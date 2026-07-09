# Browser Games

A collection of polished, single-file browser games. No build tools, no frameworks, no dependencies — every game is a single `index.html` you can open straight from the file system or host as a static site.

Open [`index.html`](index.html) at the repo root for a hub page linking to all games (handy for GitHub Pages).

## Games

| Game | Description | Play |
|---|---|---|
| [Chroma Blocks](chroma-blocks/index.html) | A vibrant, neon falling-blocks game in the spirit of Tetris — 7-bag randomizer, hold/next queue, ghost piece, combo effects, procedural audio, keyboard + touch controls. | Open `chroma-blocks/index.html` in any browser |
| [Last 16](last-16/index.html) | Arcade football set at the World Cup 2026 Round of 16 — pick 1 of 16 real nations and one of 4 real star players, control them directly while AI plays everyone else, and fight through the real bracket (Tournament mode) or play a single Quick Match. Penalty shootouts, stamina, fouls, and procedural crowd/kick audio included. | Open `last-16/index.html` in any browser |
| [Break Room](break-room/index.html) | Physics-driven 8-ball pool — full rules (open table, group assignment, all foul types with ball-in-hand, called-pocket 8-ball win/loss), draggable spin control for follow/draw shots, an AI opponent across three difficulties, 2-player pass-and-play, and a practice mode. | Open `break-room/index.html` in any browser |
| [Daśānana](dasanana/index.html) | A Rāmāyaṇa astra-duel: Rāvaṇa invokes divine missiles and you must answer with the true counter (water quenches fire, light dispels darkness…) before both loose. Restore tejas by rhythm-chanting authentic Āditya-Hṛdayam ślokas (Devanāgarī + IAST), survive the Śakti spear and his Brahmāstra, and unlock your own Brahmāstra for the final head. Story mode (Khara → Indrajit → Rāvaṇa) and three duel difficulties, with procedural tanpura drones, chant bells, and conch. | Open `dasanana/index.html` in any browser |
| [Fairway Four](fairway-four/index.html) | Full-3D golf over four authored holes (par 4/3/5/4) rendered with Three.js — cinematic birds-eye-to-address camera swoops, a three-click swing meter with draw/fade from your timing, wind and Magnus-lift ball flight, bunkers, water, trees, out-of-bounds, and a sloped putting green with a flowing break grid. Keyboard + mouse. | Open `fairway-four/index.html` in any browser (needs internet once for the Three.js CDN) |
| [Ennead](ennead/index.html) | Configurable tic-tac-toe with two modes sharing one engine. **Classic:** any board `N×N` from 3×3 up to 9×9 with a selectable win length `k` (3×3 noughts-and-crosses through gomoku). **Ultimate:** a nested `9×9` of nine sub-boards where winning a sub-board claims a meta-cell and every move sends your opponent to a specific sub-board — with an active-board spotlight and a sub-board-claim animation. Local 2-player or a three-level AI (Hard 3×3 plays perfectly), undo, light/dark themes, keyboard control, and `localStorage` resume. | Open `ennead/index.html` in any browser |
| [Deadpoint](deadpoint/index.html) | A side-on 2.5D rock-climbing game built around *the commit* — reach a hold, time the latch at the bright ring, then trust it with your weight while a per-hand pump clock burns. Center-of-mass balance makes you barn-door off the wall (fight it by flagging a foot with `A`/`D`); chalk resets slip and boosts grip; rest recovers pump; and dynos launch into slow-mo with a latch window at the apex. Six procedurally-generated, always-solvable boulder problems V0–V5 with an articulated IK climber, golden-hour parallax wall, top-out payoff, and Flash/Send scoring. Mouse + keyboard. | Open `deadpoint/index.html` in any browser |

## Running a game

Each game lives in its own folder and is fully self-contained:

```
git clone https://github.com/sudhir-patavardhan/browser-games.git
open browser-games/chroma-blocks/index.html
```

No server required — just open the file directly, or serve the repo root with any static file server (e.g. for GitHub Pages).
