# Drift MP — how the multiplayer works

Drift MP is [Drift](../drift/index.html) with a paddock bolted on: up to **8 players race the same
road live**, each from their own phone or laptop, with **no server** running the game.

## The model: the daily ghost, made live

Solo Drift already proved the two ideas this game leans on:

1. **The world is a seed.** The daily road gives everyone the same corners, the same horde schedule
   and the same sky from one integer. A race works the same way: the host draws a seed, every
   browser builds an identical world from it, and nothing about the world ever crosses the wire.
2. **A rival is a hologram.** The daily ghost renders another car's recorded line without touching
   your physics. A live rival is that ghost fed by the network instead of localStorage.

So each browser is the **sole authority over its own car** — full local physics, zero latency on
your own inputs — and rivals are translucent cars in team colours you can't collide with, only
outscore. There is no reconciliation and no rollback because there is nothing to reconcile: the
worst the network can do is make a hologram stutter, never corrupt your run.

Zombies, deer and traffic spawn identically for everyone (seeded), but each player interacts with
their own copy — same stage, parallel performances, exactly like the daily road.

## The wire

- **PeerJS over WebRTC DataChannels.** The public PeerJS broker carries only the handshake (SDP/ICE);
  after that every message is browser-to-browser. If the CDN script never loads, `window.Peer` is
  undefined and the game degrades to solo — the network is never load-bearing for the road.
- **Star topology.** The host's browser is the room: peer id `kreeda-driftmp-<CODE>`, where the code
  is 4 glyphs from an alphabet with no `0/O/1/I/L`. Joiners connect to the host; the host relays
  every message to the rest of the grid. Invite links (`?room=CODE`) open the join gate pre-filled.
- **~12 Hz of pose.** In a race each client sends `{t:'st', x, y, a, score, dist, mult}` every 83 ms.
  Rivals are drawn ~140 ms in the past, interpolated between the two nearest poses; past the newest
  pose they coast on the last velocity for up to 280 ms, then fade rather than teleport.

### Protocol (all JSON over one reliable DataChannel)

| msg | direction | meaning |
|---|---|---|
| `hi {name}` | joiner → host | knock on the paddock door |
| `wel {pid, players, roundLen, racing}` | host → joiner | your seat, and the room |
| `lobby {players, roundLen, racing}` | host → all | the room changed |
| `start {seed, len}` | host → all | the flag drops: build seed, race `len` seconds |
| `st {p, x, y, a, s, d, m}` | everyone, host relays | a pose and a score |
| `over {p, s, r}` | everyone, host relays | a car is out, score final |
| `full` | host → joiner | 8 cars max |

## The race

A round is a **fixed clock** (host picks 2/3/5 minutes). Three beats of countdown hold the score at
zero — the road is live, roll if you like — then the clock runs. Die early (`OUT OF CHARGE`, the
wall, the horde) and your score stands where it fell; survive and `TIME UP` calls it. The tower
publishes the final order once every car on the grid is in. Pause is disabled in a race — the grid
clock waits for nobody — and the auto-park valet is waved off.

Mid-race arrivals wait in the paddock as spectators (the `racing` flag keeps them from holding the
result open) and make the next grid. A dropped racer keeps their last score on the board, marked
`LOST SIGNAL`. If the host vanishes mid-race you finish your run solo; the board freezes where it
stood. Races never touch the endless or daily best ledgers — a race settles against the grid, not a
ledger — but cash, contracts and badges earn as normal.

## Limits, by design

- The public PeerJS broker has no uptime SLA — fine for a hobby game, swappable for a self-hosted
  `peerjs-server` without touching client code.
- STUN gets most home networks through; a strict symmetric NAT (some corporate/CGNAT setups) may
  fail to connect without a TURN relay. That player plays solo.
- Clocks are not synchronized across peers; a race is parallel time-trial scoring, so ±200 ms of
  start skew is irrelevant and per-player timing is local.

## Verifying it

`./drift-mp/verify/run.sh mp` drives the whole layer headlessly with fake connections: room-code
alphabet, host relay and seat assignment, the full-room bounce, interpolation (including the
short-way-round on angles), the pinned countdown score, `TIME UP`, ledger isolation, standings
order, spectator isolation and the joiner's welcome. The rest of the solo suite
(`./drift-mp/verify/run.sh`) still passes untouched — multiplayer is additive.
