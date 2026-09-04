/**
 * The money-safe launch order (§8.2).
 *
 * The property under test is the one that costs real money if it breaks: at
 * every moment during a launch, either nothing can spend, or the ledger
 * already knows about the thing that can. A crash anywhere must leave a
 * visible, paused, un-billed record — never a Campaign spending money that
 * nothing knows about.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

import { CampaignManager } from '../src/ads/campaignManager.js';
import { AdsApiAccessError } from '../src/ads/xAdsClient.js';
import { tempStateFile, noNetwork } from './helpers.js';

noNetwork();

/**
 * An Ads API that records the order it was called in, and can be told to fail
 * at one step. Nothing here touches the network.
 */
function stubAds({ failAt = null } = {}) {
  const calls = [];
  const step = (name, result) => {
    calls.push(name);
    if (failAt === name) throw new Error(`simulated crash at ${name}`);
    return result;
  };
  return {
    calls,
    entityStatus: {},
    async probeAccess() { step('probeAccess'); return { authorized: true }; },
    async resolveFundingInstrument() { return step('funding', { id: 'fi-1' }); },
    async createCampaign({ status }) {
      const r = step('createCampaign', { id: 'camp-1' });
      this.entityStatus['camp-1'] = status;
      return r;
    },
    async createLineItem({ status }) {
      const r = step('createLineItem', { id: 'li-1' });
      this.entityStatus['li-1'] = status;
      return r;
    },
    async lookupCountry() { return 'loc-1'; },
    async lookupInterest() { return { id: 'int-1' }; },
    async addTargeting() { return step('addTargeting', {}); },
    async promoteTweet() { return step('promoteTweet', {}); },
    async setLineItemStatus(id, status) { step('activateLineItem'); this.entityStatus[id] = status; },
    async setCampaignStatus(id, status) { step('activateCampaign'); this.entityStatus[id] = status; }
  };
}

const stubTwitter = (calls) => ({
  async publish() { calls.push('postAdTweet'); return { success: true, postId: 'tweet-1' }; }
});

function manager(ads, ledgerFile) {
  return new CampaignManager({ ads, twitter: stubTwitter(ads.calls), ledgerFile });
}

const brief = { gameId: 'drift', tweetText: 'A Post about Drift. https://kreeda.games/drift/', dailyBudgetUsd: 5, angle: 'grip budget' };
const readLedger = file => JSON.parse(fs.readFileSync(file, 'utf8'));

test('a launch creates everything paused and activates only at the end', async () => {
  const ads = stubAds();
  const ledgerFile = tempStateFile('ads-campaigns.json');
  const result = await manager(ads, ledgerFile).launch(brief, { dryRun: false });

  assert.equal(result.launched, true);
  assert.deepEqual(ads.calls.filter(c => c !== 'addTargeting'), [
    'probeAccess', 'funding', 'createCampaign', 'createLineItem',
    'postAdTweet', 'promoteTweet', 'activateLineItem', 'activateCampaign'
  ]);
  // The ad tweet is posted after targeting and before anything is activated.
  assert.ok(ads.calls.indexOf('postAdTweet') > ads.calls.lastIndexOf('addTargeting'));
  assert.ok(ads.calls.indexOf('postAdTweet') < ads.calls.indexOf('activateCampaign'));
  assert.equal(ads.calls.at(-1), 'activateCampaign', 'the Campaign is the last thing switched on');
  assert.equal(readLedger(ledgerFile)[0].status, 'active');
});

test('the ledger record exists before the line item does', async () => {
  const ledgerFile = tempStateFile('ads-campaigns.json');
  const ads = stubAds({ failAt: 'createLineItem' });
  await assert.rejects(() => manager(ads, ledgerFile).launch(brief, { dryRun: false }), /simulated crash/);

  const [record] = readLedger(ledgerFile);
  assert.ok(record, 'a crash before the ledger write would leave a Campaign nothing knows about');
  assert.equal(record.campaignId, 'camp-1');
  assert.equal(record.status, 'launch_failed');
  assert.equal(ads.entityStatus['camp-1'], 'PAUSED', 'the Campaign it left behind cannot spend');
});

test('a crash mid-launch leaves a paused record and no orphan tweet', async () => {
  for (const failAt of ['createLineItem', 'addTargeting', 'promoteTweet']) {
    const ledgerFile = tempStateFile('ads-campaigns.json');
    const ads = stubAds({ failAt });
    await assert.rejects(() => manager(ads, ledgerFile).launch(brief, { dryRun: false }), /simulated crash/);

    const [record] = readLedger(ledgerFile);
    assert.equal(record.status, 'launch_failed', `${failAt}: the next Cycle must be able to see it`);
    assert.equal(record.launchError, `simulated crash at ${failAt}`);
    assert.equal(ads.entityStatus['camp-1'], 'PAUSED', `${failAt}: nothing may be billing`);
    assert.notEqual(ads.entityStatus['li-1'], 'ACTIVE', `${failAt}: nothing may be delivering`);
    if (failAt !== 'promoteTweet') {
      assert.ok(!ads.calls.includes('postAdTweet'), `${failAt}: an ad tweet was left on the timeline`);
    }
  }
});

test('an access failure blocks before anything is created', async () => {
  const ledgerFile = tempStateFile('ads-campaigns.json');
  const ads = stubAds();
  ads.probeAccess = async () => ({ authorized: false, error: 'INSUFFICIENT_USER_AUTHORIZED_PERMISSION' });
  await assert.rejects(() => manager(ads, ledgerFile).launch(brief, { dryRun: false }), AdsApiAccessError);
  assert.deepEqual(readLedger(ledgerFile), [], 'nothing was created, so nothing is in the ledger');
});

test('a Campaign is a three-day Trial that ends on its own', async () => {
  const ledgerFile = tempStateFile('ads-campaigns.json');
  await manager(stubAds(), ledgerFile).launch(brief, { dryRun: false });
  const [record] = readLedger(ledgerFile);

  const days = (new Date(record.endsAt) - new Date(record.launchedAt)) / 86_400_000;
  assert.equal(days, 3, 'ADR 0004: the Trial is the whole life of a Campaign');
  assert.equal(record.totalBudgetUsd, record.dailyBudgetUsd * 3);
});

test('a dry run creates nothing and reaches no API', async () => {
  const ledgerFile = tempStateFile('ads-campaigns.json');
  const ads = stubAds();
  const result = await manager(ads, ledgerFile).launch(brief, { dryRun: true });
  assert.equal(result.dryRun, true);
  assert.deepEqual(ads.calls, []);
  assert.equal(readLedger(ledgerFile)[0].status, 'simulated');
});

test('the Caps are enforced before anything is created', async () => {
  const ledgerFile = tempStateFile('ads-campaigns.json', [
    { id: 'a', status: 'active', dailyBudgetUsd: 10 },
    { id: 'b', status: 'active', dailyBudgetUsd: 10 }
  ]);
  const ads = stubAds();
  const result = await manager(ads, ledgerFile).launch(brief, { dryRun: false });
  assert.equal(result.launched, false, 'two active Campaigns is the configured maximum');
  assert.deepEqual(ads.calls, []);
});

test('ad text with a hashtag is refused, because X rejects it in a promoted post', async () => {
  const ledgerFile = tempStateFile('ads-campaigns.json');
  await assert.rejects(
    () => manager(stubAds(), ledgerFile).launch({ ...brief, tweetText: 'Play Drift #gaming' }, { dryRun: false }),
    /must not contain hashtags/
  );
});
