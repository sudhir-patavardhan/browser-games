/**
 * Reads the hub page.
 *
 * The hub is the source of truth for which Games exist and which Category each
 * is in (ADR 0002). Marketing used to keep its own list with its own tags, and
 * it drifted to 20 Games in 4 ad-hoc groups while the site shipped 29 across 7
 * rails — an entire Category the Strategist could not see. So nothing here is
 * hand-maintained: the rails are parsed out of index.html at load.
 *
 * A rail's id is stable and its heading is not ("Full throttle" is the display
 * name of Fast action), so the id is what names the Category.
 */

import fs from 'node:fs';
import path from 'node:path';
import { config } from '../config.js';

/** Rail id -> Category. These seven are the Categories; there are no others. */
export const CATEGORY_OF_RAIL = {
  'rail-action': 'Fast action',
  'rail-together': 'Play together',
  'rail-circle': 'Friends circle',
  'rail-study': 'Daily study grids',
  'rail-versus': 'Head-to-head',
  'rail-solo': 'Solo arcade',
  'rail-sports': 'Sports and racing'
};

/** The Categories, in the order the hub shows them. */
export const CATEGORIES = Object.values(CATEGORY_OF_RAIL);

// Every named entity the hub's cards use, plus the obvious neighbours. An
// entity that survives decoding ends up in a Post, so a test asserts that
// nothing on the hub decodes to markup.
const ENTITIES = {
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ',
  mdash: '—', ndash: '–', middot: '·', hellip: '…',
  lsquo: '‘', rsquo: '’', ldquo: '“', rdquo: '”',
  deg: '°', pi: 'π', times: '×', divide: '÷', plusmn: '±',
  aacute: 'á', eacute: 'é', iacute: 'í', oacute: 'ó', uacute: 'ú', ntilde: 'ñ'
};

function text(html) {
  return html
    .replace(/<[^>]+>/g, '')
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&([a-z]+);/gi, (whole, name) => ENTITIES[name] ?? whole)
    .replace(/\s+/g, ' ')
    .trim();
}

/** Every `<a class="card">` in a chunk of the hub, in document order. */
function readCards(html) {
  const cards = [];
  const re = /<a class="card([^"]*)" href="([^"]+)" data-game="([\w-]+)"[^>]*>([\s\S]*?)<\/a>/g;
  for (const [, classes, href, id, body] of html.matchAll(re)) {
    const name = body.match(/<span class="top"><h2>([\s\S]*?)<\/h2>/);
    const blurb = body.match(/<p>([\s\S]*?)<\/p>/);
    const meta = body.match(/<span class="meta">([\s\S]*?)<\/span>/);
    cards.push({
      id,
      href,
      featured: classes.includes('featured'),
      name: name ? text(name[1]) : id,
      blurb: blurb ? text(blurb[1]) : '',
      // "3–8 players · One phone", "Daily · High school", "Solo · Keyboard"
      hubMeta: meta ? text(meta[1]) : ''
    });
  }
  return cards;
}

/**
 * Parses the hub into its Categories and Games.
 *
 * A Game's card lives in exactly one rail, and that rail is its Category. A
 * rail can borrow a card from another rail with `data-also`, which is a
 * display choice and never changes where the Game belongs. The one card that
 * lives outside every rail is the featured billboard; it takes the Category of
 * the first rail that borrows it.
 *
 * @param {string} [hubPath] the hub's index.html; defaults to the site's.
 * @returns {{ games: Object<string, Object>, categories: Object<string, string[]> }}
 * @throws when a rail carries Games under an id no Category is named for — a
 *         new Category the Strategist cannot see is the bug ADR 0002 closes.
 */
export function readHub(hubPath = path.join(config.paths.root, 'index.html')) {
  if (!fs.existsSync(hubPath)) {
    throw new Error(`No hub page at ${hubPath} — the catalog cannot know which Games exist.`);
  }
  const html = fs.readFileSync(hubPath, 'utf8');

  const sections = html.split(/(?=<section class="rail")/);
  sections.shift();
  const games = {};
  const borrowedBy = {};
  const unknownRails = [];

  for (const section of sections) {
    const railId = section.match(/<section class="rail" id="([\w-]+)"/)?.[1];
    const body = section.slice(0, section.indexOf('</section>') + 1 || undefined);
    const cards = readCards(body);
    const category = CATEGORY_OF_RAIL[railId];

    if (!category) {
      // A rail with no cards is a display shelf, not a Category — "Jump back
      // in" is filled from the visitor's own history.
      if (cards.length) unknownRails.push(`${railId} (${cards.length} Game(s))`);
      continue;
    }

    for (const card of cards) {
      games[card.id] = { ...card, railId, category };
    }
    for (const id of (body.match(/<div class="rail-row"[^>]*data-also="([^"]*)"/)?.[1] || '').split(/\s+/).filter(Boolean)) {
      (borrowedBy[id] ||= []).push(category);
    }
  }

  if (unknownRails.length) {
    throw new Error(
      `The hub has rail(s) no Category is named for: ${unknownRails.join(', ')}. ` +
      'Add them to CATEGORY_OF_RAIL — a Category the Strategist cannot see is invisible to the whole system.'
    );
  }

  // The featured billboard sits outside every rail, so the rails that borrow
  // it say where it belongs. Any other card outside the rails is a Game with
  // no Category, which the Strategist would never plan for.
  for (const card of readCards(html)) {
    if (games[card.id]) continue;
    const category = borrowedBy[card.id]?.[0];
    if (!category) {
      throw new Error(`The Game "${card.id}" is in no rail and borrowed by none, so it has no Category.`);
    }
    games[card.id] = { ...card, railId: null, category };
  }

  for (const [id, categories] of Object.entries(borrowedBy)) {
    if (games[id]) games[id].alsoShownIn = categories.filter(c => c !== games[id].category);
  }

  const base = config.general.baseUrl.replace(/\/$/, '');
  const categories = Object.fromEntries(CATEGORIES.map(c => [c, []]));
  for (const game of Object.values(games)) {
    game.url = `${base}/${game.href.replace(/\/index\.html$/, '/')}`;
    game.alsoShownIn ||= [];
    categories[game.category].push(game.id);
  }

  return { games, categories };
}
