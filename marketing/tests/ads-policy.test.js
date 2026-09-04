/**
 * The Caps and the kill rules are frozen in code (§8.1). Configuration can
 * lower a Cap and never raise it, every Campaign is a three-day Trial that
 * always ends (ADR 0004), and the kill rules bite at the judging point.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { ADS_POLICY, evaluateLaunchBudget, judgeCampaign, usdToLocalMicro, localMicroToUsd } from '../src/ads/adsPolicy.js';
import { noNetwork } from './helpers.js';

noNetwork();

const daysAgo = days => ({ launchedAt: new Date(Date.now() - days * 86_400_000).toISOString() });
const judged = days => daysAgo(ADS_POLICY.judgingPointDays + days);

test('the Caps cannot be raised', () => {
  assert.ok(ADS_POLICY.maxDailyPerCampaignUsd <= 10);
  assert.ok(ADS_POLICY.maxTotalDailyUsd <= 25);
});

test('a Trial is three days and is judged a day before it ends', () => {
  assert.equal(ADS_POLICY.trialDays, 3);
  assert.equal(ADS_POLICY.judgingPointDays, 2);
  assert.ok(ADS_POLICY.judgingPointDays < ADS_POLICY.trialDays,
    'a Campaign judged only at the end would never stop paying for its last day');
});

test('a request above the per-Campaign Cap is clamped, not refused', () => {
  const r = evaluateLaunchBudget(40, []);
  assert.equal(r.ok, true);
  assert.equal(r.dailyUsd, 10);
});

test('the total Cap is what is left after the active Campaigns', () => {
  const r = evaluateLaunchBudget(10, [{ dailyBudgetUsd: 10 }, { dailyBudgetUsd: 10 }]);
  assert.equal(r.ok, true);
  assert.equal(r.dailyUsd, 5);
});

test('nothing launches once the total Cap is committed', () => {
  const r = evaluateLaunchBudget(10, [{ dailyBudgetUsd: 10 }, { dailyBudgetUsd: 10 }, { dailyBudgetUsd: 5 }]);
  assert.equal(r.ok, false);
  assert.equal(r.dailyUsd, 0);
});

test('headroom too small to run on is refused rather than launched tiny', () => {
  const r = evaluateLaunchBudget(5, [{ dailyBudgetUsd: 24.5 }]);
  assert.equal(r.ok, false);
});

test('USD converts to local micro and back', () => {
  assert.equal(localMicroToUsd(usdToLocalMicro(7.5)), 7.5);
  assert.ok(Number.isInteger(usdToLocalMicro(3.33)), 'the API takes whole micro units');
});

test('no kill rule applies before the judging point', () => {
  const verdict = judgeCampaign(daysAgo(0.5), { impressions: 5000, urlClicks: 0, spendUsd: 4 });
  assert.equal(verdict.judged, false);
  assert.equal(verdict.kill, false);
});

test('too few link clicks by the judging point kills a Campaign', () => {
  const verdict = judgeCampaign(judged(0.5), { impressions: 5000, urlClicks: 1, spendUsd: 9 });
  assert.equal(verdict.kill, true);
  assert.match(verdict.reason, /link click/);
});

test('a click that costs more than a dollar kills a Campaign', () => {
  const verdict = judgeCampaign(judged(0.5), { impressions: 5000, urlClicks: 5, spendUsd: 9 });
  assert.equal(verdict.kill, true);
  assert.match(verdict.reason, /Cost per click/);
});

test('delivering impressions nobody clicks kills a Campaign', () => {
  const verdict = judgeCampaign(judged(0.5), { impressions: 50_000, urlClicks: 30, spendUsd: 9 });
  assert.equal(verdict.kill, true);
  assert.match(verdict.reason, /CTR/);
});

test('a Campaign that is working is left to run its Trial out, never extended', () => {
  const verdict = judgeCampaign(judged(0.5), { impressions: 5000, urlClicks: 30, spendUsd: 9 });
  assert.equal(verdict.judged, true);
  assert.equal(verdict.kill, false);
  // ADR 0004: there is no verdict that keeps a Campaign going.
  assert.doesNotMatch(verdict.reason, /keep/i);
  assert.equal(verdict.metrics.cpcUsd, 0.3);
  assert.equal(verdict.metrics.ctrPercent, 0.6);
});
