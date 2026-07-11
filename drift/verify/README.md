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
./drift/verify/run.sh geo          # pedal geometry in both cameras (offscreen / overlap / what a tap hits)
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
- **No auto-throttle**: doing nothing must let you stall out.
- **The driver view renders through a full yaw sweep without throwing.**

## Judgement, not a rubber stamp

A threshold here is a claim about how the game should *feel*, so treat a failure as a question, not a
verdict. Two of these tests were wrong before the game was: one drove a fixed target speed into corners that
could not physically hold it (a scripted crash, not a physics bug), and one demanded that a *maximum
aggression* driver survive — but recklessness is supposed to kill you. If you retune the car on purpose,
update the numbers here and say so in the commit; just don't quietly relax a bar to make a red run green.
