import fs from 'node:fs';
import { config } from '../config.js';
import { buildOAuth1Header } from '../ads/oauth1.js';
import { X, toChannel, isChannel } from '../knowledge/channels.js';

/**
 * Pulls performance for the tweets the agent itself posted — impressions,
 * link clicks, likes, replies, reposts — and keeps a per-tweet history in
 * data/post-metrics.json. That turns organic posting into a feedback loop:
 * the ads planner and the cycle report both read the per-game summary, so the
 * agent learns which games and angles earn clicks before any budget is spent
 * (and while the Ads API approval is still pending).
 *
 * Uses GET /2/tweets with the user-context OAuth 1.0a keys: non_public_metrics
 * (impressions, url_link_clicks, user_profile_clicks) are only served for the
 * authenticated user's own tweets, and only for tweets under 30 days old.
 */
export class XMetrics {
  constructor(cfg = config.platforms.twitter, file = config.paths.postMetricsFile) {
    this.cfg = cfg;
    this.file = file;
  }

  get isConfigured() {
    return Boolean(this.cfg.apiKey && this.cfg.apiSecret && this.cfg.accessToken && this.cfg.accessTokenSecret);
  }

  load() {
    if (!fs.existsSync(this.file)) return { updatedAt: null, tweets: {} };
    try { return JSON.parse(fs.readFileSync(this.file, 'utf8')); } catch { return { updatedAt: null, tweets: {} }; }
  }

  save(store) {
    fs.writeFileSync(this.file, JSON.stringify(store, null, 2));
  }

  /**
   * Every live tweet id the agent knows about, with the game it was for:
   * queue items, the together-video history and the ads ledger.
   */
  collectLiveTweets() {
    const out = new Map();
    const isLiveId = id => typeof id === 'string' && /^\d{8,}$/.test(id);
    const read = f => { try { return fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, 'utf8')) : null; } catch { return null; } };

    for (const item of read(config.paths.queueFile) || []) {
      const id = item.publishResult?.postId;
      if (isChannel(item.channel) && toChannel(item.channel) === X && item.publishResult?.mode === 'live' && isLiveId(id)) {
        out.set(id, { gameId: item.gameId, kind: item.content?.kind || 'post', postedAt: item.publishedAt });
      }
    }
    for (const h of (read(config.together.stateFile)?.history) || []) {
      if (h.mode === 'live' && isLiveId(h.postId)) out.set(h.postId, { gameId: h.gameId, kind: 'together-video', postedAt: h.at });
    }
    for (const c of read(config.ads.ledgerFile) || []) {
      if (c.status !== 'simulated' && isLiveId(c.tweetId)) out.set(c.tweetId, { gameId: c.gameId, kind: 'ad', postedAt: c.launchedAt });
    }
    return out;
  }

  async fetch(ids) {
    const url = 'https://api.x.com/2/tweets';
    const params = { ids: ids.join(','), 'tweet.fields': 'public_metrics,non_public_metrics,created_at' };
    const auth = buildOAuth1Header({
      method: 'GET', url,
      consumerKey: this.cfg.apiKey, consumerSecret: this.cfg.apiSecret,
      accessToken: this.cfg.accessToken, tokenSecret: this.cfg.accessTokenSecret,
      signedParams: params
    });
    const res = await fetch(`${url}?${new URLSearchParams(params)}`, { headers: { Authorization: auth } });
    if (!res.ok) throw new Error(`X metrics GET /2/tweets failed [${res.status}]: ${await res.text()}`);
    const json = await res.json();
    return json.data || [];
  }

  /** Fetches fresh numbers for every known live tweet and folds them into the store. */
  async refresh() {
    const known = this.collectLiveTweets();
    const store = this.load();
    if (known.size === 0) {
      console.log('📈 No live tweets to measure yet (everything so far was draft/simulated).');
      return { fetched: 0, summary: this.summarizeByGame(store) };
    }
    if (!this.isConfigured) {
      console.log('📈 X metrics: Twitter OAuth1 keys missing — cannot fetch.');
      return { fetched: 0, summary: this.summarizeByGame(store) };
    }

    const ids = [...known.keys()];
    const now = new Date().toISOString();
    let fetched = 0;
    for (let i = 0; i < ids.length; i += 100) {
      const rows = await this.fetch(ids.slice(i, i + 100));
      for (const t of rows) {
        const meta = known.get(t.id) || {};
        const pm = t.public_metrics || {}, npm = t.non_public_metrics || {};
        const snap = {
          at: now,
          impressions: npm.impression_count ?? pm.impression_count ?? 0,
          linkClicks: npm.url_link_clicks ?? 0,
          profileClicks: npm.user_profile_clicks ?? 0,
          likes: pm.like_count ?? 0, replies: pm.reply_count ?? 0,
          reposts: (pm.retweet_count ?? 0) + (pm.quote_count ?? 0), bookmarks: pm.bookmark_count ?? 0
        };
        const rec = store.tweets[t.id] || { gameId: meta.gameId, kind: meta.kind, postedAt: meta.postedAt || t.created_at, history: [] };
        rec.latest = snap;
        rec.history = [...rec.history, snap].slice(-30);
        store.tweets[t.id] = rec;
        fetched++;
      }
    }
    store.updatedAt = now;
    this.save(store);
    const summary = this.summarizeByGame(store);
    console.log(`📈 Metrics refreshed for ${fetched} tweet(s).`);
    return { fetched, summary };
  }

  /** Per-game totals from the latest snapshot of each tweet, best CTR first. */
  summarizeByGame(store = this.load()) {
    const byGame = {};
    for (const rec of Object.values(store.tweets || {})) {
      if (!rec.latest) continue;
      const g = (byGame[rec.gameId || 'hub'] ||= { posts: 0, impressions: 0, linkClicks: 0, likes: 0, replies: 0, reposts: 0, videoPosts: 0 });
      g.posts++;
      if (rec.kind === 'together-video') g.videoPosts++;
      g.impressions += rec.latest.impressions; g.linkClicks += rec.latest.linkClicks;
      g.likes += rec.latest.likes; g.replies += rec.latest.replies; g.reposts += rec.latest.reposts;
    }
    for (const g of Object.values(byGame)) {
      g.ctrPercent = g.impressions ? Number(((g.linkClicks / g.impressions) * 100).toFixed(2)) : 0;
      g.engagementPercent = g.impressions ? Number((((g.likes + g.replies + g.reposts + g.linkClicks) / g.impressions) * 100).toFixed(2)) : 0;
    }
    return Object.fromEntries(Object.entries(byGame).sort((a, b) => b[1].ctrPercent - a[1].ctrPercent));
  }
}
