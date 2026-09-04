# Kreeda Marketing

The system that grows Kreeda's player base by publishing organic content and running paid promotion on Twitter/X and Facebook, measuring what each one earns, and reporting to a human who approves before anything goes out.

## Language

**Campaign**:
A paid promotion of one game with one creative angle on one channel (X or Facebook), running under a fixed daily budget for a fixed period.
_Avoid_: using "campaign" for organic work; "weekly campaign"; "launch campaign"

**Plan**:
The week's organic calendar: which game, angle, and format goes on which channel on which day, and why.
_Avoid_: campaign, calendar, schedule

**Post**:
One unit of organic content for one channel — a single tweet, a thread, a video post, or a Facebook post. A Post moves through review and approval before it is published.
_Avoid_: queue item, campaign item, content

**Channel**:
A destination where Posts and Campaigns run. There are two: Twitter/X and Facebook.
_Avoid_: platform, network

## Roles

**CMO**:
The human who owns the brand and the budget. Approves Posts and Campaigns, sets spend caps, and answers the decisions the system cannot make alone.
_Avoid_: the human, the operator, the user

**Producer**:
The deterministic part of the system. Runs the calendar, enforces policy, publishes approved Posts, launches approved Campaigns, watches running Campaigns against the kill rules, and writes the daily run log. Never an LLM; never decides strategy.
_Avoid_: orchestrator, the agent, the runner, campaign monitor

**Agent**:
A role with a strict output contract that a Claude session plays by following that role's prompt. The Producer prepares the Agent's inputs and accepts its output only if it validates; an Agent proposes, and only the Producer executes. There are six: Analyst, Strategist, Creative, Media Buyer, Performance Analyst, Chief of Staff. The Creative alone is a model call made by code rather than the session.
_Avoid_: the agent (for the whole system), bot, model, API call

**Analyst**:
The Agent that reads the whole funnel — impressions to retained players — and says what is working, with numbers.

**Strategist**:
The Agent that writes next week's Plan and names the game and angle paid money should go to.

**Creative**:
The Agent that turns a Plan slot into a finished Post: copy, card, and video.
_Avoid_: copywriter, content generator

**Media Buyer**:
The Agent that proposes a Campaign: game, angle, creative, targeting, and budget.
_Avoid_: campaign creator, campaign planner

**Performance Analyst**:
The Agent that writes a Campaign's post-mortem once it has ended: what was promised versus delivered, cost per player, and what to change next time.
_Avoid_: effectiveness analyst, learner

**Chief of Staff**:
The Agent that writes the CMO's weekly briefing: headline numbers, what worked, what the system decided, and the decisions only the CMO can make.
_Avoid_: executive reporter, reporter

**Cycle**:
One scheduled run of the system as a Claude routine. There are three: the **Morning desk** (daily before dawn UTC: analysis, post-mortems, and Campaign proposals), **Publish** (at each Window: the Producer alone), and **Planning** (Sunday: next week's Plan and the Briefing).
_Avoid_: run, loop, job, workflow

## Review and approval

**Review**:
The daily checklist the Producer puts in front of the CMO: every Post and Campaign proposal awaiting a decision, with full text and media. Merging the Review approves every ticked item and rejects every unticked one. Nothing is published or launched without a merged Review.
_Avoid_: the PR, auto-update PR, approval PR

**Slot**:
The day, Window, and Channel a Post is meant for. A Post is due when its Slot has arrived and it is approved. The Strategist picks the Slot.
_Avoid_: scheduled date, publish time

**Window**:
One of the three times of day the Producer publishes: 09:00, 13:00, and 17:00 UTC. The Analyst reports what each Window earns so the Strategist can choose between them.
_Avoid_: best time, cron slot

**Post lifecycle**:
Draft (the Strategist named the slot) → In review (the Creative finished it) → Approved (the CMO ticked it) → Published. Side exits: Rejected (unticked in Review), Failed (the channel refused it after retries), Expired (its Slot passed more than three days ago without a decision or a successful publish).
_Avoid_: scheduled, draft_published, ready_for_review as spoken terms

## Games

**Game**:
One playable page on kreeda.games. Every Post and every Campaign is about exactly one Game.

**Category**:
A rail on the hub page. There are seven: Fast action, Play together, Friends circle, Daily study grids, Head-to-head, Solo arcade, Sports and racing. A Game belongs to the rail it appears on; the hub is the only source of truth for which Games exist and which Category they are in.
_Avoid_: genre, tag, "together games" as a marketing-only grouping

**Dossier**:
Marketing's hand-written knowledge about one Game: pitch, hooks, mechanics, audiences. A Dossier describes a Game; it never decides whether the Game exists or which Category it is in.
_Avoid_: catalog entry

**Asset**:
A rendered file that travels with a Post or Campaign: a video, a square video variant, or a card image. The Creative makes it once; the CMO previews that exact file; the Producer publishes that exact file.
_Avoid_: artifact, media file, upload

## Measurement

**Player**:
A visitor who reached thirty seconds of active, visible play on one Game's page. The north-star metric is Players per Game per week. Counted by the `played_30s` event, which reaches GA4 for every visitor and the X pixel for visitors an ad brought.
_Avoid_: user, session, visitor, conversion (when Player is meant)

**Attribution**:
Knowing which Post or Campaign brought a Player. Every published link carries the channel, whether it was organic or paid, the Category or Campaign, and the Post id; the Analyst reads Players back per Post and per Campaign from GA4.

## Paid

**Trial**:
The fixed three-day life of every Campaign. A Campaign always ends when its Trial ends; nothing extends one in place.
_Avoid_: flight, run, always-on

**Kill rules**:
The policy the Producer applies to a running Campaign: too few clicks, cost per click too high, click-through too low, or no delivery at all. Breaking one pauses the Campaign before its Trial ends.
_Avoid_: judge, verdict thresholds

**Verdict**:
How a Campaign's Trial finished: Paused (a kill rule fired) or Ended (it ran its course).
_Avoid_: keep, too_early

**Post-mortem**:
The Performance Analyst's write-up of one finished Campaign: what was promised versus delivered, cost per Player, and a label of Winner or Loser for the game-and-angle pair. A Winner is eligible for a follow-up Campaign at a higher budget, still under the caps.
_Avoid_: learnings, lessons

**Caps**:
The spend ceilings frozen in code: ten dollars a day per Campaign, twenty-five a day in total. Configuration can lower them and never raise them.
_Avoid_: budget (when the ceiling is meant), limits

## Reporting

**Briefing**:
The Chief of Staff's weekly one-page readout to the CMO: headline numbers with week-over-week deltas, what was done, what worked and what did not, what the system decided, and the decisions only the CMO can make. Committed, posted on the Sunday Review, and emailed.
_Avoid_: executive summary, report, weekly report

**Run log**:
The Producer's account of one Cycle, written for operators: what was published, launched, paused, retried, or skipped, and why. Becomes the body of the daily Review.
_Avoid_: cycle report, latest.md

**Alert**:
An email the Producer sends only when something needs the CMO now: a Campaign paused or stuck, a publish that failed after retries, a token about to expire. A quiet day sends nothing.
_Avoid_: notification, warning block

## Flagged ambiguities (resolved 2026-09-04)

- **"Campaign"** was used for the weekly organic calendar, a one-game bundle of organic deliverables, and paid X Ads. It now means paid only. The weekly calendar is the Plan; one organic unit is a Post.
- **"The agent"** named the whole system, and "agents" named the LLM roles. The whole system has no name; the code is the Producer, each LLM role is an Agent, one scheduled run is a Cycle.
- **"Play-together"** was treated as a special lane with its own cadence and state. It is one Category among seven; the Strategist plans it like the rest.
- **"Keep"** as a Campaign verdict suggested a Campaign could continue. Every Campaign is a fixed Trial; a good one is a Winner in its Post-mortem, which earns a new Campaign, not a longer one.

## Example dialogue

**Dev:** The Strategist put a Deep Talk video in Tuesday's 17:00 Slot on Facebook. Who makes the video?
**CMO:** The Creative. It renders the storyboard, uploads the Assets, writes the Facebook copy, and the Post lands In review.
**Dev:** And it goes out Tuesday at 17:00?
**CMO:** Only if I've merged the Review with that Post ticked. If I haven't by then, it waits for the next Window. If I never do, it expires after three days and the Strategist fills the gap next Sunday.
**Dev:** The Media Buyer proposed a Campaign for Deep Talk too, at five dollars a day. Same Review?
**CMO:** Same Review, its own checkbox. When I merge, the Producer launches it. Three days later it Ends whatever happens, the Performance Analyst writes the Post-mortem, and if it's a Winner the Media Buyer can propose a bigger one.
**Dev:** Where do I see whether it actually got anyone playing?
**CMO:** Players. The Analyst counts `played_30s` per Game, and because the link carried the Campaign id, it can say how many of those Players that Campaign bought. It'll be in Sunday's Briefing, with the cost per Player.
