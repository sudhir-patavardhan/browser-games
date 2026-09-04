/**
 * The brand rules (§9). The Creative is a model call, and these are the reason
 * it cannot publish "This is a game-changer! 🚀" or a player count nobody can
 * stand behind.
 *
 * The split that matters: a violation means try again, a repair is mechanical
 * shape. Nothing that misleads is ever quietly repaired — repairing an
 * invented statistic would just mean publishing it in a nicer format.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { violations, repair, enforce, SOCIAL_CATEGORIES, AD_MAX_CHARS } from '../src/agents/creative/brand.js';
import { noNetwork } from './helpers.js';

noNetwork();

const LINK = 'https://kreeda.games/circle/';
const onX = (extra = {}) => ({ channel: 'x', ...extra });

test('rule 1: Play-together copy may not open with the one-phone mechanic', () => {
  const social = { channel: 'x', category: 'Play together' };
  for (const opening of ['One phone, two players. ', 'Pass the phone around. ', '3-8 players, one phone. ']) {
    assert.match(violations(opening + LINK, social).join(' '), /rule 1/, `"${opening}" should be refused`);
  }
  assert.deepEqual(violations(`You find out who actually knows you. ${LINK}`, social), []);
});

test('rule 1 applies to every social Category, not just one', () => {
  assert.deepEqual(SOCIAL_CATEGORIES, ['Play together', 'Friends circle']);
  assert.match(violations(`One phone, ten questions. ${LINK}`, onX({ category: 'Friends circle' })).join(' '), /rule 1/);
});

test('rule 1 does not apply to a Game nobody shares a phone for', () => {
  assert.deepEqual(violations(`One phone is all it takes. ${LINK}`, onX({ category: 'Solo arcade' })), []);
});

test('rule 2: no rocket, no game-changer, no exclamation pile-up', () => {
  assert.match(violations(`🚀 Play now ${LINK}`, onX()).join(' '), /rocket/);
  assert.match(violations(`A real game-changer ${LINK}`, onX()).join(' '), /game-changer/);
  assert.match(violations(`Revolutionary physics ${LINK}`, onX()).join(' '), /hype vocabulary/);
  assert.match(violations(`Try it! Right now! ${LINK}`, onX()).join(' '), /exclamation/);
  assert.deepEqual(violations(`Grip is a budget. ${LINK}`, onX()), []);
});

test('rule 5: no invented counts, awards or testimonials', () => {
  assert.match(violations(`Join 50,000 players ${LINK}`, onX()).join(' '), /player count/);
  assert.match(violations(`Our award-winning puzzle ${LINK}`, onX()).join(' '), /award/);
  assert.match(violations(`"The best game I have played all year" — Anna ${LINK}`, onX()).join(' '), /testimonial/);
});

test('rule 3: an ad carries no hashtag and no mention, and is short', () => {
  const ad = onX({ kind: 'ad' });
  assert.match(violations(`Play Drift #gaming ${LINK}`, ad).join(' '), /may not contain a hashtag/);
  assert.match(violations(`Play Drift @kreeda ${LINK}`, ad).join(' '), /may not @mention/);
  assert.match(violations(`${'a'.repeat(AD_MAX_CHARS)} ${LINK}`, ad).join(' '), new RegExp(`at most ${AD_MAX_CHARS}`));
});

test('rule 4: at most two hashtags, and after the link', () => {
  const { text, repairs } = repair(`Find out who knows you #a #b #c ${LINK}`, onX());
  assert.equal((text.match(/#\w+/g) || []).length, 2);
  assert.ok(text.endsWith('#a #b'), 'the hashtags belong after the link, not competing with it');
  assert.match(repairs.join(' '), /kept 2 of 3/);
});

test('a Post with no link cannot attribute a Player, so it is repaired or refused', () => {
  assert.match(violations('Two questions decide it.', onX()).join(' '), /does not link to the Game/);
  const { text, repairs } = repair('Two questions decide it.', { channel: 'x', gameUrl: LINK });
  assert.ok(text.includes(LINK));
  assert.match(repairs.join(' '), /added the link/);
});

test('length is judged the way each Channel judges it', () => {
  // On X a link costs 23 characters however long it is, so a decorated URL
  // must not push a Post over on its own.
  const long = `${'a'.repeat(250)} ${LINK}?utm_source=x&utm_medium=organic&utm_campaign=friends-circle&utm_content=post-1`;
  assert.deepEqual(violations(long, onX()), [], 'X counts the link as 23, so this fits');
  assert.match(violations(`${'a'.repeat(300)} ${LINK}`, onX()).join(' '), /the X limit is 280/);
  assert.deepEqual(violations(`${'a'.repeat(1000)} ${LINK}`, { channel: 'facebook' }), [],
    'Facebook is long-form and 1000 characters is fine there');
});

test('nothing misleading is ever quietly repaired', () => {
  const { text, violations: found } = enforce(`🚀 Join 50,000 players! ${LINK}`, onX());
  assert.ok(text.includes('50,000'), 'a repaired statistic would just be a nicer-looking lie');
  assert.ok(found.length >= 2, 'it is refused instead');
});

test('good copy passes untouched', () => {
  const result = enforce(`You have known them ten years. Two questions decide whether that is true. ${LINK}`, onX({ category: 'Friends circle' }));
  assert.equal(result.ok, true);
  assert.deepEqual(result.repairs, []);
  assert.deepEqual(result.violations, []);
});

test('empty copy is refused rather than published as nothing', () => {
  assert.deepEqual(violations('', onX()), ['there is no copy at all']);
  assert.deepEqual(violations('   ', onX()), ['there is no copy at all']);
});
