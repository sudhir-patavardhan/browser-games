import fs from 'node:fs';
import { config } from '../config.js';
import { GAME_CATALOG } from '../knowledge/catalog.js';
import { GeminiClient } from '../ai/geminiClient.js';
import { SYSTEM_PROMPTS, PROMPT_TEMPLATES } from '../ai/prompts.js';
import { TwitterPublisher } from '../publishers/twitterPublisher.js';
import { XAdsClient, AdsApiAccessError } from './xAdsClient.js';
import { ADS_POLICY, evaluateLaunchBudget, judgeCampaign, usdToLocalMicro, localToUsd } from './adsPolicy.js';
import { XMetrics } from '../insights/xMetrics.js';
import { VideoStudio } from '../studio/videoStudio.js';
import { TogetherDirector } from '../studio/togetherDirector.js';

const DEFAULT_COUNTRIES = ['US', 'GB', 'CA', 'AU', 'IN'];
const AGE_BUCKETS = new Set(['AGE_18_PLUS', 'AGE_21_TO_34', 'AGE_25_TO_34', 'AGE_35_TO_49', 'AGE_13_TO_24', 'AGE_50_PLUS']);

/**
 * Runs paid X campaigns end to end under the spend policy:
 *
 *   launch  → post the ad tweet, create campaign + line item + targeting,
 *             promote the tweet (≤ $10/day each, ≤ $25/day in total)
 *   review  → pull analytics for every active campaign, pause anything that
 *             failed its 2-day trial
 *   learn   → fold results into data/ads-learnings.json (aggregates + AI lessons)
 *   plan    → ask Gemini for the next brief given the learnings, then launch it
 *
 * Everything defaults to dry-run: no tweet is posted and no API call is made
 * unless { dryRun: false } is passed explicitly.
 */
export class CampaignManager {
  constructor({ ads = new XAdsClient(), twitter = new TwitterPublisher(), ai = new GeminiClient() } = {}) {
    this.ads = ads;
    this.twitter = twitter;
    this.ai = ai;
    this.ledgerFile = config.ads.ledgerFile;
    this.learningsFile = config.ads.learningsFile;
  }

  // ---------- persistence ----------

  loadLedger() {
    if (!fs.existsSync(this.ledgerFile)) return [];
    try { return JSON.parse(fs.readFileSync(this.ledgerFile, 'utf8')); } catch { return []; }
  }

  saveLedger(items) {
    fs.writeFileSync(this.ledgerFile, JSON.stringify(items, null, 2));
  }

  loadLearnings() {
    if (!fs.existsSync(this.learningsFile)) return null;
    try { return JSON.parse(fs.readFileSync(this.learningsFile, 'utf8')); } catch { return null; }
  }

  saveLearnings(data) {
    fs.writeFileSync(this.learningsFile, JSON.stringify(data, null, 2));
  }

  activeCampaigns(ledger = this.loadLedger()) {
    return ledger.filter(c => c.status === 'active');
  }

  status() {
    const ledger = this.loadLedger();
    const active = this.activeCampaigns(ledger);
    return {
      policy: { ...ADS_POLICY, maxActiveCampaigns: config.ads.maxActiveCampaigns, currency: config.ads.currency, usdToLocalRate: config.ads.usdToLocalRate },
      active: active.map(c => ({ id: c.id, name: c.name, gameId: c.gameId, angle: c.angle, dailyBudgetUsd: c.dailyBudgetUsd, launchedAt: c.launchedAt, lastStats: c.lastStats || null })),
      committedDailyUsd: active.reduce((s, c) => s + c.dailyBudgetUsd, 0),
      paused: ledger.filter(c => c.status === 'paused').length,
      simulated: ledger.filter(c => c.status === 'simulated').length
    };
  }

  // ---------- launch ----------

  /**
   * @param {Object} brief
   * @param {string} brief.gameId
   * @param {string} brief.tweetText   ad copy (no hashtags; must include the game URL)
   * @param {string} [brief.tweetId]   promote an existing tweet instead of posting one
   * @param {string} [brief.angle]
   * @param {string} [brief.headline]
   * @param {number} [brief.dailyBudgetUsd]
   * @param {string} [brief.ageBucket]
   * @param {string[]} [brief.interests]
   * @param {string[]} [brief.keywords]
   * @param {string[]} [brief.countries]
   * @param {string} [brief.videoPath]
   */
  async launch(brief, { dryRun = true } = {}) {
    const game = GAME_CATALOG[brief.gameId];
    if (!game) throw new Error(`Unknown game id "${brief.gameId}"`);
    if (!brief.tweetId && !brief.tweetText) throw new Error('A tweetText (or an existing tweetId) is required');
    if (brief.tweetText && /#\w/.test(brief.tweetText)) throw new Error('Ad text must not contain hashtags — X rejects them in promoted posts');

    const ledger = this.loadLedger();
    const active = this.activeCampaigns(ledger);
    if (active.length >= config.ads.maxActiveCampaigns) {
      return { launched: false, reason: `${active.length} campaign(s) already active (max ${config.ads.maxActiveCampaigns}).` };
    }

    const budget = evaluateLaunchBudget(brief.dailyBudgetUsd ?? ADS_POLICY.maxDailyPerCampaignUsd, active);
    if (!budget.ok) return { launched: false, reason: budget.reason };
    if (config.ads.currency !== 'USD' && config.ads.usdToLocalRate === 1) {
      return { launched: false, reason: `Account bills in ${config.ads.currency} but X_ADS_USD_TO_LOCAL_RATE is not set — refusing to launch with an unknown conversion.` };
    }

    const dailyUsd = budget.dailyUsd;
    // A campaign can never outspend its trial window even if the daily review is late.
    const totalUsd = dailyUsd * (ADS_POLICY.trialDays + 1);
    const now = new Date();
    const endTime = new Date(now.getTime() + (ADS_POLICY.trialDays + 1) * 86_400_000);
    const name = `[agent] ${game.name} — ${brief.angle || 'campaign'} — ${now.toISOString().slice(0, 10)}`;
    const targeting = {
      countries: brief.countries?.length ? brief.countries : DEFAULT_COUNTRIES,
      ageBucket: AGE_BUCKETS.has(brief.ageBucket) ? brief.ageBucket : 'AGE_18_PLUS',
      interests: brief.interests || [],
      keywords: brief.keywords || []
    };

    const record = {
      id: `ads-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      name,
      gameId: game.id,
      angle: brief.angle || 'campaign',
      tweetText: brief.tweetText || null,
      headline: brief.headline || null,
      targeting,
      dailyBudgetUsd: dailyUsd,
      totalBudgetUsd: totalUsd,
      currency: config.ads.currency,
      videoPath: brief.videoPath || null,
      launchedAt: now.toISOString(),
      endsAt: endTime.toISOString(),
      status: dryRun ? 'simulated' : 'active',
      lastStats: null,
      history: []
    };

    console.log(`\n💸 ${dryRun ? '[DRY-RUN] Would launch' : 'Launching'} "${name}" at $${dailyUsd}/day (cap $${totalUsd})${brief.videoPath ? ' with video creative' : ''} — ${budget.reason}`);

    if (dryRun) {
      record.tweetId = brief.tweetId || `sim-tweet-${Date.now()}`;
      record.campaignId = `sim-campaign-${Date.now()}`;
      /* A rehearsal, not a campaign: keep one per game per day and only the last
         ten overall, so the ledger stays readable while the Ads API approval is
         pending and every daily cycle rehearses a launch. */
      const today = now.toISOString().slice(0, 10);
      let kept = ledger.filter(c => !(c.status === 'simulated' && c.gameId === record.gameId && String(c.launchedAt).slice(0, 10) === today));
      const sims = kept.filter(c => c.status === 'simulated');
      if (sims.length >= 10) { const drop = new Set(sims.slice(0, sims.length - 9)); kept = kept.filter(c => !drop.has(c)); }
      kept.push(record);
      this.saveLedger(kept);
      return { launched: true, dryRun: true, campaign: record };
    }

    // 0. Never post the ad tweet if the Ads API can't take the campaign — an
    //    orphaned tweet on the timeline is the worst outcome of a failed launch.
    const probe = await this.ads.probeAccess();
    if (!probe.authorized) throw new AdsApiAccessError(probe.error);

    // 1. The creative: post the ad tweet (or reuse one).
    let tweetId = brief.tweetId;
    if (!tweetId) {
      const post = await this.twitter.publish({ text: brief.tweetText, videoPath: brief.videoPath }, false);
      if (!post.success) throw new Error(`Could not post the ad tweet: ${post.error}`);
      tweetId = post.postId;
    }
    record.tweetId = tweetId;

    // 2. Campaign → line item → targeting → promoted tweet.
    const funding = await this.ads.resolveFundingInstrument();
    const campaign = await this.ads.createCampaign({
      name,
      fundingInstrumentId: funding.id,
      dailyBudgetMicro: usdToLocalMicro(dailyUsd),
      totalBudgetMicro: usdToLocalMicro(totalUsd)
    });
    record.campaignId = campaign.id;

    const lineItem = await this.ads.createLineItem({
      campaignId: campaign.id,
      fundingInstrumentId: funding.id,
      name: `${game.name} — ${targeting.ageBucket}`,
      dailyBudgetMicro: usdToLocalMicro(dailyUsd),
      totalBudgetMicro: usdToLocalMicro(totalUsd),
      startTime: now.toISOString().replace(/\.\d{3}Z$/, 'Z'),
      endTime: endTime.toISOString().replace(/\.\d{3}Z$/, 'Z')
    });
    record.lineItemId = lineItem.id;

    for (const cc of targeting.countries) {
      await this.ads.addTargeting(lineItem.id, 'LOCATION', await this.ads.lookupCountry(cc));
    }
    await this.ads.addTargeting(lineItem.id, 'AGE', targeting.ageBucket);
    for (const interest of targeting.interests) {
      try {
        const hit = await this.ads.lookupInterest(interest);
        await this.ads.addTargeting(lineItem.id, 'INTEREST', hit.id);
      } catch (err) {
        console.warn(`  ⚠️ skipping interest "${interest}": ${err.message}`);
      }
    }
    for (const kw of targeting.keywords) {
      await this.ads.addTargeting(lineItem.id, 'BROAD_KEYWORD', kw);
    }

    await this.ads.promoteTweet(lineItem.id, tweetId);

    ledger.push(record);
    this.saveLedger(ledger);
    console.log(`✅ Live: campaign ${campaign.id}, line item ${lineItem.id}, promoting tweet ${tweetId}`);
    return { launched: true, dryRun: false, campaign: record };
  }

  // ---------- review ----------

  async review({ dryRun = true } = {}) {
    const ledger = this.loadLedger();
    const active = this.activeCampaigns(ledger);
    const results = [];
    if (active.length === 0) {
      console.log('📊 No active campaigns to review.');
      return results;
    }

    const now = new Date();
    const stats = await this.ads.getCampaignStats(
      active.map(c => c.campaignId),
      new Date(Math.min(...active.map(c => new Date(c.launchedAt).getTime()))),
      now
    );

    for (const campaign of active) {
      const raw = stats[campaign.campaignId] || { impressions: 0, urlClicks: 0, engagements: 0, spendLocal: 0 };
      const normalized = { ...raw, spendUsd: Number(localToUsd(raw.spendLocal).toFixed(2)) };
      const judgement = judgeCampaign(campaign, normalized);

      campaign.lastStats = { at: now.toISOString(), ...normalized, ...judgement.metrics };
      campaign.history.push({ at: now.toISOString(), ...judgement.metrics, killed: judgement.kill });

      console.log(`📊 ${campaign.name}: ${judgement.metrics.impressions} imp · ${judgement.metrics.clicks} clicks · $${judgement.metrics.spendUsd} · CTR ${judgement.metrics.ctrPercent}% → ${judgement.kill ? 'Paused' : 'running'} (${judgement.reason})`);

      if (judgement.kill) {
        if (!dryRun) await this.ads.setCampaignStatus(campaign.campaignId, 'PAUSED');
        campaign.status = 'paused';
        campaign.pausedAt = now.toISOString();
        campaign.pausedReason = judgement.reason;
        console.log(`  ⏸ ${dryRun ? '[DRY-RUN] would pause' : 'paused'} — ${judgement.reason}`);
      }
      results.push({ id: campaign.id, name: campaign.name, ...judgement });
    }

    this.saveLedger(ledger);
    return results;
  }

  // ---------- learn ----------

  async learn() {
    const ledger = this.loadLedger();
    const judged = ledger.filter(c => c.lastStats && c.status !== 'simulated');
    if (judged.length === 0) {
      console.log('🧠 Nothing to learn from yet (no campaign has stats).');
      return this.loadLearnings();
    }

    const records = judged
      .sort((a, b) => new Date(b.launchedAt) - new Date(a.launchedAt))
      .slice(0, 20)
      .map(c => ({
        game: c.gameId, angle: c.angle, ageBucket: c.targeting.ageBucket,
        interests: c.targeting.interests, keywords: c.targeting.keywords,
        spendUsd: c.lastStats.spendUsd, impressions: c.lastStats.impressions, clicks: c.lastStats.clicks,
        ctrPercent: c.lastStats.ctrPercent, cpcUsd: c.lastStats.cpcUsd,
        outcome: c.status === 'paused' ? `paused: ${c.pausedReason}` : 'kept running'
      }));

    const byGame = {};
    for (const r of records) {
      const g = (byGame[r.game] ||= { campaigns: 0, spendUsd: 0, clicks: 0, impressions: 0 });
      g.campaigns++; g.spendUsd += r.spendUsd; g.clicks += r.clicks; g.impressions += r.impressions;
    }
    for (const g of Object.values(byGame)) {
      g.cpcUsd = g.clicks ? Number((g.spendUsd / g.clicks).toFixed(3)) : null;
      g.ctrPercent = g.impressions ? Number(((g.clicks / g.impressions) * 100).toFixed(2)) : 0;
    }

    let lessons = [];
    let recommendedNext = '';
    if (this.ai.isConfigured) {
      const analysis = await this.ai.generate({
        prompt: PROMPT_TEMPLATES.adsLearningsSummary(records),
        systemInstruction: SYSTEM_PROMPTS.marketingStrategist,
        jsonMode: true
      });
      lessons = Array.isArray(analysis.lessons) ? analysis.lessons : [];
      recommendedNext = analysis.recommendedNext || '';
    }

    const learnings = { updatedAt: new Date().toISOString(), byGame, records, lessons, recommendedNext };
    this.saveLearnings(learnings);
    console.log(`🧠 Learnings updated from ${records.length} campaign(s)${lessons.length ? `: ${lessons[0]}` : ''}`);
    return learnings;
  }

  // ---------- plan ----------

  /**
   * @param {Object} [opts]
   * @param {boolean} [opts.dryRun]
   * @param {boolean|'auto'} [opts.video]  render the storyboard video for a
   *   Play-together brief: 'auto' = only for a live launch (rendering takes
   *   ~40 s and needs Chromium), true = always, false = never
   */
  async planNext({ dryRun = true, video = 'auto' } = {}) {
    const ledger = this.loadLedger();
    const active = this.activeCampaigns(ledger);
    if (active.length >= config.ads.maxActiveCampaigns) {
      return { launched: false, reason: `${active.length} campaign(s) active — waiting for the trial reviews before launching more.` };
    }
    const budget = evaluateLaunchBudget(ADS_POLICY.maxDailyPerCampaignUsd, active);
    if (!budget.ok) return { launched: false, reason: budget.reason };

    // Going live? Check the API will take a campaign before filming or posting anything.
    if (!dryRun) {
      const probe = await this.ads.probeAccess();
      if (!probe.authorized) throw new AdsApiAccessError(probe.error);
    }

    const catalog = Object.values(GAME_CATALOG).filter(g => g.id !== 'hub').map(g => ({ id: g.id, name: g.name, tagline: g.tagline, url: g.url, category: g.category }));
    const learnings = this.loadLearnings();
    const organic = new XMetrics().summarizeByGame();   // what our own posts earned, per game

    let brief;
    if (this.ai.isConfigured) {
      brief = await this.ai.generate({
        prompt: PROMPT_TEMPLATES.adsCampaignBrief({ catalog, learnings, organic, activeCampaigns: active, dailyBudgetUsd: budget.dailyUsd }),
        systemInstruction: SYSTEM_PROMPTS.marketingStrategist,
        jsonMode: true
      });
    }
    brief = this.sanitizeBrief(brief, catalog, active);
    brief.dailyBudgetUsd = budget.dailyUsd;

    /* A Play-together game is promoted with its storyboard film — a video
       creative in the promoted post earns far more than a text card, and it
       is the same film the organic cadence posts. A render failure falls back
       to a text ad rather than blocking the launch. */
    const wantsVideo = video === true || (video === 'auto' && !dryRun);
    if (wantsVideo && TogetherDirector.hasStoryboard(brief.gameId)) {
      try {
        const out = await new VideoStudio().generateTogetherVideo(brief.gameId);
        brief.videoPath = out.mp4Path;
        console.log(`🎬 Video creative: ${out.mp4Path} (${out.seconds}s)`);
      } catch (err) {
        console.warn(`  ⚠️ video creative skipped, launching a text ad instead: ${err.message}`);
      }
    }

    console.log(`🧭 Next brief: ${brief.gameId} / ${brief.angle} — ${brief.rationale || 'deterministic fallback'}`);
    return this.launch(brief, { dryRun });
  }

  /**
   * Readiness checklist for going live — what is in place and what is still
   * missing, in one call, without launching or posting anything.
   */
  async preflight() {
    const checks = [];
    const add = (label, ok, detail = '') => checks.push({ label, ok: Boolean(ok), detail });
    add('Gemini key', this.ai.isConfigured, this.ai.isConfigured ? 'briefs written by Gemini' : 'briefs use the deterministic fallback');
    add('X posting keys', this.twitter.isConfigured, this.twitter.isConfigured ? 'OAuth 1.0a user context' : 'need TWITTER_API_KEY/SECRET + ACCESS_TOKEN/SECRET');
    add('Ads account id', Boolean(config.ads.accountId), config.ads.accountId || 'set X_ADS_ACCOUNT_ID');
    add('Currency rate', config.ads.currency === 'USD' || config.ads.usdToLocalRate !== 1, `${config.ads.currency} @ ${config.ads.usdToLocalRate} per USD`);
    let access = { authorized: false, error: 'Ads client not configured' };
    if (this.ads.isConfigured) {
      try { access = await this.ads.probeAccess(); } catch (err) { access = { authorized: false, error: err.message }; }
    }
    add('Ads API approval', access.authorized, access.authorized ? `${access.accounts.length} account(s) visible` : access.error);
    if (access.authorized) {
      try { const f = await this.ads.resolveFundingInstrument(); add('Funding instrument', true, f.id); }
      catch (err) { add('Funding instrument', false, err.message); }
    }
    const boards = TogetherDirector.storyboardGames();
    add('Video storyboards', boards.length > 0, boards.join(', '));
    const st = this.status();
    add('Budget headroom', st.committedDailyUsd < ADS_POLICY.maxTotalDailyUsd, `$${st.committedDailyUsd}/day committed of $${ADS_POLICY.maxTotalDailyUsd}/day`);
    return { ready: checks.every(c => c.ok), checks, status: st };
  }

  /** Makes an AI brief safe to launch, or builds a deterministic one without AI. */
  sanitizeBrief(brief, catalog, active) {
    const activeIds = new Set(active.map(c => c.gameId));
    const fallbackGame = catalog.find(g => !activeIds.has(g.id)) || catalog[0];
    const game = GAME_CATALOG[brief?.gameId] && brief.gameId !== 'hub' ? GAME_CATALOG[brief.gameId] : GAME_CATALOG[fallbackGame.id];

    let text = String(brief?.tweetText || `${game.tagline} ${game.pitch.split('. ')[0]}. Free in your browser: ${game.url}`);
    text = text.replace(/#\w+/g, '').replace(/\s{2,}/g, ' ').trim();
    if (!text.includes(game.url)) text = `${text} ${game.url}`.trim();
    if (text.length > 260) text = `${text.slice(0, 260 - game.url.length - 2).trim()} ${game.url}`;

    return {
      gameId: game.id,
      angle: String(brief?.angle || game.category || 'launch').slice(0, 60),
      tweetText: text,
      headline: brief?.headline ? String(brief.headline).slice(0, 50) : `Play ${game.name} free — no download`,
      ageBucket: AGE_BUCKETS.has(brief?.ageBucket) ? brief.ageBucket : 'AGE_18_PLUS',
      interests: Array.isArray(brief?.interests) ? brief.interests.slice(0, 3).map(String) : ['Gaming'],
      keywords: Array.isArray(brief?.keywords) ? brief.keywords.slice(0, 7).map(String) : ['browser games', 'indie games'],
      rationale: brief?.rationale || ''
    };
  }

  // ---------- daily cycle ----------

  async runCycle({ dryRun = true, video = 'auto' } = {}) {
    console.log(`\n💸 ADS CYCLE (${dryRun ? 'DRY-RUN' : 'LIVE'}) — policy: ≤ $${ADS_POLICY.maxDailyPerCampaignUsd}/day per campaign, ≤ $${ADS_POLICY.maxTotalDailyUsd}/day total, ${ADS_POLICY.trialDays}-day trial`);
    const summary = { reviewed: [], learned: null, planned: null, blocked: null, status: null };
    try {
      summary.reviewed = await this.review({ dryRun });
      summary.learned = await this.learn();
      summary.planned = await this.planNext({ dryRun, video });
    } catch (err) {
      if (err instanceof AdsApiAccessError) {
        console.warn(`⚠️ ${err.message}`);
        summary.blocked = err.message;
      } else {
        throw err;
      }
    }
    summary.status = this.status();
    return summary;
  }
}
