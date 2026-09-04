/**
 * The Post lifecycle (§5.3). The transitions are the thing that stops a Post
 * being published twice or published without a merged Review, so they are
 * asserted rather than assumed.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  makePost, transition, update, migrate, isDue, hasExpired, currentWindow, slotAt, isOpen,
  DRAFT, IN_REVIEW, APPROVED, PUBLISHED, REJECTED, FAILED, EXPIRED, WINDOWS, EXPIRY_DAYS
} from '../src/producer/post.js';
import { X, FACEBOOK } from '../src/knowledge/channels.js';
import { noNetwork } from './helpers.js';

noNetwork();

const at = iso => new Date(iso);
const post = (fields = {}) => makePost({ slot: { date: '2026-09-08', window: '13' }, ...fields }, at('2026-09-05T09:00:00Z'));

test('a new Post is a Draft with every field present', () => {
  const p = post({ gameId: 'circle', category: 'Friends circle' });
  assert.equal(p.status, DRAFT);
  assert.equal(p.channel, X);
  assert.match(p.id, /^post-\d{4}-\d{2}-\d{2}-/);
  for (const field of ['content', 'assets', 'intentId', 'publishResult', 'reviewedAt', 'rejectReason']) {
    assert.ok(field in p, `${field} is missing, so a reader has to guess`);
  }
});

test('a Post walks Draft to Published', () => {
  let p = post();
  p = transition(p, IN_REVIEW);
  p = transition(p, APPROVED, { reviewedAt: '2026-09-07T10:00:00Z' });
  p = transition(p, PUBLISHED, { publishResult: { mode: 'live', postId: '1' } });
  assert.equal(p.status, PUBLISHED);
  assert.equal(p.publishResult.postId, '1');
});

test('a Post cannot skip the Review', () => {
  assert.throws(() => transition(post(), APPROVED), /cannot go from Draft to Approved/);
  assert.throws(() => transition(post(), PUBLISHED), /cannot go from Draft to Published/);
});

test('a Published Post is finished and cannot move again', () => {
  const published = transition(transition(transition(post(), IN_REVIEW), APPROVED), PUBLISHED);
  assert.equal(isOpen(published), false);
  assert.throws(() => transition(published, PUBLISHED), /it is finished/);
  assert.throws(() => transition(published, FAILED), /it is finished/);
});

test('a Rejected Post stays rejected', () => {
  const rejected = transition(transition(post(), IN_REVIEW), REJECTED, { rejectReason: 'rejected in review' });
  assert.equal(isOpen(rejected), false);
  assert.throws(() => transition(rejected, APPROVED), /it is finished/);
});

test('a Failed Post can still be published, because the next Window retries it', () => {
  const failed = transition(transition(transition(post(), IN_REVIEW), APPROVED), FAILED, { attempts: 3 });
  assert.equal(transition(failed, PUBLISHED).status, PUBLISHED);
  assert.equal(transition(failed, FAILED).status, FAILED, 'a second failure is allowed');
});

test('an unknown status is refused rather than written', () => {
  assert.throws(() => transition(post(), 'scheduled'), /is not a Post status/);
  assert.throws(() => transition(post(), 'draft_published'), /is not a Post status/);
});

test('a Post is due when its Slot has arrived and the CMO approved it', () => {
  const approved = transition(transition(post(), IN_REVIEW), APPROVED);
  assert.equal(isDue(approved, { now: at('2026-09-08T13:05:00Z'), window: '13' }), true);
  assert.equal(isDue(approved, { now: at('2026-09-08T09:05:00Z'), window: '09' }), false, 'its Window has not come');
  assert.equal(isDue(approved, { now: at('2026-09-07T17:05:00Z'), window: '17' }), false, 'its day has not come');
});

test('a Post whose Window was missed goes out at the next one', () => {
  const approved = transition(transition(post(), IN_REVIEW), APPROVED);
  assert.equal(isDue(approved, { now: at('2026-09-08T17:05:00Z'), window: '17' }), true);
  assert.equal(isDue(approved, { now: at('2026-09-09T09:05:00Z'), window: '09' }), true, 'and the next day');
});

test('a Post nobody approved is never due', () => {
  assert.equal(isDue(post(), { now: at('2026-09-30T13:05:00Z'), window: '13' }), false);
  assert.equal(isDue(transition(post(), IN_REVIEW), { now: at('2026-09-30T13:05:00Z'), window: '13' }), false,
    'In review is not approval — nothing publishes without a merged Review');
});

test('a Post expires three days after its Slot, and not before', () => {
  const waiting = transition(post(), IN_REVIEW);
  const slot = slotAt(waiting).getTime();
  assert.equal(hasExpired(waiting, new Date(slot + EXPIRY_DAYS * 86_400_000 - 1000)), false);
  assert.equal(hasExpired(waiting, new Date(slot + EXPIRY_DAYS * 86_400_000 + 1000)), true);
});

test('a Post that already happened never expires', () => {
  const published = transition(transition(transition(post(), IN_REVIEW), APPROVED), PUBLISHED);
  assert.equal(hasExpired(published, at('2030-01-01T00:00:00Z')), false);
});

test('the Window is the last one to have arrived', () => {
  assert.equal(currentWindow(at('2026-09-08T08:59:00Z')), '09', 'before the first Window, it is the first');
  assert.equal(currentWindow(at('2026-09-08T09:00:00Z')), '09');
  assert.equal(currentWindow(at('2026-09-08T12:59:00Z')), '09');
  assert.equal(currentWindow(at('2026-09-08T13:00:00Z')), '13');
  assert.equal(currentWindow(at('2026-09-08T23:59:00Z')), '17');
  assert.deepEqual(WINDOWS, ['09', '13', '17']);
});

test('a retired status is migrated, not carried', () => {
  const now = at('2026-09-05T09:00:00Z');
  assert.equal(migrate({ status: 'scheduled', channel: 'twitter', scheduledDate: '2026-09-10' }, now).post.status, DRAFT);
  assert.equal(migrate({ status: 'draft_published', channel: 'twitter', scheduledDate: '2026-08-29' }, now).post.status, EXPIRED);
  assert.equal(migrate({ status: 'archived', channel: 'twitter', scheduledDate: '2026-09-01' }, now).post.status, EXPIRED);
});

test('a Post on a Channel that no longer exists is Expired, not dropped', () => {
  const { post: migrated, changed, reason } = migrate(
    { status: 'draft_published', channel: 'devto', gameId: 'ennead', scheduledDate: '2026-08-30' },
    at('2026-09-05T09:00:00Z')
  );
  assert.equal(migrated.status, EXPIRED);
  assert.equal(migrated.gameId, 'ennead', 'the Run log must still be able to say what happened to it');
  assert.equal(changed, true);
  assert.match(reason, /not a Channel any more/);
});

test('a real published Post keeps its history through migration', () => {
  const { post: migrated } = migrate({
    status: 'published', channel: 'twitter', gameId: 'drift', scheduledDate: '2026-09-02',
    publishResult: { mode: 'live', postId: '2093734828265152685' }
  }, at('2026-09-05T09:00:00Z'));
  assert.equal(migrated.status, PUBLISHED);
  assert.equal(migrated.channel, X);
  assert.equal(migrated.publishResult.postId, '2093734828265152685');
  assert.deepEqual(migrated.slot, { date: '2026-09-02', window: '09' });
});

test('an already-current Post is left alone', () => {
  const current = post({ channel: FACEBOOK, status: IN_REVIEW });
  const { changed } = migrate(current, at('2026-09-05T09:00:00Z'));
  assert.equal(changed, false);
});

test('update changes fields but can never change a status', () => {
  const p = post();
  const withIntent = update(p, { intentId: 'intent-1' });
  assert.equal(withIntent.intentId, 'intent-1');
  assert.equal(withIntent.status, DRAFT);
  assert.notEqual(withIntent.updatedAt, p.updatedAt);
  assert.throws(() => update(p, { status: PUBLISHED }), /never by update/);
});
