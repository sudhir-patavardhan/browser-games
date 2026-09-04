/**
 * The Publish Cycle (AGENTS_SPEC.md §5.1).
 *
 * The Producer alone: no Agent judgement, no improvisation. It runs the same
 * eight steps at each Window, in this order, and the order matters — Reviews
 * are read before anything is published, so a Post approved five minutes ago
 * goes out now; expiry runs before the Creative, so nothing is written for a
 * Post that has already missed its moment.
 *
 * **Nothing is published or launched without a merged Review**, and dry-run
 * never mutates state (§4).
 */

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { config } from '../config.js';
import { CHANNEL_NAMES, toChannel, X } from '../knowledge/channels.js';
import { GAME_CATALOG } from '../knowledge/catalog.js';
import { UniversalPublisher } from '../publishers/index.js';
import { XMetrics } from '../insights/xMetrics.js';
import { FbMetrics } from '../insights/fbMetrics.js';

import { Queue } from './queue.js';
import { Intents } from './intents.js';
import { GitHub } from './github.js';
import { RunLog } from './runlog.js';
import { Outbox, sendAlerts } from './alerts.js';
import { decoratePost } from './links.js';
import { renderReview, parseTicks, decisionsFrom, reviewTitle, REVIEW_HEAD, REVIEW_BASE } from './review.js';
import { Creative } from '../agents/creative/index.js';
import { commitState, refreshReviewBranch, stateIsDirty } from './git.js';
import {
  transition, update, currentWindow, slotAt,
  IN_REVIEW, APPROVED, PUBLISHED, REJECTED, FAILED, EXPIRED, STATUS_NAMES
} from './post.js';

/** Where the Producer remembers which Reviews it has already read. */
const REVIEW_STATE = 'review.json';

/** §4: three attempts within a run, then the Post is Failed. */
export const MAX_ATTEMPTS = 3;

const name = id => GAME_CATALOG[id]?.name || id;

export class PublishCycle {
  constructor({
    queue = new Queue(),
    intents = new Intents(),
    github = new GitHub(),
    publisher = new UniversalPublisher(),
    creative = null,
    outbox = new Outbox(),
    now = new Date()
  } = {}) {
    this.queue = queue;
    this.intents = intents;
    this.github = github;
    this.publisher = publisher;
    this._creative = creative;
    this.outbox = outbox;
    this.now = now;
    this.window = currentWindow(now);
    this.log = new RunLog('Publish Cycle', now);
  }

  get creative() {
    this._creative ||= new Creative({ github: this.github, metrics: new XMetrics() });
    return this._creative;
  }

  get reviewStateFile() {
    return path.join(config.paths.data, REVIEW_STATE);
  }

  readReviewState() {
    try {
      return JSON.parse(fs.readFileSync(this.reviewStateFile, 'utf8'));
    } catch {
      return { lastSyncedAt: null, prNumber: null };
    }
  }

  writeReviewState(state) {
    fs.mkdirSync(path.dirname(this.reviewStateFile), { recursive: true });
    fs.writeFileSync(this.reviewStateFile, `${JSON.stringify(state, null, 2)}\n`);
  }

  /**
   * Runs the whole Cycle.
   * @param {Object} [options]
   * @param {boolean} [options.dryRun] nothing leaves this machine and no state
   *        is written (§4).
   * @returns {Promise<{ log: RunLog, review: Object|null, alerts: string|null }>}
   */
  async run({ dryRun = true } = {}) {
    this.dryRun = dryRun;
    if (dryRun) this.log.step('Mode').note('dry run: nothing is published, launched, or written to state');

    await this.syncReviews();
    this.expire();
    await this.runCreative();
    await this.publishDue();
    await this.collectMetrics();

    await this.commit();
    const review = await this.updateReview();
    const alerts = dryRun ? null : sendAlerts(this.log, { outbox: this.outbox, reviewUrl: review?.html_url, now: this.now });
    if (alerts) this.log.step('Alerts').did(`wrote ${path.basename(alerts)} to the outbox for the session to send`);

    if (!dryRun) this.log.write();
    return { log: this.log, review, alerts };
  }

  /**
   * State goes to marketing-state directly, before the Review is written: the
   * Producer is that branch's only committer (ADR 0001), and a Review nobody
   * merges must never strand a Cycle's work.
   */
  async commit() {
    const step = this.log.step('State');
    if (this.dryRun) {
      step.skipped(await stateIsDirty() ? 'dry run: the worktree is dirty but nothing was committed' : 'dry run');
      return;
    }
    const result = await commitState(`${this.cycleTitle()}\n\n${this.log.render()}`);
    if (!result.committed) { step.skipped(result.detail); return; }
    step[result.pushed ? 'did' : 'failed'](result.detail);
    if (!result.pushed) this.log.alert(`State was committed locally but not pushed: ${result.detail}`);
  }

  cycleTitle() {
    return `Publish Cycle · ${this.now.toISOString().slice(0, 10)} ${this.window}:00 UTC`;
  }

  /** 1. What the CMO decided in every Review merged since the last Cycle. */
  async syncReviews() {
    const step = this.log.step('Reviews');
    const state = this.readReviewState();

    let merged;
    try {
      merged = await this.github.mergedReviews(state.lastSyncedAt);
    } catch (err) {
      step.failed(`could not read merged Reviews: ${err.message}`);
      this.log.alert(`The Producer could not read the Review: ${err.message}`);
      return;
    }

    if (!merged.length) {
      step.skipped('no Review has been merged since the last Cycle');
      return;
    }

    const posts = this.queue.all();
    const byId = new Map(posts.map(p => [p.id, p]));
    const changed = [];

    for (const pr of merged) {
      const { approved, rejected } = decisionsFrom(pr.body || '');
      let counted = { approved: 0, rejected: 0 };

      for (const id of approved) {
        const post = byId.get(id);
        if (!post || post.status !== IN_REVIEW) continue;
        changed.push(transition(post, APPROVED, { reviewedAt: pr.merged_at }, this.now));
        counted.approved++;
      }
      for (const id of rejected) {
        const post = byId.get(id);
        if (!post || post.status !== IN_REVIEW) continue;
        changed.push(transition(post, REJECTED, { reviewedAt: pr.merged_at, rejectReason: 'rejected in review' }, this.now));
        counted.rejected++;
      }
      step.did(`Review #${pr.number} merged: ${counted.approved} Post(s) approved, ${counted.rejected} rejected`, 'the CMO');
    }

    if (changed.length && !this.dryRun) this.queue.replaceAll(changed);
    if (!this.dryRun) this.writeReviewState({ ...state, lastSyncedAt: merged.at(-1).merged_at });
  }

  /** 2. Posts whose Slot is three days gone have missed their moment. */
  expire() {
    const step = this.log.step('Expiry');
    const stale = this.queue.expired(this.now);
    if (!stale.length) {
      step.skipped('nothing has been waiting more than three days');
      return;
    }
    const expired = stale.map(p => transition(p, EXPIRED, {}, this.now));
    for (const post of stale) {
      step.did(`${post.id} (${name(post.gameId)}, ${STATUS_NAMES[post.status]}) expired: its Slot was ${post.slot.date}`);
    }
    if (!this.dryRun) this.queue.replaceAll(expired);
  }

  /** 3. The Creative fills Drafts close enough to matter (§6.3). */
  async runCreative() {
    const step = this.log.step('Creative');
    const drafts = this.queue.needingCreative({ now: this.now });
    if (!drafts.length) {
      step.skipped('no Draft is inside the 48-hour horizon');
      return;
    }

    for (const draft of drafts) {
      try {
        const { post, filled, notes, error } = await this.creative.fill(draft, { dryRun: this.dryRun });
        if (error) {
          step.failed(`${draft.id} (${name(draft.gameId)}) stays a Draft: ${error}`, 'the Creative');
          continue;
        }
        for (const note of notes) step.note(`${draft.id}: ${note}`, 'the Creative');
        if (filled && !this.dryRun) {
          this.queue.replace(post);
          step.did(`${post.id} (${name(post.gameId)}, ${CHANNEL_NAMES[toChannel(post.channel)]}) is In review`, 'the Creative');
        } else if (filled) {
          step.did(`${post.id} would be In review`, 'the Creative');
        }
      } catch (err) {
        step.failed(`${draft.id}: ${err.message}`, 'the Creative');
      }
    }
  }

  /** 4. Publish every approved Post whose Slot has arrived. */
  async publishDue() {
    const step = this.log.step('Publishing');
    const due = this.queue.due({ now: this.now, window: this.window });
    if (!due.length) {
      step.skipped(`nothing is approved and due at the ${this.window}:00 Window`);
      return;
    }

    for (const post of due) {
      try {
        const result = await this.publishOne(post, step);
        if (result) this.queue.replace(result);
      } catch (err) {
        step.failed(`${post.id} (${name(post.gameId)}): ${err.message}`);
        this.log.alert(`Publishing ${post.id} (${name(post.gameId)}) failed: ${err.message}`);
      }
    }
  }

  /**
   * Publishes one Post: the intent first, then the Assets, then the decorated
   * copy, then the record (§4, §7, ADR 0003).
   */
  async publishOne(post, step) {
    const channel = toChannel(post.channel);
    const label = `${post.id} (${name(post.gameId)}, ${CHANNEL_NAMES[channel]})`;

    const already = this.intents.finished({ kind: 'publish', target: post.id });
    if (already) {
      step.skipped(`${label} was already published as ${already.result?.postId}`);
      return this.dryRun ? null : transition(post, PUBLISHED, { publishResult: already.result }, this.now);
    }
    const inFlight = this.intents.unfinished({ kind: 'publish', target: post.id }, { now: this.now });
    if (inFlight) {
      // A Cycle died between the call and the record. Publishing again could
      // double-post, so this needs a human eye rather than a guess.
      step.failed(`${label} has an intent from ${inFlight.at} that never completed — check the Channel before it is retried`);
      this.log.alert(`${label} may already be published: an intent from ${inFlight.at} never completed. Check ${CHANNEL_NAMES[channel]} before the next Cycle.`);
      return null;
    }

    if (this.dryRun) {
      step.did(`${label} would publish at the ${this.window}:00 Window`);
      return null;
    }

    const intent = this.intents.record({ kind: 'publish', target: post.id, channel }, this.now);
    const content = decoratePost(post);
    const media = await this.downloadAssets(post);

    const result = await this.publisher.publish(channel, {
      text: content.text,
      thread: content.thread,
      altText: content.altText,
      videoPath: media.video,
      imagePath: media.card,
      intentId: intent.id
    }, false);

    if (!result?.success) {
      const attempts = (post.attempts || 0) + 1;
      const failed = attempts >= MAX_ATTEMPTS;
      step.failed(`${label}: ${result?.error || 'the Channel refused it'}${failed ? ` — ${attempts} attempts, giving up until its Slot expires` : ` (attempt ${attempts})`}`);
      if (failed) this.log.alert(`${label} failed to publish after ${attempts} attempts: ${result?.error}`);
      return failed
        ? transition(update(post, { attempts, intentId: intent.id }, this.now), FAILED, {}, this.now)
        : update(post, { attempts, intentId: intent.id }, this.now);
    }

    this.intents.complete(intent.id, result, this.now);
    step.did(`${label} published: ${result.url || result.postId}`);
    return transition(update(post, { intentId: intent.id, content }, this.now), PUBLISHED, { publishResult: result }, this.now);
  }

  /** The exact Assets the CMO previewed, fetched back for publishing (ADR 0003). */
  async downloadAssets(post) {
    const media = { video: undefined, card: undefined };
    if (!post.assets?.length) return media;
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'kreeda-publish-'));
    for (const asset of post.assets) {
      const file = path.join(dir, path.basename(new URL(asset.url).pathname));
      await this.github.downloadAsset(asset.url, file);
      if (asset.kind === 'video') media.video = file;
      if (asset.kind === 'card') media.card = file;
    }
    return media;
  }

  /** 7. What every live Post has earned since the last Cycle. */
  async collectMetrics() {
    const step = this.log.step('Metrics');
    if (this.dryRun) {
      step.skipped('dry run');
      return;
    }
    try {
      const x = await new XMetrics().refresh();
      step.did(`X: refreshed ${x.fetched} Post(s)`);
    } catch (err) {
      step.failed(`X metrics: ${err.message}`);
    }
    try {
      const fb = await new FbMetrics().refresh(this.queue.all());
      step.did(`Facebook: refreshed ${fb.fetched} Post(s)${fb.failed ? `, ${fb.failed} unreadable` : ''}`);
    } catch (err) {
      step.failed(`Facebook metrics: ${err.message}`);
    }
  }

  /** 8. The rolling Review, with the CMO's ticks preserved (§5.2). */
  async updateReview() {
    const step = this.log.step('Review');
    const posts = this.queue.inReview();

    let open = null;
    try {
      open = await this.github.openReview();
    } catch (err) {
      step.failed(`could not read the open Review: ${err.message}`);
      return null;
    }

    const body = renderReview({
      posts,
      proposals: [],
      runLog: this.log.render(),
      alerts: this.log.alerts,
      ticks: parseTicks(open?.body || '')
    });

    if (this.dryRun) {
      step.did(`would ${open ? `update Review #${open.number}` : 'open a Review'} with ${posts.length} Post(s)`);
      return open;
    }

    try {
      if (open) {
        await this.github.updatePullRequest(open.number, { title: reviewTitle(this.now), body });
        step.did(`Review #${open.number} updated: ${posts.length} Post(s) awaiting a decision — ${open.html_url}`);
        return open;
      }
      if (!posts.length) {
        step.skipped('nothing is waiting on the CMO, so no Review was opened');
        return null;
      }
      const branch = await refreshReviewBranch(reviewTitle(this.now), this.now);
      if (!branch.ok) {
        step.failed(branch.detail);
        this.log.alert(`The Review could not be opened: ${branch.detail}`);
        return null;
      }
      step.note(branch.detail);
      const created = await this.github.createPullRequest({
        title: reviewTitle(this.now), body, head: REVIEW_HEAD, base: REVIEW_BASE
      });
      step.did(`Review #${created.number} opened: ${posts.length} Post(s) awaiting a decision — ${created.html_url}`);
      return created;
    } catch (err) {
      step.failed(`could not write the Review: ${err.message}`);
      this.log.alert(`The Review could not be updated: ${err.message}. Nothing can be approved until it is.`);
      return open;
    }
  }
}
