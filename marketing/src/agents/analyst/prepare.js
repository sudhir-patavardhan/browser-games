/**
 * The Analyst's inputs (AGENTS_SPEC.md §6.1).
 *
 * Everything the funnel is made of, joined into one file: what each Post
 * earned on its Channel, what each Campaign spent, and what GA4 says actually
 * happened on the page afterwards. The Analyst's job is to read impressions
 * through to Players; this gathers both ends so it never has to guess at the
 * middle.
 */

import fs from 'node:fs';
import path from 'node:path';
import { config } from '../../config.js';
import { GAME_CATALOG, CATEGORIES } from '../../knowledge/catalog.js';
import { GA4 } from '../../insights/ga4.js';
import { WINDOWS } from '../../producer/post.js';

const read = (file, fallback) => {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return fallback; }
};

const dataFile = name => path.join(config.paths.data, name);

/** The last reading of a metrics history, or zeros if it was never read. */
const latest = history => (Array.isArray(history) && history.length ? history[history.length - 1] : null);

/**
 * @param {Object} [opts]
 * @param {boolean} [opts.full] the Sunday pass: a 28-day window instead of 7.
 */
export async function prepare({ now = new Date(), full = false, days = null } = {}) {
  const window = days || (full ? 28 : 7);
  const since = new Date(now.getTime() - window * 86_400_000);

  const queue = read(config.paths.queueFile, []);
  const postMetrics = read(config.paths.postMetricsFile, { tweets: {} });
  const fbMetrics = read(dataFile('fb-metrics.json'), { posts: {} });
  const ledger = read(config.ads.ledgerFile, []);
  const learnings = read(config.ads.learningsFile, []);

  const byId = Object.fromEntries(queue.map(p => [p.id, p]));
  const published = queue.filter(p => p.status === 'published' && p.publishResult?.postId);

  // One row per published Post: what the Channel reported, and enough of the
  // Post to tell the Analyst which Game, angle and Window earned it.
  const posts = published.map(post => {
    const id = post.publishResult.postId;
    const x = latest(postMetrics.tweets?.[id]?.history);
    const fb = fbMetrics.posts?.[id]?.latest;
    const reported = x || fb || null;
    const impressions = reported?.impressions ?? null;
    const linkClicks = reported?.linkClicks ?? 0;

    return {
      postId: post.id,
      channelPostId: id,
      channel: post.channel,
      gameId: post.gameId,
      category: post.category || GAME_CATALOG[post.gameId]?.category || null,
      angle: post.angle || null,
      format: post.format || null,
      slot: post.slot || null,
      publishedAt: post.publishResult.publishedAt || null,
      impressions,
      linkClicks,
      likes: reported?.likes ?? reported?.reactions ?? 0,
      ctrPercent: impressions ? Number(((linkClicks / impressions) * 100).toFixed(2)) : null,
      // §6.1: below a hundred impressions there is nothing to read.
      signal: impressions == null ? 'not read yet' : impressions < 100 ? 'no signal' : 'readable'
    };
  }).filter(p => !p.publishedAt || new Date(p.publishedAt) >= since);

  const campaigns = ledger.filter(c => c.status !== 'simulated').map(c => ({
    id: c.id,
    channel: c.channel || 'x',
    gameId: c.gameId,
    angle: c.angle,
    status: c.status,
    dailyBudgetUsd: c.dailyBudgetUsd,
    launchedAt: c.launchedAt,
    endsAt: c.endsAt,
    endedAt: c.endedAt || null,
    pausedReason: c.pausedReason || null,
    lastStats: c.lastStats || null
  }));

  // GA4 is the only place Players exist. When it is not reachable the Analyst
  // is told so plainly rather than being handed silent zeros it would read as
  // "nobody played".
  const ga4 = new GA4();
  let players = { available: false, reason: 'GA4 is not configured — set GA4_PROPERTY_ID and GA4_SA_KEY. Without it there are no Players, only clicks.' };
  if (ga4.isConfigured) {
    try {
      const [byGame, byPost, byCampaign, byHour] = await Promise.all([
        ga4.funnelByGame({ days: window }),
        ga4.attributed({ by: 'content', days: window }),
        ga4.attributed({ by: 'campaign', days: window }),
        ga4.playersByHour({ days: window })
      ]);
      players = { available: true, byGame, byPost, byCampaign, byHour };
    } catch (err) {
      players = { available: false, reason: `GA4 refused the query: ${err.message}` };
    }
  }

  const readable = posts.filter(p => p.signal === 'readable').length;
  return {
    summary: `${posts.length} published Post(s) over ${window} days (${readable} with enough impressions to read), ${campaigns.length} Campaign(s), Players ${players.available ? 'from GA4' : 'unavailable'}`,
    window: { days: window, from: since.toISOString(), to: now.toISOString(), full },
    catalog: {
      categories: CATEGORIES,
      games: Object.values(GAME_CATALOG)
        .filter(g => g.id && g.id !== 'hub')
        .map(g => ({ id: g.id, name: g.name, category: g.category || null }))
    },
    windows: WINDOWS,
    posts,
    campaigns,
    postMortems: Array.isArray(learnings) ? learnings : (learnings?.records || []),
    players,
    queueDepth: {
      draft: queue.filter(p => p.status === 'draft').length,
      inReview: queue.filter(p => p.status === 'in_review').length,
      approved: queue.filter(p => p.status === 'approved').length
    }
  };
}
