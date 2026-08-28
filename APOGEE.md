# Apogee — build a rocket, learn why it flies

**Play:** [kreeda.games/apogee](https://kreeda.games/apogee/) · **File:** [`apogee/index.html`](apogee/index.html)

Apogee is an educational rocket-builder. Twelve real rocket parts sit on a shelf —
not just "a rocket" but the anatomy: payload, parachute, avionics, tanks, three
different engines, fins, strap-on boosters. The player taps or drags them onto the
launch pad, watches a live mass/thrust/fuel/TWR/stability readout as the stack
grows, and then launches to see how high the design flies. The score is the apogee.

The educational bet (shared with [Garage](GARAGE.md)): **you remember what a part
does when getting it wrong costs you altitude.** So the game is built around three
reinforcing loops — FIT (every fitted part pops a fact card about the real thing),
FLY (the flight itself teaches: atmosphere layers, max-Q, gravity vs drag losses),
and RECALL (the Flight School quiz checks it stuck).

## The parts

Twelve parts, each with a one-or-two-sentence fact shown on fitting. The physics
makes every fact *matter* — the catalog is the design space:

| Part | Role | What the player learns | What the physics does with it |
|---|---|---|---|
| Aero Cone | Nose | Streamlining; fairings are dropped when air thins | Lowest drag area (CdA 0.055), lightest nose |
| Crew Capsule | Nose | Crew ride on top so an escape rocket can pull them clear | Heavy (40 kg) and draggy; needs a parachute for "crew safe" |
| Science Probe | Nose | Sounding rockets measure the atmosphere they fly through | Middle mass/drag |
| Parachute | Recovery | Recovery; Apollo splashed down under three | Pops at apogee; "recovered" result line; capsule without one gets called out |
| Avionics | Guidance | Gyros sense tilt, the engine gimbals to correct | Removes residual wobble; fins+avionics = zero thrust wasted |
| Slim / Jumbo Tank | Tanks (≤3) | Propellant is ~90% of a real launcher's mass; empty tanks are dead weight | 70 / 180 kg of propellant, 15 / 35 kg dry |
| Sparrow | Engine | Specific impulse — push per kg of propellant | 4.6→5.2 kN, sips 2.0 kg/s; can't lift heavy stacks |
| Titan | Engine | TWR must beat 1 to lift off | 12.5→13.8 kN, drinks 6.2 kg/s |
| Aether | Engine | Vacuum nozzles: feeble at sea level, mighty up high | 6.2 kN at sea level → 17.5 kN in vacuum; usually pad-fails without boosters |
| Fins | Stability | Arrow feathers: centre of pressure behind centre of gravity | Without them wobble grows with speed and thrust is wasted as cos(θ) |
| Boosters | Stage 0 | Solid fuel can't be throttled; staging sheds dead weight | +7.5 kN for 5 s, then jettisoned with a callout |

Engine thrust slides between its sea-level and vacuum rating with actual air
density (`ρ = 1.225·e^(−h/8500)`) — which is why the Aether exists: it is the
endgame discovery, a rocket that cannot leave the pad alone but rides its boosters
through the thick air and then out-pulls everything. Careless builds hop ~10 km,
considered ones reach 30–90 km, a matched Titan stack crosses the 100 km Kármán
line, and a boostered Aether can pass ISS altitude (400 km).

## The flight teaches

- **Atmosphere layers as milestones**, each crossing flashing a real fact:
  1 km (taller than the Burj Khalifa), 12 km (top of the troposphere — all
  weather below, airliners cruise here), 31 km (stratosphere/ozone), 50 km
  (mesosphere — meteors burn up), 100 km (Kármán line), 400 km (ISS altitude).
- **Max-Q** is computed for real (0.5ρv², called out once pressure falls off its
  peak) — the same milestone real launch commentary calls.
- **Booster jettison** at T+5 s with tumbling casings and a staging callout.
- **The mission log** on the results card turns the flight into numbers a
  textbook would charge for: burnout altitude and speed, top speed, max-Q, and
  velocity lost to gravity vs drag — the two taxes every real rocket pays.
- **Recovery**: a fitted parachute pops at apogee and earns a recovery line; a
  crew capsule that comes down without one gets called out.

Time-warp (1× at launch up to 12× high in the coast) keeps long flights snappy
without touching the physics — the sub-stepping scales with the warp.

## Flight School (the quiz)

Opened from the header 🎓 or the results card. Ten questions drawn shuffled from a
sixteen-question pool, four options each, immediate right/wrong feedback with a
one-line explanation — every answer is taught by a part card or a flight milestone.
Ranks: 9+ **Flight Director**, 7+ **Commander**, 5+ **Pilot**, else **Cadet**.
Best score persists in `localStorage`.

## Constraints (house rules of this repo)

- One self-contained `index.html`, no build step, no dependencies, works from
  `file://` and offline.
- All art is inline SVG — one drawing per part reused at every size (shelf card,
  pad stack, flight sprite via data-URL image). Every SVG carries explicit
  width/height attributes: Safari gives a viewBox-only SVG no intrinsic size.
- All audio synthesized WebAudio behind a mute toggle; nothing fetched.
- Pointer Events only — tap-to-fit and drag share one code path; the shelf keeps
  `touch-action: pan-x` so it stays swipe-scrollable while a vertical pull
  starts a drag.
- `../analytics.js` at the end of `<body>`; `game_start`/`game_end` (build and
  quiz modes) via the guarded `bgTrack`, never able to break the game.
- Registered like every other game: hub card (Solo arcade rail), `sitemap.xml`
  via `scripts/gen-sitemap.js`, `sw.js` precache + cache bump, README table row.

## Test hook

`window.__apogee` exposes `{ rocket, flight, addPart(id), removePart(role, idx),
clear(), launch(), stats() }` — enough for a headless probe to build any rocket,
fly it, and read the results without synthesizing pointer gestures. It drives the
same code paths as a tap (fact cards included), not a shortcut around them.

## Tuning

The flight model was balanced with an offline simulator (same equations, no
rendering) before the numbers went into the file. If you touch the catalog,
re-run the sweep: min builds should hop ~10 km, Titan ladders should top out
just under 200 km, and only a boostered Aether should pass 400 km.
