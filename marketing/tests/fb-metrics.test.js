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

test('Games are ranked by click rate, best first', () => {
  const summary = metrics().summarizeByGame({
    posts: {
      '1': { gameId: 'circle', latest: { impressions: 1000, reach: 800, clicks: 50, reactions: 10 } },
      '2': { gameId: 'drift', latest: { impressions: 2000, reach: 1500, clicks: 20, reactions: 4 } }
    }
  });
  assert.deepEqual(Object.keys(summary), ['circle', 'drift']);
  assert.equal(summary.circle.clickRatePercent, 5);
  assert.equal(summary.drift.clickRatePercent, 1);
});

test('several Posts about one Game add up', () => {
  const summary = metrics().summarizeByGame({
    posts: {
      '1': { gameId: 'sync', latest: { impressions: 1000, reach: 900, clicks: 30, reactions: 5 } },
      '2': { gameId: 'sync', latest: { impressions: 1000, reach: 700, clicks: 10, reactions: 1 } }
    }
  });
  assert.equal(summary.sync.posts, 2);
  assert.equal(summary.sync.impressions, 2000);
  assert.equal(summary.sync.clickRatePercent, 2);
});

test('a Post that could not be read does not distort the totals', () => {
  const summary = metrics().summarizeByGame({
    posts: {
      '1': { gameId: 'sync', latest: { impressions: 1000, reach: 900, clicks: 30, reactions: 5 } },
      '2': { gameId: 'sync', error: 'insights unavailable' }
    }
  });
  assert.equal(summary.sync.posts, 1);
});

test('an unconfigured Channel refreshes nothing rather than failing a Cycle', async () => {
  const result = await metrics().refresh([{ channel: 'facebook', publishResult: { mode: 'live', postId: '1' } }]);
  assert.equal(result.fetched, 0);
  assert.equal(result.failed, 0);
});
