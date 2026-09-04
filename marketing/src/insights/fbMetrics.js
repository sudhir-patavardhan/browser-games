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
 * The Page-post metrics Graph v21 still has.
 *
 * Meta removed every post-level impressions metric — `post_impressions`,
 * `post_impressions_unique`, `post_impressions_organic` and
 * `post_engaged_users` are all rejected as "not a valid insights metric".
 * There is no post-level reach or impression number on Facebook any more, so
 * there is no honest click-through *rate* to report either.
 *
 * What remains is what people did, not how many saw it. The rest of the
 * funnel comes from GA4, which counts sessions and Players against the
 * utm_content on the link (§7) — and that was always the better source.
 */
const METRICS = [
  'post_clicks',
  'post_clicks_by_type',
  'post_reactions_by_type_total',
  'post_video_views'
];

/** Which of the click types in post_clicks_by_type is a click on our link. */
const LINK_CLICK_KEYS = ['link clicks', 'other clicks'];

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

    const raw = name => (body.data || []).find(d => d.name === name)?.values?.[0]?.value;
    const total = value => (typeof value === 'object' && value !== null
      ? Object.values(value).reduce((a, b) => a + (Number(b) || 0), 0)
      : Number(value) || 0);

    const byType = raw('post_clicks_by_type');
    const linkClicks = typeof byType === 'object' && byType !== null
      ? Object.entries(byType).filter(([k]) => LINK_CLICK_KEYS.includes(k.toLowerCase())).reduce((a, [, v]) => a + (Number(v) || 0), 0)
      : 0;

    return {
      clicks: total(raw('post_clicks')),
      linkClicks,
      reactions: total(raw('post_reactions_by_type_total')),
      videoViews: total(raw('post_video_views')),
      // Graph v21 has no post-level impressions, so there is no rate to give.
      impressions: null
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

  /** Per-Game totals, most link clicks first. */
  summarizeByGame(store = this.load()) {
    const byGame = {};
    for (const entry of Object.values(store.posts || {})) {
      if (!entry.latest) continue;
      const g = (byGame[entry.gameId] ||= { posts: 0, clicks: 0, linkClicks: 0, reactions: 0, videoViews: 0 });
      g.posts++;
      g.clicks += entry.latest.clicks || 0;
      g.linkClicks += entry.latest.linkClicks || 0;
      g.reactions += entry.latest.reactions || 0;
      g.videoViews += entry.latest.videoViews || 0;
    }
    return Object.fromEntries(
      Object.entries(byGame).sort((a, b) => b[1].linkClicks - a[1].linkClicks || b[1].clicks - a[1].clicks)
    );
  }
}
