/**
 * Minting the long-lived Page token (§11).
 *
 * The bug this file exists to prevent: calling /me/accounts with the
 * short-lived user token. It succeeds, it returns a Page token, and that token
 * dies in an hour — which is what expired on 2026-09-03. The Page token only
 * has no expiry when it is derived from a long-lived user token, so the test
 * that matters asserts which token the second call carried.
 */

import test, { afterEach } from 'node:test';
import assert from 'node:assert/strict';

import { mintPageToken, inspectToken, GRAPH_VERSION } from '../src/publishers/facebookAccess.js';

const SHORT_LIVED = 'EAA-short-lived-user-token';
const LONG_LIVED = 'EAA-long-lived-user-token';
const PAGE_TOKEN = 'EAA-page-token';
const APP = { appId: '111', appSecret: 'secret' };

/**
 * A Graph API that records every call. `expiresAt` is what debug_token says
 * about the Page token: 0 means no expiry.
 */
function stubGraph({ pages, expiresAt = 0, fail = null, permissions = ['pages_manage_posts', 'pages_read_engagement', 'pages_show_list'] } = {}) {
  const grants = permissions.map(p => (typeof p === 'string' ? { permission: p, status: 'granted' } : p));
  const calls = [];
  globalThis.fetch = async (url) => {
    const u = new URL(url);
    const path = u.pathname.replace(`/${GRAPH_VERSION}`, '');
    calls.push({ path, params: Object.fromEntries(u.searchParams) });

    if (fail === path) {
      return { ok: false, status: 400, json: async () => ({ error: { message: 'simulated Graph failure', code: 190 } }) };
    }

    const body = {
      '/oauth/access_token': { access_token: LONG_LIVED, token_type: 'bearer', expires_in: 5_184_000 },
      '/me/accounts': { data: pages },
      '/me/permissions': { data: grants },
      '/debug_token': { data: { is_valid: true, type: 'PAGE', expires_at: expiresAt, scopes: ['pages_manage_posts', 'pages_read_engagement', 'pages_show_list'] } }
    }[path];

    if (!body) throw new Error(`the stub was not asked for ${path}`);
    return { ok: true, status: 200, json: async () => body };
  };
  return calls;
}

const ONE_PAGE = [{ id: '1282959528235085', name: 'Kreeda', access_token: PAGE_TOKEN, tasks: ['MANAGE', 'CREATE_CONTENT'] }];

const realFetch = globalThis.fetch;
afterEach(() => { globalThis.fetch = realFetch; });

test('the Page token is derived from the long-lived user token, not the short-lived one', async () => {
  const calls = stubGraph({ pages: ONE_PAGE });
  await mintPageToken({ userToken: SHORT_LIVED, ...APP, pageId: '1282959528235085' });

  const exchange = calls.find(c => c.path === '/oauth/access_token');
  assert.equal(exchange.params.grant_type, 'fb_exchange_token');
  assert.equal(exchange.params.fb_exchange_token, SHORT_LIVED);
  assert.equal(exchange.params.client_id, APP.appId);

  const accounts = calls.find(c => c.path === '/me/accounts');
  assert.equal(accounts.params.access_token, LONG_LIVED,
    'using the short-lived token here yields a Page token that dies in an hour');
  assert.ok(calls.indexOf(exchange) < calls.indexOf(accounts), 'the exchange must come first');
});

test('it reports what Facebook says about expiry rather than assuming', async () => {
  stubGraph({ pages: ONE_PAGE, expiresAt: 0 });
  const permanent = await mintPageToken({ userToken: SHORT_LIVED, ...APP });
  assert.equal(permanent.neverExpires, true);
  assert.equal(permanent.pageToken, PAGE_TOKEN);
  assert.equal(permanent.pageName, 'Kreeda');

  stubGraph({ pages: ONE_PAGE, expiresAt: Math.floor(Date.now() / 1000) + 3600 });
  const temporary = await mintPageToken({ userToken: SHORT_LIVED, ...APP });
  assert.equal(temporary.neverExpires, false, 'a token that still expires must not be reported as permanent');
});

test('debug_token is asked about the Page token, not the user token', async () => {
  const calls = stubGraph({ pages: ONE_PAGE });
  await mintPageToken({ userToken: SHORT_LIVED, ...APP });
  const debug = calls.find(c => c.path === '/debug_token');
  assert.equal(debug.params.input_token, PAGE_TOKEN);
  assert.equal(debug.params.access_token, `${APP.appId}|${APP.appSecret}`, 'debug_token needs an app token');
});

test('the right Page is picked when the CMO administers several', async () => {
  stubGraph({ pages: [
    { id: '999', name: 'Another Page', access_token: 'wrong-token' },
    ...ONE_PAGE
  ] });
  const minted = await mintPageToken({ userToken: SHORT_LIVED, ...APP, pageId: '1282959528235085' });
  assert.equal(minted.pageToken, PAGE_TOKEN);
  assert.equal(minted.pageId, '1282959528235085');
});

test('a Page the CMO does not administer names the ones they do', async () => {
  stubGraph({ pages: [{ id: '999', name: 'Another Page', access_token: 'wrong-token' }] });
  await assert.rejects(
    () => mintPageToken({ userToken: SHORT_LIVED, ...APP, pageId: '1282959528235085' }),
    /Another Page \(999\)/
  );
});

test('no Pages at all points at the missing permission', async () => {
  stubGraph({ pages: [] });
  await assert.rejects(() => mintPageToken({ userToken: SHORT_LIVED, ...APP }), /pages_show_list/);
});

test('the exchange refuses to start without what it needs', async () => {
  stubGraph({ pages: ONE_PAGE });
  await assert.rejects(() => mintPageToken({ userToken: '', ...APP }), /short-lived user token is required/);
  await assert.rejects(() => mintPageToken({ userToken: SHORT_LIVED, appId: '', appSecret: 'x' }), /FACEBOOK_APP_ID/);
  await assert.rejects(() => mintPageToken({ userToken: SHORT_LIVED, appId: 'x', appSecret: '' }), /FACEBOOK_APP_SECRET/);
});

test('an expired short-lived token surfaces the Graph error, not a crash', async () => {
  stubGraph({ pages: ONE_PAGE, fail: '/oauth/access_token' });
  await assert.rejects(
    () => mintPageToken({ userToken: SHORT_LIVED, ...APP }),
    /simulated Graph failure.*code 190/s
  );
});

test('inspectToken reads a token back through the app', async () => {
  stubGraph({ pages: ONE_PAGE, expiresAt: 0 });
  const info = await inspectToken(PAGE_TOKEN, APP);
  assert.equal(info.is_valid, true);
  assert.equal(info.type, 'PAGE');
  assert.equal(info.expires_at, 0);
});

test('a token missing a permission is refused before the exchange spends it', async () => {
  const calls = stubGraph({ pages: ONE_PAGE, permissions: ['pages_show_list', 'pages_read_engagement'] });
  await assert.rejects(
    () => mintPageToken({ userToken: SHORT_LIVED, ...APP }),
    err => {
      assert.equal(err.name, 'MissingPermissionsError');
      assert.deepEqual(err.missing, ['pages_manage_posts']);
      assert.deepEqual(err.granted, ['pages_show_list', 'pages_read_engagement']);
      return true;
    }
  );
  assert.ok(!calls.some(c => c.path === '/oauth/access_token'),
    'the exchange must not run: the token is still good for a retry after re-granting');
});

test('a permission the dialog declined is not counted as granted', async () => {
  stubGraph({ pages: ONE_PAGE, permissions: [
    { permission: 'pages_show_list', status: 'granted' },
    { permission: 'pages_read_engagement', status: 'granted' },
    { permission: 'pages_manage_posts', status: 'declined' }
  ] });
  await assert.rejects(() => mintPageToken({ userToken: SHORT_LIVED, ...APP }), /pages_manage_posts/);
});
