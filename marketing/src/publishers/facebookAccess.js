/**
 * Getting and checking access to the Facebook Channel (§11).
 *
 * The token on file when this was built was a Graph API Explorer user token,
 * which lasts about an hour, and it expired. What the Producer needs is a
 * long-lived **Page** token, which does not expire at all while the CMO is an
 * admin of the Page. There is only one way to get one, and it is three hops:
 *
 *   a short-lived user token  (the CMO pastes this from Graph API Explorer)
 *     -> a long-lived user token   (needs the app's id and secret)
 *       -> the Page token          (from /me/accounts, inherits "no expiry")
 *
 * Taking the middle hop out is the usual mistake: /me/accounts against a
 * short-lived user token hands back a Page token that dies with it.
 */

import { config } from '../config.js';
import { CheckReport, ok, warn, fail } from '../producer/checks.js';

/** Graph API version. §11 requires v21 or newer. */
export const GRAPH_VERSION = 'v21.0';
const GRAPH = `https://graph.facebook.com/${GRAPH_VERSION}`;

/** What the Producer must be able to do on the Page. */
const REQUIRED_SCOPES = ['pages_manage_posts', 'pages_read_engagement', 'pages_show_list'];

async function graph(path, params) {
  const url = new URL(`${GRAPH}${path}`);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);

  const res = await fetch(url);
  const body = await res.json().catch(() => ({}));
  if (!res.ok || body.error) {
    const err = body.error || {};
    throw new Error(`Graph ${path} failed [${res.status}]: ${err.message || 'unknown error'}${err.code ? ` (code ${err.code})` : ''}`);
  }
  return body;
}

/**
 * Turns a short-lived user token into a long-lived Page token.
 *
 * @param {Object} options
 * @param {string} options.userToken a short-lived user token from Graph API Explorer.
 * @param {string} options.appId
 * @param {string} options.appSecret
 * @param {string} [options.pageId] which Page, when the CMO administers several.
 * @returns {Promise<{ pageToken: string, pageId: string, pageName: string, neverExpires: boolean }>}
 */
export async function mintPageToken({ userToken, appId, appSecret, pageId = config.platforms.facebook.pageId }) {
  if (!userToken) throw new Error('A short-lived user token is required — get one from Graph API Explorer.');
  if (!appId || !appSecret) {
    throw new Error('FACEBOOK_APP_ID and FACEBOOK_APP_SECRET are required: only the app can exchange a short-lived token for a long-lived one.');
  }

  const longLived = await graph('/oauth/access_token', {
    grant_type: 'fb_exchange_token',
    client_id: appId,
    client_secret: appSecret,
    fb_exchange_token: userToken
  });

  const pages = await graph('/me/accounts', { access_token: longLived.access_token, fields: 'id,name,access_token,tasks' });
  const list = pages.data || [];
  if (!list.length) {
    throw new Error('This user administers no Pages. Check that the token was granted pages_show_list.');
  }

  const page = pageId ? list.find(p => p.id === String(pageId)) : list[0];
  if (!page) {
    throw new Error(`Page ${pageId} is not among the Pages this user administers: ${list.map(p => `${p.name} (${p.id})`).join(', ')}`);
  }

  // A Page token derived from a long-lived user token carries no expiry. Ask
  // Facebook rather than assuming it, because a wrong assumption here is a
  // Channel that silently stops publishing in sixty days.
  const inspected = await inspectToken(page.access_token, { appId, appSecret });

  return {
    pageToken: page.access_token,
    pageId: page.id,
    pageName: page.name,
    neverExpires: inspected.expires_at === 0,
    tasks: page.tasks || [],
    scopes: inspected.scopes || []
  };
}

/**
 * What Facebook says about a token: who it is for, what it may do, and when it
 * dies.
 * @returns {Promise<Object>} the debug_token payload.
 */
export async function inspectToken(token, { appId = config.platforms.facebook.appId, appSecret = config.platforms.facebook.appSecret } = {}) {
  if (!appId || !appSecret) throw new Error('FACEBOOK_APP_ID and FACEBOOK_APP_SECRET are required to inspect a token.');
  const res = await graph('/debug_token', { input_token: token, access_token: `${appId}|${appSecret}` });
  return res.data || {};
}

/**
 * Whether the Producer can publish a Post on the Facebook Channel right now.
 * @returns {Promise<CheckReport>}
 */
export async function facebookPreflight() {
  const report = new CheckReport('FACEBOOK CHANNEL — PREFLIGHT', `Graph ${GRAPH_VERSION} (§11)`);
  const add = report.group('Page', 'what the Producer needs to publish a Post');
  const { pageId, pageToken, appId, appSecret } = config.platforms.facebook;

  if (!pageId) {
    add(fail('FACEBOOK_PAGE_ID', 'missing', 'the Producer has no Page to publish to'));
    return report;
  }
  add(ok('FACEBOOK_PAGE_ID', pageId));

  if (!pageToken) {
    add(fail('FACEBOOK_PAGE_TOKEN', 'missing', 'run `node cli.js fb token --user-token <short-lived token>`'));
    return report;
  }

  if (!appId || !appSecret) {
    add(warn('token inspection', 'FACEBOOK_APP_ID / FACEBOOK_APP_SECRET are unset',
      'the token cannot be checked for expiry or role until it fails mid-Cycle'));
  } else {
    try {
      const info = await inspectToken(pageToken, { appId, appSecret });
      if (!info.is_valid) {
        add(fail('FACEBOOK_PAGE_TOKEN', 'Facebook says this token is not valid', 'mint a new one with `node cli.js fb token`'));
        return report;
      }
      if (info.expires_at === 0) {
        add(ok('FACEBOOK_PAGE_TOKEN', 'valid, and does not expire while the CMO administers the Page'));
      } else {
        const days = Math.round((info.expires_at * 1000 - Date.now()) / 86_400_000);
        const detail = `valid, expires in ${days} day(s)`;
        // A token under a fortnight from expiry is an Alert the Producer
        // raises in its own right (§5.1).
        add(days > 14
          ? warn('FACEBOOK_PAGE_TOKEN', detail, 'this is a short-lived token; `fb token` mints one that does not expire')
          : fail('FACEBOOK_PAGE_TOKEN', detail, 'mint a long-lived Page token with `node cli.js fb token`'));
      }

      const missing = REQUIRED_SCOPES.filter(s => !(info.scopes || []).includes(s));
      add(missing.length
        ? fail('permissions', `missing ${missing.join(', ')}`, 'grant them in Graph API Explorer and mint the token again')
        : ok('permissions', REQUIRED_SCOPES.join(', ')));

      if (info.type && info.type !== 'PAGE') {
        add(fail('token type', `this is a ${info.type} token, not a Page token`,
          'a user token expires; run `node cli.js fb token` to exchange it for the Page token'));
      }
    } catch (err) {
      add(fail('token inspection', err.message, 'the Facebook Channel cannot be trusted to publish'));
      return report;
    }
  }

  try {
    const page = await graph(`/${pageId}`, { access_token: pageToken, fields: 'id,name,fan_count' });
    add(ok('the Page answers', `${page.name}${page.fan_count == null ? '' : ` · ${page.fan_count} followers`}`));
  } catch (err) {
    add(fail('the Page answers', err.message, 'the Producer cannot reach the Page with this token'));
  }

  return report;
}
