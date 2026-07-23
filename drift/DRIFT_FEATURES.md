# Drift — feature log

A running log of features added by the automated improvement loop, newest first. One entry per feature:
what it is, why it earns its place, and how it's defended.

## The full-service stop — auto-park, a 10 km/h limit, and a metered wallet bill (2026-07-23)

**What.** The rest area is now an *experience*, end to end. The **exit road is broader** (a ~20 m two-way
service road, up from ~13 m) and the **lot is bigger** (~75 m deep, up from ~46 m — three rows of stalls,
six charging posts). Cross onto a facility's own pavement and the car itself enforces the **10 km/h limit**
(`REST_LIMIT`, braked in at a firm automatic rate, never clamped): your foot loses to the limiter, and only
the drive back out is exempt so you can power back up to road speed. Drive into the exit and the
**auto-park valet** takes the wheel — `AUTO-PARK · LIMIT 10` on the pill, cancellable with the pause key —
idles down the drive, parks in a stall on the charger row and plugs in; the self-driven legs run as a ×6
time-lapse, because the limit is real but nobody's evening is spent watching a car idle across a lot. RESUME
is the mirror image: the car sees itself out and hands the wheel back in the traffic lane.

**The money is real now.** Charging no longer spends score — it runs a **meter**. The pack is 100 kWh usable
(scaled by the long-range mod, like the range readout), the post is a 250 kW DC unit that tapers toward the
80% cap, and the session is billed to the **wallet** as the energy flows: **$0.45/kWh + $1.00 hookup**, with
a **$0.35/min idle fee** after a 45 s grace once charged — and *no money, no electrons*, which keeps the
fail state the economy exists to protect. The pause card is the receipt: live kW, kWh delivered, tariff,
session total, wallet balance. One real second at the post is 90 s of charging; the meter banks to
localStorage as it runs, so a closed tab can't un-spend electricity that already flowed.

**Why.** Field report: make the rest-area experience *a lot better* — and tie its cost to the game's real
currency. Score-priced charging punished the thing you're best at; wallet-priced charging makes the horde
bounties, contracts and waves *fund* the drive, the way fuel money works. The valet, the limit and the
broad exit turn the stop from a mechanic into a place with manners.

**How it's defended.** `./verify/run.sh pause` — the meter is pinned to the number: kWh delivered must match
the pack's gain times PACK_KWH·mod.cap, the bill must equal kWh·$0.45+$1.00 out of the wallet with the score
untouched, the taper must stop at 80%, the grace must be free and a minute past it must cost $0.35, an empty
wallet must stop the meter dead, and the shoulder must stay unmetered. Driving onto the exit must hand the
wheel to the valet, take the speed to 10 km/h within ~2 s, and end parked at a live charger; resume from a
lot must end back in the traffic lane under the car's own steering, while a shoulder resume hands the wheel
straight back. `restnav` pins the broader geometry (drive 18–23 m wide, lot ≥70 m deep) and still proves the
U-turn trip parks on the apron, plugged in.

## Rest areas become real estate — a drive in, and a lot (2026-07-20)

**What.** The rest area is no longer a widened shoulder. Each services is now a **facility**: a ~200 m
**drive-in lane** that peels off at the gore and runs *away* from the carriageway, a **big parking lot set
back behind a strip of grass** (~46 m deep, two rows of marked stalls), a **row of four charging posts**
along its far side, and a shorter drive back out. The paved cross-section is still one pure function of
(index, seed) — an interval `[in..out]` that only touches the road at the two mouths — so `paved()`,
`wallAt()` (the fence now stands at the facility's perimeter), both views' drawing, and the pull-in
autopilot all read the same geometry. The pull-in now **drives the lane**: it chases the drive's own
centreline (~94 km/h down the drive), flares into the lot, and parks in a stall on the charger row;
stopping anywhere short of the lot — the drive, the shoulder — earns no charger.

**Why.** Field report: "the rest area is like a shoulder stop." It was — the bay sat directly on the
shoulder, so stopping felt like breaking down, not arriving somewhere. A real services with an approach,
an interior, and furniture makes the pause feature a *place*, and the 200 m drive gives the charging trip
the small ritual cost the economy already prices in.

**How it's defended.** `./verify/run.sh restnav` — the geometry probe now demands a real facility: plain
road before the gore, a lane *off* the road (its inner edge clear of the carriageway, lane-width, ~200 m
long) half-way down the drive, and a set-back lot at the stand (inner edge ≥8 m past the road edge, ≥43 m
deep); the U-turn trip must still end parked ON the lot at a live charger. `pause` still proves the
whole charging loop, and a stop far from services still parks on the hard shoulder, unplugged.

## The county's wildlife — deer crossings (2026-07-20)

**What.** A rarer, faster hazard than the horde: every ~1.5–2.5 km (seeded, an event not a fixture) a deer
breaks from the verge and bolts the full width of the road in a couple of seconds flat — occasionally a
fawn follows a beat behind. Reuses the horde's own machinery (a live entity array, `zPos`/`roadAt` for its
line, the same nose-strike math) because "something crosses your path and you have to react" was already
built; only the tone and the stakes are new. A real strike costs real speed and a bite of the pack — no
bounty, no gore, a startled bound and a puff of dust, not a splat, tracked on its own counter. Read it and
dodge it clean at speed and the same nerve the horde already pays for pays again: **DEER DODGE**, heat and
a grace refresh, exactly like a close shave. New `GAME WARDEN` badge (3 clean dodges) and `DODGE 2 DEER
CLEAN` contract, both reading the counter the toast increments. Never spawned on a bridge, in a tunnel, or
across a services apron.

**Why.** Every hazard so far either builds slowly into view (the horde, read from a distance) or sits
fixed in the world (a wall, a slick, a bore). Nothing tests pure reaction — see it, decide, act, in under a
second. A rural county road runs through someone else's territory too, and wildlife is the natural way to
ask for that without inventing a new mechanic: reusing the horde's proximity/strike/near-miss shape means
the only genuinely new code is *what* crosses and *what it costs*, not *how crossing works*.

**Fix in the same pass.** Deer inherit the horde's own "spawner live" gate (`zNextIdx<1e8`) on purpose — so
any existing probe that stands the horde down for a clean measurement correctly silences deer too, without
needing to know deer exist. Caught the sharp edge of that while writing this feature's own probe: a
sub-test that stands the horde down to avoid unrelated noise *also* silences the very crossings it's
trying to observe. Not a game bug — the shared gate is the right design — just something the test itself
had to account for.

**How it's defended.** `./verify/run.sh deer` — crossings actually happen on a long enough drive and never
land on a bridge or a services apron, a real strike costs speed and charge but pays no bounty, a clean
pass at speed pays DEER DODGE exactly once per crossing (never on top of an actual hit, never on ordinary
driving nowhere near one), the badge/contract read the same counter, and — checked directly against the
resolution this suite actually runs at, not assumed — a deer at a fair ~65m reaction distance genuinely
clears the dashboard rather than rendering invisible behind it.

## The county buys better signage (2026-07-20)

**What.** Three tiers of rest-area signage, because a stop you can drive straight past isn't a stop. The
**pylon**: a services totem at the bay itself, tall enough to read over the treeline, fading up out of the
haze from ~1.3 km (the road points that far ahead are minted on demand — same rng stream, same road, just
built a moment early). The **banner gantry**: a full-width overhead panel astride the road at the exit's
gore, arrowed into the lane — you drive *under* it, not past it. And the 3-2-1 km countdown boards grown
to motorway size. The countdown itself is fixed: a post that landed near a bridge used to be silently
**dropped**, so a bay could announce itself with nothing but a lone “1 KM” out of nowhere — posts are now
minted with the bay (memoized in `restBlock`) and *nudged* along the road until they stand on dry land,
never dropped.

**Why.** Field report: “drove 5 km and couldn’t find the rest stop … the signs keep telling it’s 1 km
away.” The countdown was real but leaky (dropped posts made it stutter), and it *terminated in nothing* —
at the bay there was no landmark bigger than a charger post, so the exit slid by unnoticed. Signage is a
promise; the pylon and the gantry are the promise being kept where the player is actually looking.

**How it's defended.** `./verify/run.sh restnav` — every bay carries its full set (gore gantry + 3-2-1),
every post answers `signAt` at its own index, stands clear of any bridge, and sits within a nudge (≤90
points) of its true kilometre. The full suite stays green.

## Rest areas get real — a schedule and an exit (2026-07-20)

**What.** Services now sit on the county's own schedule — the **3rd, 7th, 12th, 18th… kilometre**, each
gap one km longer than the last (bay n at n(n+5)/2 km), nudged deterministically off any bridge — instead
of a random bay every half-km. And each one finally *looks* like somewhere you can stop: a **real exit**
(a ~145 m deceleration tongue smoothstepped off the shoulder, lane-drop dashes across the mouth where the
solid edge line stands down, a white edge out along the tongue, a shorter merge back), the barrier
standing back around the apron exactly where `wallAt()` puts the wall, bay markings, the charger post,
and a **gore sign arrowed into the lane** on top of the 3-2-1 km countdown — in **both views** (the top
view previously drew no rest area at all), with nothing growing through the pavement: tufts, poles, trees
and chevron boards all stand clear. The dash now always knows the distance to the next services, however
far out.

**Why.** The apron was real physics (`paved()`/`wallAt()` let the car in; pause parked on it) but
`drawApron` was never called and the barrier posts were drawn straight across the entrance — a stop you
could use but not see. And a bay every ~500 m made stopping meaningless: no anticipation, no planning,
nothing for the signage to promise. A fixed, learnable, widening schedule turns range into a decision the
long haul keeps re-asking.

**Fix in the same pass.** The pull-in autopilot could strand itself: grass drag (a flat 300) eats a crawl
throttle (0.32×760) whole, so a car that clipped the verge mid-U-turn sat at 0 km/h draining its pack to
death. The crawl now digs (0.75) whenever it's aground on grass, and a shoulder stop is allowed to park
from the crawl speed grass kills anyway.

**How it's defended.** `./verify/run.sh restnav` — the schedule (bays at km 3/7/12/18, ± the river
nudge), the exit geometry (plain road before the gore, a ramp half-way down the lane, a full-width
stand), and the turn-back trip now runs against the real schedule — plus `pause`, which still proves a
stop far from services parks on the hard shoulder, unplugged.

## Bounty Waves — the county radio calls (2026-07-19)

**What.** Every ~1.6–2.2 km (seeded off the run, first call ~30 s in), the radio calls a **BOUNTY
WAVE**: a two-tone klaxon, a dense pack of 8 dropped on the road ahead (population cap lifted to 14
for the duration), every bounty **doubled** for 18 seconds, and **five heads inside the window pays a
+$120 clear bonus**. The HUD counts it down (`⚑ WAVE 12s · 3/5`); banners call the arrival, the clear,
or the pass. Daily roads call the same waves for everyone. When a probe stands the horde down, the
radio is off too — so every cash-arithmetic test stays exact.

**Why.** The run had hazard variety but no *rhythm* — nothing escalated, peaked, or released. Waves
give the session a pulse: anticipation between calls, a 18-second skill spike that leans on everything
already built (guns, brutes' two-round soak, shave lines through a dense pack), and a clear bonus that
makes the wallet loop breathe.

**How it's defended.** `./verify/run.sh waves` — seeded schedule (same seed, same call), the wave
arrives on it and drops a real pack (0→9 on the road), base pay $33 vs in-wave $56+ on the same
choreographed mow (placed on the car's actual line — the autopilot cuts corners, so road-centre can
miss in a bend), the clear pays exactly +$120 at five heads, a passed wave pays nothing, the radio
re-arms ~2 km out, and a stood-down horde silences it entirely.

## The Trophy Shelf — badges and streaks (2026-07-19)

**What.** Fifteen persistent badges, shown as a shelf on the start and over panels with a gold toast
when one lands: firsts (SIDEWAYS — first banked chain), the chain-tier ladder (CLEAN COLLAR /
CERTIFIED SICK / COUNTY LEGEND), feats (225 CLUB, LONG HAULER 5 km, THE BARBER 5 shaves, PEST CONTROL
10 shamblers, BIG GAME — a brute), daily-mode glory (FASTER THAN YESTERDAY — beat your ghost;
RAIN DANCER — a wet-day best), completion (FULLY ARMED, GEARHEAD), and the habit itself: REGULAR and
LOCAL FIXTURE for 3- and 7-day **streaks** on Today's Road. Chains you died holding still count.

**Why.** Every other system settles when the run ends; badges are the layer that *remembers*. They give
the long horizon goals cash can't (cash runs out of sinks; "I've never hit LEGENDARY" doesn't), and
streak badges are the industry's most reliable comeback lever, riding on the daily road that's already
there.

**How it's defended.** `./verify/run.sh badges` — every badge is claimed through the game's own paths
(real banked chains, a real brute under the bumper, real purchases, real daily starts — never by poking
storage): feats pay once, the toast announces, the report awards died-holding chains, two guns is not
FULLY ARMED, streaks continue from yesterday / break after a lapse / hit REGULAR at 3 and LOCAL FIXTURE
at 7, and the shelf persists and gilds.

## The horde gets ranks — runners and brutes (2026-07-18)

**What.** The horde is no longer uniform. **Runners** (10%) sprint for your lane at ~3× shamble speed,
red-shirted with a pumping gait, and pay **2× bounty** — they turn a quiet straight into a snap
decision, and shaving one is the scariest shave there is. **Brutes** (5%) are a head taller and wider,
soak **two gun rounds** (the first is a visible flinch, not a kill), pay **3×** — and running one down
costs ~14% of your speed, so the plow-in is a real momentum decision when you're holding a chain. All
rolled from the horde's seeded rng: a daily road raises the identical horde for everyone.

**Why.** Variety in the moment-to-moment threat mix is what keeps an endless runner's minutes fresh —
uniform hazards fade into scenery. The ranks also deepen two existing systems for free: the bounty
ladder gives the wallet richer texture, and the brute finally gives the SM-2/LR-7 upgrades a target
that justifies them.

**Fix in the same pass.** The start card had outgrown small screens and `.panel` didn't scroll, leaving
the Drive button unreachable on short viewports (a real tap at 500×560 timed out). The panel now
scrolls with the card centred by auto margins; real taps verified at 500×900, 500×560, and 900×500.

**How it's defended.** `./verify/run.sh horde` — the seeded mix (330/44/26 of 400), runner speed,
the bounty ladder proven on choreographed hits at matched speed (walker $33 / runner $66 / brute $99),
the brute's momentum tax (227→207 km/h vs a walker's 227→229), the two-round soak observed hp 2→1→0,
and same-seed determinism.

## Weather — some days it rains (2026-07-18)

**What.** ~1 day in 3 (34%), Today's Road is **wet**: the grip budget drops 12% and the brakes 15%, rain
streaks the windshield (raked flatter the faster you drive), a cool veil mutes the palette, the tarmac
darkens in both views, and the HUD flies `🌧 WET ROAD · GRIP −12%`. The forecast is a pure function of
the day's seed — everyone drives the same sky, and the ghost you race recorded its line in the same
rain. **Endless mode is always dry**, so the canonical car stays exactly as the physics suite pins it.

**Why.** A daily mode lives on variety: if every day feels the same, "come back tomorrow" decays. Rain
days re-price every corner the player thought they knew — same road knowledge, new grip budget — which
is the cheapest honest way to make a known-quantity mode feel fresh. Weather gated to the seeded daily
keeps the competitive frame fair (one sky per day) and the physics canon intact.

**How it's defended.** `./verify/run.sh weather` — the forecast is pure and rains 97/300 seeds, endless
starts are always dry, the daily road matches the day's forecast, and the physics is proven A/B with
identical forced inputs on pinned roads where the only variable flipped is the sky: the same corner
breaks away sooner (slip 0.602→0.628) and the same 1.5 s stop leaves more speed on (81→88 km/h).

## Run Report + chain ratings (2026-07-18)

**What.** Two doses of arcade juice. Banked chains now have **names** — CLEAN ≥1,000, SLICK ≥2,500,
SICK ≥5,000, OUTRAGEOUS ≥10,000, LEGENDARY ≥20,000 — worn in the drift pop as a gradient title, with
the bank chime singing higher (and slightly longer) the bigger the name. And the over panel now opens
with a **six-tile run report**: top speed, longest chain (with its tier), drift time, distance, close
shaves, shamblers. A chain you *died holding* is folded into the books before the card is written.

**Why.** Peak-end rule: a run that ends on one bare number is remembered as a number; a run that ends
on "231 km/h, an OUTRAGEOUS 11,000 chain, 2 shaves" is remembered as a drive. The named ladder also
gives chains a vocabulary — a target ("I've never hit SICK") that raw score can't offer.

**How it's defended.** `./verify/run.sh report` — the ladder names chains at exactly its thresholds,
the pop announces the tier on a real bank, `driftTotal` accumulates sliding (2.27 s) and not straight
driving (0.00 s), the card's numbers match the run's real state, died-holding chains count name-and-all,
and every run gets six tiles. (Writing the probe re-proved the game's own loop: a chain that banks
mid-death claws back 5.5% charge and saves the car — the death choreography had to outlast the grace.)

## The Ghost — race today's best line (2026-07-18)

**What.** On Today's Road, your best run is recorded (~7 Hz: time, position, heading, distance) and
replayed on every later daily start as a **translucent cyan phantom** driving its exact line — visible
in both views, drawn as a hologram so it never reads as traffic. The HUD shows the live gap:
`GHOST +12 m` (ahead, green) / `−34 m` (behind, red), and `FINISHED` once the phantom's run ends. Only
a run that takes today's best keeps its ghost; the line voids at midnight with the daily ledger.
Endless runs record nothing.

**Why.** A daily best as a number is bookkeeping; a car you can *see* is a race. Ghost racing is the
proven mechanic for making a fixed course compulsive (every kart and time-trial game since the 90s) —
it turns "one more go" into "I was 40 m up at the second bend and threw it away". It's the payoff the
Daily Road was built for, at zero cost to the endless mode.

**How it's defended.** `./verify/run.sh ghost` — endless runs lay down no line, a best daily run stores
one under today's key, the next daily start loads it, `ghostAt()` reproduces the recorded samples to
<2 px, a coasting driver reads BEHIND on the HUD meter, a worse run can't overwrite the line, and a
stale day's ghost is ignored.

## Today's Road — one seeded road per day (2026-07-18)

**What.** A second button on the start card: **⚑ Today's Road**. The seed is a pure hash of the calendar
date, so everyone who drives it gets the same corners, the same horde, and the same contract board all
day. It keeps its own **today's best** (HUD shows `TODAY`, the over panel settles against it, "NEW DAILY
BEST!") which resets at midnight — and it never touches the endless `BEST`, so grinding a known road
can't inflate the real leaderboard. *Again* replays whichever mode you died in; plain *Drive* stays
random-seeded.

**Why.** Endless mode can't be learned — every run is a new road, so mastery has no target. A daily road
gives short-session players a fair, learnable arena and a reason to come back tomorrow (the Wordle
lever). It composes with everything already shipped: the day's fixed contract board becomes a puzzle,
and the fixed horde layout makes shave lines repeatable.

**How it's defended.** `./verify/run.sh daily` — seed is a pure function of the date (adjacent days
differ), two daily starts give the identical road and board, plain Drive differs and stays out of the
daily ledger, the two bests never cross, worse runs don't overwrite, Again preserves mode both ways, and
a stale ledger from another day reads as zero then yields to the new day's first run.

## CLOSE SHAVE — near-misses pay in heat (2026-07-18)

**What.** Passing a live shambler with the nose inside 120 px (but outside the 55 px strike radius) at
over ~100 km/h — judged at closest approach — pops **CLOSE SHAVE**, bumps the multiplier +0.5, and
refreshes the drift chain's 0.7 s grace window. That refresh is the real mechanic: a shave can **bridge
a chain** across the straight between two corners, so the horde stops being only targets and becomes
apexes. A new SHAVE contract (4 shaves, $60) joins the job board. Each shambler pays at most once; a hit
stays a bounty and never doubles as a shave.

**Why.** The game paid for hitting zombies but gave nothing for the scarier, more skilled line —
threading past one flat out. Near-miss rewards are proven moment-to-moment juice (Burnout made a genre
of them), and paying in *heat* rather than score keeps the suite's core invariant intact: tidy driving
still scores ~nothing, because the multiplier only matters while a drift chain is alive.

**How it's defended.** `./verify/run.sh nearmiss` — choreographed passes with the spawner stood down:
close-at-speed pays, wide pays nothing, slow (coasting past at 31 km/h) pays nothing, one shave per
shambler, hit-vs-shave never double up, and the bridge is proven A/B: the same 0.45 s-of-grace chain
dies over a 0.7 s straight bare, and survives it shaved.

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
