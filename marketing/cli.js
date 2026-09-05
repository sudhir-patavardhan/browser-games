#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { config } from './src/config.js';
import { GAME_CATALOG } from './src/knowledge/catalog.js';
import { ContentGenerator } from './src/generator/contentGenerator.js';
import { VisualStudio } from './src/studio/visualStudio.js';
import { VideoStudio } from './src/studio/videoStudio.js';
import { QueueManager } from './src/scheduler/queueManager.js';
import { AutonomousRunner } from './src/scheduler/autonomousRunner.js';
import { UniversalPublisher } from './src/publishers/index.js';
import { CampaignManager } from './src/ads/campaignManager.js';
import { MetaCampaignManager } from './src/ads/metaCampaign.js';
import { ROLES, prepare as prepareAgent, accept as acceptAgent, ioPaths, RejectedOutput } from './src/agents/index.js';
import { prepareCycle, renderCycle } from './src/producer/cycles.js';
import { XAdsClient } from './src/ads/xAdsClient.js';
import { ConversionApiClient } from './src/ads/conversionApi.js';
import { TogetherDirector } from './src/studio/togetherDirector.js';
import { TogetherPromoter } from './src/generator/togetherPromoter.js';
import { XMetrics } from './src/insights/xMetrics.js';
import { X, CHANNELS, CHANNEL_NAMES, toChannel } from './src/knowledge/channels.js';
import { runSmoke } from './src/producer/smoke.js';
import { initState } from './src/producer/state.js';
import { mintPageToken, facebookPreflight, MissingPermissionsError } from './src/publishers/facebookAccess.js';
import { FbMetrics } from './src/insights/fbMetrics.js';
import { xPreflight } from './src/publishers/xAccess.js';
import { PublishCycle } from './src/producer/cycle.js';
import { Queue } from './src/producer/queue.js';
import { Creative } from './src/agents/creative/index.js';

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

    // The Cycles (AGENTS_SPEC.md §5.1). The Producer alone; --live to act.
    case 'cycle': {
      const which = args[1];

      if (which === 'publish') {
        const cycle = new PublishCycle();
        const { log, review } = await cycle.run({ dryRun: !flags.live });
        console.log(`\n${log.render()}`);
        if (review) console.log(`Review: ${review.html_url}\n`);
        if (log.counts().failed) process.exit(1);
        break;
      }

      if (which === 'desk' || which === 'planning') {
        // ADR 0006: the Producer prepares; the session is the Agent. This
        // never accepts on the session's behalf.
        console.log(renderCycle(await prepareCycle(which)));
        break;
      }

      if (which === 'creative') {
        // Used by the Planning Cycle so Monday and Tuesday's Posts are In
        // review by Sunday evening (§3).
        const hours = Number(String(flags.horizon || '48').replace(/h$/i, '')) || 48;
        const queue = new Queue();
        const creative = new Creative();
        const drafts = queue.needingCreative({ horizonHours: hours });
        console.log(`\nThe Creative: ${drafts.length} Draft(s) within ${hours}h`);
        for (const draft of drafts) {
          const { post, filled, notes, error } = await creative.fill(draft, { dryRun: !flags.live });
          for (const note of notes) console.log(`     ${note}`);
          if (error) { console.log(`  failed  ${draft.id} (${draft.gameId}) stays a Draft: ${error}`); continue; }
          if (filled) { queue.replace(post); console.log(`  ok      ${post.id} (${post.gameId}) is In review`); }
          else console.log(`  dry run ${draft.id} (${draft.gameId}) written but not filled`);
        }
        console.log();
        break;
      }

      console.error('Unknown Cycle. There are two here: publish, creative.');
      process.exit(1);
    }

    // Whether the Producer can publish a Post on X, and read what it earned.
    case 'x': {
      if (args[1] !== 'preflight') {
        console.error('Unknown x command. There is one: preflight.');
        process.exit(1);
      }
      const report = await xPreflight();
      console.log(report.render());
      if (report.blocked) process.exit(1);
      break;
    }

    // The Facebook lane (AGENTS_SPEC.md §11).
    case 'fb': {
      const sub = args[1];

      if (sub === 'preflight') {
        const report = await facebookPreflight();
        console.log(report.render());
        if (report.blocked) process.exit(1);
        break;
      }

      if (sub === 'token') {
        const userToken = flags['user-token'] || flags.token;
        const { appId, appSecret } = config.platforms.facebook;

        // Everything that can be checked without the token is checked first:
        // the short-lived token the CMO pastes in lasts about an hour, and
        // failing on a missing app secret after they fetched one wastes it.
        const problems = [];
        if (!userToken) problems.push('--user-token is missing');
        if (!appId) problems.push('FACEBOOK_APP_ID is not set');
        if (!appSecret) problems.push('FACEBOOK_APP_SECRET is not set');

        if (problems.length) {
          console.error(`
Cannot mint a Page token: ${problems.join('; ')}.

  node cli.js fb token --user-token <short-lived user token>

Mints the long-lived Page token the Producer publishes with. You do this
once: a Page token derived from a long-lived user token has no expiry while
you administer the Page.

  1. developers.facebook.com -> your app -> Settings -> Basic
     Copy the App ID and App Secret into marketing/.env as
     FACEBOOK_APP_ID and FACEBOOK_APP_SECRET. Only the app itself can
     exchange a short-lived token for a long-lived one, which is the step
     that makes the Page token permanent.

  2. Tools -> Graph API Explorer -> pick that same app -> Generate access
     token, granting pages_manage_posts, pages_read_engagement and
     pages_show_list (add publish_video for video Posts).

  3. Paste that token into the command above. It lasts about an hour, which
     is long enough, and it is not what you keep.
`);
          process.exit(1);
        }

        let minted;
        try {
          minted = await mintPageToken({ userToken, appId, appSecret });
        } catch (err) {
          if (err instanceof MissingPermissionsError) {
            // Nothing was spent: the check runs before the exchange. What is
            // needed is a new token, granted properly.
            console.error(`\nThis token cannot publish a Post.\n`);
            console.error(`  granted: ${err.granted.join(', ') || 'nothing'}`);
            console.error(`  missing: ${err.missing.join(', ')}\n`);
            console.error('Graph API Explorer makes this easy to get wrong twice over:\n');
            console.error('  1. Typing a permission into "Add a Permission" does not select it.');
            console.error('     Pick it from the dropdown, and check the list above shows it with');
            console.error('     an x beside it and the counter has gone up.');
            console.error('  2. When the login dialog offers to "continue with your previous');
            console.error('     settings", Continue re-grants only what you had before. Click');
            console.error('     Edit settings instead, tick the Page, and approve the new');
            console.error('     permission there.\n');
            console.error('Then generate a fresh token and run this again.\n');
            process.exit(1);
          }
          // Any other failed exchange is almost always one of four things, and
          // the Graph message alone does not say which.
          console.error(`\nCould not mint the Page token: ${err.message}\n`);
          console.error('The usual causes:');
          console.error('  · the short-lived token expired — they last about an hour, so fetch a fresh one');
          console.error('  · the token came from a different app than FACEBOOK_APP_ID');
          console.error('  · the token is a Page token; the exchange needs a User token');
          console.error(`  · you do not administer Page ${config.platforms.facebook.pageId || '(FACEBOOK_PAGE_ID is unset)'}\n`);
          process.exit(1);
        }

        console.log(`\nPage: ${minted.pageName} (${minted.pageId})`);
        console.log(`Permissions: ${minted.scopes.join(', ') || 'none reported'}`);
        if (minted.neverExpires) {
          console.log('Expiry: none. Facebook reports no expiry while you administer the Page,');
          console.log('        so this is the last time you need to do this.');
        } else {
          console.log('Expiry: THIS TOKEN STILL EXPIRES, which means the exchange did not take.');
          console.log('        Check that FACEBOOK_APP_ID is the app that issued the user token.');
        }
        console.log(`\nAdd this to the cloud environment (and marketing/.env to publish locally):\n`);
        console.log(`FACEBOOK_PAGE_TOKEN=${minted.pageToken}`);
        console.log(`FACEBOOK_PAGE_ID=${minted.pageId}\n`);
        console.log('Then check it with: node cli.js fb preflight\n');
        break;
      }

      if (sub === 'metrics') {
        const queue = new QueueManager();
        const result = await new FbMetrics().refresh(queue.getAll());
        console.log(`\nFacebook: refreshed ${result.fetched} Post(s)${result.failed ? `, ${result.failed} unreadable` : ''}`);
        for (const [gameId, m] of Object.entries(new FbMetrics().summarizeByGame(result.store))) {
          console.log(`   ${gameId.padEnd(14)} ${String(m.posts).padStart(2)} Post(s) · ${m.linkClicks} link click(s) · ${m.clicks} click(s) · ${m.reactions} reaction(s)${m.videoViews ? ` · ${m.videoViews} video view(s)` : ''}`);
        }
        console.log();
        break;
      }

      console.error('Unknown fb command. There are three: token, preflight, metrics.');
      process.exit(1);
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
      // §6.2: the Mon–Sun rota is gone. A Plan is the Strategist's judgement
      // about next week, not a table filled in by the calendar.
      console.log(`\n📅 The Plan is the Strategist's now (§6.2).\n`);
      console.log(`  node cli.js cycle planning     the whole Sunday Cycle, in order`);
      console.log(`  node cli.js agent prepare strategist   just the Plan\n`);
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
      console.log(`\n💸 PAID — POLICY & STATE (both Channels share the Caps)`);
      console.log(`  Per-campaign cap: $${st.policy.maxDailyPerCampaignUsd}/day · total cap: $${st.policy.maxTotalDailyUsd}/day · trial: ${st.policy.trialDays} days · max active: ${st.policy.maxActiveCampaigns}`);
      console.log(`  Account currency: ${st.policy.currency} (1 USD = ${st.policy.usdToLocalRate} ${st.policy.currency})`);
      console.log(`  Active: ${st.active.length} (committing $${st.committedDailyUsd}/day) · paused: ${st.paused} · ended: ${st.ended} · simulated: ${st.simulated}`);
      st.active.forEach(c => console.log(`   • [${CHANNEL_NAMES[c.channel] || 'X'}] ${c.name} — $${c.dailyBudgetUsd}/day since ${c.launchedAt.slice(0, 10)}${c.lastStats ? ` · ${c.lastStats.clicks} clicks, CTR ${c.lastStats.ctrPercent}%` : ''}`));
      const client = new XAdsClient();
      if (!client.isConfigured) {
        console.log(`  API: not configured (need Twitter OAuth1 keys + X_ADS_ACCOUNT_ID)\n`);
      } else {
        const probe = await client.probeAccess();
        console.log(`  X API access: ${probe.authorized ? `✅ authorized (${probe.accounts.length} account(s))` : `❌ ${probe.error}`}\n`);
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

    case 'agent': {
      // ADR 0006: the Producer gathers the inputs and validates the answer.
      // The thinking in between is the session's, not the CLI's.
      const [, action, role] = args;
      if (action === 'list' || !action) {
        console.log(`\n🧠 THE AGENTS — each is the routine's own session (ADR 0006)\n`);
        for (const name of ROLES) console.log(`  ${name.padEnd(20)} prompt: src/agents/${name}/PROMPT.md`);
        console.log(`\n  node cli.js agent prepare <role> [--full]`);
        console.log(`  node cli.js agent accept <role> [--file <path>]\n`);
        break;
      }
      if (!ROLES.includes(role)) {
        console.error(`"${role || ''}" is not an Agent. The roles are: ${ROLES.join(', ')}.`);
        process.exit(1);
      }

      if (action === 'prepare') {
        const res = await prepareAgent(role, { full: Boolean(flags.full), ...(flags.days ? { days: Number(flags.days) } : {}) });
        console.log(`\n🧠 ${role} — inputs ready`);
        console.log(`  ${res.summary}`);
        console.log(`\n  1. read    ${res.prompt}`);
        console.log(`  2. read    ${res.input}`);
        console.log(`  3. write   ${res.output}`);
        console.log(`  4. run     node cli.js agent accept ${role}\n`);
        break;
      }

      if (action === 'accept') {
        try {
          const res = await acceptAgent(role, { dryRun: Boolean(flags.dry), file: flags.file || null });
          console.log(`\n✅ ${role} accepted — ${res.summary}`);
          for (const file of res.wrote) console.log(`   wrote ${file}`);
          console.log('');
        } catch (err) {
          if (!(err instanceof RejectedOutput)) throw err;
          // §6: malformed output is rejected, never patched. The previous
          // state file stands, and the Agent gets one chance to fix its own.
          console.error(`\n❌ ${err.message}\n`);
          console.error(`   The previous state file stands. Fix ${ioPaths(role).output} and run accept again.\n`);
          process.exit(1);
        }
        break;
      }

      console.error(`Unknown agent action "${action}". Use prepare, accept or list.`);
      process.exit(1);
    }

    case 'ads-review': {
      const dryRun = !flags.live;
      // Each Channel is judged through the API that issued its campaign ids,
      // and one Channel being unreachable must not hide the other's verdicts.
      const judge = async (label, run) => {
        try { return await run(); }
        catch (err) { console.error(`⚠️ ${label}: ${err.message}`); return { error: err.message }; }
      };
      const res = {
        x: await judge('X', () => new CampaignManager().review({ dryRun })),
        facebook: await judge('Facebook', () => new MetaCampaignManager().review({ dryRun }))
      };
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
  x preflight                Whether the Producer can publish a Post on X and read metrics

The Cycles
  cycle publish              One Publish Cycle: read merged Reviews, expire, fill Drafts,
                             publish what is due, pull metrics, update the Review  [--live]
  cycle creative             Fill every Draft inside the horizon      [--horizon 48h] [--live]
  cycle desk                 The Morning desk: prepare the Analyst, any Post-mortem due,
                             and the Media Buyer if there is headroom (§5)
  cycle planning             Sunday: the Analyst in full, the Strategist, the Briefing
  fb token                   Mint the long-lived Facebook Page token (§11)
                             --user-token <short-lived token from Graph API Explorer>
  fb preflight               Whether the Producer can publish a Post on the Page
  fb metrics                 Pull Page insights for every live Facebook Post

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
  plan                       Where the Plan comes from now (the Strategist, §6.2)
  run-autonomous             Run one Cycle                                         [--live]
  metrics                    Pull impressions and link clicks for every live Post on X
  report                     Print the last Run log

The Agents — the session is the Agent; the CLI prepares and accepts (ADR 0006)
  agent list                 The five judgment roles and where their prompts live
  agent prepare <role>       Gather one role's inputs into data/agent-io/       [--full]
  agent accept <role>        Validate the role's answer and write its state file [--file <path>]

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
