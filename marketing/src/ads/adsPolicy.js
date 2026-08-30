import { config } from '../config.js';

/**
 * Spend guardrails and kill rules for agent-run X Ads campaigns.
 *
 * All limits are expressed in USD and converted to the ads account's local
 * currency at launch time (the account bills in whatever currency its funding
 * card uses — this one is INR). The conversion rate comes from config so a
 * stale rate can never silently raise the cap: if unset for a non-USD
 * account, launches are refused.
 */
export const ADS_POLICY = Object.freeze({
  maxDailyPerCampaignUsd: config.ads.maxDailyPerCampaignUsd,   // hard ceiling per campaign
  maxTotalDailyUsd: config.ads.maxTotalDailyUsd,               // ceiling across all active campaigns
  trialDays: config.ads.trialDays,                             // full days before a campaign is judged
  // Kill thresholds, evaluated only after `trialDays` of delivery.
  minTrialClicks: 3,          // fewer link clicks than this over the trial → pause
  maxCostPerClickUsd: 1.0,    // paying more than this per link click → pause
  minCtrPercent: 0.25         // impressions but a CTR below this → pause
});

export function usdToLocal(usd) {
  return usd * config.ads.usdToLocalRate;
}

export function localToUsd(local) {
  return local / config.ads.usdToLocalRate;
}

/** X Ads API budgets are "local micro" units: 1 unit of currency = 1,000,000 micro. */
export function usdToLocalMicro(usd) {
  return Math.round(usdToLocal(usd) * 1_000_000);
}

export function localMicroToUsd(micro) {
  return localToUsd(micro / 1_000_000);
}

/**
 * Decide whether a new campaign at `requestedDailyUsd` may launch given the
 * campaigns already active. Returns { ok, dailyUsd, reason }. The daily budget
 * is clamped to the per-campaign ceiling and, if needed, to whatever headroom
 * is left under the total ceiling.
 */
export function evaluateLaunchBudget(requestedDailyUsd, activeCampaigns = []) {
  const activeDailyUsd = activeCampaigns.reduce((sum, c) => sum + (c.dailyBudgetUsd || 0), 0);
  const headroom = ADS_POLICY.maxTotalDailyUsd - activeDailyUsd;

  if (headroom <= 0) {
    return { ok: false, dailyUsd: 0, reason: `Active campaigns already commit $${activeDailyUsd.toFixed(2)}/day of the $${ADS_POLICY.maxTotalDailyUsd} total cap.` };
  }

  const dailyUsd = Math.min(requestedDailyUsd, ADS_POLICY.maxDailyPerCampaignUsd, headroom);
  if (dailyUsd < 1) {
    return { ok: false, dailyUsd: 0, reason: `Only $${headroom.toFixed(2)}/day of headroom left under the total cap — not enough to run a campaign.` };
  }

  return { ok: true, dailyUsd, reason: dailyUsd < requestedDailyUsd ? `Clamped from $${requestedDailyUsd} to $${dailyUsd.toFixed(2)}/day by policy.` : 'Within policy.' };
}

/**
 * Judge a campaign from its accumulated stats.
 * @returns {{ verdict: 'keep'|'pause'|'too_early', reason: string, metrics: Object }}
 */
export function judgeCampaign(campaign, stats) {
  const impressions = stats.impressions || 0;
  const clicks = stats.urlClicks || 0;
  const spendUsd = stats.spendUsd || 0;
  const ctr = impressions > 0 ? (clicks / impressions) * 100 : 0;
  const cpc = clicks > 0 ? spendUsd / clicks : null;
  const metrics = { impressions, clicks, spendUsd, ctrPercent: Number(ctr.toFixed(2)), cpcUsd: cpc == null ? null : Number(cpc.toFixed(3)) };

  const launchedAt = new Date(campaign.launchedAt);
  const ageDays = (Date.now() - launchedAt.getTime()) / 86_400_000;
  if (ageDays < ADS_POLICY.trialDays) {
    return { verdict: 'too_early', reason: `${ageDays.toFixed(1)} days in; judged after ${ADS_POLICY.trialDays}.`, metrics };
  }

  if (clicks < ADS_POLICY.minTrialClicks) {
    return { verdict: 'pause', reason: `Only ${clicks} link click(s) after ${ADS_POLICY.trialDays} days (need ≥ ${ADS_POLICY.minTrialClicks}).`, metrics };
  }
  if (cpc != null && cpc > ADS_POLICY.maxCostPerClickUsd) {
    return { verdict: 'pause', reason: `Cost per click $${cpc.toFixed(2)} exceeds $${ADS_POLICY.maxCostPerClickUsd}.`, metrics };
  }
  if (impressions > 0 && ctr < ADS_POLICY.minCtrPercent) {
    return { verdict: 'pause', reason: `CTR ${ctr.toFixed(2)}% is below ${ADS_POLICY.minCtrPercent}%.`, metrics };
  }
  return { verdict: 'keep', reason: `Performing: ${clicks} clicks at $${(cpc ?? 0).toFixed(2)} CPC, CTR ${ctr.toFixed(2)}%.`, metrics };
}
