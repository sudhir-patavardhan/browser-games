/**
 * The Review (§5.2). Merging it is the CMO's approval, so the two things that
 * must never break are: a tick means approved and an untick means rejected,
 * and regenerating the body does not silently re-tick something the CMO
 * deliberately unticked.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { renderReview, parseTicks, decisionsFrom, slotLabel, REVIEW_HEAD, REVIEW_BASE } from '../src/producer/review.js';
import { makePost } from '../src/producer/post.js';
import { noNetwork } from './helpers.js';

noNetwork();

const post = (fields) => makePost({
  slot: { date: '2026-09-05', window: '09' }, gameId: 'circle', category: 'Friends circle',
  content: { text: 'Two questions decide whether you know them. https://kreeda.games/circle/' },
  ...fields
});

const proposal = (fields = {}) => ({
  id: 'prop-1', gameId: 'drift', angle: 'the battery is the health bar',
  tweetText: 'A drift game where the battery is your health bar.',
  budget: { dailyUsd: 5, trialDays: 3, totalCapUsd: 15, suggestedBecause: 'first Campaign for this Game' },
  targeting: { ageBucket: 'AGE_21_TO_34', countries: ['IN'], interests: ['Gaming'] },
  expectedOutcome: { estClicks: 60, estCpcUsd: 0.25, estPlayers: 12, basis: 'organic CTR of 1.2% on this Game' },
  ...fields
});

test('the Review targets the state branch, never main', () => {
  assert.equal(REVIEW_BASE, 'marketing-state');
  assert.equal(REVIEW_HEAD, 'marketing-review');
});

test('every Post is listed pre-ticked, with its text and its Slot', () => {
  const body = renderReview({ posts: [post({ id: 'post-1' })] });
  assert.match(body, /- \[x\] `post-1`/);
  assert.match(body, /Circle Quiz/);
  assert.match(body, /Sat 5 Sep, 09:00 UTC/);
  assert.match(body, /> Two questions decide whether you know them/);
});

test('the body says plainly what merging does', () => {
  const body = renderReview({ posts: [post({ id: 'post-1' })] });
  assert.match(body, /Merging this pull request is your approval/);
  assert.match(body, /Closing without merging changes nothing/);
});

test('a tick is an approval and an untick is a rejection', () => {
  const merged = renderReview({ posts: [post({ id: 'a' }), post({ id: 'b' })] }).replace('- [x] `b`', '- [ ] `b`');
  const { approved, rejected } = decisionsFrom(merged);
  assert.deepEqual(approved, ['a']);
  assert.deepEqual(rejected, ['b']);
});

test('an untick survives the body being regenerated', () => {
  const first = renderReview({ posts: [post({ id: 'a' }), post({ id: 'b' })] });
  const afterCmoUnticked = first.replace('- [x] `b`', '- [ ] `b`');

  const regenerated = renderReview({
    posts: [post({ id: 'a' }), post({ id: 'b' }), post({ id: 'c' })],
    ticks: parseTicks(afterCmoUnticked)
  });

  const ticks = parseTicks(regenerated);
  assert.equal(ticks.get('a'), true);
  assert.equal(ticks.get('b'), false, 'the CMO unticked this; regenerating must not re-tick it');
  assert.equal(ticks.get('c'), true, 'a Post the CMO has not seen arrives pre-ticked');
});

test('a Post that has left the Review is simply gone from it', () => {
  const ticks = parseTicks(renderReview({ posts: [post({ id: 'a' }), post({ id: 'gone' })] }));
  const regenerated = renderReview({ posts: [post({ id: 'a' })], ticks });
  assert.doesNotMatch(regenerated, /`gone`/);
  assert.deepEqual([...parseTicks(regenerated).keys()], ['a']);
});

test('Assets are linked so the CMO previews the exact file that goes out', () => {
  const body = renderReview({ posts: [post({
    id: 'post-1', format: 'video',
    assets: [
      { kind: 'video', url: 'https://github.com/o/r/releases/download/media/a.mp4' },
      { kind: 'card', url: 'https://github.com/o/r/releases/download/media/a.png' }
    ]
  })] });
  assert.match(body, /\[video\]\(https:\/\/github\.com\/o\/r\/releases\/download\/media\/a\.mp4\)/);
  assert.match(body, /\[card\]\(/);
});

test('a thread is shown numbered, so the CMO reads what actually posts', () => {
  const body = renderReview({ posts: [post({
    id: 'post-1', format: 'thread',
    content: { text: '', thread: [{ text: 'One.' }, { text: 'Two.' }] }
  })] });
  assert.match(body, /\*\*1\/2\*\* One\./);
  assert.match(body, /\*\*2\/2\*\* Two\./);
});

test('a Campaign proposal shows the money, the targeting and the promise', () => {
  const body = renderReview({ proposals: [proposal()] });
  assert.match(body, /- \[x\] `prop-1` · Drift/);
  assert.match(body, /\$5\/day for 3 days \(cap \$15\)/);
  assert.match(body, /AGE_21_TO_34 · IN · Gaming/);
  assert.match(body, /60 clicks at \$0\.25 · 12 Players/);
  assert.match(body, /first Campaign for this Game/);
});

test('Posts and Campaigns are ticked independently', () => {
  const body = renderReview({ posts: [post({ id: 'post-1' })], proposals: [proposal()] });
  const unticked = body.replace('- [x] `prop-1`', '- [ ] `prop-1`');
  const { approved, rejected } = decisionsFrom(unticked);
  assert.deepEqual(approved, ['post-1']);
  assert.deepEqual(rejected, ['prop-1'], 'a Campaign can be refused while its Posts go out');
});

test('an Alert is the first thing the CMO sees', () => {
  const body = renderReview({ posts: [], alerts: ['Campaign ads-1 was paused: CTR 0.11%'] });
  assert.match(body.split('\n').slice(0, 5).join('\n'), /Needs your attention/);
  assert.match(body, /Campaign ads-1 was paused/);
});

test('a quiet day still renders, and says so', () => {
  const body = renderReview({ posts: [], proposals: [], runLog: 'Nothing was due.' });
  assert.match(body, /Nothing is waiting on you/);
  assert.match(body, /No Campaign is proposed/);
  assert.match(body, /Nothing was due\./);
  assert.deepEqual([...parseTicks(body).keys()], [], 'nothing to approve means nothing tickable');
});

test('a Post the Creative has not filled says so rather than showing nothing', () => {
  const body = renderReview({ posts: [post({ id: 'post-1', content: { text: '', thread: [] } })] });
  assert.match(body, /The Creative has not filled this Post yet/);
});

test('a Slot reads as a date a person can parse', () => {
  assert.equal(slotLabel({ date: '2026-09-08', window: '13' }), 'Tue 8 Sep, 13:00 UTC');
});
