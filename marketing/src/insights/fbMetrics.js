/**
 * What a published Post earned on the Facebook Channel.
 *
 * The mirror of xMetrics for the other Channel: it walks the Posts the
 * Producer published to the Page, pulls their insights, and writes
 * fb-metrics.json for the Analyst to read (§4, §11).
 */

import fs from 'node:fs';
import path from 'node:path';
import { config } from '../config.js';
import { FACEBOOK, toChannel, isChannel } from '../knowledge/channels.js';
import { GRAPH_VERSION } from '../publishers/facebookAccess.js';

/**
 * The Page-post metrics that mean something to the Analyst. Reach and
 * impressions size the audience; the click metrics are what the funnel needs.
 */
const METRICS = [
  'post_impressions',
  'post_impressions_unique',
  'post_clicks',
  'post_reactions_by_type_total'
];

export class FbMetrics {
  constructor(cfg = config.platforms.facebook, file = path.join(config.paths.data, 'fb-metrics.json')) {
    this.cfg = cfg;
    this.file = file;
  }

  get isConfigured() {
    return Boolean(this.cfg.pageToken && this.cfg.pageId);
  }

  load() {
    if (!fs.existsSync(this.file)) return { updatedAt: null, posts: {} };
    try { return JSON.parse(fs.readFileSync(this.file, 'utf8')); } catch { return { updatedAt: null, posts: {} }; }
  }

  save(store) {
    fs.writeFileSync(this.file, `${JSON.stringify(store, null, 2)}\n`);
  }

  /** Insights for one Page post, flattened to the numbers the Analyst uses. */
  async fetchOne(postId) {
    const url = new URL(`https://graph.facebook.com/${GRAPH_VERSION}/${postId}/insights`);
    url.searchParams.set('metric', METRICS.join(','));
    url.searchParams.set('access_token', this.cfg.pageToken);

    const res = await fetch(url);
    const body = await res.json().catch(() => ({}));
    if (!res.ok || body.error) {
      throw new Error(`Page insights for ${postId} failed: ${body.error?.message || res.status}`);
    }

    const value = name => {
      const row = (body.data || []).find(d => d.name === name);
      const v = row?.values?.[0]?.value;
      return typeof v === 'object' && v !== null
        ? Object.values(v).reduce((a, b) => a + b, 0)
        : (v || 0);
    };

    const impressions = value('post_impressions');
    const clicks = value('post_clicks');
    return {
      impressions,
      reach: value('post_impressions_unique'),
      clicks,
      reactions: value('post_reactions_by_type_total'),
      // Facebook counts every click on the Post, not link clicks alone, so
      // this reads high next to X. The Analyst compares it with itself.
      clickRatePercent: impressions > 0 ? Number(((clicks / impressions) * 100).toFixed(2)) : 0
    };
  }

  /**
   * Refreshes every live Facebook Post in the queue.
   * @param {Array} posts the queue.
   * @returns {Promise<{ fetched: number, failed: number, store: Object }>}
   */
  async refresh(posts = []) {
    const store = this.load();
    if (!this.isConfigured) return { fetched: 0, failed: 0, store };

    const live = posts.filter(p =>
      isChannel(p.channel) && toChannel(p.channel) === FACEBOOK &&
      p.publishResult?.mode === 'live' && p.publishResult?.postId
    );

    let fetched = 0;
    let failed = 0;
    for (const post of live) {
      const id = post.publishResult.postId;
      try {
        store.posts[id] = {
          gameId: post.gameId,
          publishedAt: post.publishResult.publishedAt,
          latest: await this.fetchOne(id),
          updatedAt: new Date().toISOString()
        };
        fetched++;
      } catch (err) {
        // One unreadable Post must not cost the Cycle the rest of them.
        store.posts[id] = { ...(store.posts[id] || {}), gameId: post.gameId, error: err.message };
        failed++;
      }
    }

    store.updatedAt = new Date().toISOString();
    this.save(store);
    return { fetched, failed, store };
  }

  /** Per-Game totals, best click rate first. */
  summarizeByGame(store = this.load()) {
    const byGame = {};
    for (const entry of Object.values(store.posts || {})) {
      if (!entry.latest) continue;
      const g = (byGame[entry.gameId] ||= { posts: 0, impressions: 0, reach: 0, clicks: 0, reactions: 0 });
      g.posts++;
      g.impressions += entry.latest.impressions;
      g.reach += entry.latest.reach;
      g.clicks += entry.latest.clicks;
      g.reactions += entry.latest.reactions;
    }
    for (const g of Object.values(byGame)) {
      g.clickRatePercent = g.impressions > 0 ? Number(((g.clicks / g.impressions) * 100).toFixed(2)) : 0;
    }
    return Object.fromEntries(
      Object.entries(byGame).sort((a, b) => b[1].clickRatePercent - a[1].clickRatePercent)
    );
  }
}
