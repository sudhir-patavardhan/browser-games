/**
 * The Media Buyer's inputs (AGENTS_SPEC.md §6.4).
 *
 * What money could go to, what money has already learned, and exactly how much
 * room is left under the Caps. The headroom is computed here rather than left
 * to the Agent to work out, because a proposal that breaks the Caps wastes
 * everyone's turn: `accept` would reject it anyway.
 */

import fs from 'node:fs';
import path from 'node:path';
import { config } from '../../config.js';
import { GAME_CATALOG } from '../../knowledge/catalog.js';
import { DOSSIERS } from '../../knowledge/dossiers.js';
import { ADS_POLICY, evaluateLaunchBudget } from '../../ads/adsPolicy.js';
import { STORYBOARDS } from '../../studio/togetherDirector.js';

const read = (file, fallback) => {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return fallback; }
};

/** X has to have learned something before Facebook gets paid money (§6.4). */
export const JUDGED_TRIALS_BEFORE_FACEBOOK = 4;

export function judgedXTrials(ledger) {
  return ledger.filter(c => (c.channel || 'x') === 'x' && ['ended', 'paused'].includes(c.status)).length;
}

export async function prepare({ now = new Date() } = {}) {
  const insights = read(path.join(config.paths.data, 'insights.json'), null);
  const plan = read(path.join(config.paths.data, 'weekly-plan.json'), null);
  const ledger = read(config.ads.ledgerFile, []);
  const postMortems = read(config.ads.learningsFile, []);
  const proposals = read(path.join(config.paths.data, 'ads-proposals.json'), []);

  const active = ledger.filter(c => c.status === 'active');
  const committed = active.reduce((sum, c) => sum + (c.dailyBudgetUsd || 0), 0);
  const budget = evaluateLaunchBudget(ADS_POLICY.maxDailyPerCampaignUsd, active);
  const judged = judgedXTrials(ledger);

  const mortems = Array.isArray(postMortems) ? postMortems : [];
  // Per Game: what its Trials have actually taught, newest first. The budget
  // rules are written in these terms, so the Agent gets them in these terms.
  const historyByGame = {};
  for (const m of [...mortems].sort((a, b) => new Date(b.writtenAt || 0) - new Date(a.writtenAt || 0))) {
    (historyByGame[m.gameId] ||= []).push({ angle: m.angle, label: m.label, costPerPlayerUsd: m.costPerPlayerUsd ?? null, changeNextTime: m.changeNextTime });
  }

  return {
    summary: `$${(ADS_POLICY.maxTotalDailyUsd - committed).toFixed(2)}/day headroom, ${active.length}/${config.ads.maxActiveCampaigns} Campaigns active, ${judged} judged X Trial(s), ${mortems.length} Post-mortem(s)`,
    caps: {
      maxDailyPerCampaignUsd: ADS_POLICY.maxDailyPerCampaignUsd,
      maxTotalDailyUsd: ADS_POLICY.maxTotalDailyUsd,
      trialDays: ADS_POLICY.trialDays,
      maxActiveCampaigns: config.ads.maxActiveCampaigns,
      committedDailyUsd: committed,
      headroomDailyUsd: Math.max(0, ADS_POLICY.maxTotalDailyUsd - committed),
      mayLaunch: budget.ok && active.length < config.ads.maxActiveCampaigns,
      whyNot: budget.ok ? null : budget.reason
    },
    channels: {
      x: { open: true },
      facebook: {
        // §6.4: Facebook Campaigns wait until X has taught us something.
        open: judged >= JUDGED_TRIALS_BEFORE_FACEBOOK,
        judgedXTrials: judged,
        needs: JUDGED_TRIALS_BEFORE_FACEBOOK,
        why: 'Facebook Campaigns are out of scope until X has four judged Trials.'
      }
    },
    insights,
    adsFocus: plan?.adsFocus ?? null,
    activeCampaigns: active.map(c => ({ id: c.id, gameId: c.gameId, angle: c.angle, channel: c.channel || 'x', dailyBudgetUsd: c.dailyBudgetUsd, endsAt: c.endsAt })),
    postMortems: mortems,
    historyByGame,
    openProposals: (Array.isArray(proposals) ? proposals : []).filter(p => p.status === 'proposed'),
    games: Object.values(GAME_CATALOG).filter(g => g.id && g.id !== 'hub').map(g => ({
      id: g.id, name: g.name, category: g.category || null, url: g.url,
      tagline: g.tagline || null,
      pitch: DOSSIERS[g.id]?.pitch || g.pitch || null,
      hasStoryboard: Boolean(STORYBOARDS[g.id])
    })),
    copyRules: [
      'No hashtags and no @mentions in ad copy.',
      'Use the bare catalog URL — the Producer decorates it with attribution.',
      'At most 240 characters.',
      'Honest copy only: no invented quotes, player counts, or awards.'
    ]
  };
}
