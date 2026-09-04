/**
 * The catalog: every Game, with its Category from the hub and its Dossier from
 * marketing.
 *
 * The hub page decides which Games exist and which Category each is in
 * (ADR 0002). Marketing adds only the Dossier — pitch, hooks, mechanics,
 * audiences. Neither half can silently disagree with the other, because the
 * Game half is read from index.html at load and never written down here.
 */

import { readHub, CATEGORIES, CATEGORY_OF_RAIL } from './hub.js';
import { DOSSIERS } from './dossiers.js';

export { CATEGORIES, CATEGORY_OF_RAIL };

const hub = readHub();

/**
 * Every Game on the hub, merged with its Dossier.
 * The hub's fields win: a Dossier can never rename a Game or move its Category.
 * @type {Object<string, Object>}
 */
export const GAMES = Object.fromEntries(
  Object.entries(hub.games).map(([id, game]) => [id, { ...DOSSIERS[id], ...game }])
);

/** Game ids by Category, in the order the hub shows them. */
export const GAMES_BY_CATEGORY = hub.categories;

/**
 * Kreeda itself. Not a Game — it is the hub every Game's link points into —
 * but it has a Dossier, because Posts are sometimes about the whole thing.
 */
export const HUB = {
  id: 'hub',
  name: 'Kreeda',
  url: 'https://kreeda.games/',
  repoUrl: 'https://github.com/sudhir-patavardhan/browser-games',
  ...DOSSIERS.hub
};

/** Every Game, plus the hub under the key `hub`. */
export const GAME_CATALOG = { ...GAMES, hub: HUB };

/** The Games in one Category. @param {string} category */
export function gamesInCategory(category) {
  const ids = GAMES_BY_CATEGORY[category];
  if (!ids) throw new Error(`No such Category: "${category}". The seven are: ${CATEGORIES.join(', ')}.`);
  return ids.map(id => GAMES[id]);
}

/**
 * Games on the hub with no Dossier. A Game marketing knows nothing about is
 * one the Strategist will never plan a Post for, so a test fails on this.
 * @returns {string[]}
 */
export function gamesMissingDossiers() {
  return Object.keys(hub.games).filter(id => !DOSSIERS[id]).sort();
}

/**
 * Dossiers for Games that are not on the hub — a Game that was renamed or
 * retired. Harmless, but it means the Dossier is describing nothing.
 * @returns {string[]}
 */
export function dossiersWithoutGames() {
  return Object.keys(DOSSIERS).filter(id => id !== 'hub' && !hub.games[id]).sort();
}
