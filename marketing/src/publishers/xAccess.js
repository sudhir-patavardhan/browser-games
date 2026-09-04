/**
 * Whether the Producer can publish a Post on the X Channel (§14, Phase 1).
 *
 * The Facebook lane has `fb preflight`; this is its opposite number. Two
 * different credentials do two different jobs on X, and either can be broken
 * while the other works:
 *
 *   the four OAuth 1.0a keys  publish a Post, as the account
 *   the bearer token          read what a Post earned, as the app
 *
 * Campaigns are a third thing again, on a third credential path, and they have
 * their own `ads-preflight`.
 */

import { config } from '../config.js';
import { buildOAuth1Header } from '../ads/oauth1.js';
import { CheckReport, ok, warn, fail } from '../producer/checks.js';

const API = 'https://api.x.com/2';

/** A Post that has existed since 2006 and will answer any valid bearer token. */
const KNOWN_POST_ID = '20';

async function readError(res) {
  const body = await res.json().catch(() => ({}));
  return body.detail || body.title || body.errors?.[0]?.message || `HTTP ${res.status}`;
}

/**
 * @returns {Promise<CheckReport>}
 */
export async function xPreflight() {
  const report = new CheckReport('X CHANNEL — PREFLIGHT', 'publishing a Post, and reading what it earned');
  const add = report.group('Credentials', 'two of them, doing two different jobs');
  const { apiKey, apiSecret, accessToken, accessTokenSecret, bearerToken } = config.platforms.twitter;

  const oauthKeys = { TWITTER_API_KEY: apiKey, TWITTER_API_SECRET: apiSecret, TWITTER_ACCESS_TOKEN: accessToken, TWITTER_ACCESS_TOKEN_SECRET: accessTokenSecret };
  const missing = Object.entries(oauthKeys).filter(([, v]) => !v).map(([k]) => k);

  if (missing.length) {
    add(fail('publishing', `missing ${missing.join(', ')}`, 'the Producer cannot publish a Post on X'));
  } else {
    // /2/users/me under OAuth 1.0a user context: it proves the four keys sign
    // correctly and identifies the account a Post would go out as, which is
    // worth seeing before one does.
    const url = `${API}/users/me`;
    try {
      const res = await fetch(url, {
        headers: {
          Authorization: buildOAuth1Header({
            method: 'GET', url,
            consumerKey: apiKey, consumerSecret: apiSecret,
            accessToken, tokenSecret: accessTokenSecret
          })
        }
      });
      if (!res.ok) {
        const detail = await readError(res);
        add(fail('publishing', detail, res.status === 401
          ? 'the four OAuth keys do not sign; regenerate the access token with Read+Write'
          : 'the Producer cannot publish a Post on X'));
      } else {
        const me = (await res.json()).data || {};
        add(ok('publishing', `as @${me.username}${me.name ? ` (${me.name})` : ''}`));
      }
    } catch (err) {
      add(fail('publishing', err.message, 'the Producer cannot reach X to publish'));
    }
  }

  if (!bearerToken) {
    add(warn('reading metrics', 'TWITTER_BEARER_TOKEN is missing', 'the Analyst gets no impressions or link clicks from X'));
  } else {
    try {
      const res = await fetch(`${API}/tweets?ids=${KNOWN_POST_ID}&tweet.fields=public_metrics`, {
        headers: { Authorization: `Bearer ${bearerToken}` }
      });
      add(res.ok
        ? ok('reading metrics', 'the bearer token reads public metrics')
        : fail('reading metrics', await readError(res), 'regenerate the Bearer Token in the X developer portal'));
    } catch (err) {
      add(fail('reading metrics', err.message, 'the Analyst cannot reach X'));
    }
  }

  // Campaigns are a separate credential path with their own preflight; say so
  // here rather than leaving someone to wonder why paid is not covered.
  add(config.ads.enabled
    ? ok('Campaigns', 'a separate credential path — run `node cli.js ads-preflight`')
    : warn('Campaigns', 'X_ADS_ACCOUNT_ID is unset', 'no Campaign can launch (Phase 4)'));

  return report;
}
