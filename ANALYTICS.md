# The analytics contract

[`analytics.js`](analytics.js) is loaded by every page and exposes exactly one function, `window.bgTrack`.
This file says what the games are expected to send through it, so sixteen self-contained files report the
same shapes and a report can be built without a per-game legend.

Read [`analytics.js`](analytics.js) first — its three rules (never break a game, nothing on `file://`,
every event logged locally as it is sent) are the reason everything below is written the way it is.

## The call site

Every game defines this wrapper once and calls it everywhere. Copy it verbatim.

```js
/* Analytics must never be able to break a game. bgTrack is itself wrapped and swallows everything,
   but the guard is repeated here so a game opened from the file system — where analytics.js injects
   nothing at all — reaches a no-op rather than an undefined. */
function track(name,params){ try{ if(window.bgTrack) window.bgTrack(name,params); }catch(e){} }
```

## What to send

**A pageview already exists.** Every game is its own path under one GA4 property, so *which game was
opened* is answered for free. Do not send an event for it. Custom events exist to answer what a pageview
cannot: did they actually play, how far did they get, and why did it end.

Two events per game, at minimum:

| Event | Fires | Always carries |
|---|---|---|
| `game_start` | when play actually begins — the first move, not page load | `mode` |
| `game_end` | when that play ends, however it ends | `mode`, `outcome`, `duration_s` |

`mode` is the game's own vocabulary (`daily`, `endless`, `vs-ai`, `2p`, `practice`, `archive`).
`outcome` is why it ended (`win`, `loss`, `draw`, `quit`, `complete`, `bust`, `timeout`) — the field
that turns a play count into something you can act on.

**Games that already report keep the names they have.** Drift sends `run_start` / `run_end` /
`shop_buy` / `badge_earned`; the grids send `grid_start` / `grid_end`. Renaming those would orphan the
history already collected, which is worth more than a tidy taxonomy. New instrumentation uses
`game_start` / `game_end`; a game with a genuinely distinct second loop may add its own third event.

## Rules for parameters

- **`snake_case`, at most 40 characters**, per GA4's own limits. A name GA4 rejects fails silently.
- **Round every number on the way out.** A raw float per play is a high-cardinality dimension: it reports
  badly and tells you nothing a rounded one doesn't. Seconds as integers, distances to two decimals.
- **Never send anything identifying.** No free text a player typed, no answers, no share strings, no
  storage contents. A daily's answers are the one thing that must never leave the device — a leak there
  spoils the puzzle for everyone, not just the sender.
- **Bound the vocabulary.** A parameter whose value is drawn from a fixed set is a dimension you can
  group by; one that can be any string is noise.
- **Never branch on analytics.** No game logic may read a return value, check whether a send worked, or
  wait on one. `track()` returns nothing, deliberately.

## What the numbers are worth

Stated plainly here because a dashboard built on them will overstate its own precision:

- **Nothing arrives from `file://`.** Opening a game off the disk is the point of this repo, and those
  plays are invisible by design.
- **Ad blockers drop `googletagmanager.com` universally**, so every count is a material undercount.
  Treat the numbers as a biased sample, never as traffic.
- **GA4 sets cookies.** There is no consent banner here, which is an outstanding item for EU/UK
  visitors — see the README. Adding more events does not change that; it raises the stakes.
