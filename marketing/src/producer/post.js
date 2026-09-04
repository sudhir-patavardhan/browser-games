/**
 * The Post record and its lifecycle (AGENTS_SPEC.md §5.3).
 *
 * A Post moves Draft -> In review -> Approved -> Published, and leaves that
 * path in one of three ways: Rejected when the CMO unticks it in the Review,
 * Failed when the Channel refuses it after retries, Expired when its Slot has
 * been more than three days gone without a decision or a successful publish.
 *
 * Every transition goes through `transition()`. A status set by assignment is
 * a status nobody checked, and the double-posting incidents of August 2026
 * came from exactly that.
 */

import { toChannel } from '../knowledge/channels.js';

export const DRAFT = 'draft';
export const IN_REVIEW = 'in_review';
export const APPROVED = 'approved';
export const PUBLISHED = 'published';
export const REJECTED = 'rejected';
export const FAILED = 'failed';
export const EXPIRED = 'expired';

export const STATUSES = [DRAFT, IN_REVIEW, APPROVED, PUBLISHED, REJECTED, FAILED, EXPIRED];

/** How each status is spoken to the CMO (CONTEXT.md). */
export const STATUS_NAMES = {
  [DRAFT]: 'Draft', [IN_REVIEW]: 'In review', [APPROVED]: 'Approved',
  [PUBLISHED]: 'Published', [REJECTED]: 'Rejected', [FAILED]: 'Failed', [EXPIRED]: 'Expired'
};

/** The three times of day the Producer publishes, in UTC hours. */
export const WINDOWS = ['09', '13', '17'];

/** A Post whose Slot is this many days gone has missed its moment for good. */
export const EXPIRY_DAYS = 3;

export const FORMATS = ['single', 'thread', 'video', 'image'];

/**
 * Where a Post may go from where it is. Anything not listed is refused.
 *
 * Failed is not terminal: §4 retries a Failed Post at the next Window for up
 * to three days, so it can still reach Published.
 */
const ALLOWED = {
  [DRAFT]: [IN_REVIEW, EXPIRED],
  [IN_REVIEW]: [APPROVED, REJECTED, EXPIRED],
  [APPROVED]: [PUBLISHED, FAILED, REJECTED, EXPIRED],
  [FAILED]: [PUBLISHED, FAILED, EXPIRED],
  [PUBLISHED]: [],
  [REJECTED]: [],
  [EXPIRED]: []
};

/** Statuses a Post can still leave. */
export function isOpen(post) {
  return ALLOWED[post.status]?.length > 0;
}

/** The retired names still on marketing-state, and what each becomes (§12). */
const RETIRED_STATUS = {
  // The old scheduler published on a date alone. Under the Review gate a Slot
  // arriving means nothing, so these are Drafts that were never finished.
  scheduled: DRAFT,
  // "Published" in draft mode: a dry run that never reached a Channel.
  draft_published: EXPIRED,
  archived: EXPIRED
};

let counter = 0;

/** A Post id that is unique within a Cycle as well as across them. */
export function newPostId(now = new Date()) {
  return `post-${now.toISOString().slice(0, 10)}-${(counter++).toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

/**
 * Builds a Post from a Plan item. Everything the Strategist does not name is
 * present and empty rather than absent, so no reader has to guess.
 * @returns {Object}
 */
export function makePost(fields = {}, now = new Date()) {
  const at = now.toISOString();
  return {
    id: fields.id || newPostId(now),
    status: fields.status || DRAFT,
    channel: toChannel(fields.channel || 'x'),
    gameId: fields.gameId || 'hub',
    category: fields.category || '',
    slot: normalizeSlot(fields.slot, now),
    format: FORMATS.includes(fields.format) ? fields.format : 'single',
    angle: fields.angle || '',
    persona: fields.persona || '',
    brief: fields.brief || '',
    successMetric: fields.successMetric || '',
    content: { text: '', thread: [], altText: '', ...(fields.content || {}) },
    assets: fields.assets || [],
    intentId: fields.intentId ?? null,
    publishResult: fields.publishResult ?? null,
    reviewedAt: fields.reviewedAt ?? null,
    rejectReason: fields.rejectReason ?? null,
    attempts: fields.attempts ?? 0,
    createdAt: fields.createdAt || at,
    updatedAt: fields.updatedAt || at
  };
}

function normalizeSlot(slot, now) {
  const date = slot?.date || now.toISOString().slice(0, 10);
  const window = WINDOWS.includes(String(slot?.window)) ? String(slot.window) : WINDOWS[0];
  return { date, window };
}

/** The moment a Slot arrives, in UTC. */
export function slotAt(post) {
  return new Date(`${post.slot.date}T${post.slot.window}:00:00Z`);
}

/**
 * Moves a Post to a new status, or throws. Returns a new Post; the caller
 * writes it back.
 *
 * @param {Object} post
 * @param {string} to one of STATUSES.
 * @param {Object} [extra] fields the transition carries (a publishResult, a
 *        rejectReason), merged in.
 * @returns {Object} the moved Post.
 */
export function transition(post, to, extra = {}, now = new Date()) {
  if (!STATUSES.includes(to)) {
    throw new Error(`"${to}" is not a Post status. They are: ${STATUSES.join(', ')}.`);
  }
  // No short-circuit for `from === to`: asking to publish an already-Published
  // Post means something is about to go out twice, and that must be loud. The
  // table decides, including Failed -> Failed, which is a second attempt.
  const from = post.status;
  if (!ALLOWED[from]?.includes(to)) {
    throw new Error(
      `A Post cannot go from ${STATUS_NAMES[from] || from} to ${STATUS_NAMES[to]}. ` +
      `From ${STATUS_NAMES[from] || from} it can only become: ${(ALLOWED[from] || []).map(s => STATUS_NAMES[s]).join(', ') || 'nothing — it is finished'}.`
    );
  }
  return { ...post, ...extra, status: to, updatedAt: now.toISOString() };
}

/**
 * Changes a Post's fields without touching its status. Use this for anything
 * that is not a lifecycle move — recording an intent, attaching an Asset — so
 * that `transition` stays the only thing that can change a status.
 * @returns {Object}
 */
export function update(post, fields, now = new Date()) {
  if ('status' in fields) {
    throw new Error('A status is changed by transition(), never by update() — that is the point of both.');
  }
  return { ...post, ...fields, updatedAt: now.toISOString() };
}

/**
 * Is this Post due to go out in this Window?
 *
 * Due means approved, and its Slot has arrived — the date is today or earlier
 * and the Window is this one or an earlier one, so a Post whose Window was
 * missed goes out at the next one rather than waiting a day.
 */
export function isDue(post, { now = new Date(), window = currentWindow(now) } = {}) {
  if (post.status !== APPROVED && post.status !== FAILED) return false;
  const today = now.toISOString().slice(0, 10);
  if (post.slot.date > today) return false;
  if (post.slot.date === today && Number(post.slot.window) > Number(window)) return false;
  return true;
}

/**
 * Has this Post's Slot been gone long enough to give up on?
 * Only a Post still waiting on something can expire; a Published or Rejected
 * one is already finished.
 */
export function hasExpired(post, now = new Date()) {
  if (!isOpen(post)) return false;
  return now.getTime() - slotAt(post).getTime() > EXPIRY_DAYS * 86_400_000;
}

/** The Window a Cycle running now belongs to; before the first, the first. */
export function currentWindow(now = new Date()) {
  const hour = now.getUTCHours();
  return [...WINDOWS].reverse().find(w => hour >= Number(w)) || WINDOWS[0];
}

/**
 * Brings a Post written by the old scheduler onto the lifecycle in §5.3.
 * A Post on a Channel that no longer exists is Expired rather than dropped:
 * the Run log should be able to say what happened to it.
 * @returns {{ post: Object, changed: boolean, reason: string|null }}
 */
export function migrate(old, now = new Date()) {
  const reasons = [];
  let status = old.status;

  if (RETIRED_STATUS[status]) {
    reasons.push(`status "${status}" is retired, so it becomes ${STATUS_NAMES[RETIRED_STATUS[status]]}`);
    status = RETIRED_STATUS[status];
  }

  let channel = old.channel;
  try {
    channel = toChannel(channel);
  } catch {
    reasons.push(`"${old.channel}" is not a Channel any more`);
    channel = 'x';
    if (status !== PUBLISHED) status = EXPIRED;
  }

  const slot = old.slot?.date
    ? old.slot
    : { date: old.scheduledDate || old.createdAt?.slice(0, 10) || now.toISOString().slice(0, 10), window: WINDOWS[0] };
  if (!old.slot?.date) reasons.push('scheduledDate becomes a Slot at the 09:00 Window');

  const post = makePost({ ...old, status, channel, slot }, now);
  return { post, changed: reasons.length > 0, reason: reasons.join('; ') || null };
}
