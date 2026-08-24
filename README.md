# Kreeda — Browser Games

[![Kreeda](og.png)](https://kreeda.games)

[**Play now at kreeda.games →**](https://kreeda.games)

A collection of polished, single-file browser games. No build tools, no frameworks, no dependencies — every game is a single `index.html` you can open straight from the file system or host as a static site.

Open [`index.html`](index.html) at the repo root for the [Kreeda](https://kreeda.games) landing page — a card grid linking to every game (this is what's live at kreeda.games via GitHub Pages).

## Games

| Game | Description | Play |
|---|---|---|
| [Drift](drift/index.html) | A bright, sunny endless drifting game with a **real throttle and brake** — no handbrake. Slides aren't a button: steering yaws the car, the velocity vector chases the heading, and that chase is capped by a lateral grip budget, so carrying too much speed into a corner is what breaks the tail loose. Brake as you turn in and the weight shifts onto the nose, unloading the rear; get back on the power to hold it, and countersteer to catch it. **The battery is your life.** You drive a high-end EV: a barrier no longer kills you, it bites a chunk out of the pack and scrubs your speed; wandering off into the grass drains it fast; landing a drift chain claws charge back — so driving well is what buys you a longer run, and the run ends at 0% (`OUT OF CHARGE`). Need to stop? **PAUSE** (or Esc) doesn't freeze the world — the car pulls itself off at the next rest area (or the hard shoulder, if none's in reach), and every services is a real facility: a broad, trumpet-mouthed exit road where the car automatically drops to **10 km/h**, a big set-back parking lot, and a row of well-spaced DC fast-charge **kiosks** down its far side. Drive into the exit yourself and the **auto-park valet** takes the wheel, drives up to the first kiosk it reaches, backs itself square into the bay and plugs in; the post tops the pack up to 80% on a **metered bill** — $0.45/kWh plus a $1 hookup fee, idle fees for squatting after the session — paid live from your **wallet**, so a break is never a free reset: no money, no electrons. **You drive from behind the wheel** — the first-person driver view is the game. Top-down is the glance you take to read a corner: pulled back and looking further up the road, so you can see what's coming. From inside the car — flat-bottom wheel, ambient-lit dash, and a glass cluster reading speed, drive selector, live power/regen in kW, charge and remaining range. **The car has a voice**, driven off the same kW the dash draws: one reduction gear means the motor whine is a pure function of road speed (pitch *is* your speed, no shifts), its loudness is power rather than speed — so coasting fast is nearly silent and dragging out of a hairpin isn't — and regen bends the note down as it claws charge back. Under it, road noise that rises and brightens with speed, rings brighter on a bridge deck, and goes **loud and dark the moment you're off the tarmac**, so the mistake that drains the pack 90× faster finally makes a sound instead of only moving a number. The stereo plays **your own music** (drop MP3s into [`drift/music/`](drift/music/) or load them off your device — the game runs fine with none). Out through the windshield: drifting clouds, bird flocks, the occasional airliner, a hazed city-outskirts horizon backed by rolling hills quilted into farmland — pasture greens with the odd rapeseed gold, pale stubble and ploughed-brown strip, hazing into the distance, world-anchored poles and trees streaming past, wild grass tussocks fringing the near verge and streaming past underfoot, a low post-and-wire boundary fence running the verge with its slack wires converging to the road's own vanishing point, hedgerows striking out from the verge across the fields to split the land into a patchwork, the odd river cut through the country and crossed on a bridge whose deck drives like the road right out to the parapet (no verge to wander off into up there), a rest area every so often with a tarmac apron and its row of charging kiosks (the verge fence and the hedgerows bow around the facility rather than running across the exit road), black-on-yellow chevron alignment boards ranged along the outside of every real bend, pointing the way it turns — the tarmac itself reading as a repaired rural road, with resurfaced patches and irregular black crack-seal seams streaming past under the lane paint — and **advertising hoardings** every 10–15 s of driving, world-anchored on the verge with real perspective. Out of the box the hoardings run house ads for the other games in this repo (drawn at boot, so the file stays offline-complete); point them at your own S3 bucket of images (`AD_BUCKET` in the file, a `?ads=…` URL param, or `localStorage['drift.ads']` — the bucket serves an `ads.json` array listing the image files) and your ads replace them. **The road has a zombie problem** — shamblers lurch across the tarmac and loiter on the verge, and the county pays a bounty: run one down for **wallet cash** (persisted, banked on the spot) with comic-gore payoff — a thud-and-squelch, a dark splat baked into the tarmac, gibs, a red pulse round the glass and ichor running down the windscreen. The wallet buys guns in the **Armory** on the start/over screens (sidearm / auto / rifle — rate and reach); an equipped gun **auto-fires** at the shamblers out on the verge that the car can't reach, for a bigger bounty. Drifting is still what scores — the horde is how you get rich. **And the road isn't yours alone:** deer bolt out of the verge without warning, and the oncoming lane finally has an owner — cars, vans and flatbeds coming the other way at closing speed. They pull over and lean on the horn when they see you drifting across the line, so your own lane costs you nothing; take their half anyway and thread one for a **CLOSE CALL** (heat, and a chain kept alive), or meet one head-on and lose most of your speed, a bite of the pack, and the chain you were holding. **No on-screen buttons:** keyboard is ←/→ steer, ↑/W throttle, ↓/S brake; on touch you hold a screen half (or swipe the wheel) to steer while the car finds its own pace, and a **second finger is the brake**. | [kreeda.games/drift](https://kreeda.games/drift/) |
| [Carrom](carrom/index.html) | A polished arcade take on the classic Indian board game — position the striker on your baseline, pull back to aim (slingshot style), and flick to pocket your nine carrommen and the red queen (+3 bonus). Procedurally-drawn wooden board with traditional markings, low-friction rigid-disc physics with swept-collision safety, corner pockets with drop animations, a three-difficulty AI that plans ghost-ball shots (and restitution-corrected one-cushion banks on Hard), pass-and-play for two humans, striker fouls and owed pieces, and fully synthesized WebAudio sound. Mouse + touch, portrait and landscape. | [kreeda.games/carrom](https://kreeda.games/carrom/) |
| [Break Room](break-room/index.html) | Physics-driven 8-ball pool — full rules (open table, group assignment, all foul types with ball-in-hand, called-pocket 8-ball win/loss), draggable spin control for follow/draw shots, an AI opponent across three difficulties, 2-player pass-and-play, and a practice mode. | [kreeda.games/break-room](https://kreeda.games/break-room/) |
| [Chroma Blocks](chroma-blocks/index.html) | A vibrant, neon falling-blocks game in the spirit of Tetris — 7-bag randomizer, hold/next queue, ghost piece, combo effects, procedural audio, keyboard + touch controls. | [kreeda.games/chroma-blocks](https://kreeda.games/chroma-blocks/) |
| [Blackjack](blackjack/index.html) | Casino blackjack on green felt — a real shoe, hit/stand/double/split, and a 3:2 payout on a natural. Bet chips from your bankroll, ride hot streaks or bust, and play hand after hand at your own pace. Built for one hand on a phone. | [kreeda.games/blackjack](https://kreeda.games/blackjack/) |
| [Last 16](last-16/index.html) | Arcade football set at the World Cup 2026 Round of 16 — pick 1 of 16 real nations and one of 4 real star players, control them directly while AI plays everyone else, and fight through the real bracket (Tournament mode) or play a single Quick Match. Penalty shootouts, stamina, fouls, and procedural crowd/kick audio included. | [kreeda.games/last-16](https://kreeda.games/last-16/) |
| [Road Rumble](road-rumble/index.html) | A Road Rash&ndash;style racing brawler on a pseudo-3D highway — six riders sprint a course of curves, crests and oncoming traffic. Pin the throttle, thread the cars, and get physical: pull alongside a rival and throw a punch (auto-targeting the nearest rider) to knock them down, or grab a roadside club for extra reach. Rivals swing back and a truck to the face is a wipeout, so it's a scrap to stay upright and finish high. Grid start, live position, health/stamina and distance bars, procedural engine + impact audio, and a saved best finish. Keyboard (steer / gas / brake / punch) plus full on-screen touch controls. | [kreeda.games/road-rumble](https://kreeda.games/road-rumble/) |
| [Fairway Four](fairway-four/index.html) | Full-3D golf over four authored holes (par 4/3/5/4) rendered with Three.js — cinematic birds-eye-to-address camera swoops, a three-click swing meter with draw/fade from your timing, wind and Magnus-lift ball flight, bunkers, water, trees, out-of-bounds, and a sloped putting green with a flowing break grid. Keyboard + mouse. | [kreeda.games/fairway-four](https://kreeda.games/fairway-four/) (needs internet once for the Three.js CDN) |
| [Deadpoint](deadpoint/index.html) | A side-on 2.5D rock-climbing game built around *the commit* — reach a hold, time the latch at the bright ring, then trust it with your weight while a per-hand pump clock burns. Center-of-mass balance makes you barn-door off the wall (fight it by flagging a foot with `A`/`D`); chalk resets slip and boosts grip; rest recovers pump; and dynos launch into slow-mo with a latch window at the apex. Six procedurally-generated, always-solvable boulder problems V0–V5 with an articulated IK climber, golden-hour parallax wall, top-out payoff, and Flash/Send scoring. Mouse + keyboard. | [kreeda.games/deadpoint](https://kreeda.games/deadpoint/) |
| [Ennead](ennead/index.html) | Configurable tic-tac-toe with two modes sharing one engine. **Classic:** any board `N×N` from 3×3 up to 9×9 with a selectable win length `k` (3×3 noughts-and-crosses through gomoku). **Ultimate:** a nested `9×9` of nine sub-boards where winning a sub-board claims a meta-cell and every move sends your opponent to a specific sub-board — with an active-board spotlight and a sub-board-claim animation. Local 2-player or a three-level AI (Hard 3×3 plays perfectly), undo, light/dark themes, keyboard control, and `localStorage` resume. | [kreeda.games/ennead](https://kreeda.games/ennead/) |
| [Daśānana](dasanana/index.html) | A Rāmāyaṇa astra-duel: Rāvaṇa invokes divine missiles and you must answer with the true counter (water quenches fire, light dispels darkness…) before both loose. Restore tejas by rhythm-chanting authentic Āditya-Hṛdayam ślokas (Devanāgarī + IAST), survive the Śakti spear and his Brahmāstra, and unlock your own Brahmāstra for the final head. Story mode (Khara → Indrajit → Rāvaṇa) and three duel difficulties, with procedural tanpura drones, chant bells, and conch. | [kreeda.games/dasanana](https://kreeda.games/dasanana/) |

All eleven are also playable offline straight from the file system — clone the repo and open any `<game>/index.html` directly, no server required.

## Running a game

Each game lives in its own folder and is fully self-contained:

```
git clone https://github.com/sudhir-patavardhan/browser-games.git
open browser-games/chroma-blocks/index.html
```

No server required — just open the file directly, or serve the repo root with any static file server (e.g. for GitHub Pages).

## The daily loop

Six games — [Drift](drift/index.html), [Chroma Blocks](chroma-blocks/index.html), [Carrom](carrom/index.html),
[Deadpoint](deadpoint/index.html), [Fairway Four](fairway-four/index.html) and, next,
[Setu](RAMAYANA_GRID.md) — carry a **daily** alongside their normal mode: today's road, today's bag,
today's board, today's problem, today's round.

The whole thing turns on one property. The day's challenge is drawn from `mulberry32(daySeed(dayKey()))`,
a pure function of the calendar date, so **every player in the world gets the identical puzzle and no
server is involved in agreeing on it**. That is the only reason a repeat-visit loop is possible at all on
a static site with no backend, and it is why the constraint in [`DAILY.md`](DAILY.md) — every value that
shapes a daily comes from that one stream, in a fixed order — is not a style rule. A stray `Math.random()`
in daily setup silently desynchronises players and cannot be detected from inside the game.

Finishing any daily bumps a **site-wide streak** that the landing page reads. Games write it; the landing
page only ever reports it. Each game keeps its daily and its free-play bests in separate ledgers, because
a challenge you can learn must never inflate the number earned in open play.

Results share as a **spoiler-free block grid** rather than a sentence — the shape of the run, never the
answer:

```
Kreeda · Deadpoint · 24 Aug
🟩🟩🟩🟩🟨
🟩🟩🟨🟨🟩
🟩🟩🟩🟩
V3 · flash · streak 4 🔥
```

[`DAILY.md`](DAILY.md) is the contract: the storage keys, the helpers, the streak rules and the share
format. There is no shared runtime module and there must not be one — a game has to keep working opened
straight off the disk — so each game **copies** those helpers inline. They agree because they were copied
from one place, not because they import from one.

## Offline

[`sw.js`](sw.js) is a cache-first service worker that precaches the landing page and all eleven games, so
a hosted copy keeps working with the network gone and the install promised by
[`manifest.webmanifest`](manifest.webmanifest) is a real one.

Correctness here is **cache versioning**, not revalidation: nothing in a deploy changes in place, the whole
tree is replaced at once. Bump `CACHE` in `sw.js` and `activate` wipes every cache that isn't the current
name. Forget to bump it and players stay on the old build indefinitely with no way to know why — that is
the one failure mode the file cannot afford, and the reason it is written the way it is.

Two things it deliberately does not do: it never caches cross-origin requests (analytics, and Fairway
Four's Three.js off a CDN — this worker has no version story for someone else's asset), and it does
nothing at all on `file://`, where registration throws and where opening a game off the disk is the point.

It registers from the landing page only, so a visitor who deep-links straight into a game is not covered
until they visit the hub.

## Analytics

Every page loads [`analytics.js`](analytics.js) from the repo root — one file, one GA4 measurement ID, so
there is a single place to change it instead of a dozen copies drifting apart. Pageviews come for free
(each game is its own path under one property), and Drift additionally reports gameplay: `run_start`,
`run_end` (score, distance, top speed, longest chain and its tier, drift time, shamblers, shaves, deer
dodges, close calls, head-ons — and crucially *why* the run ended), `shop_buy`, and `badge_earned`.

Three things worth knowing before you rely on the numbers:

- **It is completely silent when a game is opened as a local file.** GA4 identifies a visitor by a cookie
  and browsers grant none to `file://` origins, so such a hit has no stable `client_id` and reports a
  `file:///…` path — junk, if it arrives at all. Since opening a game straight off the disk is the whole
  point of this repo, `analytics.js` doesn't pretend otherwise: on `file://` it injects nothing and sends
  nothing. **You will only ever see traffic from a hosted copy.**
- **Ad blockers drop `googletagmanager.com` universally.** Expect a material undercount, and treat the
  numbers as a biased sample rather than as traffic.
- **GA4 sets cookies, so there is no consent banner here and serving this to visitors in the EU/UK
  generally requires one.** That is an outstanding item, not a solved one — if you need it, the honest fix
  is Google Consent Mode with `analytics_storage` denied until the visitor agrees.

It cannot break a game: every entry point swallows its own failures, and Drift's `track()` is a no-op if
the file never loaded. `./drift/verify/run.sh analytics` pins exactly that — silent on `file://`, unable to
throw at the game loop however badly it is called (including with a `gtag` that throws), and reporting
numbers that match the run's own final state rather than invented ones.

## Publishing to itch.io

Every game here already runs correctly inside an iframe — no `top`-navigation assumptions, no
absolute-rooted asset paths, just relative links within its own folder — so each one can be zipped as-is
and uploaded to itch.io as an HTML5 game:

```
cd fairway-four && zip -r ../fairway-four.zip index.html
```

Set `index.html` as the embed's entry point on upload. One game loads something over the network and needs
itch.io's **"This game requires network access"** option checked in the embed settings, or it degrades
gracefully instead of failing: **Fairway Four** loads Three.js from a CDN (`cdnjs.cloudflare.com`) —
without network access the page won't render.

Every other game is fully offline-complete in its single file.

## How these are built

Every game in this repo started as a written spec — a plain-English description of the feel, the rules,
the constraints — handed to [Claude Code](https://claude.com/claude-code), which then wrote the whole
single-file implementation: markup, styles, game loop, physics, procedural WebAudio, the lot. Iteration
happens the same way — a spec for the next feature or fix, not a diff — with a human steering scope, taste,
and what ships. The `DRIFT_FEATURES.md` file inside [`drift/`](drift/) is a living example of that
spec-then-Claude-Code loop for the most involved game here.

[`RAMAYANA_GRID.md`](RAMAYANA_GRID.md) and [`CRICKET_GRID.md`](CRICKET_GRID.md) are the same loop caught
one stage earlier: written specs for two daily grid puzzles — **Setu**, nine stones of the causeway to
Laṅkā, and **Maidan** — that have not been built yet. Both flag the facts they are not certain of rather
than asserting them, and Setu's §6 sets out what the game will not do with material that is living
scripture to hundreds of millions of people.
