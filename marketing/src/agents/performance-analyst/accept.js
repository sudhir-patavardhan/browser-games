/**
 * Appending a Post-mortem (AGENTS_SPEC.md §6.5).
 *
 * `ads-learnings.json` is a list of Post-mortems, newest last, and this Agent
 * is its only writer — the Media Buyer and the Chief of Staff only read it.
 * A Campaign is written up exactly once; a second Post-mortem for the same
 * Campaign is a rejection, not an update, because the budget ladder counts
 * consecutive Losers and a duplicate would double one.
 */

import fs from 'node:fs';
import { config } from '../../config.js';
import { RejectedOutput } from '../validate.js';

const read = (file, fallback) => {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return fallback; }
};

export async function accept(output, { now = new Date(), dryRun = false } = {}) {
  const file = config.ads.learningsFile;
  const stored = read(file, []);
  const postMortems = Array.isArray(stored) ? stored : [];
  const ledger = read(config.ads.ledgerFile, []);

  const campaign = ledger.find(c => c.id === output.campaignId);
  if (!campaign) {
    throw new RejectedOutput('performance-analyst', [`campaignId: no Campaign "${output.campaignId}" is in the ledger`]);
  }
  if (!['ended', 'paused'].includes(campaign.status)) {
    throw new RejectedOutput('performance-analyst', [`campaignId: ${output.campaignId} is ${campaign.status}; a Post-mortem is written once a Trial has finished`]);
  }
  if (postMortems.some(m => m.campaignId === output.campaignId)) {
    throw new RejectedOutput('performance-analyst', [`campaignId: ${output.campaignId} already has a Post-mortem`]);
  }

  const entry = {
    ...output,
    channel: output.channel || campaign.channel || 'x',
    dailyBudgetUsd: output.dailyBudgetUsd ?? campaign.dailyBudgetUsd ?? null,
    spendUsd: campaign.lastStats?.spendUsd ?? null,
    clicks: campaign.lastStats?.clicks ?? null,
    verdict: campaign.status,
    writtenAt: now.toISOString()
  };

  if (dryRun) return { wrote: [], summary: `[dry run] ${entry.label} for ${entry.gameId} — "${entry.angle}"` };

  fs.writeFileSync(file, `${JSON.stringify([...postMortems, entry], null, 2)}\n`);
  return {
    wrote: [file],
    summary: `${entry.label}: ${entry.gameId} — "${entry.angle}" `
      + `(${entry.clicks ?? '?'} clicks, $${entry.spendUsd ?? '?'})`
      + ` — next time: ${entry.changeNextTime}`
  };
}
