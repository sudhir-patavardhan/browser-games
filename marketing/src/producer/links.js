/**
 * Link decoration (AGENTS_SPEC.md §7).
 *
 * Agents write bare catalog URLs. The Producer adds the attribution at publish
 * time, so a link is decorated exactly once, by the one component that knows
 * which Channel it is going out on and under which Post id.
 *
 * That is what closes the measurement loop: `analytics.js` derives the Game
 * from the path and GA4 reports Players against these parameters, so the
 * Analyst can say which Post or Campaign brought someone who actually played.
 *
 * Nothing on the site changes for this. X counts every link as 23 characters
 * however long it is, so decoration never costs a Post any room.
 */

import { X, FACEBOOK, toChannel } from '../knowledge/channels.js';

/** Only Kreeda's own links are decorated; anything else is left alone. */
const OWN_HOST = /^(www\.)?kreeda\.games$/i;

export const ORGANIC = 'organic';
export const PAID = 'paid';

/** X counts a link as this many characters no matter its length. */
export const X_LINK_COST = 23;

/**
 * Adds the attribution to one URL.
 *
 * @param {string} url a bare catalog URL.
 * @param {Object} attribution
 * @param {string} attribution.channel which Channel it is going out on.
 * @param {'organic'|'paid'} [attribution.medium]
 * @param {string} attribution.campaign the Category for organic, the Campaign
 *        id for paid — the thing the Analyst groups Players by.
 * @param {string} attribution.content the Post id.
 * @returns {string} the decorated URL, or the original if it is not ours.
 */
export function decorate(url, { channel, medium = ORGANIC, campaign = '', content = '' }) {
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    return url;
  }
  if (!OWN_HOST.test(parsed.hostname)) return url;

  // Decorating twice would silently reassign a Player to the wrong Post.
  if (parsed.searchParams.has('utm_source')) return url;

  parsed.searchParams.set('utm_source', toChannel(channel));
  parsed.searchParams.set('utm_medium', medium);
  if (campaign) parsed.searchParams.set('utm_campaign', slug(campaign));
  if (content) parsed.searchParams.set('utm_content', content);
  return parsed.toString();
}

/**
 * Decorates every Kreeda link in a piece of copy, leaving the rest untouched.
 * @returns {string}
 */
export function decorateText(text, attribution) {
  if (!text) return text;
  // Trailing punctuation is part of the sentence, not the URL.
  return text.replace(/https?:\/\/[^\s<>"')]+/gi, match => {
    const trimmed = match.replace(/[.,;:!?)]+$/, '');
    const tail = match.slice(trimmed.length);
    return decorate(trimmed, attribution) + tail;
  });
}

/**
 * Decorates a whole Post's content — its text and every tweet in a thread —
 * for the Channel and Category it is going out under.
 * @returns {Object} the content, decorated.
 */
export function decoratePost(post, { medium = ORGANIC, campaign = null } = {}) {
  const attribution = {
    channel: post.channel,
    medium,
    campaign: campaign ?? post.category,
    content: post.id
  };
  return {
    ...post.content,
    text: decorateText(post.content.text, attribution),
    thread: (post.content.thread || []).map(part =>
      typeof part === 'string'
        ? decorateText(part, attribution)
        : { ...part, text: decorateText(part.text, attribution) })
  };
}

/**
 * How long a piece of copy is as X counts it: every link is 23 characters,
 * however long the decorated URL actually is.
 */
export function lengthOnX(text) {
  if (!text) return 0;
  const links = text.match(/https?:\/\/[^\s]+/gi) || [];
  const withoutLinks = links.reduce((s, link) => s.replace(link, ''), text);
  return withoutLinks.length + links.length * X_LINK_COST;
}

/** utm values are lowercase and hyphenated, so "Play together" groups cleanly. */
function slug(value) {
  return String(value).trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

export { X, FACEBOOK };
