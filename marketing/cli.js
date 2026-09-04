#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { config } from './src/config.js';
import { GAME_CATALOG } from './src/knowledge/catalog.js';
import { ContentGenerator } from './src/generator/contentGenerator.js';
import { CampaignPlanner } from './src/generator/campaignPlanner.js';
import { VisualStudio } from './src/studio/visualStudio.js';
import { VideoStudio } from './src/studio/videoStudio.js';
import { QueueManager } from './src/scheduler/queueManager.js';
import { AutonomousRunner } from './src/scheduler/autonomousRunner.js';
import { UniversalPublisher } from './src/publishers/index.js';
import { CampaignManager } from './src/ads/campaignManager.js';
import { XAdsClient } from './src/ads/xAdsClient.js';
import { ConversionApiClient } from './src/ads/conversionApi.js';
import { TogetherDirector } from './src/studio/togetherDirector.js';
import { TogetherPromoter } from './src/generator/togetherPromoter.js';
import { XMetrics } from './src/insights/xMetrics.js';
import { X, CHANNELS, CHANNEL_NAMES, toChannel } from './src/knowledge/channels.js';
import { runSmoke } from './src/producer/smoke.js';
import { initState } from './src/producer/state.js';

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

    // The smoke routine (AGENTS_SPEC.md §3). Nothing else is built until it is green.
    case 'smoke': {
      const report = await runSmoke();
      console.log(report.render());
      if (report.blocked) process.exit(1);
      break;
    }

    // ADR 0001 — every state file lives on the marketing-state branch.
    case 'state': {
      const sub = args[1] || 'init';
      if (sub !== 'init') {
        console.error(`Unknown state command: ${sub} (only "init" exists — it is idempotent, so it doubles as a status check)`);
        process.exit(1);
      }
      const stateReport = await initState({ push: !flags['no-push'] });
      console.log(stateReport.render());
      if (stateReport.blocked) process.exit(1);
      break;
    }

    case 'status': {
      const pub = new UniversalPublisher();
      const reachable = pub.getStatus();
      console.log(`\nKREEDA MARKETING — ${config.general.mode.toUpperCase()} mode`);
      console.log(`  ${config.general.baseUrl} · the Creative writes with ${config.ai.geminiModel}` +
        `${config.ai.geminiApiKey ? '' : ' (no GEMINI_API_KEY — it cannot run)'}`);
      console.log(`\nChannels`);
      for (const channel of CHANNELS) {
        console.log(`  ${CHANNEL_NAMES[channel].padEnd(9)} ${reachable[channel] ? 'the Producer holds credentials' : 'no credentials — run `node cli.js smoke`'}`);
      }
      console.log();
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
      const channel = toChannel(flags.channel || 'x');
      const isThread = Boolean(flags.thread);

      console.log(`\n✨ Generating ${channel.toUpperCase()} content for "${gameId}"...`);
      const gen = new ContentGenerator();
      const result = await gen.generate(gameId, channel, { isThread, angle: flags.angle });

      console.log(`\n================ GENERATED CONTENT ================`);
      console.log(JSON.stringify(result.content, null, 2));
      console.log(`===================================================`);

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
      const studio = new VideoStudio();
      if (TogetherDirector.hasStoryboard(gameId) && !flags.generic) {
        console.log(`\n🎬 Filming the "${gameId}" storyboard (${config.together.names.join(' & ')})...`);
        const out = await studio.generateTogetherVideo(gameId);
        console.log(`✅ ${out.mp4Path}\n   square: ${out.squarePath}\n   ${out.seconds}s of footage\n`);
        break;
      }
      const duration = Number(flags.duration) || 8;
      console.log(`\n🎬 Recording ${duration}s of real gameplay for "${gameId}"...`);
      const mp4Path = await studio.generateGameplayVideo(gameId, { durationSeconds: duration, generic: true });
      console.log(`✅ Saved video: ${mp4Path}\n`);
      break;
    }

    case 'promote-together': {
      const promoter = new TogetherPromoter();
      const dryRun = !flags.live;
      console.log(`\n🎬 PLAY-TOGETHER VIDEO POST (${dryRun ? 'DRY-RUN' : 'LIVE'})`);
      console.log(`   storyboards: ${TogetherDirector.storyboardGames().join(', ')} · next in rotation: ${promoter.nextGame()}`);
      const res = await promoter.promote({ gameId: flags.game || undefined, dryRun, video: !flags['no-video'] });
      console.log(JSON.stringify({ gameId: res.gameId, video: res.videoPath, square: res.squarePath, seconds: res.renderSeconds, text: res.text, altText: res.altText, publish: res.publishResult, queueId: res.queueId }, null, 2));
      break;
    }

    case 'metrics': {
      const res = await new XMetrics().refresh();
      console.log(`\n📈 ORGANIC PERFORMANCE BY GAME (our own tweets)`);
      const rows = Object.entries(res.summary);
      if (!rows.length) console.log(`   nothing measured yet — metrics begin once posts go out live`);
      rows.forEach(([g, s]) => console.log(`   • ${g.padEnd(13)} ${String(s.posts).padStart(2)} post(s) · ${s.impressions} imp · ${s.linkClicks} link clicks · CTR ${s.ctrPercent}% · engagement ${s.engagementPercent}%`));
      console.log();
      break;
    }

    case 'ads-preflight': {
      const p = await new CampaignManager().preflight();
      console.log(`\n🛫 X ADS PREFLIGHT — ${p.ready ? '✅ ready to go live' : '⚠️ not ready yet'}`);
      p.checks.forEach(c => console.log(`   ${c.ok ? '✅' : '⚠️'} ${c.label.padEnd(18)} ${c.detail}`));
      console.log();
      break;
    }

    case 'report': {
      const f = path.join(config.paths.reports, 'latest.md');
      console.log(fs.existsSync(f) ? fs.readFileSync(f, 'utf8') : 'No cycle report yet — run "node cli.js run-autonomous" first.');
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
      const result = await gen.generate(gameId, X, {});
      const text = result.content.text || result.content.headline || '';
      console.log(`Tweet: "${text}"`);

      const pub = new UniversalPublisher();
      console.log(`\n📡 Publishing (${dryRun ? 'DRY-RUN' : 'LIVE'})...`);
      const publishResult = await pub.publish(X, { text, videoPath }, dryRun);
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
      await runner.runCycle({ dryRun: !flags.live });
      break;
    }

    default:
      console.error(`Unknown command: ${command}`);
      printHelp();
      process.exit(1);
  }
}

function printHelp() {
  console.log(`
======================================================
KREEDA MARKETING
======================================================
Usage: node cli.js <command> [options]

The Producer. Agents propose, the Producer executes; nothing is published or
launched without a merged Review. Terms below are defined in CONTEXT.md.

Setup
  smoke                      Prove this machine can run a Cycle: secrets, reachability,
                             a rendered Asset, and a push to marketing-state (§3)
  state init                 Open the marketing-state branch and check it out at
                             marketing/data/ (idempotent; ADR 0001)             [--no-push]
  status                     Which Channels the Producer can reach

Content
  generate                   Draft a Post for one Game and Channel
                             --game <id> --channel <x|facebook> [--thread] [--queue]
  studio                     Render an SVG card Asset for every Game
  video                      Film a Game: a storyboarded Play-together Game is filmed from
                             its storyboard (1080x1920 + a square variant), any other is
                             recorded live
                             --game <id> [--duration <seconds>] [--generic]
  promote-video              Film a Game, write the copy, and post the video to X
                             --game <id> [--duration <seconds>] [--live]
  promote-together           Film the next Play-together Game and post the video
                             [--game sync|windows] [--live] [--no-video]

Queue and publishing
  queue                      The Posts awaiting a decision  [--status draft|approved|published]
  approve <id>               Approve one Post
  publish <id>               Publish one Post now                                  [--live]
  process-due                Publish every approved Post whose Slot has arrived
  plan                       Draft next week's Plan (replaced by the Strategist in Phase 3)
  run-autonomous             Run one Cycle                                         [--live]
  metrics                    Pull impressions and link clicks for every live Post on X
  report                     Print the last Run log

Paid — every Campaign is a fixed Trial under the Caps ($10/day each, $25/day total)
  ads-preflight              Whether a Campaign can go live: keys, approval, funding, Asset
  ads-status                 The Caps, the active and paused Campaigns, and API access
  ads-launch                 Launch one Campaign
                             --game <id> [--daily <usd>] [--tweet <id>] [--text "..."]
                             [--age AGE_21_TO_34] [--interests "a,b"] [--keywords "a,b"] [--live]
  ads-review                 Apply the kill rules to every active Campaign            [--live]
  ads-cycle                  review -> learn -> propose and launch the next Campaign  [--live]
  ads-conversion-test        Send one test event through the X Conversion API
                             --event <tw-<pixel>-xxxxx> [--url <page>] [--live]
                             [--twclid <id> | --ip <ip> [--ua <agent>] | --email <sha256>]
======================================================
`);
}


main().catch(err => {
  console.error('Fatal error in CLI:', err);
  process.exit(1);
});
