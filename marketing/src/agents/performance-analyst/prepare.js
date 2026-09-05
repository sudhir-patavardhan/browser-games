/**
 * The Performance Analyst's inputs (AGENTS_SPEC.md §6.5).
 *
 * One Campaign that has finished, and everything needed to say whether it was
 * worth it: what it promised, what it cost, and how many people actually
 * played afterwards. The last of those only exists in GA4, read back through
 * the attribution the Producer put on the link (§7).
 *
 * A Campaign is "awaiting a Post-mortem" when it reached Ended or Paused and
 * nothing has been written about it yet — which is why the Ended Verdict had
 * to exist before this Agent could.
 */

import fs from 'node:fs';
import path from 'node:path';
import { config } from '../../config.js';
import { GAME_CATALOG } from '../../knowledge/catalog.js';
import { GA4 } from '../../insights/ga4.js';

const read = (file, fallback) => {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return fallback; }
};

const FINISHED = ['ended', 'paused'];

/** Every finished Campaign nobody has written up yet, oldest first. */
export function awaitingPostMortem(ledger = [], postMortems = []) {
  const done = new Set(postMortems.map(m => m.campaignId));
  return ledger
    .filter(c => FINISHED.includes(c.status) && !done.has(c.id))
    .sort((a, b) => new Date(a.endedAt || a.pausedAt || a.launchedAt) - new Date(b.endedAt || b.pausedAt || b.launchedAt));
}

export async function prepare({ now = new Date(), campaignId = null } = {}) {
  const ledger = read(config.ads.ledgerFile, []);
  const stored = read(config.ads.learningsFile, []);
  const postMortems = Array.isArray(stored) ? stored : [];
  const proposals = read(path.join(config.paths.data, 'ads-proposals.json'), []);

  const queue = awaitingPostMortem(ledger, postMortems);
  const campaign = campaignId ? ledger.find(c => c.id === campaignId) : queue[0];

  if (!campaign) {
    return {
      summary: 'No Campaign has finished without a Post-mortem — nothing to write.',
      campaign: null,
      remaining: 0
    };
  }

  // What it promised, if a Media Buyer proposed it. A Campaign launched by
  // hand has no promise, and the Post-mortem has to say so rather than invent
  // one to beat.
  const proposal = (Array.isArray(proposals) ? proposals : [])
    .find(p => p.gameId === campaign.gameId && p.angle === campaign.angle && ['approved', 'launched'].includes(p.status));

  const ga4 = new GA4();
  let players = { available: false, reason: 'GA4 is not configured, so the Players this Campaign brought are unknown. Judge it on clicks and say the cost per Player is unmeasured.' };
  if (ga4.isConfigured) {
    try {
      const days = Math.max(7, Math.ceil((now - new Date(campaign.launchedAt)) / 86_400_000) + 3);
      const byCampaign = await ga4.attributed({ by: 'campaign', days });
      // The Producer's decoration puts the Campaign's own id in utm_campaign,
      // but a hand-launched Campaign may carry the Category instead, so both
      // the id and the Game are offered rather than one guess.
      players = {
        available: true,
        forThisCampaign: byCampaign[campaign.campaignId] || byCampaign[campaign.id] || null,
        allCampaigns: byCampaign
      };
    } catch (err) {
      players = { available: false, reason: `GA4 refused the query: ${err.message}` };
    }
  }

  const spend = campaign.lastStats?.spendUsd ?? null;
  const clicks = campaign.lastStats?.clicks ?? null;

  return {
    summary: `Post-mortem for ${campaign.name} (${campaign.status}); ${queue.length - 1} other Campaign(s) waiting`,
    campaign: {
      id: campaign.id,
      campaignId: campaign.campaignId,
      channel: campaign.channel || 'x',
      name: campaign.name,
      gameId: campaign.gameId,
      gameName: GAME_CATALOG[campaign.gameId]?.name || campaign.gameId,
      category: GAME_CATALOG[campaign.gameId]?.category || null,
      angle: campaign.angle,
      creative: campaign.tweetText || campaign.message || null,
      headline: campaign.headline || null,
      targeting: campaign.targeting || null,
      dailyBudgetUsd: campaign.dailyBudgetUsd,
      launchedAt: campaign.launchedAt,
      endsAt: campaign.endsAt,
      // Ended means the Trial ran its course; Paused means a kill rule fired,
      // and `pausedReason` says which.
      verdict: campaign.status,
      endedAt: campaign.endedAt || campaign.pausedAt || null,
      pausedReason: campaign.pausedReason || null,
      delivered: campaign.lastStats || null,
      history: campaign.history || [],
      costPerClickUsd: clicks ? Number((spend / clicks).toFixed(3)) : null
    },
    promised: proposal?.expectedOutcome ?? null,
    promisedBy: proposal?.id ?? null,
    players,
    previousForGame: postMortems.filter(m => m.gameId === campaign.gameId),
    remaining: Math.max(0, queue.length - 1)
  };
}
