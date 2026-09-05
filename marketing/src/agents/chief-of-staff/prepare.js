/**
 * The Chief of Staff's inputs (AGENTS_SPEC.md §6.6).
 *
 * Everything, plus last week's Briefing — because a number without last week's
 * number beside it is not news, and the CMO's whole question is "is this
 * getting better?".
 */

import fs from 'node:fs';
import path from 'node:path';
import { config } from '../../config.js';
import { GAME_CATALOG } from '../../knowledge/catalog.js';
import { TOKEN_WARNING_DAYS } from '../../producer/alerts.js';

const read = (file, fallback) => {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return fallback; }
};
const readText = file => {
  try { return fs.readFileSync(file, 'utf8'); } catch { return null; }
};

export async function prepare({ now = new Date() } = {}) {
  const reports = config.paths.reports;
  const insights = read(path.join(config.paths.data, 'insights.json'), null);
  const plan = read(path.join(config.paths.data, 'weekly-plan.json'), null);
  const queue = read(config.paths.queueFile, []);
  const ledger = read(config.ads.ledgerFile, []);
  const stored = read(config.ads.learningsFile, []);
  const proposals = read(path.join(config.paths.data, 'ads-proposals.json'), []);

  const weekAgo = new Date(now.getTime() - 7 * 86_400_000);
  const inWeek = p => p.publishResult?.publishedAt && new Date(p.publishResult.publishedAt) >= weekAgo;

  const publishedThisWeek = queue.filter(p => p.status === 'published' && inWeek(p));
  const byChannel = publishedThisWeek.reduce((acc, p) => ({ ...acc, [p.channel]: (acc[p.channel] || 0) + 1 }), {});

  const spentThisWeek = ledger
    .filter(c => c.status !== 'simulated' && c.lastStats?.spendUsd)
    .filter(c => new Date(c.launchedAt) >= weekAgo)
    .reduce((sum, c) => sum + c.lastStats.spendUsd, 0);

  // The decisions only the CMO can take. Everything here is a blocker the
  // system has already noticed and cannot clear itself.
  const blockers = [];
  if (!process.env.CMO_EMAIL) blockers.push('CMO_EMAIL is unset, so the Briefing and every Alert have nowhere to be sent.');
  if (!config.platforms.facebook.adsToken) blockers.push('No Facebook Ads token: Facebook Campaigns cannot launch.');
  if (!process.env.GA4_PROPERTY_ID || !process.env.GA4_SA_KEY) {
    blockers.push('GA4 is not configured (GA4_PROPERTY_ID / GA4_SA_KEY), so Players — the north-star metric — are unmeasured and every judgement rests on clicks.');
  }
  if (config.ads.enabled && !config.ads.fundingInstrumentId) {
    blockers.push('The X Ads account has no funding instrument on file, so no X Campaign can leave dry-run.');
  }

  return {
    summary: `Week to ${now.toISOString().slice(0, 10)}: ${publishedThisWeek.length} Post(s), $${spentThisWeek.toFixed(2)} spent, ${blockers.length} blocker(s)`,
    weekEnding: now.toISOString().slice(0, 10),
    insights,
    plan,
    lastBriefing: readText(path.join(reports, 'briefing.md')),
    activity: {
      publishedThisWeek: publishedThisWeek.length,
      byChannel,
      posts: publishedThisWeek.map(p => ({
        id: p.id, channel: p.channel, gameId: p.gameId, angle: p.angle,
        gameName: GAME_CATALOG[p.gameId]?.name || p.gameId,
        slot: p.slot, url: p.publishResult?.url || null
      })),
      awaitingDecision: queue.filter(p => ['in_review', 'draft'].includes(p.status)).length,
      expiredThisWeek: queue.filter(p => p.status === 'expired').length
    },
    paid: {
      spentThisWeekUsd: Number(spentThisWeek.toFixed(2)),
      campaigns: ledger.filter(c => c.status !== 'simulated').map(c => ({
        id: c.id, gameId: c.gameId, angle: c.angle, channel: c.channel || 'x',
        status: c.status, dailyBudgetUsd: c.dailyBudgetUsd, lastStats: c.lastStats || null
      })),
      postMortems: Array.isArray(stored) ? stored : [],
      openProposals: (Array.isArray(proposals) ? proposals : []).filter(p => p.status === 'proposed')
    },
    decisionsNeeded: {
      blockers,
      postsAwaitingTick: queue.filter(p => p.status === 'in_review').length,
      proposalsAwaitingTick: (Array.isArray(proposals) ? proposals : []).filter(p => p.status === 'proposed').length,
      tokenWarningDays: TOKEN_WARNING_DAYS
    }
  };
}
