/**
 * A Channel is a term, not a string literal. The Post record names the two
 * `x` and `facebook` (§5.3), and Posts already published on marketing-state
 * carry the older spelling `twitter`.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { X, FACEBOOK, CHANNELS, CHANNEL_NAMES, toChannel, isChannel } from '../src/knowledge/channels.js';
import { UniversalPublisher } from '../src/publishers/index.js';
import { noNetwork } from './helpers.js';

noNetwork();

test('there are two Channels', () => {
  assert.deepEqual(CHANNELS, ['x', 'facebook']);
  assert.equal(CHANNEL_NAMES[X], 'X');
  assert.equal(CHANNEL_NAMES[FACEBOOK], 'Facebook');
});

test('a Post published under the old spelling still resolves', () => {
  assert.equal(toChannel('twitter'), X);
  assert.equal(toChannel('Twitter'), X);
  assert.equal(toChannel(' X '), X);
  assert.equal(toChannel('fb'), FACEBOOK);
});

test('an unknown Channel throws rather than publishing nowhere', () => {
  for (const value of ['reddit', 'linkedin', '', null, undefined]) {
    assert.throws(() => toChannel(value), /Unknown Channel/);
    assert.equal(isChannel(value), false);
  }
});

test('the publisher dispatches on a Channel and refuses anything else', async () => {
  const publisher = new UniversalPublisher();
  assert.deepEqual(Object.keys(publisher.getStatus()).sort(), ['facebook', 'x']);
  await assert.rejects(() => publisher.publish('reddit', { text: 'no' }, true), /Unknown Channel/);
});

test('a dry run reaches no Channel', async () => {
  // noNetwork() above is the real assertion: a live call would throw.
  const result = await new UniversalPublisher().publish('twitter', { text: 'A Post.' }, true);
  assert.equal(result.mode, 'draft');
  assert.equal(result.channel, X);
});
