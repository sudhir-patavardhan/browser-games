/**
 * The two Cycles a session drives (AGENTS_SPEC.md §5, ADR 0005, ADR 0006).
 *
 * The Publish Cycle is the Producer alone and runs itself. The Morning desk
 * and Planning cannot: their steps are Agents, and an Agent is the routine's
 * own session. So the Producer does the part it can — it works out which steps
 * are due today and prepares each one's inputs — and hands the session an
 * ordered list.
 *
 * This is deliberately not an orchestrator. It never accepts on the session's
 * behalf: `accept` is the gate, and a gate that opens itself is not one.
 */

import fs from 'node:fs';
import path from 'node:path';
import { config } from '../config.js';
import { prepare } from '../agents/index.js';
import { awaitingPostMortem } from '../agents/performance-analyst/prepare.js';

const read = (file, fallback) => {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return fallback; }
};

/**
 * Which Agents the Morning desk needs today, and why (§5, §6).
 *
 * The Analyst always runs. The Performance Analyst runs once per finished
 * Campaign. The Media Buyer runs only when there is room under the Caps —
 * proposing a Campaign that cannot launch wastes the CMO's attention in the
 * Review, which is the scarcest thing in the system.
 */
export function deskSteps({ ledger = null, postMortems = null } = {}) {
  const campaigns = ledger ?? read(config.ads.ledgerFile, []);
  const stored = postMortems ?? read(config.ads.learningsFile, []);
  const mortems = Array.isArray(stored) ? stored : [];

  const steps = [{ role: 'analyst', why: 'the daily read of the funnel' }];

  for (const campaign of awaitingPostMortem(campaigns, mortems)) {
    steps.push({
      role: 'performance-analyst',
      why: `${campaign.name} reached ${campaign.status} and has no Post-mortem`,
      campaignId: campaign.id
    });
  }

  const active = campaigns.filter(c => c.status === 'active');
  const committed = active.reduce((sum, c) => sum + (c.dailyBudgetUsd || 0), 0);
  const headroom = config.ads.maxTotalDailyUsd - committed;
  if (active.length < config.ads.maxActiveCampaigns && headroom >= 1) {
    steps.push({ role: 'media-buyer', why: `$${headroom.toFixed(2)}/day of headroom and ${active.length}/${config.ads.maxActiveCampaigns} Campaigns active` });
  } else {
    steps.push({
      role: null,
      skipped: 'media-buyer',
      why: active.length >= config.ads.maxActiveCampaigns
        ? `${active.length} Campaign(s) already active (max ${config.ads.maxActiveCampaigns})`
        : `only $${headroom.toFixed(2)}/day of headroom left`
    });
  }

  return steps;
}

/** Planning runs the same three Agents every Sunday, in this order (§5.3). */
export function planningSteps() {
  return [
    { role: 'analyst', why: 'the full 28-day read, before anyone plans on it', options: { full: true } },
    { role: 'strategist', why: "next week's Plan, from those insights" },
    { role: 'chief-of-staff', why: "the CMO's Briefing, once the Plan exists" }
  ];
}

/**
 * Prepares every step's inputs and returns the ordered list for the session.
 *
 * @returns {Promise<{ cycle, steps: Array }>} each step carries the paths the
 *          session needs and the reason it is in the list.
 */
export async function prepareCycle(cycle, { now = new Date() } = {}) {
  const plan = cycle === 'planning' ? planningSteps() : deskSteps();
  const steps = [];

  for (const step of plan) {
    if (!step.role) { steps.push(step); continue; }
    const prepared = await prepare(step.role, { now, ...(step.options || {}), ...(step.campaignId ? { campaignId: step.campaignId } : {}) });
    steps.push({ ...step, ...prepared });
  }

  return { cycle, steps };
}

/** What the session should see: the order, the reason, and the three paths. */
export function renderCycle({ cycle, steps }) {
  const title = cycle === 'planning' ? 'PLANNING CYCLE' : 'MORNING DESK';
  const out = [``, `🧠 ${title} — ${steps.filter(s => s.role).length} Agent step(s)`, ``];

  let n = 0;
  for (const step of steps) {
    if (!step.role) {
      out.push(`  —  ${step.skipped}: skipped — ${step.why}`, ``);
      continue;
    }
    n += 1;
    out.push(`  ${n}. ${step.role} — ${step.why}`);
    out.push(`       ${step.summary}`);
    out.push(`       prompt  ${path.relative(config.paths.marketing, step.prompt)}`);
    out.push(`       input   ${path.relative(config.paths.marketing, step.input)}`);
    out.push(`       answer  ${path.relative(config.paths.marketing, step.output)}`);
    out.push(`       then    node cli.js agent accept ${step.role}`, ``);
  }

  out.push(`  Read each prompt, write each answer, and accept it before the next step:`);
  out.push(`  a later Agent reads what an earlier one wrote.`, ``);
  return out.join('\n');
}
