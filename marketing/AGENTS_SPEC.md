# Kreeda Marketing System — Specification

**Status:** approved for build · **Revised:** 2026-09-04 after the design review (grill session) on Fable 5.1
**Scope:** Twitter/X + Facebook, organic and paid · **Language:** every term below is defined in [`CONTEXT.md`](./CONTEXT.md); decisions that are hard to reverse are in [`docs/adr/`](./docs/adr/)

This revision supersedes the 2026-09-04 morning draft. What changed, in one breath: no GitHub Actions — every Cycle is a Claude routine and the routine session *is* the Agent; state lives on an orphan branch; the hub's rails define Games and Categories; every Campaign is a fixed Trial; three publish Windows a day; media on a GitHub Release; links carry attribution; `played_30s` reaches GA4; the Campaign Monitor is folded into the Producer; no autopublish in v1.

---

## 1. Mission

Grow Players of Kreeda (https://kreeda.games — 29 Games across 7 Categories) through organic Posts and Cap-limited paid Campaigns on X and Facebook, with the CMO approving everything before it goes out, a closed measurement loop (impressions → clicks → sessions → `game_start` → Players), and a weekly Briefing the CMO reads in two minutes.

**North star:** Players (`played_30s`) per Game per week, from GA4.
**Secondary:** link-click CTR per Post and per Campaign; cost per Player for paid; Players per Window and per Category.

---

## 2. Cast

| Role | Kind | Owns |
|---|---|---|
| **CMO** | human | Approvals (merging the Review), the Caps, the answers to "decisions needed". |
| **Producer** | code (`marketing/cli.js` + `src/`) | Scheduling inside a Cycle, policy, publishing, launching, kill rules, Campaign lifecycle, retries, idempotency, the Review, the Run log, Alerts. Never an LLM. |
| **Analyst** | Agent | `insights.json` — what is working, with numbers. |
| **Strategist** | Agent | `weekly-plan.json` + draft Posts — next week's Plan and the paid focus. |
| **Creative** | Agent (Gemini, called by code) | Fills each Post: copy, card, video → In review. |
| **Media Buyer** | Agent | `ads-proposals.json` — Campaign proposals. |
| **Performance Analyst** | Agent | `ads-learnings.json` — Post-mortems, Winner/Loser. |
| **Chief of Staff** | Agent | `artifacts/reports/briefing.md` — the weekly Briefing. |

Agents propose; the Producer executes. Every action in a Run log is attributed to an Agent by name or to "policy".

---

## 3. Runtime: Claude routines (ADR 0005, 0006)

There is **no GitHub Actions workflow**. Three cloud routines in the "Browser Games" environment (`env_011FxiY73spRKKNNboQdie8B`) run the system. Each has a checkout of the repo and the `marketing-state` worktree, the environment's secrets, and a fixed one-paragraph prompt.

| Routine | Cron (UTC) | Model | Does |
|---|---|---|---|
| **Morning desk** | `30 3 * * *` | `claude-sonnet-5` | `prepare analyst` → session writes insights → `accept analyst`; `prepare performance` for any Campaign that reached Ended/Paused since last run → `accept`; if headroom and < `maxActiveCampaigns`: `prepare media-buyer` → `accept`. Commits. |
| **Publish** | `0 9,13,17 * * *` | `claude-sonnet-5` | `node marketing/cli.js cycle publish` — the Producer alone (§5). Then: if the CLI wrote an outbox, send it by Gmail. |
| **Planning** | `0 16 * * 0` | `claude-fable-5-1` | `prepare analyst --full` → `accept`; `prepare strategist` → `accept` (writes Plan + draft Posts); `prepare chief-of-staff` → `accept`; email the Briefing by Gmail; then `cycle creative --horizon 48h` so Monday/Tuesday Posts are In review by Sunday evening. |

**Routine prompt shape (each is self-contained; the cloud session starts with zero context):**
> You are running the Kreeda marketing *Publish* Cycle. Run exactly: `cd marketing && npm ci --silent && node cli.js cycle publish`. Do not edit any file under `src/` or `cli.js`; do not run any other marketing command; do not retry a failed command more than once. If the command exits non-zero, stop and report the last 40 lines of output. If `marketing/data/outbox/` contains files after the run, send each one as an email via the Gmail connector to the address in its `to:` line, with its `subject:` line as the subject and the rest as the body, then delete it. Report what the command printed under "Run log".

The Agent routines add: "Read `marketing/src/agents/<role>/PROMPT.md` and the prepared input at the path `prepare` printed; write your output to the path it named; then run `node cli.js agent accept <role>`. If accept rejects the output, fix the output (not the code) once; if it rejects again, stop and report."

**Secrets** (environment variables of the cloud environment; never in the repo): `TWITTER_API_KEY/SECRET`, `TWITTER_ACCESS_TOKEN/SECRET`, `TWITTER_BEARER_TOKEN`, `GEMINI_API_KEY`, `GEMINI_MODEL`, `FACEBOOK_PAGE_ID`, `FACEBOOK_PAGE_TOKEN` (long-lived Page token), `X_ADS_ACCOUNT_ID`, `X_ADS_CURRENCY`, `X_ADS_USD_TO_LOCAL_RATE`, `X_PIXEL_ID`, `X_PIXEL_TOKEN`, `GA4_PROPERTY_ID=548072389`, `GA4_SA_KEY` (JSON key of `kreeda-ga4-viewer-service-act@browser-games-507002.iam.gserviceaccount.com`), `GH_TOKEN` (push to `marketing-state`, open/read the Review PR, upload release assets), `CMO_EMAIL`.

**Smoke routine (first task of Phase 1):** a one-off routine that runs `node cli.js smoke` and reports: each secret present; HTTPS reachability of api.x.com, ads-api.x.com, graph.facebook.com, generativelanguage.googleapis.com, analyticsdata.googleapis.com, api.github.com; `npx playwright install chromium` succeeds and a 2-second storyboard renders through ffmpeg; `gh auth status` and a push to `marketing-state` work. Nothing else is built until this is green. If Chromium cannot be installed, video rendering becomes the manual `node cli.js media render <postId>` step on the CMO's machine and the Creative queues text-and-card Posts only.

**Local parity:** every command runs identically on the CMO's machine against the same worktree (`git worktree add marketing/data marketing-state`). The Agent prompt files can be followed in a local Claude Code session with the same `prepare`/`accept` sandwich.

---

## 4. State (ADR 0001)

- All state lives on the orphan branch **`marketing-state`**, checked out as a worktree at `marketing/data/`. `main` holds code only and `marketing/data/` is git-ignored there. The site build never sees state.
- **Single writer per file; the Producer is the only committer.** Agent outputs are committed by `accept`, which is Producer code. Push with rebase-and-retry; files never overlap between routines, so merges are clean.
- **Dry-run never mutates state.** No status transitions, no ledger entries, no metrics writes. Dry-run output goes to stdout and to `artifacts/rehearsals/` only.
- **Idempotency:** every outward action records an intent (`intents.json`: id, kind, target, at) *before* the API call; on retry the Producer checks for the intent and, for X, for a tweet with that intent id in the last hour before posting again.
- **Retries:** 429/5xx → exponential backoff, three attempts within the run. Exhausted → the Post is Failed and listed under "needs attention"; retried next Window up to three days past its Slot, then Expired.

| File | Writer | Readers |
|---|---|---|
| `queue.json` | Strategist (drafts via accept), Creative (content), Producer (status) | Producer, Chief of Staff |
| `insights.json` | Analyst | Strategist, Media Buyer, Chief of Staff |
| `weekly-plan.json` | Strategist | Creative, Chief of Staff |
| `ads-proposals.json` | Media Buyer | Producer (launch), Chief of Staff |
| `ads-campaigns.json` (ledger) | Producer only | everyone |
| `ads-learnings.json` (post-mortems) | Performance Analyst | Media Buyer, Chief of Staff |
| `post-metrics.json` (X) · `fb-metrics.json` (Page insights) | Producer (metrics step) | Analyst, Creative |
| `intents.json` · `last-cycle.json` · `review.json` | Producer | Producer |
| `artifacts/reports/run-log.md` · `briefing.md` | Producer · Chief of Staff | the Review, the CMO |
| `outbox/*.md` | Producer | the routine session (sends, then deletes) |

---

## 5. The Producer

### 5.1 `cycle publish` (each Window)
1. **Sync Reviews:** `gh pr list --base marketing-state --state merged` since `review.json.lastSyncedAt`; parse each merged body's checklist; ticked → Approved, unticked → Rejected (reason "rejected in review"). Campaign proposals likewise → `approved`/`rejected`.
2. **Expire:** Posts In review or Approved whose Slot is > 3 days past → Expired. Campaigns past `endsAt` → Ended (they stop consuming headroom).
3. **Creative** for Draft Posts whose Slot is ≤ 48 h out (§6.3). A Creative failure leaves the Post Draft and is listed; **never** template copy.
4. **Publish** every Approved Post whose Slot date ≤ today and Window ≤ this Window: download its Assets from the `media` release, decorate the link (§7), post, record. Threads post reply-by-reply with the intent id on the root.
5. **Launch** every `approved` Campaign proposal (§8.2), in the money-safe order.
6. **Kill rules & lifecycle** on every active Campaign: pull stats; apply `judgeCampaign` (< 3 clicks after the Trial's judging point, CPC > $1.00, CTR < 0.25 %); spend sanity (billed > 120 % of expected for elapsed days → Alert); delivery sanity (active ≥ 24 h with 0 impressions → "stuck" Alert); Paused/Ended written to the ledger.
7. **Metrics:** X non-public metrics for every live tweet; Facebook Page post insights for every live Page post.
8. **Run log** → `artifacts/reports/run-log.md`; **Review** updated (§5.2); **Alerts** → `outbox/` if any of: paused, stuck, spend anomaly, publish Failed, a token < 14 days from expiry.

### 5.2 The Review
- One rolling PR, head `marketing-review`, **base `marketing-state`**, title `Review · <date>`. Body = ⚠️ block (if any) + Run log + checklist.
- Checklist: one `- [x] <id> · <channel> · <game> · <slot>` line per Post In review, followed by the full text and links to its Assets; one per Campaign proposal with brief, budget, targeting, expected outcome. All pre-ticked.
- Before regenerating, the Producer reads the open PR body and **preserves tick state** for ids still listed. Closing the PR without merging changes nothing.
- No in-place edits in v1. Rejection feedback (a PR comment naming the id fed back to the Creative) is v2.
- **Nothing is published or launched without a merged Review. There is no autopublish flag.** Revisit after four consecutive weeks with zero rejections and zero failures, and then only for text-and-card Posts on X; video Posts and Campaigns are gated permanently.

### 5.3 Post record
```jsonc
{ "id": "post-…", "status": "draft|in_review|approved|published|rejected|failed|expired",
  "channel": "x|facebook", "gameId": "", "category": "", "slot": { "date": "2026-09-08", "window": "09|13|17" },
  "format": "single|thread|video|image", "angle": "", "persona": "", "brief": "", "successMetric": "",
  "content": { "text": "", "thread": [], "altText": "" },
  "assets": [ { "kind": "video|square|card", "url": "https://github.com/…/releases/download/media/…" } ],
  "intentId": null, "publishResult": null, "reviewedAt": null, "rejectReason": null, "createdAt": "", "updatedAt": "" }
```

---

## 6. The Agents

Each judgment Agent is the routine session (ADR 0006). Per role, `src/agents/<role>/` holds `PROMPT.md` (system + task), `prepare.js` (gathers inputs into `data/agent-io/<role>.input.json`), `schema.js` (output JSON schema), and `accept.js` (validate → write the role's state file → commit). Malformed output is rejected, never patched; the previous file stands and the Run log says so.

### 6.1 Analyst
- **Cadence:** daily (Morning desk, cheap update); `--full` on Sunday before the Strategist.
- **Inputs:** `post-metrics.json`, `fb-metrics.json`, ledger, post-mortems, GA4 via `src/insights/ga4.js` (Data API, service account): sessions, `game_start`, `game_end` (outcome, duration), `played_30s` (Players) by `game_id`, by `utm_content` (Post), by `utm_campaign` (Category / Campaign), by hour (Window).
- **Output** `insights.json`: window; funnel per Game (impressions, linkClicks, sessions, gameStarts, players, ctrPercent, playRate); per Category; per Window; topAngles with evidence; anomalies; recommendations with confidence; paidReadiness (best Game for spend and why).
- **Rules:** cite numbers in every recommendation; < 100 impressions = "no signal"; sessions with near-zero `game_start` = a landing/tracking problem, not a marketing problem.

### 6.2 Strategist
- **Cadence:** Sunday (Planning).
- **Inputs:** `insights.json`, catalog (Games + Categories from the hub + Dossiers), `audiences.js` personas, queue depth, brand rules (§9), storyboards available, Campaign status.
- **Output** `weekly-plan.json` + one Draft Post per item:
```jsonc
{ "weekOf": "", "strategy": "one paragraph citing insights",
  "items": [ { "slot": { "date": "", "window": "09|13|17" }, "channel": "x|facebook", "gameId": "", "category": "",
               "format": "single|thread|video|image", "angle": "", "persona": "", "brief": "2–3 sentences", "successMetric": "" } ],
  "adsFocus": { "gameId": "", "category": "", "angle": "", "rationale": "" },
  "experiments": [ "at most one hypothesis per week" ] }
```
- **Rules:** 5–7 Posts per Channel per week (X free-tier write budget); no Game more than twice a week; every angle traces to an insight or is labelled an experiment; the Strategist chooses the mix across Categories and Windows itself — **no hard-coded balancing rules**. The Mon–Sun table in `campaignPlanner.js` is deleted.

### 6.3 Creative (Gemini, called by the Producer)
- **Cadence:** every Publish Cycle for Draft Posts ≤ 48 h out; after Planning for Monday/Tuesday.
- **Inputs:** the Post's brief, the Dossier, brand rules, the three best-performing past texts for that Game as few-shot (from metrics), plus the curated Play-together lines formerly in `togetherPromoter.js` as few-shot for that Category.
- **Outputs:** `content`, Assets uploaded to the `media` release (ADR 0003), status → In review.
- **X:** ≤ 280 chars or a thread; ≤ 2 hashtags, after the link. **Facebook:** longer-form, its own `facebookPost` prompt (never the tweet prompt). **Images:** SVG card from `visualStudio.js` → PNG via Playwright screenshot. **Video:** `videoStudio.generateTogetherVideo` for storyboarded Games; `generateGameplayVideo` where footage is presentable; rendered at creative time so the Review can play it.
- **Rules:** live mode never publishes fallback copy; on failure the Post stays Draft and is listed. Play-together copy leads with the relationship benefit, never the one-phone mechanic (sanitizer kept, moved into `accept`-style validation of the Creative's output).

### 6.4 Media Buyer
- **Cadence:** Morning desk, when headroom under the Caps and < `maxActiveCampaigns` active.
- **Inputs:** `insights.json` (pick Games that *retain*, not just click), post-mortems, active Campaigns, available Assets, headroom.
- **Output:** a proposal appended to `ads-proposals.json`:
```jsonc
{ "id": "prop-…", "proposedAt": "", "status": "proposed|approved|launched|rejected", "channel": "x",
  "gameId": "", "category": "", "angle": "", "tweetText": "", "headline": "",
  "creative": { "type": "video|text", "assetUrl": null },
  "targeting": { "ageBucket": "", "interests": [], "keywords": [], "countries": [] },
  "budget": { "dailyUsd": 0, "trialDays": 3, "totalCapUsd": 0, "suggestedBecause": "" },
  "expectedOutcome": { "estClicks": 0, "estCpcUsd": 0, "estPlayers": 0, "basis": "" } }
```
- **Budget rules (the Agent proposes, `adsPolicy.js` disposes):** never above the Caps; first Campaign for a Game starts at **$5/day**; up to double the previous budget (still ≤ $10/day) only for a Game+angle whose last Post-mortem is Winner; two consecutive Losers for a Game → propose $0 and say what must change; a Campaign promotes **one hero Game** with the Category's promise as its angle. Facebook Campaigns are out of scope until X has four judged Trials.

### 6.5 Performance Analyst
- **Cadence:** Morning desk, for every Campaign that reached Ended or Paused since the last run; weekly aggregate on Sunday.
- **Inputs:** ledger stats, GA4 sessions and Players attributed to the Campaign (utm_campaign = Campaign id, plus twclid), the creative.
- **Output:** a Post-mortem appended to `ads-learnings.json`: promised (`expectedOutcome`) vs delivered; cost per Player; verdict on the *angle* separately from the *Game*; label **Winner | Loser**; one thing to do differently. Mandatory input to the next Media Buyer call.

### 6.6 Chief of Staff
- **Cadence:** Sunday (Planning), after the Strategist.
- **Inputs:** everything, plus last week's Briefing for trend continuity.
- **Output:** `artifacts/reports/briefing.md`, ≤ 1 page: (1) headline numbers — Players, sessions, spend, cost per Player, each with WoW delta; (2) what we did — Posts per Channel, Campaigns run; (3) what worked / what didn't — three bullets each with numbers; (4) decisions the system took; (5) decisions needed from the CMO (pending Reviews, budget, blockers such as token expiry); (6) next week's Plan in three lines. Also written to `outbox/briefing.md` (to `CMO_EMAIL`) and used as the Sunday Review body.
- **Rules:** no vanity framing; every claim traceable to a state file.

---

## 7. Attribution and measurement

- **Agents write bare catalog URLs.** At publish time the Producer appends `utm_source=x|facebook`, `utm_medium=organic|paid`, `utm_campaign=<category>` (organic) or `<campaign id>` (paid), `utm_content=<post id>`. X counts every link as 23 chars; `analytics.js` derives the Game from the path, so nothing on site changes.
- **`played_30s` is a GA4 event** (done 2026-09-04 in `analytics.js`, pinned by `verify/analytics.sh`): once per Game page at 30 s of active visible play, never from the hub; also sent to the X pixel. Marked as a key event in GA4 property 548072389 on 2026-09-04.
- **GA4 access:** `src/insights/ga4.js` on the Data API with a service account (Viewer on the property), key in `GA4_SA_KEY`. If a Google Analytics connector becomes available on claude.ai, the Analyst routine may use it directly; the file format of `insights.json` does not change.

---

## 8. Paid: policy and lifecycle (ADR 0004)

### 8.1 Frozen policy (`adsPolicy.js`)
Caps: ≤ $10/day per Campaign, ≤ $25/day total; env can lower, never raise. Trial = 3 days; every Campaign gets `endsAt = launch + 3 days` and a total budget of `daily × 3`. Kill rules after the judging point (day 2): < 3 link clicks, CPC > $1.00, CTR < 0.25 %. No Campaign is ever extended or scaled in place.

### 8.2 Money-safe launch (fix before any live Campaign)
`launch()` order: probe access → create Campaign **PAUSED** → **persist the ledger record immediately** → create line item PAUSED → attach targeting → post the ad tweet (with Asset) → promote tweet → activate campaign and line item last. Any failure after the ledger write leaves a visible, paused, un-billed record the next Cycle can clean up. `xAdsClient.js` maps `INSUFFICIENT_USER_AUTHORIZED_PERMISSION` and every 403 auth-family code to `AdsApiAccessError` so the Cycle reports `blocked`, not `failed`.

### 8.3 Account facts
X Ads account `18ce55x74gq`, app `33371607`. As of 2026-09-04 the probe fails with `INSUFFICIENT_USER_AUTHORIZED_PERMISSION` → approval has likely landed; **regenerate the X access token** before live Campaigns and confirm with `ads-preflight`.

---

## 9. Brand and content rules (enforced in code where possible)
1. Play-together Games: lead with what two people find out about each other, never the one-phone mechanic.
2. Never generic AI marketing: no rocket emoji, no "game-changer", no exclamation-mark hype.
3. Ads: no hashtags, no @mentions, bare catalog URL (the Producer decorates), ≤ 240 chars.
4. Organic: ≤ 2 hashtags, after the link.
5. Honest copy only: no invented quotes, player counts, or awards.

---

## 10. Games and Categories (ADR 0002)
- **The hub is the source of truth.** `catalog.js` parses `index.html` rails at load: rail id → Category, links → Games. The seven Categories: Fast action, Play together, Friends circle, Daily study grids, Head-to-head, Solo arcade, Sports and racing.
- The catalog keeps a hand-written **Dossier** per Game. A test fails when a Game on the hub has no Dossier. **Nine Dossiers are missing** and must be written in Phase 1: `circle`, `prism`, `alibi`, `herd`, `alter`, `lore`, `capsule` (Friends circle), `isomer`, `wattage` (Daily study grids).
- No Category is special: the cadence-based Play-together promoter and `together-state.json` are deleted; the Strategist plans videos like any other Post.

---

## 11. Facebook lane (Phase 1)
A Page exists and the CMO is its admin. The token on file was a short-lived Explorer token (expired 2026-09-03). Build: `node cli.js fb token` exchanges a short-lived user token → long-lived user token → **long-lived Page token** (no expiry while admin) and prints it for the environment secret; preflight reads `debug_token` for expiry and role; Graph API v21+; text posts via `/{page}/feed`, videos via `/{page}/videos`; Page post insights into `fb-metrics.json`; the Chief of Staff lists token problems under decisions needed. README: the "personal account" guidance is wrong and is deleted.

---

## 12. Delete list (Phase 1)
`.github/workflows/marketing-agent.yml` and every Actions-only secret; `dashboard/` and the `dashboard` command; `src/scout/`, `opportunities.json`, the `scout` command and prompts; per-generation dumps under `artifacts/twitter|facebook|devto|reddit|shorts` and the `saveArtifact` path; `src/telemetry/tracker.js`; Reddit/HN/Dev.to/Product Hunt/short-video prompts; the `campaign` bundle command; `startDaemon`; the `secrets` guide command; `campaignPlanner.js` (after the Strategist lands); `togetherPromoter.js` as a publisher (its copy becomes few-shot; `promote-together` becomes "queue a video Post for Review"); `together-state.json`; `autopublish`; the `scheduled` and `draft_published` statuses. Rewrite `README.md` and `.env.example` from scratch for this design.

---

## 13. Tests
`node --test` under `marketing/tests/`: every test runs against a temp state dir and a stubbed network (no real X/FB/Gemini/GA4). Cover: catalog parses the hub and flags missing Dossiers; Post lifecycle and expiry; Review tick parsing and preservation; link decoration; policy clamps and kill rules; launch ordering with a simulated mid-launch crash; idempotent retry; `accept` rejecting malformed Agent output. Fix the stale Reddit assertion. Tests run locally and in an on-demand `verify` routine, never inside the Publish path.

---

## 14. Build order and definition of done

1. **Foundations.** Smoke routine (§3) first. Then: `marketing-state` branch + worktree; the delete list; hub-driven catalog + nine Dossiers; tests on temp state; §8.2 launch fixes; X token regenerated until `ads-preflight` is green; long-lived Facebook Page token + lane (§11). **Done:** smoke green, preflight green on both Channels, `npm test` green.
2. **Producer and Creative.** §5 in full, §6.3, media release, link decoration, Alerts via outbox, the Publish routine live. **Done:** a hand-written Plan flows through Review to a live Post on each Channel.
3. **Analyst and Strategist.** prepare/accept framework, `ga4.js`, §6.1, §6.2, the Planning routine (Chief of Staff step stubbed to the Run log). **Done:** a Sunday run produces a Plan the CMO approves without editing.
4. **Paid.** §6.4, §6.5, the Morning desk routine, first $5/day Campaign after an approved proposal. **Done:** one Trial Ended with a Post-mortem.
5. **Chief of Staff.** §6.6 and the emailed Briefing. Then Facebook Campaigns once X has four judged Trials; then per-angle card variants and a real scout source (HN Algolia) if wanted.

**Per phase:** dry-run of every Cycle passes, `npm test` green, the Review renders correctly, no state file written by more than one component.

---

## 15. CMO to-dos before Phase 2
- ~~Create the GA4 service account and mark `played_30s` as a key event~~ — done 2026-09-04: `kreeda-ga4-viewer-service-act@browser-games-507002.iam.gserviceaccount.com`, key event created. Remaining: grant it **Viewer** under GA4 Admin → Property access management, and add its JSON key as `GA4_SA_KEY` with `GA4_PROPERTY_ID=548072389` to the cloud environment.
- Add every secret in §3 to the "Browser Games" cloud environment, including a `GH_TOKEN` that can push `marketing-state`, manage PRs, and upload release assets.
- Regenerate the X access token; run `fb token` once for the long-lived Page token.

## 16. Resolved decisions (2026-09-04)
GA4 access → service account in `ga4.js` (connector optional later) · autopublish → none in v1 · Briefing delivery → state branch + Sunday Review + Gmail · Facebook → Page confirmed, lane in Phase 1 · scheduler → Claude routines, no Actions · Agents → the routine session with prepare/accept · Campaign Monitor → folded into the Producer.
