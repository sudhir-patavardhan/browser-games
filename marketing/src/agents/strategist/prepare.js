/**
 * The Strategist's inputs (AGENTS_SPEC.md §6.2).
 *
 * Everything needed to choose next week's Games, angles, Channels and Windows
 * — and nothing that would let it choose them by rote. There is deliberately
 * no day-of-week table here: the Mon–Sun rota in campaignPlanner.js is what
 * this Agent replaces, and handing it one back would be handing back the
 * habit.
 */

import fs from 'node:fs';
import path from 'node:path';
import { config } from '../../config.js';
import { GAME_CATALOG, CATEGORIES } from '../../knowledge/catalog.js';
import { DOSSIERS } from '../../knowledge/dossiers.js';
import { AUDIENCES } from '../../knowledge/audiences.js';
import { STORYBOARDS } from '../../studio/togetherDirector.js';
import { WINDOWS } from '../../producer/post.js';

const read = (file, fallback) => {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return fallback; }
};

/** Monday of the week that starts after `now`. A Plan is always for next week. */
export function nextWeekOf(now = new Date()) {
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  // 0 is Sunday. The next Monday is 1 day away from Sunday, 7 from Monday.
  d.setUTCDate(d.getUTCDate() + ((8 - d.getUTCDay()) % 7 || 7));
  return d.toISOString().slice(0, 10);
}

export async function prepare({ now = new Date() } = {}) {
  const insights = read(path.join(config.paths.data, 'insights.json'), null);
  const queue = read(config.paths.queueFile, []);
  const ledger = read(config.ads.ledgerFile, []);
  const weekOf = nextWeekOf(now);

  // What has already gone out recently, so the Strategist can honour "no Game
  // more than twice a week" against reality rather than against its own memory.
  const fortnightAgo = new Date(now.getTime() - 14 * 86_400_000);
  const recent = queue
    .filter(p => ['published', 'approved', 'in_review'].includes(p.status))
    .filter(p => !p.slot?.date || new Date(`${p.slot.date}T00:00:00Z`) >= fortnightAgo)
    .map(p => ({ gameId: p.gameId, channel: p.channel, angle: p.angle, format: p.format, slot: p.slot, status: p.status }));

  const games = Object.values(GAME_CATALOG)
    .filter(g => g.id && g.id !== 'hub')
    .map(g => ({
      id: g.id,
      name: g.name,
      category: g.category || null,
      tagline: g.tagline || null,
      pitch: DOSSIERS[g.id]?.pitch || g.pitch || null,
      hooks: DOSSIERS[g.id]?.hooks || [],
      audiences: DOSSIERS[g.id]?.audiences || [],
      hasStoryboard: Boolean(STORYBOARDS[g.id])
    }));

  return {
    summary: `Plan for the week of ${weekOf}: ${games.length} Game(s), insights ${insights?.generatedAt ? `from ${insights.generatedAt.slice(0, 10)}` : 'MISSING'}, ${recent.length} Post(s) in the last fortnight`,
    weekOf,
    windows: WINDOWS,
    channels: ['x', 'facebook'],
    // The Strategist writes from evidence. Without insights it must label
    // every angle an experiment, and the prompt says so.
    insights,
    catalog: { categories: CATEGORIES, games },
    personas: AUDIENCES,
    storyboardedGames: Object.keys(STORYBOARDS),
    recentPosts: recent,
    queueDepth: {
      draft: queue.filter(p => p.status === 'draft').length,
      inReview: queue.filter(p => p.status === 'in_review').length,
      approved: queue.filter(p => p.status === 'approved').length
    },
    campaigns: ledger.filter(c => ['active', 'paused', 'ended'].includes(c.status))
      .map(c => ({ id: c.id, gameId: c.gameId, angle: c.angle, channel: c.channel || 'x', status: c.status, lastStats: c.lastStats || null })),
    brandRules: [
      'Play-together Games: lead with what two people find out about each other, never the one-phone mechanic.',
      'Never generic AI marketing: no rocket emoji, no "game-changer", no exclamation-mark hype.',
      'Organic copy: at most two hashtags, and only after the link.',
      'Honest copy only: no invented quotes, player counts, or awards.'
    ],
    limits: {
      postsPerChannelPerWeek: [5, 7],
      maxPostsPerGamePerWeek: 2,
      note: 'The X free tier is the reason for the write budget. The Strategist chooses the mix across Categories and Windows itself — there is no hard-coded balance.'
    }
  };
}
