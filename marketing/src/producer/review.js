/**
 * The Review (AGENTS_SPEC.md §5.2).
 *
 * One rolling pull request, head `marketing-review`, base `marketing-state`.
 * Its body is the Run log and a checklist: one pre-ticked line per Post
 * awaiting a decision and one per Campaign proposal.
 *
 * **Merging is the approval.** Every ticked item is approved and every unticked
 * one is rejected, and nothing is published or launched without a merged
 * Review. Closing it without merging changes nothing — which is what makes it
 * safe for the CMO to walk away from.
 *
 * The rendering and parsing here are pure so they can be tested without
 * GitHub; `github.js` does the talking.
 */

import { STATUS_NAMES } from './post.js';
import { CHANNEL_NAMES, toChannel } from '../knowledge/channels.js';
import { GAME_CATALOG } from '../knowledge/catalog.js';

export const REVIEW_HEAD = 'marketing-review';
export const REVIEW_BASE = 'marketing-state';

/** A checklist line: the tick, the id in backticks, then a human summary. */
const TICK_LINE = /^- \[([ xX])\]\s+`([^`]+)`/gm;

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** "Fri 5 Sep, 09:00" — a Slot the CMO can read at a glance. */
export function slotLabel(slot) {
  const d = new Date(`${slot.date}T00:00:00Z`);
  return `${DAYS[d.getUTCDay()]} ${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}, ${slot.window}:00 UTC`;
}

const gameName = id => GAME_CATALOG[id]?.name || id;

export function reviewTitle(now = new Date()) {
  return `Review · ${now.toISOString().slice(0, 10)}`;
}

/**
 * Which items a merged Review approved and which it rejected.
 * @param {string} body the pull request body as merged.
 * @returns {Map<string, boolean>} id -> ticked
 */
export function parseTicks(body = '') {
  const ticks = new Map();
  for (const [, mark, id] of body.matchAll(TICK_LINE)) {
    ticks.set(id, mark.toLowerCase() === 'x');
  }
  return ticks;
}

/**
 * Renders the Review body.
 *
 * @param {Object} input
 * @param {Object[]} input.posts Posts In review.
 * @param {Object[]} [input.proposals] Campaign proposals awaiting a decision.
 * @param {string} [input.runLog] the Producer's account of the Cycle.
 * @param {string[]} [input.alerts] things that need the CMO now.
 * @param {Map<string, boolean>} [input.ticks] tick state to preserve.
 * @returns {string}
 */
export function renderReview({ posts = [], proposals = [], runLog = '', alerts = [], ticks = new Map() }) {
  const out = [];
  const tick = id => (ticks.has(id) && !ticks.get(id) ? ' ' : 'x');

  if (alerts.length) {
    out.push('> [!WARNING]', '> **Needs your attention**', '>');
    for (const alert of alerts) out.push(`> - ${alert}`);
    out.push('');
  }

  out.push(
    '**Merging this pull request is your approval.** Every ticked item goes out at its',
    'Slot; every unticked one is rejected. Closing without merging changes nothing.',
    ''
  );

  out.push(`## Posts awaiting a decision (${posts.length})`, '');
  if (!posts.length) {
    out.push('_Nothing is waiting on you._', '');
  }
  for (const post of posts) {
    out.push(`- [${tick(post.id)}] \`${post.id}\` · ${CHANNEL_NAMES[toChannel(post.channel)]} · ${gameName(post.gameId)} · ${slotLabel(post.slot)}`);
    out.push('');
    if (post.angle) out.push(`  **Angle:** ${post.angle}${post.persona ? ` · for ${post.persona}` : ''}`, '');
    for (const line of postText(post)) out.push(`  > ${line}`);
    out.push('');
    if (post.content?.altText) out.push(`  _Alt text:_ ${post.content.altText}`, '');
    if (post.assets?.length) {
      out.push(`  **Assets:** ${post.assets.map(a => `[${a.kind}](${a.url})`).join(' · ')}`, '');
    }
    if (post.successMetric) out.push(`  _Success looks like:_ ${post.successMetric}`, '');
  }

  out.push(`## Campaign proposals (${proposals.length})`, '');
  if (!proposals.length) {
    out.push('_No Campaign is proposed._', '');
  }
  for (const p of proposals) {
    const budget = p.budget || {};
    out.push(`- [${tick(p.id)}] \`${p.id}\` · ${gameName(p.gameId)} · ${p.angle || 'no angle given'} · $${budget.dailyUsd}/day for ${budget.trialDays || 3} days (cap $${budget.totalCapUsd ?? (budget.dailyUsd || 0) * (budget.trialDays || 3)})`);
    out.push('');
    if (p.tweetText) out.push(`  > ${p.tweetText}`, '');
    const t = p.targeting || {};
    out.push(`  **Targeting:** ${[t.ageBucket, (t.countries || []).join('/'), (t.interests || []).join(', ')].filter(Boolean).join(' · ') || 'not given'}`, '');
    const e = p.expectedOutcome || {};
    if (e.basis) out.push(`  **Expected:** ${e.estClicks ?? '?'} clicks at $${e.estCpcUsd ?? '?'} · ${e.estPlayers ?? '?'} Players — ${e.basis}`, '');
    if (budget.suggestedBecause) out.push(`  **Budget because:** ${budget.suggestedBecause}`, '');
  }

  if (runLog) out.push('## Run log', '', runLog.trim(), '');

  return out.join('\n');
}

function postText(post) {
  const content = post.content || {};
  if (content.thread?.length) {
    return content.thread.flatMap((part, i) => {
      const text = typeof part === 'string' ? part : part.text;
      return [`**${i + 1}/${content.thread.length}** ${text}`.split('\n').join('\n  > '), ''];
    }).slice(0, -1);
  }
  return (content.text || '_The Creative has not filled this Post yet._').split('\n');
}

/**
 * What a merged Review decided, as a list the Producer can act on.
 * @returns {{ approved: string[], rejected: string[] }}
 */
export function decisionsFrom(body) {
  const approved = [];
  const rejected = [];
  for (const [id, ticked] of parseTicks(body)) (ticked ? approved : rejected).push(id);
  return { approved, rejected };
}

export { STATUS_NAMES };
