/**
 * The Post queue: every Post the system knows about, on the marketing-state
 * branch (§4).
 *
 * The Strategist adds Drafts through `accept`, the Creative fills them, and
 * the Producer moves their status. Single writer per file — every write goes
 * through here, and every status change goes through `transition`.
 */

import fs from 'node:fs';
import path from 'node:path';
import { config } from '../config.js';
import {
  makePost, migrate, isDue, hasExpired, slotAt, currentWindow,
  DRAFT, IN_REVIEW, APPROVED, FAILED, EXPIRED, STATUS_NAMES
} from './post.js';

/** How far ahead the Creative works: a Draft closer than this gets filled (§6.3). */
export const CREATIVE_HORIZON_HOURS = 48;

export class Queue {
  constructor(file = config.paths.queueFile) {
    this.file = file;
  }

  /** @returns {Object[]} */
  load() {
    if (!fs.existsSync(this.file)) return [];
    try {
      const parsed = JSON.parse(fs.readFileSync(this.file, 'utf8'));
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      // A Cycle that cannot read the queue must not silently publish nothing
      // and call it a quiet day; the caller sees an empty queue and the Run
      // log says the file was unreadable.
      return [];
    }
  }

  save(posts) {
    fs.mkdirSync(path.dirname(this.file), { recursive: true });
    fs.writeFileSync(this.file, `${JSON.stringify(posts, null, 2)}\n`);
    return posts;
  }

  all() {
    return this.load();
  }

  byId(id) {
    return this.load().find(p => p.id === id) || null;
  }

  /** Adds Posts, returning the ones written. */
  add(postOrPosts, now = new Date()) {
    const incoming = (Array.isArray(postOrPosts) ? postOrPosts : [postOrPosts]).map(p => makePost(p, now));
    this.save([...this.load(), ...incoming]);
    return incoming;
  }

  /**
   * Writes one Post back over its stored self. The Post must already be in the
   * queue: writing an unknown id would create a Post nobody planned.
   */
  replace(post) {
    const posts = this.load();
    const at = posts.findIndex(p => p.id === post.id);
    if (at === -1) throw new Error(`No Post ${post.id} in the queue to replace.`);
    posts[at] = post;
    this.save(posts);
    return post;
  }

  /** Writes several Posts back at once, so a Cycle touches the file once. */
  replaceAll(updated) {
    const byId = new Map(updated.map(p => [p.id, p]));
    this.save(this.load().map(p => byId.get(p.id) || p));
    return updated;
  }

  /** Every Post due to go out in this Window (§5.1 step 4). */
  due({ now = new Date(), window = currentWindow(now) } = {}) {
    return this.load().filter(p => isDue(p, { now, window })).sort(bySlot);
  }

  /** Every Post whose Slot is more than three days gone (§5.1 step 2). */
  expired(now = new Date()) {
    return this.load().filter(p => hasExpired(p, now)).sort(bySlot);
  }

  /** Every Post waiting on the CMO — what the Review lists. */
  inReview() {
    return this.load().filter(p => p.status === IN_REVIEW).sort(bySlot);
  }

  /**
   * Drafts close enough that the Creative should fill them now (§6.3).
   * A Draft whose Slot has already passed is included: it is late, not gone,
   * until it expires.
   */
  needingCreative({ now = new Date(), horizonHours = CREATIVE_HORIZON_HOURS } = {}) {
    const until = now.getTime() + horizonHours * 3_600_000;
    return this.load().filter(p => p.status === DRAFT && slotAt(p).getTime() <= until).sort(bySlot);
  }

  /** What the Run log counts. */
  summary() {
    const counts = {};
    for (const post of this.load()) counts[post.status] = (counts[post.status] || 0) + 1;
    return counts;
  }

  /**
   * Brings every Post written by the old scheduler onto the lifecycle in §5.3,
   * and says what it did. Idempotent: a queue already migrated reports no
   * changes and is written back unchanged.
   *
   * @returns {{ migrated: number, unchanged: number, notes: string[] }}
   */
  migrateAll(now = new Date()) {
    const notes = [];
    let migrated = 0;
    const posts = this.load().map(old => {
      const result = migrate(old, now);
      if (result.changed) {
        migrated++;
        notes.push(`${result.post.id} (${old.gameId || 'unknown Game'}): ${result.reason} -> ${STATUS_NAMES[result.post.status]}`);
      }
      return result.post;
    });
    this.save(posts);
    return { migrated, unchanged: posts.length - migrated, notes };
  }
}

function bySlot(a, b) {
  return `${a.slot.date}${a.slot.window}`.localeCompare(`${b.slot.date}${b.slot.window}`);
}

export { DRAFT, IN_REVIEW, APPROVED, FAILED, EXPIRED };
