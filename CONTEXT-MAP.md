# Context Map

## Contexts

- [Marketing](./marketing/CONTEXT.md) — grows Kreeda's player base through organic Posts and paid Campaigns on Twitter/X and Facebook, with the CMO approving before anything goes out. Decisions in [marketing/docs/adr](./marketing/docs/adr/).

## Relationships

- **Games → Marketing**: every game page reports `game_start`, `game_end`, `game_time`, and the `played_30s` conversion through `analytics.js` (see `ANALYTICS.md`); Marketing reads those numbers and never writes to a game.
