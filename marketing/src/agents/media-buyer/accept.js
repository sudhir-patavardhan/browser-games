/**
 * The Agent proposes, `adsPolicy.js` disposes (AGENTS_SPEC.md §6.4).
 *
 * A proposal is written to `ads-proposals.json` as `proposed`; nothing spends
 * until the CMO ticks it in a Review and the Producer launches it. What
 * happens here is the part that must never depend on the Agent's good
 * intentions: the Caps, the budget ladder, the Channel gate and the copy rules.
 */

import fs from 'node:fs';
import path from 'node:path';
import { config } from '../../config.js';
import { GAME_CATALOG } from '../../knowledge/catalog.js';
import { ADS_POLICY, evaluateLaunchBudget } from '../../ads/adsPolicy.js';
import { RejectedOutput } from '../validate.js';
import { judgedXTrials, JUDGED_TRIALS_BEFORE_FACEBOOK } from './prepare.js';

const read = (file, fallback) => {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return fallback; }
};

/** The first Campaign for a Game is always the small one. */
export const OPENING_DAILY_USD = 5;

/**
 * The budget ladder (§6.4), applied to what the Post-mortems actually say.
 *
 * @returns {{ allowedUsd: number, problems: string[], reason: string }}
 */
export function budgetCeiling(proposal, { ledger = [], postMortems = [] } = {}) {
  const problems = [];
  const forGame = postMortems
    .filter(m => m.gameId === proposal.gameId)
    .sort((a, b) => new Date(b.writtenAt || 0) - new Date(a.writtenAt || 0));

  // Two consecutive Losers is the Game telling us to stop, not to try harder.
  if (forGame.length >= 2 && forGame[0].label === 'Loser' && forGame[1].label === 'Loser') {
    if (proposal.budget.dailyUsd > 0) {
      problems.push(`${proposal.gameId} has two consecutive Losers; propose $0/day and say what must change before it earns money again`);
    }
    return { allowedUsd: 0, problems, reason: 'two consecutive Losers' };
  }

  if (forGame.length === 0) {
    return { allowedUsd: OPENING_DAILY_USD, problems, reason: `the first Campaign for ${proposal.gameId} opens at $${OPENING_DAILY_USD}/day` };
  }

  // Doubling is earned by a Winner on this Game *and* this angle, never by a
  // Winner on the Game alone: the angle is what the money is buying.
  const lastForAngle = forGame.find(m => m.angle === proposal.angle);
  const previous = lastForAngle?.dailyBudgetUsd ?? OPENING_DAILY_USD;
  if (lastForAngle?.label === 'Winner') {
    const allowed = Math.min(previous * 2, ADS_POLICY.maxDailyPerCampaignUsd);
    return { allowedUsd: allowed, problems, reason: `"${proposal.angle}" was a Winner at $${previous}/day, so up to $${allowed}/day` };
  }

  return {
    allowedUsd: OPENING_DAILY_USD,
    problems,
    reason: lastForAngle
      ? `"${proposal.angle}" was not a Winner last time, so it starts again at $${OPENING_DAILY_USD}/day`
      : `no Post-mortem for "${proposal.angle}" yet, so it opens at $${OPENING_DAILY_USD}/day`
  };
}

/** §9.3, and the Caps. Everything a proposal must satisfy before it is filed. */
export function checkProposal(proposal, { ledger = [], postMortems = [] } = {}) {
  const problems = [];

  if (!GAME_CATALOG[proposal.gameId] || proposal.gameId === 'hub') {
    problems.push(`gameId: "${proposal.gameId}" is not a Game on the hub`);
  }
  if (/#\w/.test(proposal.tweetText)) problems.push('tweetText: ad copy carries no hashtags (rule 3)');
  if (/@\w/.test(proposal.tweetText)) problems.push('tweetText: ad copy carries no @mentions (rule 3)');
  if (/[?&]utm_/.test(proposal.tweetText)) problems.push('tweetText: use the bare catalog URL — the Producer decorates it (§7)');

  if (proposal.channel === 'facebook') {
    const judged = judgedXTrials(ledger);
    if (judged < JUDGED_TRIALS_BEFORE_FACEBOOK) {
      problems.push(`channel: Facebook Campaigns wait until X has ${JUDGED_TRIALS_BEFORE_FACEBOOK} judged Trials (there are ${judged})`);
    }
  }

  const active = ledger.filter(c => c.status === 'active');
  if (active.length >= config.ads.maxActiveCampaigns) {
    problems.push(`${active.length} Campaign(s) already active, and the Cap is ${config.ads.maxActiveCampaigns}`);
  }

  const ceiling = budgetCeiling(proposal, { ledger, postMortems });
  problems.push(...ceiling.problems);

  if (proposal.budget.dailyUsd > ceiling.allowedUsd) {
    problems.push(`budget.dailyUsd: $${proposal.budget.dailyUsd}/day is above the $${ceiling.allowedUsd}/day this Game has earned — ${ceiling.reason}`);
  }

  const headroom = evaluateLaunchBudget(proposal.budget.dailyUsd, active);
  if (proposal.budget.dailyUsd > 0 && !headroom.ok) problems.push(`budget: ${headroom.reason}`);

  return problems;
}

export async function accept(output, { now = new Date(), dryRun = false } = {}) {
  const ledger = read(config.ads.ledgerFile, []);
  const stored = read(config.ads.learningsFile, []);
  const postMortems = Array.isArray(stored) ? stored : [];

  const problems = checkProposal(output, { ledger, postMortems });
  if (problems.length) throw new RejectedOutput('media-buyer', problems);

  const file = path.join(config.paths.data, 'ads-proposals.json');
  const proposals = read(file, []);
  const trialDays = output.budget.trialDays || ADS_POLICY.trialDays;

  const proposal = {
    id: `prop-${now.getTime()}-${Math.random().toString(36).slice(2, 6)}`,
    proposedAt: now.toISOString(),
    // Nothing spends on a proposal. The CMO ticking it in a Review is what
    // turns this into a Campaign.
    status: 'proposed',
    channel: output.channel,
    gameId: output.gameId,
    category: output.category || GAME_CATALOG[output.gameId]?.category || null,
    angle: output.angle,
    tweetText: output.tweetText,
    headline: output.headline ?? null,
    creative: output.creative ?? { type: 'text', assetUrl: null },
    targeting: output.targeting,
    budget: {
      dailyUsd: output.budget.dailyUsd,
      trialDays,
      totalCapUsd: output.budget.totalCapUsd || output.budget.dailyUsd * trialDays,
      suggestedBecause: output.budget.suggestedBecause
    },
    expectedOutcome: output.expectedOutcome
  };

  if (dryRun) return { wrote: [], summary: `[dry run] would propose ${proposal.gameId} at $${proposal.budget.dailyUsd}/day` };

  fs.writeFileSync(file, `${JSON.stringify([...proposals, proposal], null, 2)}\n`);
  return {
    wrote: [file],
    summary: `${proposal.gameId} — "${proposal.angle}" on ${proposal.channel} at $${proposal.budget.dailyUsd}/day for ${trialDays} days, awaiting the CMO's tick`
  };
}
