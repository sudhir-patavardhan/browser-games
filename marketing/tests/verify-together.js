import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { config } from '../src/config.js';
import { GAME_CATALOG } from '../src/knowledge/catalog.js';
import { STORYBOARDS, TogetherDirector } from '../src/studio/togetherDirector.js';
import { TOGETHER_GAMES, FALLBACK_COPY, TogetherPromoter } from '../src/generator/togetherPromoter.js';
import { XMetrics } from '../src/insights/xMetrics.js';
import { renderCycleReport } from '../src/reports/cycleReport.js';
import { QueueManager } from '../src/scheduler/queueManager.js';
import { PROMPT_TEMPLATES } from '../src/ai/prompts.js';

// No browser, no network: these check the parts that don't need either.

// Every together game has copy that leads with the relationship, not the mechanic, and links to itself.
for (const id of TOGETHER_GAMES) {
  const c = FALLBACK_COPY[id];
  assert.ok(c, `fallback copy missing for ${id}`);
  assert.ok(!/^(one phone|pass the phone)/i.test(c.text), `${id} copy leads with the mechanic`);
  assert.ok(c.text.includes(`kreeda.games/${id}/`), `${id} copy must link to the game`);
  assert.ok(c.text.length <= 280, `${id} copy over 280 chars`);
  assert.ok(GAME_CATALOG[id].category === 'together');
}

// Storyboards exist for the games the promoter will rotate through.
assert.ok(STORYBOARDS.sync && STORYBOARDS.windows, 'storyboards for sync and windows');
for (const [id, b] of Object.entries(STORYBOARDS)) {
  assert.ok(TogetherDirector.hasStoryboard(id));
  assert.equal(typeof b.run, 'function');
  assert.ok(b.colors.length === 2 && b.url.includes(id));
  assert.ok(fs.existsSync(path.join(config.paths.root, id, 'index.html')), `${id}/index.html must exist to film`);
}

// Rotation moves on and wraps.
const tmpState = path.join(config.paths.data, 'test-together-state.json');
const tmpQueue = path.join(config.paths.data, 'test-together-queue.json');
for (const f of [tmpState, tmpQueue]) if (fs.existsSync(f)) fs.unlinkSync(f);
const promoter = new TogetherPromoter({ queue: new QueueManager(tmpQueue), stateFile: tmpState });
const pool = promoter.filmable();
assert.equal(promoter.nextGame({ lastGameId: null }), pool[0]);
assert.equal(promoter.nextGame({ lastGameId: pool[pool.length - 1] }), pool[0]);
assert.equal(promoter.isDue({ lastPostedAt: null }), true);
assert.equal(promoter.isDue({ lastPostedAt: new Date().toISOString() }, 2), false);
assert.equal(promoter.isDue({ lastPostedAt: new Date(Date.now() - 3 * 86_400_000).toISOString() }, 2), true);

// Sanitizer: a draft that leads with the mechanic is replaced; hashtags are capped and moved after the link.
const game = GAME_CATALOG.sync;
let s = promoter.sanitize({ text: 'One phone, two players, ten questions #a #b #c' }, game, FALLBACK_COPY.sync);
assert.equal(s.text.startsWith('How well do you'), true);
s = promoter.sanitize({ text: 'Find out how well you know each other #x #y #z see https://kreeda.games/sync/ now' }, game, FALLBACK_COPY.sync);
assert.equal((s.text.match(/#\w+/g) || []).length, 2);
assert.ok(s.text.endsWith('#x #y'));

// Dry-run promote without rendering records a queue item and advances the rotation.
const res = await promoter.promote({ dryRun: true, video: false });
assert.equal(res.publishResult.mode, 'draft');
assert.ok(res.text.includes('kreeda.games/'));
assert.equal(promoter.loadState().lastGameId, res.gameId);
assert.equal(new QueueManager(tmpQueue).getAll()[0].content.kind, 'together-video');
for (const f of [tmpState, tmpQueue]) if (fs.existsSync(f)) fs.unlinkSync(f);

// Metrics summary from a fixture store.
const xm = new XMetrics();
const summary = xm.summarizeByGame({ tweets: {
  '1': { gameId: 'sync', kind: 'together-video', latest: { impressions: 1000, linkClicks: 30, likes: 10, replies: 2, reposts: 1 } },
  '2': { gameId: 'drift', kind: 'post', latest: { impressions: 2000, linkClicks: 10, likes: 5, replies: 0, reposts: 0 } }
} });
assert.equal(Object.keys(summary)[0], 'sync');           // best CTR first
assert.equal(summary.sync.ctrPercent, 3);
assert.equal(summary.sync.videoPosts, 1);
assert.equal(summary.drift.ctrPercent, 0.5);

// Prompts mention the framing rule.
assert.ok(PROMPT_TEMPLATES.togetherVideoPost(game).includes('relationship'));
assert.ok(PROMPT_TEMPLATES.adsCampaignBrief({ catalog: [{ id: 'sync', name: 'Sync', tagline: '', url: '', category: 'together' }] }).includes('one-phone'));

// Report renders every section.
const md = renderCycleReport({ mode: 'draft', actions: { plannedPosts: 7, publishedPosts: 2, togetherVideo: { gameId: 'sync', mode: 'draft', text: 'x', renderSeconds: 28 }, ads: { reviewed: 0, paused: 0, launched: false, blocked: 'not approved' }, metrics: { summary } } });
for (const h of ['Content queue', 'Play-together video', 'X Ads', 'Organic performance']) assert.ok(md.includes(h), `report missing ${h}`);
assert.ok(md.includes('Sync') && md.includes('not approved'));

console.log('together: all checks passed');
