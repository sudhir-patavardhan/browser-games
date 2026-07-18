# Drift — feature log

A running log of features added by the automated improvement loop, newest first. One entry per feature:
what it is, why it earns its place, and how it's defended.

## The Garage — permanent car hardware (2026-07-18)

**What.** Wallet cash now buys **car upgrades**, not just guns: LONG-RANGE PACK (+30% battery, $900),
REGEN TUNE (+50% brake regen, $1,400), TRACK TYRES (+8% lateral grip, $2,600). Fitted once, driven on
every run after — the dash reports the pack you actually fitted, wall impacts and chain claw-backs count
in % of the pack you own. The stock car is untouched until you pay, so every physics claim the suite
pins still holds for a fresh player.

**Why.** Contracts and bounties opened the cash faucet, but the armory capped the sink at $3,350 —
after three guns, money stopped mattering. The garage adds a $4,900 progression ladder on top, and the
upgrades bend the core loop rather than sitting beside it: more pack is more clock, more regen rewards
the trail-braking the game teaches, stickier tyres move the grip budget the whole risk/reward gradient
is built on. Long-term saving goals are the classic retention lever.

**How it's defended.** `./verify/run.sh garage` — shop rules (no credit, no double-buys, persistence,
stock-until-paid) plus each part measured **fitted alone** against stock on pinned roads with identical
forced inputs: battery state never steers the car, so the pack's drain ratio is held to its 1.30 spec
±0.02, peak regen kW to ~1.5x, and the tyres' provoked corner must break away measurably less.

## Contracts — the county job board (2026-07-18)

**What.** Every run posts **three short contracts** drawn from the road's own seed — e.g. *HOLD ONE
SLIDE 4s*, *BUILD A 1,500 CHAIN*, *TOUCH 225 km/h*, *RUN DOWN 3 SHAMBLERS*, *COVER 2.5 km* — shown
under the wallet in the top-left HUD pill with live progress. Crossing a target pays **wallet cash on
the spot** (banked like a bounty: a crash can't take it), with a toast and a cash pop. The over panel
settles the board with ✓/✗. A marksman job (*BAG 3 FROM THE VERGE*) only enters the draw when a gun is
equipped.

**Why.** Score chases one long-term number; contracts put a goal within reach in the next minute of any
run, which is what keeps a "one more go" loop alive. They are also the economy's second faucet: the
wallet/armory previously fed only on zombie bounties, so a player who couldn't crack a big chain had no
path to a gun. Rewards ($40–$80) are sized against gun prices ($250+) so a good run visibly moves the
needle.

**How it's defended.** `./verify/run.sh contracts` — seeded draw determinism, board variety across
roads, marksman gating, live progress, pay-on-the-spot (exactly once, zombies stood down so the
arithmetic is pure), and the settled board on the over panel. The draw uses `seed^0x51c7`, so it never
touches the road's or the horde's random streams.

## Harness fix — cruise stint pinned to a seed (2026-07-18)

The `controls` suite's "cruise holds the set speed" stint ran on an **unpinned** road: on seeds whose
early corners are tighter than the grip budget allows at 220 km/h, the grip-limited autopilot runs wide
and barrier hits eat the speed — failing the stint on road luck, not cruise. Now pinned to seed 31337
(a canon road from the physics suite) where the set speed is genuinely holdable; the suite is
deterministic again (verified 3× green).
