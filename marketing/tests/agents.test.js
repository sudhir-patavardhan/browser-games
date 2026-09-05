/**
 * The gate between an Agent and the Producer (§6, ADR 0006).
 *
 * The property under test is the one the whole design rests on: an Agent
 * proposes and only the Producer executes. So every rule that costs money or
 * credibility — the Caps, the budget ladder, the write budget, the Channel
 * gate — must be enforced in `accept`, where a persuasive Agent cannot talk
 * its way past it, and never only in a prompt.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { validate } from '../src/agents/validate.js';
import { ROLES } from '../src/agents/index.js';
import { checkPlan } from '../src/agents/strategist/accept.js';
import { budgetCeiling, checkProposal, OPENING_DAILY_USD } from '../src/agents/media-buyer/accept.js';
import { awaitingPostMortem } from '../src/agents/performance-analyst/prepare.js';
import { renderBriefing } from '../src/agents/chief-of-staff/accept.js';
import { nextWeekOf } from '../src/agents/strategist/prepare.js';
import { deskSteps, planningSteps } from '../src/producer/cycles.js';
import { noNetwork } from './helpers.js';

noNetwork();

// --- the validator -------------------------------------------------------

test('the validator names what is wrong, by path', () => {
  const schema = {
    type: 'object',
    required: ['a'],
    properties: { a: { type: 'string' }, n: { type: 'number', minimum: 1 } }
  };
  assert.deepEqual(validate({ a: 'yes' }, schema), []);
  assert.match(validate({}, schema)[0], /output\.a: required/);
  assert.match(validate({ a: 1 }, schema)[0], /output\.a: expected string, got number/);
  assert.match(validate({ a: 'x', n: 0 }, schema)[0], /output\.n: 0 is below the minimum 1/);
});

test('an unknown field is rejected rather than quietly stored', () => {
  const schema = { type: 'object', properties: { a: { type: 'string' } }, additionalProperties: false };
  assert.match(validate({ a: 'x', sneaky: true }, schema)[0], /sneaky: not a field this role writes/);
});

test('null is a type, not an absence', () => {
  assert.deepEqual(validate(null, { type: ['string', 'null'] }), []);
  assert.equal(validate(null, { type: 'string' }).length, 1);
});

test('every role has all four parts', async () => {
  for (const role of ROLES) {
    for (const part of ['prepare', 'schema', 'accept']) {
      const mod = await import(`../src/agents/${role}/${part}.js`);
      const wanted = part === 'schema' ? 'schema' : part;
      assert.ok(mod[wanted], `${role}/${part}.js exports no ${wanted}`);
    }
    const { readFileSync } = await import('node:fs');
    const prompt = readFileSync(new URL(`../src/agents/${role}/PROMPT.md`, import.meta.url), 'utf8');
    assert.ok(prompt.length > 500, `${role} has no real PROMPT.md`);
  }
});

// --- the Strategist's write budget --------------------------------------

const item = (over = {}) => ({
  slot: { date: '2026-09-07', window: '09' }, channel: 'x', gameId: 'drift',
  format: 'single', angle: 'grip budget', brief: 'A brief long enough to be a brief.',
  basis: 'experiment', ...over
});

test('a Plan that runs one Game three times is rejected', () => {
  const problems = checkPlan({ items: [
    item(), item({ slot: { date: '2026-09-08', window: '09' } }), item({ slot: { date: '2026-09-09', window: '09' } })
  ] });
  assert.match(problems.join('\n'), /drift appears 3 times/);
});

test('a Plan that overruns the X write budget is rejected', () => {
  const games = ['drift', 'carrom', 'break-room', 'road-rumble'];
  const items = [];
  for (let i = 0; i < 8; i++) {
    items.push(item({ gameId: games[i % 4], slot: { date: `2026-09-0${(i % 7) + 1}`, window: ['09', '13', '17'][i % 3] } }));
  }
  assert.match(checkPlan({ items }).join('\n'), /write budget is 7 per Channel/);
});

test('two Posts cannot hold the same Slot on one Channel', () => {
  const problems = checkPlan({ items: [item(), item({ gameId: 'carrom' })] });
  assert.match(problems.join('\n'), /x 2026-09-07 09 is already taken/);
});

test('an item claiming an insight must say which one', () => {
  assert.match(checkPlan({ items: [item({ basis: 'insight' })] }).join('\n'), /must say which one/);
  assert.deepEqual(checkPlan({ items: [item({ basis: 'insight', because: 'drift: 6.6% CTR' })] }), []);
});

test('a Plan is always for next week, never this one', () => {
  // A Sunday, and the Monday after it.
  assert.equal(nextWeekOf(new Date('2026-09-06T12:00:00Z')), '2026-09-07');
  // A Monday plans the *following* Monday, not today.
  assert.equal(nextWeekOf(new Date('2026-09-07T12:00:00Z')), '2026-09-14');
});

// --- the Media Buyer's budget ladder ------------------------------------

const proposal = (over = {}) => ({
  channel: 'x', gameId: 'drift', angle: 'grip budget',
  tweetText: 'A drift game where the battery is the health bar. https://kreeda.games/drift/',
  targeting: { countries: ['IN'] },
  budget: { dailyUsd: 5, suggestedBecause: 'first Trial' },
  expectedOutcome: { estClicks: 100, estCpcUsd: 0.05, basis: 'organic CTR' },
  ...over
});

test('the first Campaign for a Game opens at $5/day, whatever is proposed', () => {
  const ceiling = budgetCeiling(proposal(), { postMortems: [] });
  assert.equal(ceiling.allowedUsd, OPENING_DAILY_USD);
  assert.match(checkProposal(proposal({ budget: { dailyUsd: 10, suggestedBecause: 'feeling lucky' } })).join('\n'),
    /above the \$5\/day this Game has earned/);
});

test('doubling is earned by the angle, not by the Game', () => {
  const postMortems = [
    { gameId: 'drift', angle: 'grip budget', label: 'Winner', dailyBudgetUsd: 5, writtenAt: '2026-09-01' }
  ];
  assert.equal(budgetCeiling(proposal(), { postMortems }).allowedUsd, 10);
  // A different angle on the same winning Game starts again at the opening bid.
  assert.equal(budgetCeiling(proposal({ angle: 'one more run' }), { postMortems }).allowedUsd, OPENING_DAILY_USD);
});

test('doubling never breaches the per-Campaign Cap', () => {
  const postMortems = [{ gameId: 'drift', angle: 'grip budget', label: 'Winner', dailyBudgetUsd: 10, writtenAt: '2026-09-01' }];
  assert.equal(budgetCeiling(proposal(), { postMortems }).allowedUsd, 10);
});

test('two consecutive Losers stop a Game getting money at all', () => {
  const postMortems = [
    { gameId: 'drift', angle: 'b', label: 'Loser', writtenAt: '2026-09-02' },
    { gameId: 'drift', angle: 'a', label: 'Loser', writtenAt: '2026-09-01' }
  ];
  const ceiling = budgetCeiling(proposal(), { postMortems });
  assert.equal(ceiling.allowedUsd, 0);
  assert.match(ceiling.problems.join('\n'), /propose \$0\/day and say what must change/);
});

test('ad copy carries no hashtags, no mentions and no attribution of its own', () => {
  assert.match(checkProposal(proposal({ tweetText: 'Play #drift now https://kreeda.games/drift/' })).join('\n'), /no hashtags/);
  assert.match(checkProposal(proposal({ tweetText: 'Play @kreeda now https://kreeda.games/drift/' })).join('\n'), /no @mentions/);
  assert.match(checkProposal(proposal({ tweetText: 'https://kreeda.games/drift/?utm_source=x' })).join('\n'), /bare catalog URL/);
});

test('Facebook Campaigns wait until X has four judged Trials', () => {
  const two = [
    { channel: 'x', status: 'ended' }, { channel: 'x', status: 'paused' }
  ];
  assert.match(checkProposal(proposal({ channel: 'facebook' }), { ledger: two }).join('\n'), /4 judged Trials \(there are 2\)/);

  const four = [...two, { channel: 'x', status: 'ended' }, { channel: 'x', status: 'ended' }];
  assert.equal(checkProposal(proposal({ channel: 'facebook' }), { ledger: four }).length, 0);
});

test('nothing is proposed when the Caps are already committed', () => {
  const ledger = [{ status: 'active', dailyBudgetUsd: 10 }, { status: 'active', dailyBudgetUsd: 10 }];
  assert.match(checkProposal(proposal(), { ledger }).join('\n'), /already active, and the Cap is 2/);
});

// --- the Performance Analyst's queue ------------------------------------

test('only a finished Campaign with no Post-mortem is written up, oldest first', () => {
  const ledger = [
    { id: 'a', status: 'active', launchedAt: '2026-09-01' },
    { id: 'b', status: 'ended', endedAt: '2026-09-04' },
    { id: 'c', status: 'paused', pausedAt: '2026-09-02' },
    { id: 'd', status: 'ended', endedAt: '2026-09-03' },
    { id: 'e', status: 'simulated', launchedAt: '2026-09-01' }
  ];
  const queue = awaitingPostMortem(ledger, [{ campaignId: 'd' }]);
  assert.deepEqual(queue.map(c => c.id), ['c', 'b'], 'active, simulated and already-written are all out');
});

// --- the Cycles ----------------------------------------------------------

test('the Morning desk asks for a Post-mortem per finished Campaign, and skips the Media Buyer with no headroom', () => {
  const ledger = [
    { id: 'a', name: 'A', status: 'ended', endedAt: '2026-09-03', dailyBudgetUsd: 5 },
    { id: 'b', name: 'B', status: 'active', dailyBudgetUsd: 10 },
    { id: 'c', name: 'C', status: 'active', dailyBudgetUsd: 10 }
  ];
  const steps = deskSteps({ ledger, postMortems: [] });
  assert.equal(steps[0].role, 'analyst');
  assert.deepEqual(steps.filter(s => s.role === 'performance-analyst').map(s => s.campaignId), ['a']);
  const skipped = steps.find(s => s.skipped === 'media-buyer');
  assert.ok(skipped, 'two active Campaigns means nothing to buy');
  assert.match(skipped.why, /already active/);
});

test('Planning runs the Analyst in full, then the Strategist, then the Briefing', () => {
  assert.deepEqual(planningSteps().map(s => s.role), ['analyst', 'strategist', 'chief-of-staff']);
  assert.equal(planningSteps()[0].options.full, true, 'the Sunday read is the 28-day one');
});

// --- the Briefing --------------------------------------------------------

test('the Briefing always has all six sections, even in a silent week', () => {
  const page = renderBriefing({
    weekEnding: '2026-09-06',
    headline: [{ metric: 'Players', value: 'unmeasured', wow: null }],
    whatWeDid: [], whatWorked: [], whatDidnt: [], systemDecisions: [], cmoDecisions: [], nextWeek: []
  });
  for (const heading of ['The numbers', 'What we did', 'What worked', 'What did not', 'What the system decided', 'Decisions needed from you', 'Next week']) {
    assert.ok(page.includes(`## ${heading}`), `the Briefing dropped "${heading}"`);
  }
  assert.match(page, /Nothing is waiting on you/);
});

test('the Briefing puts the evidence next to the claim', () => {
  const page = renderBriefing({
    weekEnding: '2026-09-06',
    headline: [{ metric: 'Players', value: '31', wow: '+12%' }],
    whatWeDid: [], whatWorked: [{ point: 'Drift is converting', evidence: '6.6% CTR on 1,587 impressions' }],
    whatDidnt: [], systemDecisions: [], cmoDecisions: [], nextWeek: ['Two Posts for Drift']
  });
  assert.match(page, /\*\*Players:\*\* 31 \(\+12% week on week\)/);
  assert.match(page, /Drift is converting — 6\.6% CTR on 1,587 impressions/);
});
