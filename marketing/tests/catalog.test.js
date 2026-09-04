/**
 * The hub decides which Games exist and which Category each is in (ADR 0002).
 * These tests are the thing that stops the catalog drifting away from it again.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

import { readHub, CATEGORIES, CATEGORY_OF_RAIL } from '../src/knowledge/hub.js';
import { DOSSIERS } from '../src/knowledge/dossiers.js';
import {
  GAMES, GAMES_BY_CATEGORY, GAME_CATALOG, HUB,
  gamesInCategory, gamesMissingDossiers, dossiersWithoutGames
} from '../src/knowledge/catalog.js';
import { tempStateDir, noNetwork } from './helpers.js';

noNetwork();

test('there are seven Categories, and they are the seven in the glossary', () => {
  assert.deepEqual(CATEGORIES, [
    'Fast action', 'Play together', 'Friends circle',
    'Daily study grids', 'Head-to-head', 'Solo arcade', 'Sports and racing'
  ]);
  assert.equal(Object.keys(CATEGORY_OF_RAIL).length, 7);
});

test('every Game on the hub has a Dossier', () => {
  assert.deepEqual(gamesMissingDossiers(), [],
    'a Game marketing knows nothing about is one the Strategist will never plan a Post for');
});

test('no Dossier describes a Game the hub does not have', () => {
  assert.deepEqual(dossiersWithoutGames(), []);
});

test('every Game belongs to exactly one Category, and every Category has Games', () => {
  const counted = Object.values(GAMES_BY_CATEGORY).flat();
  assert.equal(counted.length, Object.keys(GAMES).length);
  assert.equal(new Set(counted).size, counted.length, 'a Game appears under two Categories');
  for (const category of CATEGORIES) {
    assert.ok(GAMES_BY_CATEGORY[category].length > 0, `${category} has no Games`);
  }
});

test('a Game carries its hub facts and its Dossier together', () => {
  for (const [id, game] of Object.entries(GAMES)) {
    assert.ok(game.name, `${id} has no name`);
    assert.match(game.url, /^https:\/\/kreeda\.games\/[\w-]+\/$/, `${id} has a malformed url`);
    assert.ok(CATEGORIES.includes(game.category), `${id} is in "${game.category}"`);
    assert.ok(game.blurb, `${id} has no hub blurb`);
    assert.ok(game.tagline && game.pitch, `${id} has an empty Dossier`);
    assert.ok(Array.isArray(game.hooks) && game.hooks.length, `${id} has no hooks`);
    assert.ok(Array.isArray(game.mechanics) && game.mechanics.length, `${id} has no mechanics`);
    assert.ok(Array.isArray(game.audiences) && game.audiences.length, `${id} has no audiences`);
  }
});

test('a Dossier cannot rename a Game or move its Category', () => {
  // The hub's fields win the merge, so a stray name in a Dossier is inert.
  const id = Object.keys(GAMES)[0];
  assert.equal(GAMES[id].name, readHub().games[id].name);
  assert.equal(GAMES[id].category, readHub().games[id].category);
  for (const dossier of Object.values(DOSSIERS)) {
    assert.equal(dossier.category, undefined, 'a Dossier must not name a Category');
    assert.equal(dossier.url, undefined, 'a Dossier must not carry a url');
  }
});

test('the hub is in the catalog but is not a Game', () => {
  assert.equal(HUB.id, 'hub');
  assert.equal(GAMES.hub, undefined);
  assert.equal(GAME_CATALOG.hub, HUB);
  assert.equal(Object.keys(GAME_CATALOG).length, Object.keys(GAMES).length + 1);
});

test('gamesInCategory refuses a Category that does not exist', () => {
  assert.ok(gamesInCategory('Play together').length > 0);
  assert.throws(() => gamesInCategory('together'), /No such Category/);
});

test('a rail the code has no Category for is an error, not a silent skip', () => {
  const dir = tempStateDir();
  const hubPath = path.join(dir, 'index.html');
  fs.writeFileSync(hubPath, `
    <section class="rail" id="rail-action" aria-label="Fast action games">
      <div class="rail-row">
        <a class="card" href="road-rumble/index.html" data-game="road-rumble" data-cat="racing">
          <span class="top"><h2>Road Rumble</h2></span><p>A brawler.</p>
          <span class="meta">Solo</span>
        </a>
      </div>
    </section>
    <section class="rail" id="rail-brand-new" aria-label="Something new">
      <div class="rail-row">
        <a class="card" href="mystery/index.html" data-game="mystery" data-cat="x">
          <span class="top"><h2>Mystery</h2></span><p>New.</p><span class="meta">Solo</span>
        </a>
      </div>
    </section>`);
  assert.throws(() => readHub(hubPath), /rail-brand-new/,
    'a whole Category was once invisible to the Strategist; that must fail loudly');
});

test('an empty rail is a shelf, not a Category', () => {
  const dir = tempStateDir();
  const hubPath = path.join(dir, 'index.html');
  fs.writeFileSync(hubPath, `
    <section class="rail" id="rail-resume" aria-label="Games you have played" hidden>
      <div class="rail-row"></div>
    </section>
    <section class="rail" id="rail-solo" aria-label="Solo arcade games">
      <div class="rail-row">
        <a class="card" href="apogee/index.html" data-game="apogee" data-cat="arcade">
          <span class="top"><h2>Apogee</h2></span><p>Up.</p><span class="meta">Solo</span>
        </a>
      </div>
    </section>`);
  const hub = readHub(hubPath);
  assert.deepEqual(Object.keys(hub.games), ['apogee']);
});

test('a borrowed card does not change where a Game belongs', () => {
  // drift is the featured billboard, borrowed by Fast action and Sports and
  // racing; it belongs to the first rail that borrows it, and shows in both.
  assert.equal(GAMES.drift.category, 'Fast action');
  assert.deepEqual(GAMES.drift.alsoShownIn, ['Sports and racing']);
  // chroma-blocks lives in Fast action and is borrowed by Solo arcade.
  assert.equal(GAMES['chroma-blocks'].category, 'Fast action');
  assert.ok(!GAMES_BY_CATEGORY['Solo arcade'].includes('chroma-blocks'));
});

test('the hub page decodes into readable copy, not markup', () => {
  for (const game of Object.values(GAMES)) {
    assert.doesNotMatch(game.blurb, /[<>]|&[a-z]+;/, `${game.id} blurb still has markup`);
    assert.doesNotMatch(game.name, /[<>]|&[a-z]+;/, `${game.id} name still has markup`);
  }
});
