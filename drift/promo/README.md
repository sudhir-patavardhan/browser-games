# Drift — Instagram promo reel

`drift-promo-20s.mp4` — 20 s, 1080×1920 (9:16 reel), 30 fps, H.264 + silent AAC track.
Cut from **3 minutes of real gameplay** (no staging, no mockups): the game drove itself with the
verify suite's aggressive follower model — the "intended way to play" driver from `assert.js` —
while the full page (canvas + DOM HUD) was screencast and the run's state sampled at 10 Hz.

Every frame links back to **kreeda.games**:

- a persistent `kreeda.games` watermark, top-right, on every gameplay second;
- a closing end card: **DRIFT · SLIDE · CHAIN · SEND IT — PLAY FREE NOW — no install · no login ·
  right in your browser — kreeda.games · + 10 more free games**;
- the in-game billboards along the road advertise the rest of the kreeda.games catalog.

The four highlight windows were picked by scoring the session log — close shaves, a threaded
oncoming car, ×8.0 multiplier, big slides (slip 0.99), bounty popups paid at the multiplier.

## Rebuild it

```sh
./drift/promo/make.sh          # needs node 22+, Chrome/Chromium, full ffmpeg, DejaVu fonts
SECS=240 ./drift/promo/make.sh # record a longer session to pick highlights from
```

Every run records a fresh session, so every rebuild is honest to the game as it is today —
same spirit as `verify/clip.sh`, which keeps the start card's loop truthful.

## Posting notes

- Post as a **Reel**; add trending audio in the Instagram app (the file's audio track is silent
  on purpose — IG re-scores reels anyway, and licensed music can't ship in the repo).
- Suggested caption:
  > One gear. One grip budget. A county full of zombies. 🏎️🧟
  > DRIFT — play free in your browser, no install, no login.
  > 🔗 kreeda.games (link in bio) — plus 10 more free games.
  > #browsergame #driftgame #indiegame #webgame #freegame
- Put `https://kreeda.games/drift/` in the profile's link-in-bio before posting — Instagram
  captions don't hyperlink, the bio link is the only tappable path.
