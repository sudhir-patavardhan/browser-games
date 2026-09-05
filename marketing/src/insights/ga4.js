/**
 * Players, from GA4 (AGENTS_SPEC.md §6.1, §7).
 *
 * The north-star metric is Players — visitors who reached thirty seconds of
 * active, visible play — counted by the `played_30s` event. Everything else
 * here is a step on the way to that number.
 *
 * Two facts about this property shape the whole file:
 *
 * 1. **No custom dimensions are registered.** `game_id` rides on every event
 *    as a parameter, but an unregistered parameter cannot be queried, so the
 *    Game is derived from the page path instead — exactly the way analytics.js
 *    derives it, so the two can never disagree.
 * 2. **Attribution arrives as the standard manual utm dimensions.** The
 *    Producer's decoration (§7) lands as sessionManualSource / Medium /
 *    CampaignName / AdContent, and `utm_content` is the Post id.
 */

import crypto from 'node:crypto';
import { config } from '../config.js';

const DATA_API = 'https://analyticsdata.googleapis.com/v1beta';
const SCOPE = 'https://www.googleapis.com/auth/analytics.readonly';

/** The event that makes someone a Player. */
export const PLAYER_EVENT = 'played_30s';

/** Pages that are not Games, mirroring NOT_A_GAME in analytics.js. */
const NOT_A_GAME = new Set(['home', 'marketing', 'privacy', 'verify']);

/**
 * The Game a path belongs to, derived the way analytics.js derives it: the
 * last folder, with any filename dropped.
 * @returns {string|null} null when the path is not a Game.
 */
export function gameFromPath(pagePath) {
  const parts = String(pagePath || '').split('?')[0].split('/').filter(Boolean);
  if (parts.length && parts[parts.length - 1].includes('.')) parts.pop();
  const id = parts.length ? parts[parts.length - 1] : 'home';
  return NOT_A_GAME.has(id) ? null : id;
}

export class GA4 {
  constructor({
    key = process.env.GA4_SA_KEY,
    propertyId = process.env.GA4_PROPERTY_ID
  } = {}) {
    this.rawKey = key;
    this.propertyId = propertyId;
    this._token = null;
    this._tokenExpires = 0;
  }

  get isConfigured() {
    return Boolean(this.rawKey && this.propertyId);
  }

  /** A service-account access token, minted by signing a JWT. Cached. */
  async accessToken() {
    if (this._token && Date.now() < this._tokenExpires - 60_000) return this._token;
    if (!this.isConfigured) throw new Error('GA4_SA_KEY and GA4_PROPERTY_ID are needed to count Players.');

    const key = typeof this.rawKey === 'string' ? JSON.parse(this.rawKey) : this.rawKey;
    const now = Math.floor(Date.now() / 1000);
    const encode = obj => Buffer.from(JSON.stringify(obj)).toString('base64url');
    const claim = `${encode({ alg: 'RS256', typ: 'JWT' })}.${encode({
      iss: key.client_email, scope: SCOPE, aud: key.token_uri, exp: now + 3600, iat: now
    })}`;
    const signature = crypto.sign('RSA-SHA256', Buffer.from(claim), key.private_key).toString('base64url');

    const res = await fetch(key.token_uri, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
        assertion: `${claim}.${signature}`
      })
    });
    const body = await res.json();
    if (!res.ok) throw new Error(`GA4 refused the service account: ${body.error_description || body.error}`);

    this._token = body.access_token;
    this._tokenExpires = Date.now() + (body.expires_in || 3600) * 1000;
    return this._token;
  }

  /**
   * One Data API report.
   * @returns {Promise<{ rows: Array<{ keys: string[], values: number[] }> }>}
   */
  async runReport({ dimensions = [], metrics, days = 28, eventName = null, limit = 200 }) {
    const res = await fetch(`${DATA_API}/properties/${this.propertyId}:runReport`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${await this.accessToken()}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        dateRanges: [{ startDate: `${days}daysAgo`, endDate: 'today' }],
        dimensions: dimensions.map(name => ({ name })),
        metrics: metrics.map(name => ({ name })),
        ...(eventName ? { dimensionFilter: { filter: { fieldName: 'eventName', stringFilter: { value: eventName } } } } : {}),
        limit
      })
    });
    const body = await res.json();
    if (!res.ok) throw new Error(`GA4 report failed: ${body.error?.message || res.status}`);

    return {
      rows: (body.rows || []).map(r => ({
        keys: (r.dimensionValues || []).map(v => v.value),
        values: (r.metricValues || []).map(v => Number(v.value) || 0)
      }))
    };
  }

  /**
   * The funnel per Game: sessions in, Players out (§6.1).
   *
   * `playRate` is the number that matters — of the people who arrived at this
   * Game, how many actually played it. A Game with few sessions and a high
   * play rate is a better bet than one with many sessions and a low one.
   *
   * @returns {Promise<Object<string, { sessions, players, gameStarts, activeSeconds, playRate }>>}
   */
  async funnelByGame({ days = 28 } = {}) {
    const games = {};
    const at = id => (games[id] ||= { gameId: id, sessions: 0, players: 0, gameStarts: 0, activeSeconds: 0, playRate: 0 });

    const sessions = await this.runReport({ dimensions: ['pagePath'], metrics: ['sessions'], days });
    for (const row of sessions.rows) {
      const id = gameFromPath(row.keys[0]);
      if (id) at(id).sessions += row.values[0];
    }

    // One report per event rather than a shared one: eventCount can only be
    // filtered to a single event at a time without a compound filter.
    for (const [event, field] of [[PLAYER_EVENT, 'players'], ['game_start', 'gameStarts']]) {
      const report = await this.runReport({ dimensions: ['pagePath'], metrics: ['eventCount'], days, eventName: event });
      for (const row of report.rows) {
        const id = gameFromPath(row.keys[0]);
        if (id) at(id)[field] += row.values[0];
      }
    }

    // How long people actually played, from the site's own honest clock.
    const time = await this.runReport({ dimensions: ['pagePath'], metrics: ['eventCount'], days, eventName: 'game_time' });
    for (const row of time.rows) {
      const id = gameFromPath(row.keys[0]);
      // Each game_time event is one 30-second beat of active play.
      if (id) at(id).activeSeconds += row.values[0] * 30;
    }

    for (const game of Object.values(games)) {
      game.playRate = game.sessions > 0 ? Number(((game.players / game.sessions) * 100).toFixed(1)) : 0;
      game.minutesPlayed = Math.round(game.activeSeconds / 60);
    }
    return games;
  }

  /**
   * Players and sessions per Post or per Campaign, read back from the
   * attribution the Producer put on the link (§7).
   *
   * @param {'content'|'campaign'} by content is the Post id; campaign is the
   *        Category for organic and the Campaign id for paid.
   */
  async attributed({ by = 'content', days = 28 } = {}) {
    const dimension = by === 'campaign' ? 'sessionManualCampaignName' : 'sessionManualAdContent';
    const rows = {};
    const at = key => (rows[key] ||= { key, sessions: 0, players: 0 });

    const sessions = await this.runReport({ dimensions: [dimension], metrics: ['sessions'], days });
    for (const row of sessions.rows) {
      if (isUnset(row.keys[0])) continue;
      at(row.keys[0]).sessions += row.values[0];
    }

    const players = await this.runReport({ dimensions: [dimension], metrics: ['eventCount'], days, eventName: PLAYER_EVENT });
    for (const row of players.rows) {
      if (isUnset(row.keys[0])) continue;
      at(row.keys[0]).players += row.values[0];
    }

    for (const row of Object.values(rows)) {
      row.playRate = row.sessions > 0 ? Number(((row.players / row.sessions) * 100).toFixed(1)) : 0;
    }
    return rows;
  }

  /** Players by hour of day, so the Strategist can choose between Windows. */
  async playersByHour({ days = 28 } = {}) {
    const report = await this.runReport({ dimensions: ['hour'], metrics: ['eventCount'], days, eventName: PLAYER_EVENT });
    const hours = {};
    for (const row of report.rows) hours[row.keys[0]] = row.values[0];
    return hours;
  }
}

/** GA4 says "(not set)" and "(referral)" where a value is absent. */
function isUnset(value) {
  return !value || /^\((not set|referral|organic|none|direct)\)$/i.test(value);
}
