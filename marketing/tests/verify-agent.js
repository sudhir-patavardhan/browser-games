import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';

import { config } from '../src/config.js';
import { GAME_CATALOG } from '../src/knowledge/catalog.js';
import { AUDIENCES } from '../src/knowledge/audiences.js';
import { ContentGenerator } from '../src/generator/contentGenerator.js';
import { CampaignPlanner } from '../src/generator/campaignPlanner.js';
import { OpportunityScout } from '../src/scout/opportunityScout.js';
import { VisualStudio } from '../src/studio/visualStudio.js';
import { QueueManager } from '../src/scheduler/queueManager.js';
import { UniversalPublisher } from '../src/publishers/index.js';
import { AutonomousRunner } from '../src/scheduler/autonomousRunner.js';

console.log('🧪 Starting Marketing Agent Verification Suite...\n');

async function runTests() {
  let passed = 0;
  let total = 0;

  function test(name, fn) {
    total++;
    try {
      fn();
      console.log(`  ✅ PASS: ${name}`);
      passed++;
    } catch (e) {
      console.error(`  ❌ FAIL: ${name}`);
      console.error(e);
    }
  }

  async function asyncTest(name, fn) {
    total++;
    try {
      await fn();
      console.log(`  ✅ PASS: ${name}`);
      passed++;
    } catch (e) {
      console.error(`  ❌ FAIL: ${name}`);
      console.error(e);
    }
  }

  // 1. Catalog & Audiences
  test('Catalog includes the hub, the arcade games and the five Play-together games', () => {
    const expected = ['hub', 'drift', 'carrom', 'break-room', 'chroma-blocks', 'last-16', 'road-rumble', 'fairway-four', 'ennead', 'dasanana', 'blackjack',
      'sync', 'windows', 'split', 'auction', 'fathom'];
    for (const key of expected) {
      assert.ok(GAME_CATALOG[key], `Missing catalog entry: ${key}`);
      assert.ok(GAME_CATALOG[key].name, `Missing name for ${key}`);
      assert.ok(GAME_CATALOG[key].url, `Missing url for ${key}`);
      assert.ok(GAME_CATALOG[key].tagline, `Missing tagline for ${key}`);
    }
  });

  test('Audiences configuration is populated', () => {
    assert.ok(AUDIENCES.personas.casual_gamers);
    assert.ok(AUDIENCES.channels.twitter);
    assert.ok(AUDIENCES.channels.reddit.subreddits.length >= 4);
  });

  // 2. Content Generator
  await asyncTest('Content Generator produces valid outputs for all channels', async () => {
    const gen = new ContentGenerator();
    
    // Twitter Single
    const tw = await gen.generate('drift', 'twitter', { isThread: false });
    assert.ok(tw.content);
    assert.ok(fs.existsSync(tw.artifactPath));

    // Twitter Thread
    const th = await gen.generate('carrom', 'twitter', { isThread: true });
    assert.ok(th.content);

    // Reddit
    const rd = await gen.generate('break-room', 'reddit', { subreddit: 'r/webgames' });
    assert.ok(rd.content);

    // Hacker News
    const hn = await gen.generate('ennead', 'hackernews');
    assert.ok(hn.content);

    // Shorts
    const sh = await gen.generate('road-rumble', 'shorts');
    assert.ok(sh.content);

    // Dev.to
    const dt = await gen.generate('apogee', 'devto');
    assert.ok(dt.content);
  });

  // 3. Campaign Planner
  await asyncTest('Campaign Planner creates a structured 7-day calendar', async () => {
    const planner = new CampaignPlanner();
    const plan = await planner.planWeeklyCalendar();
    assert.strictEqual(plan.items.length, 7);
    assert.strictEqual(plan.items[0].dayOfWeek, 'Monday');
    assert.strictEqual(plan.items[6].dayOfWeek, 'Sunday');
  });

  // 4. Visual Studio
  test('Visual Studio produces valid SVG cards for games', () => {
    const studio = new VisualStudio();
    const cardPath = studio.generateSocialCard('drift');
    assert.ok(fs.existsSync(cardPath));
    const content = fs.readFileSync(cardPath, 'utf8');
    assert.ok(content.includes('<svg'));
    assert.ok(content.includes('Drift'));
  });

  // 5. Opportunity Scout
  await asyncTest('Opportunity Scout evaluates leads and assigns relevance', async () => {
    const scout = new OpportunityScout();
    const leads = await scout.scanSimulatedFeeds();
    assert.ok(leads.length > 0);
    assert.ok(leads[0].relevanceScore >= 0);
    assert.ok(leads[0].draftReply);
  });

  // 6. Queue Manager
  test('Queue Manager handles adding, filtering, and approving items', () => {
    const testQueuePath = path.join(config.paths.data, 'test-queue.json');
    if (fs.existsSync(testQueuePath)) fs.unlinkSync(testQueuePath);

    const queue = new QueueManager(testQueuePath);
    queue.add([
      { id: 'test-1', status: 'draft', channel: 'twitter', gameId: 'drift' },
      { id: 'test-2', status: 'scheduled', channel: 'reddit', gameId: 'carrom' }
    ]);

    assert.strictEqual(queue.getAll().length, 2);
    assert.strictEqual(queue.getAll({ status: 'draft' }).length, 1);

    queue.approve('test-1');
    assert.strictEqual(queue.getById('test-1').status, 'approved');

    if (fs.existsSync(testQueuePath)) fs.unlinkSync(testQueuePath);
  });

  // 7. Universal Publisher (Dry Run)
  await asyncTest('Universal Publisher executes draft simulation safely', async () => {
    const pub = new UniversalPublisher();
    const res = await pub.publish('twitter', { text: 'Test Tweet' }, true);
    assert.strictEqual(res.success, true);
    assert.strictEqual(res.mode, 'draft');
  });

  // 8. Full Autonomous Runner Cycle
  await asyncTest('Autonomous Runner executes one full cycle without error', async () => {
    const runner = new AutonomousRunner();
    // together:false — the unit suite must not film a video or touch data/together-state.json
    const summary = await runner.runCycle({ dryRun: true, generateVisuals: true, together: false });
    assert.ok(summary.timestamp);
    assert.strictEqual(summary.mode, 'draft');
    assert.ok(summary.nextSteps.length > 0);
    assert.ok(fs.existsSync(path.join(config.paths.reports, 'latest.md')));
  });

  console.log(`\n======================================================`);
  console.log(`📊 TEST RESULTS: ${passed}/${total} PASSED`);
  console.log(`======================================================\n`);

  if (passed !== total) {
    process.exit(1);
  }
}

runTests().catch(err => {
  console.error('Test suite failed:', err);
  process.exit(1);
});
