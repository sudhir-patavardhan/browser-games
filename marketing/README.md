# Kreeda Marketing

The system that grows Kreeda's player base by publishing organic content and
running paid promotion on X and Facebook, measuring what each one earns, and
reporting to a human who approves before anything goes out.

Every capitalised term here is defined in [`CONTEXT.md`](./CONTEXT.md).
Decisions that are hard to reverse are in [`docs/adr/`](./docs/adr/). What is
being built, and in what order, is [`AGENTS_SPEC.md`](./AGENTS_SPEC.md).

## How it works

The **CMO** owns the brand and the budget and approves everything. The
**Producer** is the deterministic code in `cli.js` and `src/` — it publishes,
launches, enforces the Caps and the kill rules, and writes the Run log. It is
never an LLM. Six **Agents** supply judgment: the Analyst, the Strategist, the
Creative, the Media Buyer, the Performance Analyst and the Chief of Staff.

Agents propose; the Producer executes. **Nothing is published or launched
without a merged Review**, and there is no autopublish.

Work happens in three **Cycles**, each a scheduled Claude routine
(ADR&nbsp;0005) rather than a GitHub Actions job:

| Cycle | When (UTC) | What it does |
|---|---|---|
| Morning desk | `30 3 * * *` | The Analyst reads the funnel; the Performance Analyst writes Post-mortems; the Media Buyer proposes Campaigns. |
| Publish | `0 9,13,17 * * *` | The Producer alone: sync merged Reviews, fill Drafts, publish due Posts, launch approved Campaigns, apply the kill rules, pull metrics, write the Run log. |
| Planning | `0 16 * * 0` | The Strategist writes next week's Plan; the Chief of Staff writes the Briefing. |

Each routine's session *is* the Agent (ADR&nbsp;0006): for each role the CLI
offers `prepare`, which gathers every input into one file, and `accept`, which
validates the output against the role's schema and commits it. The Creative is
the exception — a Gemini call made by code, because it is per-Post and needs
rendering tools.

## Setting up

```sh
cd marketing
npm ci
cp .env.example .env          # then fill it in; see the table in .env.example
node cli.js state init        # ADR 0001 — see "Where state lives" below
node cli.js smoke             # must be green before anything else
```

`smoke` is the gate. It reports every secret as present or missing without
printing one, probes each host a Cycle calls, renders a two-second storyboard
through Chromium and ffmpeg the way the Creative renders a Post's video Asset,
and proves the Producer can push to `marketing-state`. It exits non-zero when
a Cycle could not do its job.

## Where state lives

State — the Post queue, the Campaign ledger, metrics, Agent outputs, Run logs,
the Briefing — is **not on `main`**. It lives on the orphan branch
`marketing-state`, checked out as a git worktree at `marketing/data/`
(ADR&nbsp;0001). `main` holds code only, so a daily Cycle rewriting the queue
never rebuilds the public site and no code branch carrying a stale copy can
rewind live state on merge.

`node cli.js state init` sets that up and is idempotent, so a routine can call
it at the start of a Cycle. The daily Review targets `marketing-state`.

Rendered media does not go into git at all: the Creative uploads each MP4 and
PNG card as an Asset on a rolling GitHub Release named `media`, and the
Producer downloads that exact file at publish time (ADR&nbsp;0003).

## The Review

One rolling pull request, head `marketing-review`, base `marketing-state`,
titled `Review · <date>`. Its body is the Run log plus a checklist: one
pre-ticked line per Post awaiting a decision and one per Campaign proposal.
Merging it approves every ticked item and rejects every unticked one. Closing
it without merging changes nothing.

## Money

The Caps are frozen in code: **$10/day per Campaign, $25/day in total**.
Configuration can lower them and never raise them. Every Campaign is a
fixed three-day **Trial** and always ends (ADR&nbsp;0004) — a good one earns a
**Winner** label in its Post-mortem, which makes the Media Buyer eligible to
propose a fresh, larger Campaign. Nothing is extended or scaled in place.

## Games and Categories

The hub page is the source of truth (ADR&nbsp;0002): `src/knowledge/catalog.js`
reads the rails in the site's `index.html` to learn which Games exist and which
of the seven Categories each is in. Marketing adds only a hand-written
**Dossier** per Game — its pitch, hooks, mechanics and audiences. A test fails
when a Game is on the hub without a Dossier.

## Commands

`node cli.js help` lists them all. The ones that matter day to day:

| Command | Does |
|---|---|
| `smoke` | Can this machine run a Cycle? |
| `state init` | Open and check out `marketing-state`. |
| `status` | Which Channels the Producer can reach. |
| `queue` | The Posts awaiting a decision. |
| `report` | The last Run log. |
| `ads-preflight` | Whether a Campaign can go live. |
| `ads-status` | The Caps, and every active and paused Campaign. |

Anything that talks to a Channel is a dry run unless you pass `--live`.

## Tests

```sh
npm test
```

Every test runs against a temporary state directory and a stubbed network — no
test reaches X, Facebook, Gemini or GA4. They run locally and in an on-demand
`verify` routine, never inside a Publish Cycle.
