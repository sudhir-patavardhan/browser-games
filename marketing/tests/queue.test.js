/**
 * The Post queue, against a state directory of its own. No test writes to the
 * marketing-state worktree (§13).
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

import { QueueManager } from '../src/scheduler/queueManager.js';
import { X, FACEBOOK } from '../src/knowledge/channels.js';
import { tempStateDir, tempStateFile, noNetwork } from './helpers.js';

noNetwork();

const queue = () => new QueueManager(tempStateFile('queue.json'));

test('a queue file is created rather than assumed', () => {
  const file = `${tempStateDir()}/queue.json`;
  assert.equal(fs.existsSync(file), false);
  new QueueManager(file);
  assert.deepEqual(JSON.parse(fs.readFileSync(file, 'utf8')), []);
});

test('an added Post gets an id, a Draft status and a Channel', () => {
  const q = queue();
  q.add({ gameId: 'drift' });
  const [post] = q.getAll();
  assert.match(post.id, /^post-/);
  assert.equal(post.status, 'draft');
  assert.equal(post.channel, X);
  assert.equal(post.gameId, 'drift');
});

test('a Post keeps the Channel it was given, in the Post record spelling', () => {
  const q = queue();
  q.add([{ channel: 'twitter', gameId: 'sync' }, { channel: 'facebook', gameId: 'carrom' }]);
  assert.deepEqual(q.getAll().map(p => p.channel), [X, FACEBOOK]);
});

test('a corrupt queue reads as empty rather than crashing a Cycle', () => {
  const file = tempStateFile('queue.json');
  fs.writeFileSync(file, '{ not json');
  assert.deepEqual(new QueueManager(file).getAll(), []);
});

test('Posts survive a round trip through the file', () => {
  const file = tempStateFile('queue.json');
  new QueueManager(file).add({ gameId: 'ennead', content: { text: 'A Post.' } });
  const [post] = new QueueManager(file).getAll();
  assert.equal(post.content.text, 'A Post.');
});
