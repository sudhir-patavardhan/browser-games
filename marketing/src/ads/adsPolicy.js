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
  maxDailyPerCampaignUsd: config.ads.maxDailyPerCampaignUsd,   // the per-Campaign Cap
  maxTotalDailyUsd: config.ads.maxTotalDailyUsd,               // the Cap across every active Campaign
  // A Trial is three days and a Campaign always ends when it ends (ADR 0004).
  // Nothing is ever extended or scaled in place; a good result is a Winner in
  // its Post-mortem, which earns a fresh Campaign.
  trialDays: config.ads.trialDays,
  // The kill rules bite a day before the Trial is out, so a Campaign that is
  // clearly not working stops paying for its third day.
  judgingPointDays: 2,
  minTrialClicks: 3,          // fewer link clicks than this by the judging point
  maxCostPerClickUsd: 1.0,    // paying more than this per link click
  minCtrPercent: 0.25         // delivering impressions but converting below this
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
 * Applies the kill rules to a running Campaign.
 *
 * This decides only whether a kill rule fired. The Verdict — Paused or Ended —
 * is what the Producer writes to the ledger: Paused when this returns a kill,
 * Ended when the Trial runs out. A Campaign that is doing well is not "kept";
 * it finishes its Trial and its Post-mortem may label it a Winner.
 *
 * @returns {{ judged: boolean, kill: boolean, reason: string, metrics: Object }}
 *          `judged` is false before the judging point, when no kill rule has
 *          had long enough to mean anything.
 */
export function judgeCampaign(campaign, stats) {
  const impressions = stats.impressions || 0;
  const clicks = stats.urlClicks || 0;
  const spendUsd = stats.spendUsd || 0;
  const ctr = impressions > 0 ? (clicks / impressions) * 100 : 0;
  const cpc = clicks > 0 ? spendUsd / clicks : null;
  const metrics = { impressions, clicks, spendUsd, ctrPercent: Number(ctr.toFixed(2)), cpcUsd: cpc == null ? null : Number(cpc.toFixed(3)) };

  const ageDays = (Date.now() - new Date(campaign.launchedAt).getTime()) / 86_400_000;
  if (ageDays < ADS_POLICY.judgingPointDays) {
    return {
      judged: false,
      kill: false,
      reason: `${ageDays.toFixed(1)} days in; the kill rules apply from day ${ADS_POLICY.judgingPointDays}.`,
      metrics
    };
  }

  const killed = reason => ({ judged: true, kill: true, reason, metrics });

  if (clicks < ADS_POLICY.minTrialClicks) {
    return killed(`Only ${clicks} link click(s) by day ${ADS_POLICY.judgingPointDays} of the Trial (needs at least ${ADS_POLICY.minTrialClicks}).`);
  }
  if (cpc != null && cpc > ADS_POLICY.maxCostPerClickUsd) {
    return killed(`Cost per click $${cpc.toFixed(2)} is over $${ADS_POLICY.maxCostPerClickUsd}.`);
  }
  if (impressions > 0 && ctr < ADS_POLICY.minCtrPercent) {
    return killed(`CTR ${ctr.toFixed(2)}% is under ${ADS_POLICY.minCtrPercent}%.`);
  }

  return {
    judged: true,
    kill: false,
    reason: `Running its Trial out: ${clicks} clicks at $${(cpc ?? 0).toFixed(2)} CPC, CTR ${ctr.toFixed(2)}%.`,
    metrics
  };
}
