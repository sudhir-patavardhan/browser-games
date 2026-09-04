/**
 * Brand rule 1: Play-together copy leads with what two people find out about
 * each other, never with the one-phone mechanic. That rule outlives the
 * cadence-based promoter this file also still covers — when the Creative takes
 * the copy over, these assertions move with it.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

import { config } from '../src/config.js';
import { GAMES } from '../src/knowledge/catalog.js';
import { STORYBOARDS, TogetherDirector } from '../src/studio/togetherDirector.js';
import { TOGETHER_GAMES, FALLBACK_COPY, TogetherPromoter } from '../src/generator/togetherPromoter.js';
import { XMetrics } from '../src/insights/xMetrics.js';
import { PROMPT_TEMPLATES } from '../src/ai/prompts.js';
import { tempStateDir, noNetwork } from './helpers.js';

noNetwork();

test('the Play together Category is what the promoter draws from', () => {
  assert.deepEqual(TOGETHER_GAMES.sort(), ['auction', 'fathom', 'split', 'sync', 'windows'].sort());
  for (const id of TOGETHER_GAMES) assert.equal(GAMES[id].category, 'Play together');
});

test('every Play-together line leads with the relationship, not the phone', () => {
  for (const id of TOGETHER_GAMES) {
    const copy = FALLBACK_COPY[id];
    assert.ok(copy, `no copy for ${id}`);
    assert.doesNotMatch(copy.text, /^(one phone|pass the phone)/i, `${id} leads with the mechanic`);
    assert.ok(copy.text.includes(`kreeda.games/${id}/`), `${id} does not link to its Game`);
    assert.ok(copy.text.length <= 280, `${id} is over 280 characters`);
  }
});

test('a storyboarded Game has a page to film', () => {
  assert.ok(STORYBOARDS.sync && STORYBOARDS.windows);
  for (const [id, board] of Object.entries(STORYBOARDS)) {
    assert.equal(TogetherDirector.hasStoryboard(id), true);
    assert.equal(typeof board.run, 'function');
    assert.equal(board.colors.length, 2);
    assert.ok(board.url.includes(id));
    assert.ok(fs.existsSync(path.join(config.paths.root, id, 'index.html')), `${id}/index.html is missing`);
  }
});

test('the rotation moves on and wraps', () => {
  const dir = tempStateDir();
  const promoter = new TogetherPromoter({ stateFile: path.join(dir, 'state.json') });
  const pool = promoter.filmable();
  assert.equal(promoter.nextGame({ lastGameId: null }), pool[0]);
  assert.equal(promoter.nextGame({ lastGameId: pool.at(-1) }), pool[0]);
});

test('the sanitizer replaces copy that leads with the mechanic', () => {
  const dir = tempStateDir();
  const promoter = new TogetherPromoter({ stateFile: path.join(dir, 'state.json') });
  const clean = promoter.sanitize(
    { text: 'One phone, two players, ten questions #a #b #c' },
    GAMES.sync,
    FALLBACK_COPY.sync
  );
  assert.equal(clean.text, FALLBACK_COPY.sync.text);
});

test('the sanitizer caps hashtags at two and puts them after the link', () => {
  const dir = tempStateDir();
  const promoter = new TogetherPromoter({ stateFile: path.join(dir, 'state.json') });
  const clean = promoter.sanitize(
    { text: 'Find out how well you know each other #x #y #z see https://kreeda.games/sync/ now' },
    GAMES.sync,
    FALLBACK_COPY.sync
  );
  assert.equal((clean.text.match(/#\w+/g) || []).length, 2);
  assert.ok(clean.text.endsWith('#x #y'));
});

test('metrics rank Games by what their Posts earned', () => {
  const summary = new XMetrics().summarizeByGame({
    tweets: {
      '1': { gameId: 'sync', kind: 'together-video', latest: { impressions: 1000, linkClicks: 30, likes: 10, replies: 2, reposts: 1 } },
      '2': { gameId: 'drift', kind: 'post', latest: { impressions: 2000, linkClicks: 10, likes: 5, replies: 0, reposts: 0 } }
    }
  });
  assert.equal(Object.keys(summary)[0], 'sync', 'the best link-click rate comes first');
  assert.equal(summary.sync.ctrPercent, 3);
  assert.equal(summary.drift.ctrPercent, 0.5);
});

test('the prompts carry the framing rule into what the model is asked for', () => {
  assert.match(PROMPT_TEMPLATES.togetherVideoPost(GAMES.sync), /relationship/);
  assert.match(
    PROMPT_TEMPLATES.adsCampaignBrief({ catalog: [{ id: 'sync', name: 'Sync', tagline: '', url: '', category: 'Play together' }] }),
    /one-phone/
  );
});
