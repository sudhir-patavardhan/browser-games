# Drift — verification harness

Drift's feel lives in numbers that are easy to break and hard to eyeball: a lateral grip budget, a slip
angle, a weight-transfer term. This harness **drives the game in a real browser** and asserts on what the
car actually does, so a physics change can be checked instead of hoped for.

No test framework and no dependencies — just Node (to splice a probe into a copy of the page) and a headless
Chrome/Chromium. The game exposes `window.__drift` (`start()`, `setInput(steer, gas, brake)`, `step(n)`,
`autopilot()`), so a probe is only a `<script>` appended before `</body>` that writes its findings into a
`<div>` we read back with `--dump-dom`.

```bash
./drift/verify/run.sh              # physics + behaviour suite; exits non-zero on any FAIL
./drift/verify/run.sh controls     # the control scheme, driven with synthetic pointer + key events
./drift/verify/run.sh contracts    # the job board: seeded draw, live progress, cash paid on the spot
./drift/verify/run.sh garage       # wallet-bought car hardware, each part proven A/B on pinned roads
./drift/verify/run.sh nearmiss     # the CLOSE SHAVE: choreographed passes, paid in heat only
./drift/verify/run.sh daily        # today's road: one seed per day, its own best, resets at midnight
./drift/verify/run.sh ghost        # the daily ghost: recorded on a best run, raced faithfully after
./drift/verify/run.sh report       # chain tier names + the end-of-run report card
./drift/verify/run.sh weather      # rain days: seed-pure forecast, wet grip/brakes proven A/B
./drift/verify/run.sh horde        # zombie ranks: the mix, the bounty ladder, the brute's momentum tax
./drift/verify/run.sh plane        # scenery built, and the rare airliner is actually reachable
./drift/verify/shoot.sh driver f.png   # screenshot the car mid-drive, so you can LOOK at it
```

Set `CHROME=/path/to/chrome` if it isn't found automatically. If no browser exists the runner **exits 2
rather than reporting success** — a green run must mean the game really ran.

## What the suite pins down

The road seed is drawn from `Math.random()` on every `newGame()`, so the harness **pins the seed** before
each stint. Without that, an A/B comparison silently runs on two different roads and means nothing.

The claims it defends, in rough order of how much they matter:

- **Drifting emerges from driving, not a button.** Hard cornering at speed breaks the tail loose.
- **Tidy driving is safe and scores ~nothing; pushing past the grip limit pays 10x+.** Measured across six
  seeded roads as a *separation*, not an absolute score. Driving inside the limit survives every road and
  scores almost nothing; ~15% past it drifts for real and pays ~18x; ~20% past pays ~85x at real risk;
  recklessness always crashes. That gradient **is** the game — if it flattens, the game is broken even when
  nothing errors.
- **Trail-braking initiates a slide** (brake while turning rotates the car more than lifting does), and
  **power-on holds it**, and **countersteer catches it**.
- **Brakes must not stop you dead.** Braking is the drift trigger, and a slide needs the speed it scrubs, so
  over-strong brakes make the tool defeat itself. This one has already regressed once.
- **The bang-bang keyboard player** (steering is only -1/0/+1) can still hold a line on every road.
- **No auto-throttle on a keyboard**: doing nothing must let you stall out. Touch is the deliberate
  exception — with no on-screen pedals there's nothing to hold, so fingers get an auto-throttle and a
  second finger brakes. `run.sh controls` drives both paths with synthetic events, because a control
  scheme with no buttons has no geometry to eyeball: the only way to know touch works is to touch it.
- **The pack is the run's clock.** The battery is the fail state now, so every number on the dash has to be
  true: pulling power drains it, braking at speed genuinely regenerates (peak ~-42kW, charge gained),
  wandering off-road burns it ~90x faster than tarmac, a barrier impact costs charge and speed but does
  NOT end the run, landing a drift chain claws charge back, and 0% ends you with `OUT OF CHARGE`.
  Driving tidily buys ~840s; sending it recklessly burns you down to ~7% within 100s. That gradient is the
  whole risk/reward loop, and it replaced the old instant-crash death.
- **The driver view renders through a full yaw sweep without throwing.**

## Judgement, not a rubber stamp

A threshold here is a claim about how the game should *feel*, so treat a failure as a question, not a
verdict. Two of these tests were wrong before the game was: one drove a fixed target speed into corners that
could not physically hold it (a scripted crash, not a physics bug), and one demanded that a *maximum
aggression* driver survive — but recklessness is supposed to kill you. If you retune the car on purpose,
update the numbers here and say so in the commit; just don't quietly relax a bar to make a red run green.
