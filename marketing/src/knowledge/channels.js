/**
 * A Channel is a destination where Posts and Campaigns run. There are two.
 *
 * The Post record names them `x` and `facebook` (AGENTS_SPEC.md §5.3). The
 * code used to call the first one `twitter`, and Posts published under that
 * name are still on the marketing-state branch, so anything reading a stored
 * Channel goes through `toChannel` rather than comparing strings.
 */

export const X = 'x';
export const FACEBOOK = 'facebook';

/** Every Channel, in the order the Review and the Run log list them. */
export const CHANNELS = [X, FACEBOOK];

/** What each Channel is called when a report is written for the CMO. */
export const CHANNEL_NAMES = { [X]: 'X', [FACEBOOK]: 'Facebook' };

const LEGACY = { twitter: X, 'twitter/x': X, fb: FACEBOOK };

/**
 * Resolves any spelling of a Channel to its Post-record name.
 * @param {string} value
 * @returns {'x'|'facebook'}
 * @throws when the value names no Channel — a typo must not silently publish
 *         to the wrong place, or to nowhere.
 */
export function toChannel(value) {
  const key = String(value || '').trim().toLowerCase();
  const channel = CHANNELS.includes(key) ? key : LEGACY[key];
  if (!channel) {
    throw new Error(`Unknown Channel "${value}". There are two: ${CHANNELS.join(' and ')}.`);
  }
  return channel;
}

/** True when the value names a Channel. */
export function isChannel(value) {
  try {
    toChannel(value);
    return true;
  } catch {
    return false;
  }
}
