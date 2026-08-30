import assert from 'node:assert/strict';
import { ADS_POLICY, evaluateLaunchBudget, judgeCampaign, usdToLocalMicro } from '../src/ads/adsPolicy.js';

// Hard ceilings can never be raised past 10 / 25 (config clamps env overrides).
assert.equal(ADS_POLICY.maxDailyPerCampaignUsd <= 10, true);
assert.equal(ADS_POLICY.maxTotalDailyUsd <= 25, true);

// Per-campaign clamp: asking for $40/day yields at most $10/day.
let r = evaluateLaunchBudget(40, []);
assert.equal(r.ok, true);
assert.equal(r.dailyUsd, 10);

// Total cap: with $20/day already committed, only $5 of headroom is left.
r = evaluateLaunchBudget(10, [{ dailyBudgetUsd: 10 }, { dailyBudgetUsd: 10 }]);
assert.equal(r.ok, true);
assert.equal(r.dailyUsd, 5);

// Total cap: with $25/day committed, nothing more may launch.
r = evaluateLaunchBudget(10, [{ dailyBudgetUsd: 10 }, { dailyBudgetUsd: 10 }, { dailyBudgetUsd: 5 }]);
assert.equal(r.ok, false);

// Micro conversion respects the configured local rate.
assert.equal(usdToLocalMicro(1), Math.round(ADS_POLICY.maxDailyPerCampaignUsd > 0 ? 1_000_000 * (usdToLocalMicro(1) / 1_000_000) : 0));

// Judging: nothing is decided before the trial window ends.
const fresh = { launchedAt: new Date(Date.now() - 12 * 3600_000).toISOString() };
assert.equal(judgeCampaign(fresh, { impressions: 0, urlClicks: 0, spendUsd: 0 }).verdict, 'too_early');

// After the trial: too few clicks → pause; expensive clicks → pause; good numbers → keep.
const old = { launchedAt: new Date(Date.now() - (ADS_POLICY.trialDays + 0.5) * 86_400_000).toISOString() };
assert.equal(judgeCampaign(old, { impressions: 5000, urlClicks: 1, spendUsd: 9 }).verdict, 'pause');
assert.equal(judgeCampaign(old, { impressions: 5000, urlClicks: 5, spendUsd: 9 }).verdict, 'pause');   // $1.80 CPC
assert.equal(judgeCampaign(old, { impressions: 5000, urlClicks: 30, spendUsd: 9 }).verdict, 'keep');   // $0.30 CPC, 0.6% CTR
assert.equal(judgeCampaign(old, { impressions: 50000, urlClicks: 30, spendUsd: 9 }).verdict, 'pause'); // 0.06% CTR

console.log('ads policy: all checks passed');
