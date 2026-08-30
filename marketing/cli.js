#!/usr/bin/env node

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { config } from './src/config.js';
import { GAME_CATALOG } from './src/knowledge/catalog.js';
import { ContentGenerator } from './src/generator/contentGenerator.js';
import { CampaignPlanner } from './src/generator/campaignPlanner.js';
import { OpportunityScout } from './src/scout/opportunityScout.js';
import { VisualStudio } from './src/studio/visualStudio.js';
import { VideoStudio } from './src/studio/videoStudio.js';
import { QueueManager } from './src/scheduler/queueManager.js';
import { AutonomousRunner } from './src/scheduler/autonomousRunner.js';
import { UniversalPublisher } from './src/publishers/index.js';
import { CampaignManager } from './src/ads/campaignManager.js';
import { XAdsClient } from './src/ads/xAdsClient.js';
import { ConversionApiClient } from './src/ads/conversionApi.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const args = process.argv.slice(2);
const command = args[0] || 'help';

function parseFlags(argv) {
  const flags = {};
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg.startsWith('--')) {
      const key = arg.slice(2);
      const next = argv[i + 1];
      if (next && !next.startsWith('--')) {
        flags[key] = next;
        i++;
      } else {
        flags[key] = true;
      }
    }
  }
  return flags;
}

const flags = parseFlags(args.slice(1));

async function main() {
  switch (command) {
    case 'help':
    case '--help':
    case '-h': {
      printHelp();
      break;
    }

    case 'secrets':
    case 'github-secrets': {
      printGitHubSecretsGuide();
      break;
    }

    case 'status': {
      console.log(`\n======================================================`);
      console.log(`🎯 KREEDA MARKETING AGENT — PLATFORM STATUS`);
      console.log(`======================================================`);
      console.log(`Brand:           ${config.general.brandName}`);
      console.log(`Base URL:        ${config.general.baseUrl}`);
      console.log(`Mode:            ${config.general.mode.toUpperCase()}`);
      console.log(`AI Engine:       ${config.ai.geminiModel} (${config.ai.geminiApiKey ? '✅ Key Present' : '⚠️ Fallback Engine'})`);
      
      const pub = new UniversalPublisher();
      const st = pub.getStatus();
      console.log(`\n--- Configured Channels ---`);
      console.log(`Twitter/X API:   ${st.twitter ? '✅ Connected' : '❌ Missing Credentials'}`);
      console.log(`Reddit API:      ${st.reddit ? '✅ Connected' : '❌ Missing Credentials'}`);
      console.log(`Discord Webhook: ${st.discord ? '✅ Connected' : '❌ Missing Credentials'}`);
      console.log(`Dev.to API:      ${st.devto ? '✅ Connected' : '❌ Missing Credentials'}`);
      console.log(`Universal Hook:  ${st.webhook ? '✅ Connected' : '❌ Missing Credentials'}`);
      console.log(`======================================================\n`);
      break;
    }

    case 'plan': {
      console.log(`\n📅 Generating 7-day marketing campaign plan...`);
      const planner = new CampaignPlanner();
      const plan = await planner.planWeeklyCalendar();
      
      const queue = new QueueManager();
      queue.add(plan.items);
      
      console.log(`\n✅ Weekly plan created with ${plan.items.length} scheduled items and added to queue:`);
      plan.items.forEach(item => {
        console.log(`  • [${item.scheduledDate}] ${item.dayOfWeek.padEnd(9)} | ${item.channel.toUpperCase().padEnd(10)} | ${item.gameName} — ${item.theme}`);
      });
      console.log(`\nRun "node cli.js queue" to review drafts.\n`);
      break;
    }

    case 'generate': {
      const gameId = flags.game || 'drift';
      const channel = flags.channel || 'twitter';
      const isThread = Boolean(flags.thread);

      console.log(`\n✨ Generating ${channel.toUpperCase()} content for "${gameId}"...`);
      const gen = new ContentGenerator();
      const result = await gen.generate(gameId, channel, { isThread, subreddit: flags.subreddit, angle: flags.angle });

      console.log(`\n================ GENERATED CONTENT ================`);
      console.log(JSON.stringify(result.content, null, 2));
      console.log(`===================================================`);
      console.log(`💾 Saved to artifact: ${result.artifactPath}\n`);

      if (flags.queue) {
        const queue = new QueueManager();
        queue.add({
          channel,
          gameId,
          content: result.content,
          status: 'draft'
        });
        console.log(`📥 Added to review queue as draft.`);
      }
      break;
    }

    case 'campaign':
    case 'generate-campaign': {
      const gameId = flags.game || 'drift';
      console.log(`\n🚀 Generating 360° launch campaign for "${gameId}"...`);
      const gen = new ContentGenerator();
      const campaign = await gen.generateFullCampaign(gameId);
      console.log(`\n✅ Generated all deliverables (Twitter thread, Reddit posts, Show HN, Video script, Dev.to article).`);
      break;
    }

    case 'scout': {
      console.log(`\n🔍 Opportunity Scout running on community topics...`);
      const scout = new OpportunityScout();
      const leads = await scout.scanSimulatedFeeds();
      console.log(`\n================ OPPORTUNITY LEADS (${leads.length}) ================`);
      leads.forEach(lead => {
        console.log(`\n[Score: ${lead.relevanceScore}/100] [${lead.platform}] by ${lead.author}`);
        console.log(`Query: "${lead.queryContent}"`);
        console.log(`Recommended Game: ${lead.recommendedGame}`);
        console.log(`Draft Reply:\n"${lead.draftReply}"`);
      });
      console.log(`\n====================================================\n`);
      break;
    }

    case 'studio':
    case 'visuals': {
      console.log(`\n🎨 Generating SVG social preview cards for catalog...`);
      const studio = new VisualStudio();
      const cards = studio.generateAllCards();
      console.log(`✅ Generated ${Object.keys(cards).length} cards in ${studio.outputDir}:`);
      Object.entries(cards).forEach(([game, path]) => {
        console.log(`  • ${game.padEnd(14)} -> ${path}`);
      });
      console.log();
      break;
    }

    case 'video': {
      const gameId = flags.game || 'drift';
      const duration = Number(flags.duration) || 8;
      console.log(`\n🎬 Recording ${duration}s of real gameplay for "${gameId}"...`);
      const studio = new VideoStudio();
      const mp4Path = await studio.generateGameplayVideo(gameId, { durationSeconds: duration });
      console.log(`✅ Saved video: ${mp4Path}\n`);
      break;
    }

    case 'promote-video': {
      const gameId = flags.game || 'drift';
      const duration = Number(flags.duration) || 8;
      const dryRun = !flags.live;

      console.log(`\n🎬 Recording ${duration}s of real gameplay for "${gameId}"...`);
      const studio = new VideoStudio();
      const videoPath = await studio.generateGameplayVideo(gameId, { durationSeconds: duration });
      console.log(`✅ Saved video: ${videoPath}`);

      console.log(`\n✨ Generating tweet copy for "${gameId}"...`);
      const gen = new ContentGenerator();
      const result = await gen.generate(gameId, 'twitter', {});
      const text = result.content.text || result.content.headline || '';
      console.log(`Tweet: "${text}"`);

      const pub = new UniversalPublisher();
      console.log(`\n📡 Publishing (${dryRun ? 'DRY-RUN' : 'LIVE'})...`);
      const publishResult = await pub.publish('twitter', { text, videoPath }, dryRun);
      console.log(`\nPublish Result:`, JSON.stringify(publishResult, null, 2));
      break;
    }

    case 'ads-status': {
      const mgr = new CampaignManager();
      const st = mgr.status();
      console.log(`\n💸 X ADS — POLICY & STATE`);
      console.log(`  Per-campaign cap: $${st.policy.maxDailyPerCampaignUsd}/day · total cap: $${st.policy.maxTotalDailyUsd}/day · trial: ${st.policy.trialDays} days · max active: ${st.policy.maxActiveCampaigns}`);
      console.log(`  Account currency: ${st.policy.currency} (1 USD = ${st.policy.usdToLocalRate} ${st.policy.currency})`);
      console.log(`  Active: ${st.active.length} (committing $${st.committedDailyUsd}/day) · paused: ${st.paused} · simulated: ${st.simulated}`);
      st.active.forEach(c => console.log(`   • ${c.name} — $${c.dailyBudgetUsd}/day since ${c.launchedAt.slice(0, 10)}${c.lastStats ? ` · ${c.lastStats.clicks} clicks, CTR ${c.lastStats.ctrPercent}%` : ''}`));
      const client = new XAdsClient();
      if (!client.isConfigured) {
        console.log(`  API: not configured (need Twitter OAuth1 keys + X_ADS_ACCOUNT_ID)\n`);
      } else {
        const probe = await client.probeAccess();
        console.log(`  API access: ${probe.authorized ? `✅ authorized (${probe.accounts.length} account(s))` : `❌ ${probe.error}`}\n`);
      }
      break;
    }

    case 'ads-launch': {
      const mgr = new CampaignManager();
      const gameId = flags.game || 'drift';
      const game = GAME_CATALOG[gameId];
      if (!game) { console.error(`Unknown game "${gameId}"`); process.exit(1); }
      const brief = {
        gameId,
        angle: flags.angle || 'manual',
        tweetId: flags.tweet,
        tweetText: flags.text || `${game.tagline} ${game.pitch.split('. ')[0]}. Free in your browser: ${game.url}`,
        dailyBudgetUsd: Number(flags.daily) || undefined,
        ageBucket: flags.age,
        interests: flags.interests ? String(flags.interests).split(',').map(s => s.trim()) : undefined,
        keywords: flags.keywords ? String(flags.keywords).split(',').map(s => s.trim()) : undefined
      };
      const res = await mgr.launch(brief, { dryRun: !flags.live });
      console.log(JSON.stringify(res, null, 2));
      break;
    }

    case 'ads-review': {
      const mgr = new CampaignManager();
      const res = await mgr.review({ dryRun: !flags.live });
      console.log(JSON.stringify(res, null, 2));
      break;
    }

    case 'ads-cycle': {
      const mgr = new CampaignManager();
      const res = await mgr.runCycle({ dryRun: !flags.live });
      console.log(`\nCycle summary:`, JSON.stringify({ reviewed: res.reviewed.length, planned: res.planned, blocked: res.blocked || null }, null, 2));
      break;
    }

    case 'ads-conversion-test': {
      const client = new ConversionApiClient();
      console.log(`\nX Conversion API: ${client.isConfigured ? '✅ pixel + token configured' : '❌ missing X_PIXEL_ID / X_PIXEL_TOKEN'}`);
      if (!flags.event) {
        console.log(`Pass --event <tw-<pixel>-xxxxx> (from Ads Manager > Events manager) to send a real conversion.`);
        break;
      }
      const identifier = (flags.twclid || flags.ip || flags.email || flags.phone)
        ? {
            twclid: flags.twclid,
            ip: flags.ip,
            userAgent: flags.ip ? (flags.ua || 'KreedaGrowthAgent/1.0 (conversion-test)') : undefined,
            hashedEmail: flags.email,
            hashedPhone: flags.phone
          }
        : { ip: '127.0.0.1', userAgent: 'KreedaGrowthAgent/1.0 (conversion-test)' }; // API requires at least one identifier
      const res = await client.send({
        eventId: flags.event,
        sourceUrl: flags.url || config.general.baseUrl,
        conversionId: `cli-test-${Date.now()}`,
        identifier
      }, !flags.live);
      console.log(JSON.stringify(res, null, 2));
      break;
    }

    case 'queue': {
      const queue = new QueueManager();
      const items = queue.getAll({ status: flags.status, channel: flags.channel });
      console.log(`\n📋 CAMPAIGN QUEUE (${items.length} items):`);
      if (items.length === 0) {
        console.log(`  Queue is empty. Run "node cli.js plan" to generate a campaign.`);
      } else {
        items.forEach(item => {
          const headline = item.content?.headline || item.content?.title || item.content?.hookText || item.theme || 'Draft Post';
          console.log(`  [${item.status.toUpperCase().padEnd(9)}] ${item.id} | ${item.scheduledDate} | ${item.channel.padEnd(8)} | ${item.gameId.padEnd(12)} | "${headline.slice(0, 45)}..."`);
        });
      }
      console.log();
      break;
    }

    case 'approve': {
      const id = args[1];
      if (!id) {
        console.error('Usage: node cli.js approve <id>');
        process.exit(1);
      }
      const queue = new QueueManager();
      const updated = queue.approve(id);
      console.log(`✅ Approved post ${id} for publication on ${updated.scheduledDate}`);
      break;
    }

    case 'publish': {
      const id = args[1];
      if (!id) {
        console.error('Usage: node cli.js publish <id> [--live]');
        process.exit(1);
      }
      const queue = new QueueManager();
      const dryRun = !flags.live;
      const res = await queue.publish(id, dryRun);
      console.log(`\nPublish Result:`, JSON.stringify(res.publishResult, null, 2));
      break;
    }

    case 'process-due': {
      const queue = new QueueManager();
      const dryRun = !flags.live;
      console.log(`\nProcessing due queue items (${dryRun ? 'DRY-RUN' : 'LIVE'})...`);
      const results = await queue.processDueQueue(dryRun);
      console.log(`✅ Processed ${results.length} items.`);
      break;
    }

    case 'run-autonomous':
    case 'auto': {
      const runner = new AutonomousRunner();
      if (flags.daemon) {
        const interval = Number(flags.interval) || 60;
        runner.startDaemon(interval);
      } else {
        await runner.runCycle({ dryRun: !flags.live });
      }
      break;
    }

    case 'dashboard': {
      startDashboardServer(Number(flags.port) || 3030);
      break;
    }

    default:
      console.error(`Unknown command: ${command}`);
      printHelp();
      process.exit(1);
  }
}

function printGitHubSecretsGuide() {
  console.log(`
======================================================
🔑 GITHUB REPOSITORY SECRETS GUIDE
======================================================
To run the marketing agent autonomously in GitHub Actions:

1. Go to your repository on GitHub:
   https://github.com/sudhir-patavardhan/browser-games/settings/secrets/actions

2. Click "New repository secret" and add the following keys as needed:

  • GEMINI_API_KEY               (Google AI Studio key — Essential)
  • GEMINI_MODEL                 (Default: gemini-3.7-flash)
  • MARKETING_MODE               (Set to 'draft' or 'live')

  [Twitter / X API]
  • TWITTER_API_KEY              (App Consumer Key)
  • TWITTER_API_SECRET           (App Consumer Secret)
  • TWITTER_ACCESS_TOKEN         (User Access Token with Read+Write)
  • TWITTER_ACCESS_TOKEN_SECRET  (User Access Token Secret)
  • TWITTER_BEARER_TOKEN         (App Bearer Token)

  [Reddit API]
  • REDDIT_CLIENT_ID             (Reddit Script App Client ID)
  • REDDIT_CLIENT_SECRET         (Reddit Script App Secret)
  • REDDIT_USERNAME              (Reddit Username)
  • REDDIT_PASSWORD              (Reddit Password)

  [Discord Webhook]
  • DISCORD_WEBHOOK_URL          (Discord Webhook URL for announcements)

  [Dev.to / Technical Blog]
  • DEVTO_API_KEY                (Dev.to API Key for technical posts)

  [Universal Webhook / Buffer]
  • GENERIC_WEBHOOK_URL          (Make.com / Zapier / Buffer Webhook URL)

3. Once added, the workflow will automatically execute daily at 9:00 AM UTC
   via .github/workflows/marketing-agent.yml, or manually from the "Actions" tab.
======================================================
`);
}

function printHelp() {
  console.log(`
======================================================
🎮 KREEDA AUTONOMOUS MARKETING AGENT (CLI)
======================================================
Usage: node cli.js <command> [options]

Commands:
  status                     Check status of API credentials & channel connectivity
  plan                       Generate a complete 7-day marketing campaign plan
  generate                   Generate content for a specific game and channel
                             Options: --game <id> --channel <twitter|reddit|hackernews|shorts|devto> [--thread] [--queue]
  campaign                   Generate a full 360° cross-platform launch campaign for a game
                             Options: --game <id>
  scout                      Scout community queries & draft authentic contextual replies
  studio                     Generate high-res SVG social cards & banners for all 12 games
  video                      Record a real gameplay clip and convert to MP4
                             Options: --game <id> [--duration <seconds>]
  promote-video              Record gameplay, generate tweet copy, and post the video to Twitter
                             Options: --game <id> [--duration <seconds>] [--live]
  ads-status                 Show X Ads spend policy, active/paused campaigns, and API access
  ads-launch                 Launch one paid campaign (≤ $10/day; ≤ $25/day across all)
                             Options: --game <id> [--daily <usd>] [--tweet <id>] [--text "..."] [--age AGE_21_TO_34]
                                      [--interests "Gaming,Relationships"] [--keywords "a,b"] [--live]
  ads-review                 Pull analytics for active campaigns; pause any that failed the 2-day trial [--live]
  ads-cycle                  review → learn → plan+launch the next campaign [--live]
  ads-conversion-test        Send a test event via the X Conversion API (dry-run unless --live)
                             Options: --event <tw-<pixel>-xxxxx> [--url <page>] [--live]
                                      [--twclid <id> | --ip <ip> [--ua <agent>] | --email <sha256> | --phone <sha256>]
                                      (defaults to a placeholder IP+UA identifier if none given — the API requires one)
  queue                      View items in the campaign queue
                             Options: [--status draft|scheduled|approved|published]
  approve <id>               Approve a queued post for publication
  publish <id>               Publish a post immediately (use --live for actual API post)
  process-due                Publish all approved posts scheduled for today or earlier
  run-autonomous             Run one full autonomous marketing cycle (or --daemon --interval 60)
  dashboard                  Launch local interactive marketing dashboard (default port 3030)
======================================================
`);
}

function startDashboardServer(port = 3030) {
  const dashboardDir = path.join(__dirname, 'dashboard');
  const server = http.createServer((req, res) => {
    let reqPath = req.url.split('?')[0];

    // API routes for Dashboard
    if (reqPath === '/api/queue') {
      const queue = new QueueManager();
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(queue.getAll()));
      return;
    }

    if (reqPath === '/api/opportunities') {
      let opps = [];
      if (fs.existsSync(config.paths.opportunitiesFile)) {
        try { opps = JSON.parse(fs.readFileSync(config.paths.opportunitiesFile, 'utf8')); } catch(e){}
      }
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(opps));
      return;
    }

    if (reqPath === '/api/catalog') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(GAME_CATALOG));
      return;
    }

    if (reqPath === '/api/status') {
      const pub = new UniversalPublisher();
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ config: config.general, channels: pub.getStatus() }));
      return;
    }

    // Static file serving
    if (reqPath === '/' || reqPath === '/index.html') reqPath = '/index.html';
    
    let filePath = path.join(dashboardDir, reqPath);
    if (!fs.existsSync(filePath) && reqPath.startsWith('/artifacts/')) {
      filePath = path.join(config.paths.marketing, reqPath);
    }

    if (!fs.existsSync(filePath)) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('404 Not Found');
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    const mimeTypes = {
      '.html': 'text/html',
      '.js': 'application/javascript',
      '.css': 'text/css',
      '.json': 'application/json',
      '.svg': 'image/svg+xml',
      '.png': 'image/png'
    };

    res.writeHead(200, { 'Content-Type': mimeTypes[ext] || 'application/octet-stream' });
    fs.createReadStream(filePath).pipe(res);
  });

  server.listen(port, () => {
    console.log(`\n✨ ========================================================`);
    console.log(`✨ KREEDA MARKETING DASHBOARD RUNNING`);
    console.log(`👉 Open in browser: http://localhost:${port}`);
    console.log(`✨ ========================================================\n`);
  });
}

main().catch(err => {
  console.error('Fatal error in CLI:', err);
  process.exit(1);
});
