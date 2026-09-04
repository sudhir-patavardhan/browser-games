/**
 * The Post queue and the intent ledger, against a state directory of their
 * own. Between them they hold the two properties that stop a Post going out
 * twice: a status only changes through `transition`, and what we meant to do
 * is written before we do it.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

import { Queue } from '../src/producer/queue.js';
import { Intents } from '../src/producer/intents.js';
import { transition, DRAFT, IN_REVIEW, APPROVED, PUBLISHED, EXPIRED } from '../src/producer/post.js';
import { X, FACEBOOK } from '../src/knowledge/channels.js';
import { tempStateDir, tempStateFile, noNetwork } from './helpers.js';

noNetwork();

const at = iso => new Date(iso);
const NOW = at('2026-09-08T13:05:00Z');
const queue = () => new Queue(tempStateFile('queue.json'));

test('a missing queue reads as empty rather than throwing mid-Cycle', () => {
  assert.deepEqual(new Queue(`${tempStateDir()}/nothing.json`).all(), []);
});

test('a corrupt queue reads as empty', () => {
  const file = tempStateFile('queue.json');
  fs.writeFileSync(file, '{ not json');
  assert.deepEqual(new Queue(file).all(), []);
});

test('an added Post is a Draft with a Slot', () => {
  const q = queue();
  const [post] = q.add({ gameId: 'circle', category: 'Friends circle', slot: { date: '2026-09-09', window: '13' } }, NOW);
  assert.equal(post.status, DRAFT);
  assert.deepEqual(q.byId(post.id).slot, { date: '2026-09-09', window: '13' });
});

test('replacing a Post the queue does not have is refused', () => {
  const q = queue();
  assert.throws(() => q.replace({ id: 'post-nope', status: DRAFT }), /No Post post-nope/);
});

test('due lists only what the CMO approved and whose Slot has come', () => {
  const q = queue();
  const [a, b, c] = q.add([
    { id: 'a', slot: { date: '2026-09-08', window: '09' } },
    { id: 'b', slot: { date: '2026-09-08', window: '17' } },
    { id: 'c', slot: { date: '2026-09-08', window: '13' } }
  ], NOW);
  q.replaceAll([
    transition(transition(a, IN_REVIEW), APPROVED),
    transition(transition(b, IN_REVIEW), APPROVED),
    transition(c, IN_REVIEW)
  ]);

  const due = q.due({ now: NOW, window: '13' });
  assert.deepEqual(due.map(p => p.id), ['a'], 'b is a later Window, c was never approved');
});

test('due is ordered by Slot, so the oldest Post goes out first', () => {
  const q = queue();
  const posts = q.add([
    { id: 'later', slot: { date: '2026-09-08', window: '09' } },
    { id: 'earlier', slot: { date: '2026-09-06', window: '17' } }
  ], NOW);
  q.replaceAll(posts.map(p => transition(transition(p, IN_REVIEW), APPROVED)));
  assert.deepEqual(q.due({ now: NOW, window: '13' }).map(p => p.id), ['earlier', 'later']);
});

test('expired lists Posts three days past their Slot, whatever they were waiting for', () => {
  const q = queue();
  const posts = q.add([
    { id: 'old', slot: { date: '2026-09-01', window: '09' } },
    { id: 'recent', slot: { date: '2026-09-07', window: '09' } }
  ], NOW);
  q.replaceAll(posts.map(p => transition(p, IN_REVIEW)));
  assert.deepEqual(q.expired(NOW).map(p => p.id), ['old']);
});

test('the Creative is given Drafts inside its horizon, including late ones', () => {
  const q = queue();
  q.add([
    { id: 'soon', slot: { date: '2026-09-09', window: '09' } },
    { id: 'late', slot: { date: '2026-09-07', window: '09' } },
    { id: 'far', slot: { date: '2026-09-20', window: '09' } }
  ], NOW);
  const ids = q.needingCreative({ now: NOW }).map(p => p.id);
  assert.deepEqual(ids, ['late', 'soon'], 'a late Draft is late, not gone, until it expires');
});

test('a Post already In review is not sent to the Creative again', () => {
  const q = queue();
  const [post] = q.add({ id: 'done', slot: { date: '2026-09-09', window: '09' } }, NOW);
  q.replace(transition(post, IN_REVIEW));
  assert.deepEqual(q.needingCreative({ now: NOW }), []);
});

test('migrating the old queue is idempotent', () => {
  const q = queue();
  q.save([
    { id: 'p1', status: 'scheduled', channel: 'twitter', gameId: 'carrom', scheduledDate: '2026-09-10' },
    { id: 'p2', status: 'draft_published', channel: 'devto', gameId: 'ennead', scheduledDate: '2026-08-30' },
    { id: 'p3', status: 'published', channel: 'twitter', gameId: 'drift', scheduledDate: '2026-09-02', publishResult: { mode: 'live', postId: '99' } }
  ]);

  // All three change: two have retired statuses, and the third still carries a
  // scheduledDate where the lifecycle wants a Slot.
  const first = q.migrateAll(NOW);
  assert.equal(first.migrated, 3);
  assert.equal(first.unchanged, 0);
  assert.equal(q.byId('p1').status, DRAFT);
  assert.equal(q.byId('p2').status, EXPIRED);
  assert.equal(q.byId('p3').status, PUBLISHED);
  assert.equal(q.byId('p3').publishResult.postId, '99', 'real history survives');
  assert.equal(q.byId('p1').channel, X);

  const again = q.migrateAll(NOW);
  assert.equal(again.migrated, 0, 'a migrated queue does not keep migrating');
});

// --- intents ---------------------------------------------------------------

const intents = () => new Intents(tempStateFile('intents.json', []));

test('an intent is recorded before the call, and is unfinished until told otherwise', () => {
  const ledger = intents();
  const intent = ledger.record({ kind: 'publish', target: 'post-1', channel: X }, NOW);
  assert.match(intent.id, /^intent-/);
  assert.equal(intent.result, null);
  assert.ok(ledger.unfinished({ kind: 'publish', target: 'post-1' }, { now: NOW }));
  assert.equal(ledger.finished({ kind: 'publish', target: 'post-1' }), null);
});

test('a completed intent is how a retry knows the work is done', () => {
  const ledger = intents();
  const intent = ledger.record({ kind: 'publish', target: 'post-1' }, NOW);
  ledger.complete(intent.id, { postId: '123' }, NOW);
  assert.equal(ledger.unfinished({ kind: 'publish', target: 'post-1' }, { now: NOW }), null);
  assert.equal(ledger.finished({ kind: 'publish', target: 'post-1' }).result.postId, '123');
});

test('an intent that died mid-flight is what the next Cycle finds', () => {
  const ledger = intents();
  ledger.record({ kind: 'publish', target: 'post-1' }, NOW);
  const found = ledger.unfinished({ kind: 'publish', target: 'post-1' }, { now: new Date(NOW.getTime() + 60_000) });
  assert.ok(found, 'without this the next Cycle publishes the same Post again');
});

test('an old intent is not mistaken for one in flight', () => {
  const ledger = intents();
  ledger.record({ kind: 'publish', target: 'post-1' }, NOW);
  const muchLater = new Date(NOW.getTime() + 2 * 3_600_000);
  assert.equal(ledger.unfinished({ kind: 'publish', target: 'post-1' }, { now: muchLater }), null);
});

test('intents for different actions do not collide', () => {
  const ledger = intents();
  ledger.record({ kind: 'publish', target: 'post-1' }, NOW);
  assert.equal(ledger.unfinished({ kind: 'publish', target: 'post-2' }, { now: NOW }), null);
  assert.equal(ledger.unfinished({ kind: 'launch', target: 'post-1' }, { now: NOW }), null);
});

test('completing an intent that does not exist is an error, not a silent write', () => {
  assert.throws(() => intents().complete('intent-nope', {}), /No intent intent-nope/);
});
