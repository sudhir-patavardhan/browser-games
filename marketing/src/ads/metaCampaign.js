/**
 * Launching a Facebook Campaign (§8.2, ADR 0004).
 *
 * The same money-safe order as X, for the same reason: at every moment either
 * nothing can spend, or the ledger already knows about the thing that can.
 *
 *   probe access -> Campaign PAUSED -> **write the ledger** -> Ad Set PAUSED
 *   -> card + creative -> Ad PAUSED -> activate Ad, Ad Set, Campaign last
 *
 * A failure anywhere after the ledger write leaves a visible, paused, unbilled
 * record the next Cycle can clean up.
 *
 * The Trial is enforced twice over. Meta gets an `end_time` on the Ad Set, so
 * it stops the Campaign itself even if no Cycle ever runs again; and the
 * Producer's kill rules stop it earlier if it is clearly not working.
 */

import fs from 'node:fs';
import { config } from '../config.js';
import { FACEBOOK } from '../knowledge/channels.js';
import { GAME_CATALOG } from '../knowledge/catalog.js';
import { ADS_POLICY, trialIsOver, endTrial, evaluateLaunchBudget, judgeCampaign } from './adsPolicy.js';
import { MetaAdsClient, MetaAdsAccessError } from './metaAdsClient.js';

export class MetaCampaignManager {
  constructor({ ads = new MetaAdsClient(), ledgerFile = config.ads.ledgerFile } = {}) {
    this.ads = ads;
    this.ledgerFile = ledgerFile;
  }

  loadLedger() {
    if (!fs.existsSync(this.ledgerFile)) return [];
    try { return JSON.parse(fs.readFileSync(this.ledgerFile, 'utf8')); } catch { return []; }
  }

  saveLedger(items) {
    fs.writeFileSync(this.ledgerFile, `${JSON.stringify(items, null, 2)}\n`);
  }

  /** Every Campaign still spending, on either Channel: the Caps are shared. */
  activeCampaigns(ledger = this.loadLedger()) {
    return ledger.filter(c => c.status === 'active');
  }

  /**
   * The active Facebook Campaigns — the only ones whose ids the Marketing API
   * can resolve. The Caps are counted across both Channels; the stats are not.
   */
  activeFacebookCampaigns(ledger = this.loadLedger()) {
    return this.activeCampaigns(ledger).filter(c => c.channel === FACEBOOK);
  }

  /**
   * Applies the kill rules to every active Facebook Campaign (§8.2).
   *
   * The same policy as X, read through Meta's insights: a Campaign that is not
   * working stops paying for the rest of its Trial. Meta's own `end_time` on
   * the Ad Set still ends the Trial if no Cycle ever runs again; this only ever
   * ends one earlier.
   *
   * @returns {Promise<Object[]>} one judgement per Campaign.
   */
  async review({ dryRun = true } = {}) {
    const ledger = this.loadLedger();
    const active = this.activeFacebookCampaigns(ledger);
    const results = [];
    if (active.length === 0) {
      console.log('📊 No active Facebook Campaign to review.');
      return results;
    }

    const now = new Date();
    const day = d => new Date(d).toISOString().slice(0, 10);

    for (const campaign of active) {
      const raw = await this.ads.campaignStats(campaign.campaignId, {
        since: day(campaign.launchedAt),
        until: day(now)
      });
      // Meta reports spend in the account's own currency and the client has
      // already converted it; unlike X, there is nothing left to convert.
      const normalized = { ...raw, spendUsd: Number((raw.spendUsd || 0).toFixed(2)) };
      const judgement = judgeCampaign(campaign, normalized);

      campaign.lastStats = { at: now.toISOString(), ...normalized, ...judgement.metrics };
      (campaign.history ||= []).push({ at: now.toISOString(), ...judgement.metrics, killed: judgement.kill });

      console.log(`📊 ${campaign.name}: ${judgement.metrics.impressions} imp · ${judgement.metrics.clicks} clicks · $${judgement.metrics.spendUsd} · CTR ${judgement.metrics.ctrPercent}% → ${judgement.kill ? 'Paused' : 'running'} (${judgement.reason})`);

      // The Verdict comes after the reading — see the same order on the X
      // side. Meta's own end_time has already stopped delivery, so Ending asks
      // nothing of the Channel and a dry run records it too.
      if (trialIsOver(campaign, now)) {
        results.push(endTrial(campaign, now));
        console.log(`  🏁 Ended — its ${ADS_POLICY.trialDays}-day Trial ran its course; $${campaign.dailyBudgetUsd}/day is headroom again.`);
        continue;
      }

      if (judgement.kill) {
        // A dry run pauses nothing on the Channel, so it must not write the
        // Verdict either — see the same guard on the X side. Pausing the
        // Campaign stops the Ad Set and the Ad under it.
        if (!dryRun) {
          await this.ads.setStatus(campaign.campaignId, 'PAUSED');
          campaign.status = 'paused';
          campaign.pausedAt = now.toISOString();
          campaign.pausedReason = judgement.reason;
        }
        console.log(`  ⏸ ${dryRun ? '[DRY-RUN] would pause' : 'paused'} — ${judgement.reason}`);
      }
      results.push({ id: campaign.id, name: campaign.name, channel: FACEBOOK, ...judgement });
    }

    this.saveLedger(ledger);
    return results;
  }

  /**
   * Removes what a failed launch left behind (§8.2).
   *
   * A launch that died partway leaves a paused Campaign, and possibly an Ad
   * Set under it, that will never deliver and that nobody would think to look
   * for. The ledger knows their ids because it was written before any of them
   * existed, so cleaning up is a lookup rather than a search.
   *
   * @returns {Promise<{ cleaned: string[], failed: string[] }>}
   */
  async cleanUpFailedLaunches({ dryRun = true } = {}) {
    const ledger = this.loadLedger();
    const broken = ledger.filter(r => r.status === 'launch_failed' && r.channel === FACEBOOK && r.campaignId);
    const cleaned = [];
    const failed = [];

    for (const record of broken) {
      if (dryRun) { cleaned.push(record.campaignId); continue; }
      try {
        // Deleting the Campaign takes its Ad Sets and Ads with it.
        await this.ads.request('DELETE', `/${record.campaignId}`);
        record.status = 'cleaned_up';
        record.cleanedAt = new Date().toISOString();
        cleaned.push(record.campaignId);
      } catch (err) {
        record.cleanUpError = err.message;
        failed.push(`${record.campaignId}: ${err.message}`);
      }
    }

    if (!dryRun && broken.length) this.saveLedger(ledger);
    return { cleaned, failed };
  }

  /**
   * Launches one Facebook Campaign.
   *
   * @param {Object} brief
   * @param {string} brief.gameId
   * @param {string} brief.message the ad copy — no hashtags, no @mentions (§9).
   * @param {string} brief.link the bare catalog URL; decorated here.
   * @param {string} [brief.headline]
   * @param {string} [brief.imagePath] a rendered card.
   * @param {number} [brief.dailyBudgetUsd]
   * @param {string[]} [brief.countries]
   * @param {Object} [options]
   * @param {boolean} [options.dryRun] default true.
   * @param {boolean} [options.activate] default true; false leaves it paused.
   */
  async launch(brief, { dryRun = true, activate = true } = {}) {
    const game = GAME_CATALOG[brief.gameId];
    if (!game) throw new Error(`Unknown Game "${brief.gameId}"`);
    if (!brief.message) throw new Error('A message is required — an ad with no copy is not an ad');
    if (/#\w/.test(brief.message)) throw new Error('Ad copy must not contain hashtags (rule 3)');

    const ledger = this.loadLedger();
    const active = this.activeCampaigns(ledger);
    if (active.length >= config.ads.maxActiveCampaigns) {
      return { launched: false, reason: `${active.length} Campaign(s) already active (max ${config.ads.maxActiveCampaigns}) across both Channels.` };
    }

    const budget = evaluateLaunchBudget(brief.dailyBudgetUsd ?? 5, active);
    if (!budget.ok) return { launched: false, reason: budget.reason };

    const dailyUsd = budget.dailyUsd;
    const now = new Date();
    const endTime = new Date(now.getTime() + ADS_POLICY.trialDays * 86_400_000);
    const name = `[agent] ${game.name} — ${brief.angle || 'campaign'} — ${now.toISOString().slice(0, 10)}`;

    const record = {
      id: `ads-fb-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      channel: FACEBOOK,
      name,
      gameId: game.id,
      angle: brief.angle || 'campaign',
      message: brief.message,
      link: brief.link || game.url,
      dailyBudgetUsd: dailyUsd,
      totalBudgetUsd: dailyUsd * ADS_POLICY.trialDays,
      currency: this.ads.currency,
      launchedAt: now.toISOString(),
      endsAt: endTime.toISOString(),
      status: dryRun ? 'simulated' : 'launching',
      lastStats: null,
      history: []
    };

    if (dryRun) {
      record.campaignId = `sim-fb-${Date.now()}`;
      this.saveLedger([...ledger, record]);
      return { launched: true, dryRun: true, campaign: record };
    }

    // 1. Access first: a Campaign created against an account that cannot spend
    //    is a Campaign that has to be cleaned up.
    const probe = await this.ads.probeAccess();
    if (!probe.authorized) throw new MetaAdsAccessError(probe.error);
    if (!probe.active) throw new MetaAdsAccessError(`The ad account is not active (status ${probe.accountStatus}), so nothing would deliver.`);
    if (!probe.funded) throw new MetaAdsAccessError('The ad account has no payment method, so nothing would deliver.');

    // 2. The Campaign, paused.
    const campaign = await this.ads.createCampaign({ name });
    record.campaignId = campaign.id;

    // 3. The ledger, immediately.
    ledger.push(record);
    this.saveLedger(ledger);

    try {
      // 4. The Ad Set: the money, the audience, and the end of the Trial.
      const adSet = await this.ads.createAdSet({
        campaignId: campaign.id,
        name: `${game.name} — ${brief.countries?.join('/') || 'IN'}`,
        dailyUsd,
        endTime: endTime.toISOString(),
        countries: brief.countries || ['IN'],
        ageMin: brief.ageMin || 18,
        ageMax: brief.ageMax || 65
      });
      record.adSetId = adSet.id;
      this.saveLedger(ledger);

      // 5. The card, then the creative that shows it.
      let imageHash = null;
      if (brief.imagePath) imageHash = await this.ads.uploadImage(brief.imagePath);

      const creative = await this.ads.createCreative({
        name: `${game.name} — creative`,
        message: brief.message,
        link: record.link,
        headline: brief.headline || game.tagline,
        description: brief.description || null,
        imageHash
      });
      record.creativeId = creative.id;
      this.saveLedger(ledger);

      // 6. The Ad, paused.
      const ad = await this.ads.createAd({ adSetId: adSet.id, creativeId: creative.id, name: `${game.name} — ad` });
      record.adId = ad.id;
      this.saveLedger(ledger);

      // 7. Only now can anything spend, and only if asked.
      if (activate) {
        await this.ads.setStatus(ad.id, 'ACTIVE');
        await this.ads.setStatus(adSet.id, 'ACTIVE');
        await this.ads.setStatus(campaign.id, 'ACTIVE');
        record.status = 'active';
      } else {
        record.status = 'paused';
      }
      this.saveLedger(ledger);

      return { launched: true, dryRun: false, campaign: record };
    } catch (err) {
      record.status = 'launch_failed';
      record.launchError = err.message;
      this.saveLedger(ledger);
      throw err;
    }
  }
}
