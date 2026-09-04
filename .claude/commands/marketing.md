---
description: Run a Kreeda marketing Cycle, or show where the system stands
argument-hint: "[status | smoke | publish | desk | plan | review | briefing]"
---

You are running the Kreeda marketing system by hand, from the CMO's machine.

Everything you need to know about it is in `marketing/CONTEXT.md` (the
glossary), `marketing/AGENTS_SPEC.md` (the design) and `marketing/docs/adr/`
(the decisions). Use the glossary's words — Cycle, Post, Campaign, Channel,
Review, Run log, Producer, Agent, Player, Trial, Verdict, Caps — in everything
you say back.

**The rules of this command, which are the routines' rules (ADR 0005):**

- You are not the Producer. The Producer is `marketing/cli.js`. Run it; do not
  reimplement what it does.
- **Never edit any file under `marketing/src/` or `marketing/cli.js`** while
  running a Cycle. If a command fails, report it and stop. Improvising around a
  failure is the risk this rule exists to remove.
- Do not retry a failed command more than once.
- Nothing is published or launched without a merged Review. There is no
  autopublish. Anything that reaches a Channel needs `--live`, and without it
  every command is a dry run.
- State lives on the `marketing-state` branch, checked out at `marketing/data/`
  (ADR 0001). If that worktree is missing, run `node cli.js state init` first.

Run everything from the `marketing/` directory.

---

The argument is `$ARGUMENTS`. Treat an empty argument as `status`.

**`status`** — where the system stands. Run, and summarise together:
`node cli.js status`, `node cli.js queue`, `node cli.js ads-status`, and
`node cli.js report` (the last Run log). Then say, in a few lines: how many
Posts are waiting on a decision and for which Slots, whether a Review is open
and unmerged, which Campaigns are in Trial and how much of the Caps they
commit, and anything that needs the CMO. If a Post has been waiting more than
three days past its Slot, say so — it is about to expire.

**`smoke`** — `node cli.js smoke`. Report the whole thing. If it is not green,
list only the blocking failures with their remedies; the degraded ones matter
less. Do not try to fix anything yourself.

**`publish`** — the Publish Cycle: `node cli.js cycle publish`. This is the
Producer alone. Report what it printed under "Run log": what was published,
launched, paused, retried or skipped, and why. If `marketing/data/outbox/`
holds files afterwards, each is an Alert or the Briefing — send each one by
email to the address in its `to:` line, with its `subject:` line as the
subject and the rest as the body, then delete it.

**`desk`** — the Morning desk Cycle. For each of the Analyst, then the
Performance Analyst for any Campaign that reached Ended or Paused since the
last run, then the Media Buyer if there is headroom under the Caps:
run `node cli.js agent prepare <role>`, read
`marketing/src/agents/<role>/PROMPT.md` and the input file that `prepare`
printed the path of, write your output to the path it named, and run
`node cli.js agent accept <role>`. You are the Agent (ADR 0006). If `accept`
rejects your output, fix the output once — never the code or the schema. If it
rejects again, stop and report what it said.

**`plan`** — the Planning Cycle, in this order: the Analyst with `--full`, then
the Strategist, then the Chief of Staff, each through the same
prepare/accept sandwich as `desk`. Then `node cli.js cycle creative --horizon
48h` so Monday and Tuesday's Posts are In review by the end of it. Finish by
reading out the Briefing.

**`review`** — show the CMO what they are being asked to approve. Find the open
Review with `gh pr list --base marketing-state --head marketing-review`, print
its checklist, and for each Post give the full text and a link to its Assets,
and for each Campaign proposal the game, angle, budget, targeting and expected
outcome. Do not merge it. Merging is the CMO's approval and only they do it.

**`briefing`** — print the latest `marketing/data/artifacts/reports/briefing.md`.
If there is none, say when the next Planning Cycle will write one.

If the argument is none of these, say what the choices are rather than guessing.

---

If a command you were told to run does not exist yet, say which Phase of
`AGENTS_SPEC.md` §14 builds it and what does exist instead. Do not build it.
