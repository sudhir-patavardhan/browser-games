/**
 * Facebook Page insights, on the numbers alone. Nothing here reaches Graph.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { FbMetrics } from '../src/insights/fbMetrics.js';
import { GRAPH_VERSION } from '../src/publishers/facebookAccess.js';
import { tempStateFile, noNetwork } from './helpers.js';

noNetwork();

const metrics = () => new FbMetrics({ pageToken: '', pageId: '' }, tempStateFile('fb-metrics.json', { updatedAt: null, posts: {} }));

test('the Graph version is the one §11 requires', () => {
  assert.ok(Number(GRAPH_VERSION.replace('v', '').split('.')[0]) >= 21);
});

test('a missing metrics file reads as empty rather than throwing', () => {
  const m = new FbMetrics({ pageToken: '', pageId: '' }, `${tempStateFile('x.json')}/../nothing.json`);
  assert.deepEqual(m.load(), { updatedAt: null, posts: {} });
});

test('Games are ranked by link clicks, best first', () => {
  const summary = metrics().summarizeByGame({
    posts: {
      '1': { gameId: 'circle', latest: { clicks: 60, linkClicks: 50, reactions: 10, videoViews: 0 } },
      '2': { gameId: 'drift', latest: { clicks: 30, linkClicks: 20, reactions: 4, videoViews: 0 } }
    }
  });
  assert.deepEqual(Object.keys(summary), ['circle', 'drift']);
  assert.equal(summary.circle.linkClicks, 50);
});

test('several Posts about one Game add up', () => {
  const summary = metrics().summarizeByGame({
    posts: {
      '1': { gameId: 'sync', latest: { clicks: 40, linkClicks: 30, reactions: 5, videoViews: 100 } },
      '2': { gameId: 'sync', latest: { clicks: 12, linkClicks: 10, reactions: 1, videoViews: 20 } }
    }
  });
  assert.equal(summary.sync.posts, 2);
  assert.equal(summary.sync.linkClicks, 40);
  assert.equal(summary.sync.videoViews, 120);
});

test('a Post that could not be read does not distort the totals', () => {
  const summary = metrics().summarizeByGame({
    posts: {
      '1': { gameId: 'sync', latest: { clicks: 40, linkClicks: 30, reactions: 5 } },
      '2': { gameId: 'sync', error: 'insights unavailable' }
    }
  });
  assert.equal(summary.sync.posts, 1);
});

test('there is no post-level impressions number to report, and none is invented', () => {
  // Graph v21 removed every post_impressions metric. A rate computed against
  // a missing denominator would be worse than no rate at all.
  const summary = metrics().summarizeByGame({
    posts: { '1': { gameId: 'sync', latest: { clicks: 40, linkClicks: 30, reactions: 5, impressions: null } } }
  });
  assert.equal(summary.sync.impressions, undefined);
  assert.equal(summary.sync.clickRatePercent, undefined);
});

test('an unconfigured Channel refreshes nothing rather than failing a Cycle', async () => {
  const result = await metrics().refresh([{ channel: 'facebook', publishResult: { mode: 'live', postId: '1' } }]);
  assert.equal(result.fetched, 0);
  assert.equal(result.failed, 0);
});
