import path from 'node:path';
import { ContentGenerator } from '../generator/contentGenerator.js';
import { CampaignPlanner } from '../generator/campaignPlanner.js';
import { TogetherPromoter } from '../generator/togetherPromoter.js';
import { OpportunityScout } from '../scout/opportunityScout.js';
import { QueueManager } from './queueManager.js';
import { VisualStudio } from '../studio/visualStudio.js';
import { CampaignManager } from '../ads/campaignManager.js';
import { XMetrics } from '../insights/xMetrics.js';
import { writeCycleReport } from '../reports/cycleReport.js';
import { config } from '../config.js';

export class AutonomousRunner {
  constructor() {
    this.generator = new ContentGenerator();
    this.planner = new CampaignPlanner(this.generator);
    this.scout = new OpportunityScout();
    this.queue = new QueueManager();
    this.studio = new VisualStudio();
  }

  /**
   * Executes one full autonomous cycle
   */
  async runCycle({ dryRun = config.general.mode === 'draft', generateVisuals = true, together = true } = {}) {
    console.log(`\n🤖 ========================================================`);
    console.log(`🤖 KREEDA AUTONOMOUS MARKETING AGENT — CYCLE START`);
    console.log(`🤖 Mode: ${dryRun ? 'DRAFT / SIMULATION' : 'LIVE PUBLISHING'}`);
    console.log(`🤖 Time: ${new Date().toISOString()}`);
    console.log(`🤖 ========================================================\n`);

    const summary = {
      timestamp: new Date().toISOString(),
      mode: dryRun ? 'draft' : 'live',
      actions: {}
    };

    // 1. Check queue fullness (ensure at least 7 days of scheduled content)
    const pending = this.queue.getAll().filter(i => i.status === 'scheduled' || i.status === 'approved');
    console.log(`📊 Queue status: ${pending.length} upcoming scheduled posts.`);

    if (pending.length < 5) {
      console.log(`✨ Queue is low. Autonomous planner generating new weekly campaign plan...`);
      const weeklyPlan = await this.planner.planWeeklyCalendar();
      this.queue.add(weeklyPlan.items);
      summary.actions.plannedPosts = weeklyPlan.items.length;
      console.log(`✅ Added ${weeklyPlan.items.length} new scheduled campaign items to queue.`);
    } else {
      summary.actions.plannedPosts = 0;
      console.log(`✅ Queue has sufficient buffer.`);
    }

    // 2. Scout new community opportunities & draft responses
    console.log(`\n🔍 Running Opportunity Scout on community topics...`);
    const scoutLeads = await this.scout.scanSimulatedFeeds();
    summary.actions.scoutedLeads = scoutLeads.length;
    console.log(`✅ Found and evaluated ${scoutLeads.length} leads.`);

    // 3. Process due posts
    console.log(`\n📡 Processing due posts in queue...`);
    const published = await this.queue.processDueQueue(dryRun);
    summary.actions.publishedPosts = published.length;
    console.log(`✅ Processed ${published.length} posts.`);

    // 4. Generate social visual cards if needed
    if (generateVisuals) {
      console.log(`\n🎨 Refreshing visual cards in studio...`);
      const cards = this.studio.generateAllCards();
      summary.actions.generatedCards = Object.keys(cards).length;
      console.log(`✅ Generated ${Object.keys(cards).length} visual cards.`);
    }

    // 5. Play-together video: film one storyboarded game and post it, on the cadence
    if (config.together.enabled && together) {
      const promoter = new TogetherPromoter();
      const state = promoter.loadState();
      if (promoter.isDue(state)) {
        const gameId = promoter.nextGame(state);
        console.log(`\n🎬 Play-together video is due — filming ${gameId}...`);
        try {
          const r = await promoter.promote({ gameId, dryRun });
          summary.actions.togetherVideo = {
            gameId, mode: r.publishResult.mode, postId: r.publishResult.postId || null, url: r.publishResult.url || null,
            text: r.text, renderSeconds: r.renderSeconds, videoFile: r.videoPath ? path.basename(r.videoPath) : null
          };
        } catch (err) {
          console.warn(`⚠️ Play-together video skipped: ${err.message}`);
          summary.actions.togetherVideo = { skipped: err.message };
        }
      } else {
        const due = new Date(new Date(state.lastPostedAt).getTime() + config.together.cadenceDays * 86_400_000);
        summary.actions.togetherVideo = { skipped: `next due ${due.toISOString().slice(0, 10)} (every ${config.together.cadenceDays} days; last: ${state.lastGameId})` };
        console.log(`\n🎬 Play-together video: ${summary.actions.togetherVideo.skipped}`);
      }
    }

    // 6. Paid campaigns: review yesterday's, learn, launch the next one (policy-capped)
    if (config.ads.enabled) {
      const ads = await new CampaignManager().runCycle({ dryRun });
      summary.actions.ads = {
        reviewed: ads.reviewed.length,
        paused: ads.reviewed.filter(r => r.verdict === 'pause').length,
        launched: Boolean(ads.planned?.launched),
        plannedBrief: ads.planned?.campaign
          ? { gameId: ads.planned.campaign.gameId, angle: ads.planned.campaign.angle, videoPath: ads.planned.campaign.videoPath || null, dryRun: Boolean(ads.planned.dryRun) }
          : null,
        blocked: ads.blocked || null,
        committedDailyUsd: ads.status?.committedDailyUsd ?? null,
        policy: ads.status?.policy || null
      };
    } else {
      console.log(`\n💸 X Ads: skipped (set X_ADS_ACCOUNT_ID to enable paid campaigns).`);
    }

    // 7. Organic feedback: refresh metrics for the tweets the agent posted live
    try {
      const m = await new XMetrics().refresh();
      summary.actions.metrics = { fetched: m.fetched, summary: m.summary };
    } catch (err) {
      console.warn(`⚠️ metrics refresh failed: ${err.message}`);
      summary.actions.metrics = { fetched: 0, summary: {}, note: `metrics refresh failed: ${err.message}` };
    }

    // 8. The cycle report — this is the body of the auto-update pull request
    summary.action = 'full_cycle';
    summary.nextSteps = this.nextSteps(summary);
    const reportPath = writeCycleReport(summary);
    console.log(`\n📝 Cycle report written to ${reportPath}`);

    console.log(`\n🤖 ========================================================`);
    console.log(`🤖 KREEDA AUTONOMOUS MARKETING AGENT — CYCLE COMPLETE`);
    console.log(`🤖 ========================================================\n`);

    return summary;
  }

  /** What a human should do next, derived from what this cycle could and couldn't do. */
  nextSteps(summary) {
    const steps = [];
    const a = summary.actions || {};
    if (summary.mode !== 'live') steps.push('Everything above was a rehearsal. Run the workflow with mode=live (or set MARKETING_MODE=live) to post for real.');
    if (a.ads?.blocked) steps.push(`X Ads: ${a.ads.blocked}`);
    if (!config.ads.enabled) steps.push('X Ads: set X_ADS_ACCOUNT_ID (and currency/rate) to let the agent rehearse and, once approved, run campaigns.');
    if (a.togetherVideo?.skipped && /storyboard|chromium|browser/i.test(a.togetherVideo.skipped)) steps.push('Video: run `npx playwright install --with-deps chromium` in marketing/ so storyboards can be filmed.');
    if (!(a.metrics?.fetched > 0)) steps.push('Organic metrics begin once posts go out live; the ads planner reads them to pick games and angles.');
    return steps;
  }

  /**
   * Starts a continuous autonomous agent loop
   * @param {number} intervalMinutes - Interval in minutes (e.g. 60)
   */
  startDaemon(intervalMinutes = 60) {
    console.log(`🚀 Starting Autonomous Marketing Daemon (Interval: ${intervalMinutes} minutes)...`);
    this.runCycle();

    const intervalMs = intervalMinutes * 60 * 1000;
    const timer = setInterval(() => {
      this.runCycle().catch(err => console.error('Error in agent cycle:', err));
    }, intervalMs);

    return timer;
  }
}
