/**
 * The Creative (§6.3), against a stubbed model. The behaviour that matters is
 * what it refuses: fallback copy, copy that breaks a brand rule twice, and a
 * Game that is not on the hub.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { Creative } from '../src/agents/creative/index.js';
import { GeminiUnavailableError } from '../src/ai/geminiClient.js';
import { makePost, DRAFT, IN_REVIEW } from '../src/producer/post.js';
import { xSingle, facebookPost, SOCIAL_EXAMPLES } from '../src/agents/creative/prompts.js';
import { GAME_CATALOG } from '../src/knowledge/catalog.js';
import { noNetwork } from './helpers.js';

noNetwork();

/** A model that returns whatever it was told to, and records its prompts. */
function stubAi(replies) {
  const queue = Array.isArray(replies) ? [...replies] : [replies];
  const prompts = [];
  return {
    prompts,
    async generate({ prompt }) {
      prompts.push(prompt);
      const next = queue.shift();
      if (next instanceof Error) throw next;
      return next ?? queue.at(-1);
    }
  };
}

const stubGitHub = (uploads = []) => ({
  async uploadAsset(file, { name }) {
    uploads.push(name);
    return { url: `https://github.com/o/r/releases/download/media/${name}`, name };
  }
});

const draft = (fields = {}) => makePost({
  gameId: 'circle', category: 'Friends circle', channel: 'x',
  slot: { date: '2026-09-09', window: '09' }, angle: 'who actually knows whom',
  ...fields
});

/** A Creative that writes but renders nothing, so the tests stay offline. */
function creative(ai, { uploads = [] } = {}) {
  const c = new Creative({ ai, github: stubGitHub(uploads) });
  c.render = async () => [{ kind: 'card', url: 'https://github.com/o/r/releases/download/media/card.png' }];
  return c;
}

test('a filled Post carries its copy and moves to In review', async () => {
  const ai = stubAi({ text: 'You have known them ten years. Two questions decide it. https://kreeda.games/circle/', altText: 'Six friends around a phone.' });
  const { post, filled, error } = await creative(ai).fill(draft());

  assert.equal(error, null);
  assert.equal(filled, true);
  assert.equal(post.status, IN_REVIEW);
  assert.match(post.content.text, /ten years/);
  assert.equal(post.content.altText, 'Six friends around a phone.');
  assert.equal(post.assets.length, 1);
});

test('the model gets the Dossier, the brief and the Category rule', async () => {
  const ai = stubAi({ text: `Two questions decide it. ${GAME_CATALOG.circle.url}` });
  await creative(ai).fill(draft());

  const prompt = ai.prompts[0];
  assert.match(prompt, /Circle Quiz/, 'the Game');
  assert.match(prompt, /Friends circle/, 'the Category');
  assert.match(prompt, /who actually knows whom/, 'the brief');
  assert.match(prompt, /Never\s+open with the mechanic/, 'rule 1, because this is a social Category');
  assert.match(prompt, new RegExp(SOCIAL_EXAMPLES[0].slice(0, 30)), 'the curated few-shot lines');
});

test('a Post that breaks a brand rule is sent back once, and accepted when fixed', async () => {
  const ai = stubAi([
    { text: '🚀 A game-changer with 40,000 players! https://kreeda.games/circle/' },
    { text: 'You have known them ten years. Two questions decide it. https://kreeda.games/circle/' }
  ]);
  const { post, filled, notes } = await creative(ai).fill(draft());

  assert.equal(filled, true);
  assert.equal(post.status, IN_REVIEW);
  assert.match(ai.prompts[1], /previous attempt was rejected/, 'the retry is told what it broke');
  assert.match(ai.prompts[1], /rocket emoji/);
  assert.match(notes.join(' '), /the first attempt broke a brand rule/);
});

test('copy that breaks the rules twice leaves the Post a Draft', async () => {
  const ai = stubAi([
    { text: '🚀 Amazing! https://kreeda.games/circle/' },
    { text: '🚀 Still amazing! https://kreeda.games/circle/' }
  ]);
  const { post, filled, error } = await creative(ai).fill(draft());

  assert.equal(filled, false);
  assert.equal(post.status, DRAFT, 'a Post the Creative could not write must not reach the Review');
  assert.match(error, /broke the brand rules twice/);
  assert.match(error, /rocket emoji/);
});

test('a model that is unavailable leaves the Post a Draft, never fallback copy', async () => {
  const ai = stubAi(new GeminiUnavailableError('GEMINI_API_KEY is not set, so the Creative cannot write.'));
  const { post, filled, error } = await creative(ai).fill(draft());

  assert.equal(filled, false);
  assert.equal(post.status, DRAFT);
  assert.match(error, /cannot write/);
  assert.doesNotMatch(error, /fallback/i, 'generic copy under the brand is worse than a quiet day');
});

test('a Game that is not on the hub is refused before anything is written', async () => {
  const ai = stubAi({ text: 'anything' });
  const { filled, error } = await creative(ai).fill(draft({ gameId: 'not-a-game' }));
  assert.equal(filled, false);
  assert.match(error, /no Game "not-a-game" is on the hub/);
  assert.equal(ai.prompts.length, 0, 'the model was never called');
});

test('Facebook gets its own prompt, never the tweet prompt', async () => {
  const ai = stubAi({ text: `A quiet Sunday and nobody wants to explain a rulebook.\n\n${'x'.repeat(400)}\n\nhttps://kreeda.games/circle/` });
  await creative(ai).fill(draft({ channel: 'facebook' }));
  assert.match(ai.prompts[0], /Facebook Page post/);
  assert.match(ai.prompts[0], /Do not write a tweet here/);
  assert.doesNotMatch(ai.prompts[0], /one X post/);
});

test('a thread is written, checked and assembled post by post', async () => {
  const ai = stubAi({ thread: [
    { text: 'You have known them ten years. https://kreeda.games/circle/' },
    { text: 'Two questions decide whether that is true. https://kreeda.games/circle/' }
  ] });
  const { post } = await creative(ai).fill(draft({ format: 'thread' }));
  assert.equal(post.content.thread.length, 2);
  assert.match(post.content.text, /ten years/, 'the first post is also the text');
});

test('a dry run writes the copy and leaves the Post a Draft', async () => {
  const uploads = [];
  const ai = stubAi({ text: 'Two questions decide it. https://kreeda.games/circle/' });
  const { post, filled, notes } = await creative(ai, { uploads }).fill(draft(), { dryRun: true });

  assert.equal(filled, false);
  assert.equal(post.status, DRAFT);
  assert.match(post.content.text, /Two questions/);
  assert.deepEqual(uploads, [], 'nothing was uploaded');
  assert.match(notes.join(' '), /dry run/);
});

test('a repairable shape is repaired rather than refused', async () => {
  const ai = stubAi({ text: 'Two questions decide it #fun #games #friends https://kreeda.games/circle/' });
  const { post, filled, notes } = await creative(ai).fill(draft());
  assert.equal(filled, true);
  assert.equal((post.content.text.match(/#\w+/g) || []).length, 2);
  assert.match(notes.join(' '), /repaired: kept 2 of 3 hashtags/);
});

test('the best-performing past copy becomes few-shot', async () => {
  const ai = stubAi({ text: 'Two questions decide it. https://kreeda.games/circle/' });
  const c = creative(ai);
  c.metrics = { load: () => ({ tweets: {
    '1': { gameId: 'circle', text: 'The best one', latest: { impressions: 1000, linkClicks: 50 } },
    '2': { gameId: 'circle', text: 'The worse one', latest: { impressions: 1000, linkClicks: 5 } },
    '3': { gameId: 'drift', text: 'A different Game', latest: { impressions: 1000, linkClicks: 90 } }
  } }) };

  const { notes } = await c.fill(draft());
  assert.match(ai.prompts[0], /The best one/);
  assert.doesNotMatch(ai.prompts[0], /A different Game/, 'few-shot is per Game');
  assert.ok(ai.prompts[0].indexOf('The best one') < ai.prompts[0].indexOf('The worse one'), 'best first');
  assert.match(notes.join(' '), /few-shot: 2 past Post/);
});

test('the prompts never ask for a decorated URL', () => {
  const game = GAME_CATALOG.circle;
  for (const build of [xSingle, facebookPost]) {
    const prompt = build({ game, post: makePost({ gameId: 'circle' }), examples: [] });
    assert.match(prompt, /Do not add tracking parameters/, 'the Producer decorates at publish time (§7)');
  }
});
