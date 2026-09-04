/**
 * Link decoration (§7). This is what makes a Player attributable to a Post, so
 * getting it wrong does not break anything visibly — it just makes the
 * Analyst's numbers quietly wrong.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { decorate, decorateText, decoratePost, lengthOnX, X_LINK_COST, ORGANIC, PAID } from '../src/producer/links.js';
import { makePost } from '../src/producer/post.js';
import { noNetwork } from './helpers.js';

noNetwork();

const attribution = { channel: 'x', campaign: 'Friends circle', content: 'post-1' };
const params = url => Object.fromEntries(new URL(url).searchParams);

test('a bare catalog URL gets the whole attribution', () => {
  assert.deepEqual(params(decorate('https://kreeda.games/circle/', attribution)), {
    utm_source: 'x', utm_medium: 'organic', utm_campaign: 'friends-circle', utm_content: 'post-1'
  });
});

test('a Category becomes a stable utm value', () => {
  assert.equal(params(decorate('https://kreeda.games/sync/', { ...attribution, campaign: 'Play together' })).utm_campaign, 'play-together');
  assert.equal(params(decorate('https://kreeda.games/valence/', { ...attribution, campaign: 'Daily study grids' })).utm_campaign, 'daily-study-grids');
});

test('paid carries the Campaign id where organic carries the Category', () => {
  const paid = params(decorate('https://kreeda.games/drift/', { channel: 'x', medium: PAID, campaign: 'ads-1788201112140-rl5n', content: 'post-1' }));
  assert.equal(paid.utm_medium, PAID);
  assert.equal(paid.utm_campaign, 'ads-1788201112140-rl5n');
});

test('the Channel a Post goes out on is the source', () => {
  assert.equal(params(decorate('https://kreeda.games/a/', { ...attribution, channel: 'facebook' })).utm_source, 'facebook');
  assert.equal(params(decorate('https://kreeda.games/a/', { ...attribution, channel: 'twitter' })).utm_source, 'x',
    'the stored spelling still resolves');
});

test('a link that is not ours is left exactly as it was', () => {
  for (const url of ['https://example.com/x', 'https://github.com/sudhir-patavardhan/browser-games', 'not a url at all']) {
    assert.equal(decorate(url, attribution), url);
  }
});

test('a link is never decorated twice', () => {
  const once = decorate('https://kreeda.games/circle/', attribution);
  const twice = decorate(once, { ...attribution, content: 'post-2' });
  assert.equal(twice, once, 'decorating twice would reassign a Player to the wrong Post');
});

test('an existing path and query survive decoration', () => {
  const decorated = decorate('https://kreeda.games/circle/index.html?seed=4', attribution);
  assert.equal(new URL(decorated).pathname, '/circle/index.html');
  assert.equal(params(decorated).seed, '4');
});

test('every link in a piece of copy is decorated, and nothing else is touched', () => {
  const text = 'Two questions decide it. https://kreeda.games/circle/ and https://example.com/other #kreeda';
  const out = decorateText(text, attribution);
  assert.match(out, /kreeda\.games\/circle\/\?utm_source=x/);
  assert.match(out, /https:\/\/example\.com\/other/);
  assert.match(out, /#kreeda$/);
});

test('punctuation after a link stays punctuation', () => {
  const out = decorateText('Play it: https://kreeda.games/sync/.', attribution);
  assert.ok(out.endsWith('.'), 'the full stop was swallowed into the URL');
  assert.doesNotMatch(new URL(out.match(/https[^\s]+[^.]/)[0]).pathname, /\.$/);
});

test('a whole Post is decorated, thread and all', () => {
  const post = makePost({
    id: 'post-1', channel: 'x', category: 'Play together',
    content: {
      text: 'Start here https://kreeda.games/sync/',
      thread: [{ text: 'One https://kreeda.games/sync/' }, 'Two https://kreeda.games/windows/']
    }
  });
  const content = decoratePost(post);
  assert.match(content.text, /utm_content=post-1/);
  assert.match(content.thread[0].text, /utm_campaign=play-together/);
  assert.match(content.thread[1], /utm_source=x/);
});

test('a paid Post is decorated against its Campaign, not its Category', () => {
  const post = makePost({ id: 'post-1', category: 'Fast action', content: { text: 'https://kreeda.games/drift/' } });
  const content = decoratePost(post, { medium: PAID, campaign: 'ads-99' });
  assert.match(content.text, /utm_medium=paid/);
  assert.match(content.text, /utm_campaign=ads-99/);
});

test('X counts a link as 23 characters however long it is', () => {
  const bare = 'Find out who knows you. https://kreeda.games/circle/';
  const decorated = decorateText(bare, attribution);
  assert.ok(decorated.length > bare.length, 'decoration does make the string longer');
  assert.equal(lengthOnX(decorated), lengthOnX(bare), 'but it costs a Post no room on X');
  assert.equal(lengthOnX('abc'), 3);
  assert.equal(lengthOnX('a https://kreeda.games/x/'), 2 + X_LINK_COST);
});

test('decoration keeps a Post inside 280 characters on X', () => {
  const text = `${'a'.repeat(250)} https://kreeda.games/circle/`;
  assert.ok(lengthOnX(decorateText(text, attribution)) <= 280);
});
