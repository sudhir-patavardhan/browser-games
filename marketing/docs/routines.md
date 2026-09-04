# The routines

The three Cycles run as scheduled Claude routines in the "Browser Games" cloud
environment, `env_011FxiY73spRKKNNboQdie8B` (ADR 0005). This file is what to
paste when creating them, and it was checked by rehearsing a clean clone.

## What a fresh checkout does not have

A cloud session starts from a clone of this repo, and `marketing/data/` is not
in it: it is a worktree of the `marketing-state` branch, which `main` does not
track (ADR 0001). Nothing creates it automatically.

So **every routine's command begins with `node cli.js state init`**. It is
idempotent — it fetches the branch and checks out the worktree on a fresh
machine, and reports "already open" on one that has it — which is exactly what
a routine needs. AGENTS_SPEC.md §3's prompt sketch omits this step; a clean
clone fails without it.

Verified 2026-09-04 by cloning the repo fresh and running the sequence below:
`npm ci` succeeds, `state init` fetches the branch and checks out the
worktree, `smoke` is green and `npm test` passes 73 tests.

## Environment

Every secret lives in the cloud environment's **Environment variables**
(claude.ai/code -> the cloud icon above the message box -> hover the
environment -> the gear). Not in the repo, and not in GitHub repository
secrets — there is no Actions workflow to read those.

`FACEBOOK_APP_ID` and `FACEBOOK_APP_SECRET` are not needed there: only
`fb token` and `fb preflight` use them, and the Page token they mint does not
expire.

The environment's **network access** must reach the six hosts smoke probes:
`api.x.com`, `ads-api.x.com`, `graph.facebook.com`,
`generativelanguage.googleapis.com`, `analyticsdata.googleapis.com` and
`api.github.com`. Run the smoke routine once after creating the environment;
it reports any host it cannot reach, and which part of the system that costs.

## The routines

| Routine | Cron (UTC) | Model |
|---|---|---|
| Publish | `0 9,13,17 * * *` | `claude-sonnet-5` |
| Morning desk | `30 3 * * *` | `claude-sonnet-5` |
| Planning | `0 16 * * 0` | `claude-fable-5-1` |

Each prompt is self-contained: the session starts with no context.

### Smoke (one-off, run this first)

> You are running the Kreeda marketing smoke check. Run exactly:
> `cd marketing && npm ci --silent && node cli.js state init && node cli.js smoke`.
> Do not edit any file. Do not run any other command. Report the whole output
> verbatim, then list only the checks that failed, with the remedy each one
> gives. If a check failed, do not try to fix it.

### Publish

> You are running the Kreeda marketing *Publish* Cycle. Run exactly:
> `cd marketing && npm ci --silent && node cli.js state init && node cli.js cycle publish`.
> Do not edit any file under `src/` or `cli.js`; do not run any other marketing
> command; do not retry a failed command more than once. If the command exits
> non-zero, stop and report the last 40 lines of output. If
> `marketing/data/outbox/` contains files after the run, send each one as an
> email via the Gmail connector to the address in its `to:` line, with its
> `subject:` line as the subject and the rest as the body, then delete it.
> Report what the command printed under "Run log".

### Morning desk

> You are running the Kreeda marketing *Morning desk* Cycle. First run
> `cd marketing && npm ci --silent && node cli.js state init`. Then, for the
> Analyst, then the Performance Analyst for every Campaign that reached Ended
> or Paused since the last run, then the Media Buyer if there is headroom under
> the Caps: run `node cli.js agent prepare <role>`, read
> `marketing/src/agents/<role>/PROMPT.md` and the prepared input at the path
> `prepare` printed, write your output to the path it named, then run
> `node cli.js agent accept <role>`. You are the Agent. Do not edit any file
> under `src/` or `cli.js`. If `accept` rejects your output, fix the output —
> never the code or the schema — once; if it rejects again, stop and report
> what it said. Report each Agent's output under "Run log".

### Planning

> You are running the Kreeda marketing *Planning* Cycle. First run
> `cd marketing && npm ci --silent && node cli.js state init`. Then run the
> Analyst with `node cli.js agent prepare analyst --full`, then the Strategist,
> then the Chief of Staff, each through the same prepare/accept sandwich: read
> `marketing/src/agents/<role>/PROMPT.md` and the prepared input, write your
> output to the path `prepare` named, then `node cli.js agent accept <role>`.
> Then run `node cli.js cycle creative --horizon 48h`. Email the Briefing at
> `marketing/data/outbox/briefing.md` via the Gmail connector to the address in
> its `to:` line, then delete it. Do not edit any file under `src/` or
> `cli.js`. If `accept` rejects your output, fix the output once; if it rejects
> again, stop and report.

## Why the prompts are shaped this way

ADR 0005 accepted one residual risk: the Producer is deterministic code, but an
LLM session now invokes it. The mitigations are all in these prompts — a single
fixed command, an instruction never to edit code, and no retrying past once —
and the run transcript is how a session that improvised anyway gets caught.
