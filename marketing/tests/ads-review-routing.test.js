/**
 * Which API judges which Campaign (§8.2).
 *
 * The Caps are shared across both Channels, so one ledger holds both kinds of
 * Campaign. The stats are not shared: a campaign id is only meaningful to the
 * API that issued it. Handing a Facebook id to the X Ads stats endpoint threw
 * `INVALID_PARAMETER`, and because the X review asks for every active Campaign
 * in one call, that one bad id meant no Campaign on either Channel was ever
 * judged — the kill rules silently stopped applying while money was spending.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

import { CampaignManager } from '../src/ads/campaignManager.js';
import { MetaCampaignManager } from '../src/ads/metaCampaign.js';
import { MetaAdsAccessError } from '../src/ads/metaAdsClient.js';
import { tempStateFile, noNetwork } from './helpers.js';

noNetwork();

const FOUR_DAYS_AGO = new Date(Date.now() - 4 * 86_400_000).toISOString();

/** One X Campaign and one Facebook Campaign, both active, both past the judging point. */
const mixedLedger = () => ([
  {
    id: 'ads-x-1', name: 'Drift on X', gameId: 'drift', angle: 'grip budget',
    campaignId: 'x-campaign-1', status: 'active', dailyBudgetUsd: 5,
    launchedAt: FOUR_DAYS_AGO, lastStats: null, history: [],
    targeting: { ageBucket: 'AGE_18_PLUS', interests: ['Gaming'], keywords: ['drift'] }
  },
  {
    id: 'ads-fb-1', channel: 'facebook', name: 'Drift on Facebook', gameId: 'drift',
    angle: 'the battery is the health bar', campaignId: '120251354339310458',
    status: 'active', dailyBudgetUsd: 5, launchedAt: FOUR_DAYS_AGO, lastStats: null, history: []
  }
]);

const readLedger = file => JSON.parse(fs.readFileSync(file, 'utf8'));
const record = (file, id) => readLedger(file).find(c => c.id === id);

/** An X Ads API that refuses any id it did not issue, exactly as the real one does. */
function stubXAds({ impressions = 1000, urlClicks = 10, spendLocal = 420 } = {}) {
  const asked = [];
  const paused = [];
  return {
    asked, paused,
    async getCampaignStats(ids) {
      asked.push(...ids);
      const bad = ids.find(id => !String(id).startsWith('x-'));
      if (bad) throw new Error(`Ads API GET /stats failed [400] INVALID_PARAMETER: Expected an id, got "${bad}" for entity_ids`);
      return Object.fromEntries(ids.map(id => [id, { impressions, urlClicks, spendLocal }]));
    },
    async setCampaignStatus(id, status) { paused.push([id, status]); }
  };
}

/** A Marketing API that answers for one campaign id at a time. */
function stubMetaAds({ impressions = 1000, urlClicks = 10, spendUsd = 5 } = {}) {
  const asked = [];
  const paused = [];
  return {
    asked, paused,
    async campaignStats(campaignId) {
      asked.push(campaignId);
      if (!/^\d+$/.test(String(campaignId))) throw new Error(`Meta GET /${campaignId}/insights failed: unknown id`);
      return { impressions, urlClicks, spendUsd, spendLocal: spendUsd * 84 };
    },
    async setStatus(id, status) { paused.push([id, status]); }
  };
}

test('the X review never sends a Facebook campaign id to the X Ads API', async () => {
  const ledgerFile = tempStateFile('ads-campaigns.json', mixedLedger());
  const ads = stubXAds();

  const results = await new CampaignManager({ ads, ledgerFile }).review({ dryRun: true });

  assert.deepEqual(ads.asked, ['x-campaign-1'], 'only the id X issued was asked about');
  assert.equal(results.length, 1);
  assert.equal(results[0].id, 'ads-x-1');
  assert.ok(record(ledgerFile, 'ads-x-1').lastStats, 'the X Campaign was judged');
  assert.equal(record(ledgerFile, 'ads-fb-1').lastStats, null, 'the X review left the Facebook Campaign alone');
});

test('the Facebook review judges the Facebook Campaign through the Marketing API', async () => {
  const ledgerFile = tempStateFile('ads-campaigns.json', mixedLedger());
  const ads = stubMetaAds();

  const results = await new MetaCampaignManager({ ads, ledgerFile }).review({ dryRun: true });

  assert.deepEqual(ads.asked, ['120251354339310458'], 'only the id Meta issued was asked about');
  assert.equal(results.length, 1);
  assert.equal(results[0].channel, 'facebook');
  assert.equal(results[0].judged, true, 'four days in, the kill rules apply');

  const fb = record(ledgerFile, 'ads-fb-1');
  assert.equal(fb.lastStats.impressions, 1000);
  assert.equal(fb.lastStats.clicks, 10);
  assert.equal(fb.lastStats.spendUsd, 5, 'Meta spend is already in USD and must not be converted twice');
  assert.equal(fb.history.length, 1);
  assert.equal(record(ledgerFile, 'ads-x-1').lastStats, null, 'the Facebook review left the X Campaign alone');
});

test('a Facebook Campaign that fails a kill rule is paused on Meta', async () => {
  const ledgerFile = tempStateFile('ads-campaigns.json', mixedLedger());
  const ads = stubMetaAds({ impressions: 4000, urlClicks: 1, spendUsd: 5 });

  const [judgement] = await new MetaCampaignManager({ ads, ledgerFile }).review({ dryRun: false });

  assert.equal(judgement.kill, true, '1 link click by day two is under the minimum');
  assert.deepEqual(ads.paused, [['120251354339310458', 'PAUSED']]);
  assert.equal(record(ledgerFile, 'ads-fb-1').status, 'paused');
  assert.ok(record(ledgerFile, 'ads-fb-1').pausedReason);
});

test('a dry run judges without pausing anything, on either Channel', async () => {
  // A dry run that wrote "paused" to the ledger without pausing on the Channel
  // would drop the Campaign from `activeCampaigns` while it was still
  // delivering: it would spend the rest of its Trial with nothing watching it.
  for (const [label, run] of [
    ['Facebook', ledgerFile => new MetaCampaignManager({ ads: stubMetaAds({ impressions: 4000, urlClicks: 1, spendUsd: 5 }), ledgerFile })],
    ['X', ledgerFile => new CampaignManager({ ads: stubXAds({ impressions: 4000, urlClicks: 1 }), ledgerFile })]
  ]) {
    const ledgerFile = tempStateFile('ads-campaigns.json', mixedLedger());
    const mgr = run(ledgerFile);
    const [judgement] = await mgr.review({ dryRun: true });

    assert.equal(judgement.kill, true, `${label}: the kill rule fired`);
    assert.equal(mgr.ads.paused?.length ?? 0, 0, `${label}: nothing reaches the Channel without --live`);
    const id = label === 'Facebook' ? 'ads-fb-1' : 'ads-x-1';
    assert.equal(record(ledgerFile, id).status, 'active', `${label}: the Campaign is still delivering, so the ledger must still say so`);
    assert.ok(record(ledgerFile, id).lastStats, `${label}: the reading is still recorded`);
    assert.equal(record(ledgerFile, id).pausedReason, undefined, `${label}: no Verdict was earned`);
    assert.equal(mgr.activeCampaigns().length, 2, `${label}: the next review still sees it`);
  }
});

test('one Channel refusing our credentials does not discard the other s verdicts', async () => {
  const ledgerFile = tempStateFile('ads-campaigns.json', mixedLedger());
  const meta = new MetaCampaignManager({ ledgerFile, ads: {
    async campaignStats() { throw new MetaAdsAccessError('The Marketing API refused these credentials (code 190): Session has expired'); }
  } });
  const mgr = new CampaignManager({
    ads: stubXAds(), meta, ledgerFile,
    ai: { isConfigured: false },
    learningsFile: tempStateFile('ads-learnings.json', {})
  });
  // planNext is out of scope here; the Cycle must survive the Facebook outage.
  mgr.planNext = async () => ({ launched: false, reason: 'not under test' });

  const summary = await mgr.runCycle({ dryRun: true });

  assert.equal(summary.reviewed.length, 1, 'the X Campaign was still judged');
  assert.equal(summary.reviewed[0].id, 'ads-x-1');
  assert.match(summary.blocked, /Facebook: .*credentials/, 'the Cycle is blocked on Facebook, not crashed');
  assert.ok(summary.learned, 'the rest of the Cycle still ran');
});

test('one Cycle judges every active Campaign, on both Channels', async () => {
  const ledgerFile = tempStateFile('ads-campaigns.json', mixedLedger());
  const xAds = stubXAds();
  const meta = new MetaCampaignManager({ ads: stubMetaAds(), ledgerFile });
  const mgr = new CampaignManager({ ads: xAds, meta, ledgerFile });

  const reviewed = [...await mgr.review({ dryRun: true }), ...await meta.review({ dryRun: true })];

  assert.deepEqual(reviewed.map(r => r.id).sort(), ['ads-fb-1', 'ads-x-1']);
  assert.ok(record(ledgerFile, 'ads-x-1').lastStats, 'the X Campaign kept its stats through the Facebook pass');
  assert.ok(record(ledgerFile, 'ads-fb-1').lastStats);
});

test('a Facebook Campaign with stats does not break the learnings', async () => {
  const ledgerFile = tempStateFile('ads-campaigns.json', mixedLedger());
  const meta = new MetaCampaignManager({ ads: stubMetaAds(), ledgerFile });
  await meta.review({ dryRun: true });

  // A Facebook record carries no `targeting`: it is aimed by country and age
  // on the Ad Set. Reading it as if it were an X record used to throw.
  const learnings = await new CampaignManager({
    ads: stubXAds(), ledgerFile, learningsFile: tempStateFile('ads-learnings.json', {}),
    ai: { isConfigured: false }
  }).learn();

  const fb = learnings.records.find(r => r.channel === 'facebook');
  assert.ok(fb, 'the Facebook Campaign is in the learnings');
  assert.equal(fb.ageBucket, null);
  assert.deepEqual(fb.interests, []);
});
