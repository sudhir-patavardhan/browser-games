import { ContentGenerator } from '../generator/contentGenerator.js';
import { CampaignPlanner } from '../generator/campaignPlanner.js';
import { OpportunityScout } from '../scout/opportunityScout.js';
import { QueueManager } from './queueManager.js';
import { VisualStudio } from '../studio/visualStudio.js';
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
  async runCycle({ dryRun = config.general.mode === 'draft', generateVisuals = true } = {}) {
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

    console.log(`\n🤖 ========================================================`);
    console.log(`🤖 KREEDA AUTONOMOUS MARKETING AGENT — CYCLE COMPLETE`);
    console.log(`🤖 ========================================================\n`);

    return summary;
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
