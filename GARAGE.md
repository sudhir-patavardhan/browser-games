# Garage — build a car, part by part

**Play:** [kreeda.games/garage](https://kreeda.games/garage/) · **File:** [`garage/index.html`](garage/index.html)

Garage is an educational assembly game. Nineteen real car parts sit scattered in a
tray — not just wheels and doors, but the engine, carburetor, alternator, driveshaft,
the parts most people have heard named but couldn't point to. The player drags each
one into its place on a side-cutaway car until the car is complete, and every correct
placement teaches what that part actually does. When the last part goes in, the
engine starts and the car drives off.

The educational bet: **you remember where a thing lives and what it touches far
better than a paragraph about it.** So the game is built around three reinforcing
loops — placement (where does it go?), dependency (what must exist before it can be
fitted?), and recall (the quiz afterwards).

## The parts

Nineteen parts, each with a one-or-two-sentence fact shown on placement. The
dependency graph is the real assembly logic — you cannot bolt a carburetor to an
engine that isn't there — and it is what sequences the build without the game ever
showing a numbered step list:

| Part | Needs first | What the player learns |
|---|---|---|
| Chassis | — | The frame everything bolts to |
| Suspension | Chassis | Springs absorb bumps, dampers stop the bounce |
| Brakes | Suspension | Friction turns motion into heat |
| Wheels & tyres | Brakes | Four palm-sized contact patches do everything |
| Engine block | Chassis | Combustion becomes rotation |
| Carburetor | Engine | Mixes air and fuel (~14.7:1) before the cylinders |
| Air filter | Carburetor | Engines breathe; grit would sand the cylinders |
| Radiator | Chassis | Coolant dumps engine heat into passing air |
| Battery | Chassis | Stored jolt that spins the starter |
| Alternator | Engine | Belt-driven generator; recharges the battery |
| Gearbox | Engine | Trades engine speed for wheel torque |
| Driveshaft | Gearbox | Carries power to the driven axle, flexing via U-joints |
| Fuel tank | Chassis | Fuel stored away from the hot engine bay |
| Exhaust & muffler | Engine | Carries burnt gas out; chambers cancel the noise |
| Body shell | Engine, Driveshaft, Exhaust, Fuel tank | The body-drop: shell lowered onto a finished rolling chassis |
| Doors | Body shell | Side-impact beams, crash-proof latches |
| Windshield & glass | Body shell | Laminated glass holds together when cracked |
| Seats | Body shell | Mounts and belt anchors are crash structure |
| Steering wheel | Body shell | Small rim motion geared down through the rack |

A locked part shows **why** it's locked ("Fit the engine first") — the dependency is
itself a fact about how cars go together.

## How it plays

- **The stage** is one SVG: a side cutaway of a sedan. Empty positions render as
  dashed silhouettes while a part is in hand, so the player deduces location from
  shape and context rather than being pointed at the answer.
- **Drag** a part card from the tray onto the car. Drop near its slot → it snaps in
  with a clunk, pops, and its fact card slides up. Drop on the wrong slot → the slot
  flashes red, shakes, and a mistake is counted. Two misses on the same part and its
  true slot starts pulsing — a hint, not a lockout.
- **Tap-to-place** works too (tap the card, then tap a slot) — same rules, for
  players who find dragging on a phone fiddly.
- The tray is shuffled each run — the "scattered parts on the garage floor" feel —
  and cards show name + icon in Build mode.
- **Completion:** headlights on, engine start (synthesized), wheels spin, the car
  drives off the stage. Then the result card: time, mistakes, and a rank —
  0 mistakes **Master Mechanic**, ≤3 **Mechanic**, ≤7 **Apprentice**, else
  **Trainee**. Bests persist in `localStorage`.
- **Inspect:** on the finished car, tapping any part re-opens its fact card — the
  whole car becomes a labelled diagram.

## The quiz

Unlocked from the result screen (and from the title screen after the first build).
Ten rounds against the completed car, two alternating question forms:

1. **Name it** — one part glows, the rest dim; four name options.
2. **Find it** — a function is described ("Which part mixes air and fuel?"); the
   player taps the part on the car.

Score out of 10 with the same rank ladder; best score persists. The quiz is the
recall half of the lesson: build mode teaches with the answer in hand, the quiz
checks it stuck.

## Constraints (house rules of this repo)

- One self-contained `index.html`, no build step, no dependencies, works from
  `file://` and offline.
- All art is inline SVG (the tray icons reuse the exact same part art via per-part
  viewBoxes — one drawing per part, everywhere it appears).
- All audio is synthesized WebAudio behind a mute toggle; nothing fetched.
- Pointer Events only — one code path for mouse and touch; portrait and landscape.
- `../analytics.js` included at the end of `<body>`; game events (`build_complete`,
  `quiz_complete`) sent via the guarded `bgTrack` and never able to break the game.
- Registered like every other game: hub card (Solo arcade rail), JSON-LD ItemList,
  `sitemap.xml` (via `scripts/gen-sitemap.js`), `sw.js` precache + cache bump,
  README table row.

## Test hook

`window.__garage` exposes `{ state, place(id), reset() }` — enough for a headless
probe to drive a full build and the quiz without synthesizing pointer gestures, in
the spirit of the other games' verify harnesses. It drives the same code path as a
drop (placement, facts, completion), not a shortcut around it.
