/**
 * The brand and content rules (AGENTS_SPEC.md §9), enforced in code.
 *
 * The Creative is a model call, and a model will cheerfully write "This is a
 * game-changer! 🚀" or invent a player count. These rules are the reason it
 * cannot. They split in two:
 *
 *   violations  the copy is wrong and the Creative must try again. Nothing
 *               here is quietly fixed, because quietly fixing a hallucinated
 *               player count would mean publishing it in a nicer format.
 *   repairs     mechanical shape a human would not notice being corrected:
 *               too many hashtags, hashtags before the link, a missing link.
 *
 * Rule 1 has a history. Play-together copy that opens with the one-phone
 * mechanic tests badly, and the CMO's standing instruction is to lead with
 * what two people find out about each other. It was a sanitizer in the
 * Play-together promoter; here it applies to every social Category.
 */

import { X, FACEBOOK, toChannel } from '../../knowledge/channels.js';
import { lengthOnX } from '../../producer/links.js';

/** The Categories rule 1 governs: Games two or more people play together. */
export const SOCIAL_CATEGORIES = ['Play together', 'Friends circle'];

/** Openings that lead with the mechanic instead of the relationship. */
const MECHANIC_OPENING = /^\W*(one phone|pass the phone|share (one|a) phone|two players?,? one phone|no app|3-8 players)/i;

/** Rule 2: the tells of generic AI marketing. */
const HYPE = [
  { pattern: /🚀/u, says: 'a rocket emoji' },
  { pattern: /\bgame[- ]?changer\b/i, says: '"game-changer"' },
  { pattern: /\b(revolutionary|unleash|supercharge|next[- ]level|mind[- ]blowing)\b/i, says: 'hype vocabulary' },
  { pattern: /!\s*!|![^\n]*!/, says: 'more than one exclamation mark' }
];

/** Rule 5: claims nobody can stand behind. */
const UNVERIFIABLE = [
  { pattern: /\b\d[\d,.]*\s*(k|m|million|thousand)?\s*(players|users|downloads|installs)\b/i, says: 'a player count' },
  { pattern: /\b(award[- ]winning|#1|number one|best[- ]selling|viral hit)\b/i, says: 'an award or ranking' },
  { pattern: /["“][^"”]{15,}["”]\s*[-—–]\s*\w/, says: 'what reads as a quoted testimonial' }
];

const CAPS = { [X]: 280, [FACEBOOK]: 2000 };
export const AD_MAX_CHARS = 240;

/**
 * Checks copy against every rule that applies to it.
 *
 * @param {string} text
 * @param {Object} context
 * @param {string} context.channel
 * @param {string} [context.category] the Game's Category, for rule 1.
 * @param {'organic'|'ad'} [context.kind]
 * @returns {string[]} what is wrong; empty means it may go out.
 */
export function violations(text, { channel, category = '', kind = 'organic' } = {}) {
  const found = [];
  const copy = String(text || '').trim();

  if (!copy) return ['there is no copy at all'];

  if (SOCIAL_CATEGORIES.includes(category) && MECHANIC_OPENING.test(copy)) {
    found.push('rule 1: it opens with the one-phone mechanic instead of what the group finds out about itself');
  }
  for (const { pattern, says } of HYPE) {
    if (pattern.test(copy)) found.push(`rule 2: ${says}`);
  }
  for (const { pattern, says } of UNVERIFIABLE) {
    if (pattern.test(copy)) found.push(`rule 5: ${says}, which nobody can stand behind`);
  }

  if (kind === 'ad') {
    if (/#\w/.test(copy)) found.push('rule 3: an ad may not contain a hashtag — X rejects promoted Posts that do');
    if (/(^|\s)@\w/.test(copy)) found.push('rule 3: an ad may not @mention anyone');
    if (copy.length > AD_MAX_CHARS) found.push(`rule 3: an ad is at most ${AD_MAX_CHARS} characters; this is ${copy.length}`);
  }

  const cap = CAPS[toChannel(channel)];
  const length = toChannel(channel) === X ? lengthOnX(copy) : copy.length;
  if (length > cap) found.push(`it is ${length} characters and the ${toChannel(channel) === X ? 'X' : 'Facebook'} limit is ${cap}`);

  if (!/kreeda\.games/.test(copy)) found.push('it does not link to the Game, so no Player can be attributed to it');

  return found;
}

/**
 * Fixes the mechanical shape of a Post — rule 4's hashtag rules, and a missing
 * link — and leaves everything else exactly as written.
 *
 * @returns {{ text: string, repairs: string[] }}
 */
export function repair(text, { channel, gameUrl = '', kind = 'organic' } = {}) {
  const repairs = [];
  let copy = String(text || '').replace(/[ \t]+\n/g, '\n').trim();

  if (gameUrl && !/kreeda\.games/.test(copy)) {
    copy = `${copy}\n\n${gameUrl}`;
    repairs.push('added the link to the Game');
  }

  const tags = copy.match(/#\w+/g) || [];
  if (kind === 'ad') {
    if (tags.length) {
      copy = strip(copy);
      repairs.push('removed every hashtag: X rejects a promoted Post that has one');
    }
  } else if (tags.length) {
    // Rule 4: at most two, and after the link — a hashtag before it competes
    // with the thing being clicked.
    const kept = tags.slice(0, 2);
    const before = copy.replace(/#\w+/g, '').replace(/[ \t]{2,}/g, ' ').replace(/[ \t]+\n/g, '\n').trim();
    const moved = `${before} ${kept.join(' ')}`.trim();
    if (moved !== copy) {
      copy = moved;
      repairs.push(tags.length > 2
        ? `kept ${kept.length} of ${tags.length} hashtags and moved them after the link`
        : 'moved the hashtags after the link');
    }
  }

  return { text: copy, repairs };
}

function strip(copy) {
  return copy.replace(/#\w+/g, '').replace(/[ \t]{2,}/g, ' ').replace(/[ \t]+\n/g, '\n').trim();
}

/**
 * Repairs what can be repaired, then reports what is still wrong.
 * @returns {{ text: string, repairs: string[], violations: string[], ok: boolean }}
 */
export function enforce(text, context) {
  const { text: repaired, repairs } = repair(text, context);
  const found = violations(repaired, context);
  return { text: repaired, repairs, violations: found, ok: found.length === 0 };
}
