# Browser Games

A collection of polished, single-file browser games. No build tools, no frameworks, no dependencies — every game is a single `index.html` you can open straight from the file system or host as a static site.

Open [`index.html`](index.html) at the repo root for a hub page linking to all games (handy for GitHub Pages).

## Games

| Game | Description | Play |
|---|---|---|
| [Chroma Blocks](chroma-blocks/index.html) | A vibrant, neon falling-blocks game in the spirit of Tetris — 7-bag randomizer, hold/next queue, ghost piece, combo effects, procedural audio, keyboard + touch controls. | Open `chroma-blocks/index.html` in any browser |
| [Last 16](last-16/index.html) | Arcade football set at the World Cup 2026 Round of 16 — pick 1 of 16 real nations and one of 4 real star players, control them directly while AI plays everyone else, and fight through the real bracket (Tournament mode) or play a single Quick Match. Penalty shootouts, stamina, fouls, and procedural crowd/kick audio included. | Open `last-16/index.html` in any browser |

## Running a game

Each game lives in its own folder and is fully self-contained:

```
git clone https://github.com/sudhir-patavardhan/browser-games.git
open browser-games/chroma-blocks/index.html
```

No server required — just open the file directly, or serve the repo root with any static file server (e.g. for GitHub Pages).
