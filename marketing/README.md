# 🎯 Kreeda Autonomous Marketing Agent

An autonomous AI marketing and community growth agent designed to continuously expand the user base of **Kreeda** (`https://kreeda.games`) and its 12 single-file browser games.

The agent handles **content generation, visual social card creation, community opportunity scouting, multi-channel scheduling, and automated or human-in-the-loop publishing**.

---

## ⚡ Quick Start

```bash
# 1. Check current connection status & configured channels
node marketing/cli.js status

# 2. Generate a 7-day marketing campaign calendar
node marketing/cli.js plan

# 3. Generate high-res 1200x630 visual social cards for all 12 games
node marketing/cli.js studio

# 4. Scout community discussions & draft helpful contextual replies
node marketing/cli.js scout

# 5. Record a real gameplay clip and post it as a video tweet
node marketing/cli.js promote-video --game drift --live

# 5b. Film the next Play-together game (Sync, Windows, …) and post the video
node marketing/cli.js promote-together --live

# 6. Launch the local interactive web dashboard
node marketing/cli.js dashboard
# 👉 Open in browser: http://localhost:3030
```

**One-time setup for video generation**: after `npm install`, also run `npx playwright install chromium` to download the headless browser used to record real gameplay footage. MP4 conversion uses a bundled static ffmpeg binary (`ffmpeg-static`), so no separate ffmpeg install is needed.

---

## 🔑 Account Access & Credentials Guide

To enable automated posting across different platforms, create a `.env` file in the `marketing/` directory (see [`marketing/.env.example`](.env.example)) and add your API keys:

### 1. Google Gemini API (Required for Autonomous Content & Lead Analysis)
- **Why**: Powers the copy generation, tone tailoring, viral hook drafting, and community query analysis.
- **How to get**:
  1. Go to [Google AI Studio](https://aistudio.google.com/app/apikey).
  2. Click **Create API Key**.
  3. Set `GEMINI_API_KEY=your_key_here` in `marketing/.env`.
- *Note: If no API key is set, the agent operates in deterministic fallback mode.*

---

### 2. Twitter / X API (For Tweets, Feature Threads & Daily Challenges)
- **Why**: Posts promotional tweets, dev log threads, and daily drift challenges directly to your X account.
- **How to get**:
  1. Sign up / log in at the [X Developer Portal](https://developer.x.com/).
  2. Create a new **Project & App**.
  3. Under **User authentication settings**, enable OAuth 1.0a / OAuth 2.0 with **Read and Write** permissions.
  4. Generate and copy your **API Key**, **API Secret**, **Access Token**, and **Access Token Secret**.
  5. Add to `marketing/.env`:
     ```env
     TWITTER_API_KEY=...
     TWITTER_API_SECRET=...
     TWITTER_ACCESS_TOKEN=...
     TWITTER_ACCESS_TOKEN_SECRET=...
     TWITTER_BEARER_TOKEN=...
     ```

---

### 3. Reddit API (For r/webgames, r/indiegames, r/javascript)
- **Why**: Submits value-first showcases and technical post-mortems to relevant gaming subreddits.
- **How to get**:
  1. Log into Reddit and navigate to [reddit.com/prefs/apps](https://www.reddit.com/prefs/apps).
  2. Click **create another app...** (at the bottom).
  3. Choose **script** (for personal use script).
  4. Name it `KreedaGrowthAgent`, set redirect URI to `http://localhost:8080`.
  5. Copy the **Client ID** (string under the app name) and **Client Secret**.
  6. Add to `marketing/.env`:
     ```env
     REDDIT_CLIENT_ID=...
     REDDIT_CLIENT_SECRET=...
     REDDIT_USERNAME=...
     REDDIT_PASSWORD=...
     REDDIT_USER_AGENT=KreedaGrowthAgent/1.0 by your_username
     ```

---

### 4. Discord Webhooks (For Community Announcements & Team Alerts)
- **Why**: Broadcasts new game releases, daily drift records, or campaign notifications into your Discord server.
- **How to get**:
  1. In your Discord server, go to **Server Settings** ➔ **Integrations** ➔ **Webhooks**.
  2. Click **New Webhook**, select the target channel, and click **Copy Webhook URL**.
  3. Add to `marketing/.env`:
     ```env
     DISCORD_WEBHOOK_URL=https://discord.com/api/webhooks/...
     ```

---

### 5. Dev.to / Hashnode (For Technical Engineering Devlogs)
- **Why**: Publishes deep-dive engineering articles explaining how single-file 0-dependency games and WebAudio synthesizers are built.
- **How to get**:
  1. Log into [Dev.to](https://dev.to/settings/extensions).
  2. Scroll down to **DEV Community API Keys**, generate a new key, and copy it.
  3. Add to `marketing/.env`:
     ```env
     DEVTO_API_KEY=...
     ```

---

### 6. Universal Webhook (Buffer, Make.com, Zapier, n8n)
- **Why**: Connects to Instagram, TikTok, LinkedIn, or Mastodon via multi-platform schedulers like Buffer or Make.
- **How to get**:
  1. Create a Webhook trigger in Make / Zapier / n8n or grab a Buffer Access Token.
  2. Add to `marketing/.env`:
     ```env
     GENERIC_WEBHOOK_URL=https://hook.eu1.make.com/...
     ```

---

## 🛠️ CLI Commands & Usage

| Command | Description |
| :--- | :--- |
| `node marketing/cli.js status` | Inspects platform connection and credential status |
| `node marketing/cli.js plan` | Generates a 7-day marketing schedule with diverse game spotlights |
| `node marketing/cli.js generate --game <id> --channel <ch>` | Generates targeted copy for a single game and channel (e.g. `twitter`, `reddit`, `hackernews`, `shorts`, `devto`) |
| `node marketing/cli.js campaign --game <id>` | Generates a full 360° launch campaign across all channels |
| `node marketing/cli.js studio` | Generates 1200x630 SVG social preview cards for all 12 games |
| `node marketing/cli.js scout` | Scans community discussion topics and drafts high-relevance replies |
| `node marketing/cli.js queue` | Displays all pending, scheduled, and approved campaign posts |
| `node marketing/cli.js approve <id>` | Approves a drafted/scheduled post for publication |
| `node marketing/cli.js publish <id> [--live]` | Publishes a post (dry-run by default; `--live` for real API call) |
| `node marketing/cli.js process-due [--live]` | Publishes all approved items due today or earlier |
| `node marketing/cli.js run-autonomous [--daemon]` | Runs one full marketing loop (or runs continuously as background daemon) |
| `node marketing/cli.js video --game <id>` | Records a gameplay clip; Play-together games are filmed from their storyboard (1080×1920 + square) |
| `node marketing/cli.js promote-together [--game <id>] [--live]` | Films the next Play-together game in rotation and posts the video to X |
| `node marketing/cli.js metrics` | Pulls impressions / link clicks for the tweets the agent posted live |
| `node marketing/cli.js ads-preflight` | Readiness checklist for going live with X Ads |
| `node marketing/cli.js report` | Prints the latest cycle report (the body of the auto-update PR) |
| `node marketing/cli.js dashboard` | Starts the interactive web dashboard on `http://localhost:3030` |

---

## 🎬 Play-together videos

The five Play-together games (Sync, Windows, Split, The Auction, Fathom) can't be filmed by mashing arrow keys — they need two names typed, a pack chosen, cells tapped and a phone handed over. So each gets a **storyboard** in `src/studio/togetherDirector.js`: a real session driven through the real UI at a human pace, at a phone-sized viewport, with captions laid over the top and a branded end card. The captions tell the story the ad needs — *what the two people find out about each other* — never the one-phone mechanic.

- Output: a 1080×1920 vertical master and a 1080×1080 square variant (vertical frame over a blurred copy of itself) in `artifacts/videos/` — git-ignored, uploaded as a workflow-run artifact.
- Copy: Gemini writes the post from the same relationship-first brief (`togetherVideoPost`); without a key, each game has a hand-written fallback in `FALLBACK_COPY`. At most two hashtags, after the link.
- Cadence: the autonomous cycle films the next game in rotation every `TOGETHER_VIDEO_CADENCE_DAYS` (default 2); the workflow also has a Tue/Fri 15:00 UTC slot dedicated to it. State: `data/together-state.json`.
- Storyboards exist for **sync** and **windows**; add one per game to `STORYBOARDS` (a `run(api, [nameA, nameB])` function using `api.tap / fill / tapWord / cap / hold / scrollBy / end`).

```bash
node marketing/cli.js video --game sync              # film only
node marketing/cli.js promote-together               # film next in rotation, write copy, draft the post
node marketing/cli.js promote-together --game windows --live
```

## 📈 Organic feedback loop

`metrics` (also step 7 of every cycle) pulls `public_metrics` + `non_public_metrics` for every tweet the agent posted live — queue posts, together videos, ad tweets — into `data/post-metrics.json`, and summarizes them per game (impressions, link clicks, CTR, engagement). The ads planner reads that summary alongside the paid learnings, so the agent learns which games and angles earn clicks **before** a rupee is spent, and while the Ads API approval is still pending.

---

## 💸 Paid Campaigns on X (Ads)

The agent can run paid "Website traffic" campaigns on X and manage them daily, under a hard spend policy:

| Rule | Value |
| :--- | :--- |
| Per-campaign budget | **≤ $10/day** (env can lower it, never raise it) |
| Total across all active campaigns | **≤ $25/day** |
| Trial window | **2 days**, then analytics decide: keep, or pause |
| Kill rule after the trial | < 3 link clicks, or CPC > $1.00, or CTR < 0.25% |
| Backstop | every campaign also gets a total budget cap and an end time of trial + 1 day, so it cannot outspend the trial even if a daily run is missed |

Each daily cycle (`ads-cycle`, also part of `run-autonomous`) does:

1. **Review** — pulls impressions / link clicks / spend for every active campaign from the Ads analytics API and pauses anything that failed its trial.
2. **Learn** — folds results into `data/ads-learnings.json` (per-game aggregates plus Gemini-written lessons).
3. **Plan & launch** — asks Gemini for the next brief (game, angle, hashtag-free ad copy, age bucket, interests, keywords) given those learnings, the organic metrics, and what's already running, then posts the ad tweet and creates campaign → ad group → targeting → promoted post. A Play-together brief is launched **with its storyboard video** as the creative. Launch is skipped when the active budget already fills the cap, and a live launch checks API access *before* posting the ad tweet so a failed launch never leaves an orphan tweet.

```bash
node marketing/cli.js ads-preflight                    # keys, approval, funding, currency, storyboards, headroom
node marketing/cli.js ads-status                       # policy, access check, active/paused campaigns
node marketing/cli.js ads-launch --game sync --daily 8 # one campaign (dry-run; add --live to spend)
node marketing/cli.js ads-review --live                # pull analytics and pause trial failures
node marketing/cli.js ads-cycle --live                 # review → learn → plan+launch
```

While the approval is pending, every cycle still rehearses a launch (one simulated record per game per day, last ten kept) so the brief-writing and video pipeline are exercised daily.

**Setup**: set `X_ADS_ACCOUNT_ID` (from the Ads Manager URL) plus the currency/rate variables in `.env` (see `.env.example` §9). The developer app must be approved for the Ads API — request it at https://docs.x.com/forms/ads-api-access, then regenerate the access token; until then `ads-status` reports `UNAUTHORIZED_CLIENT_APPLICATION` and cycles run as dry-runs.

State lives in `data/ads-campaigns.json` (ledger of every campaign with its stats history) and `data/ads-learnings.json`.

---

## 🖥️ Local Web Review Dashboard

Launch the zero-dependency interactive dashboard:

```bash
node marketing/cli.js dashboard
```

- **Campaign Queue**: View scheduled posts by channel, edit, approve, or 1-click copy text & hashtags to clipboard.
- **Opportunity Scout**: Browse qualified leads and 1-click copy personalized recommendations.
- **Visual Studio**: Preview and download high-res social cards for any game.
- **Game Catalog**: Explore game positioning, target personas, and viral hooks.

---

## ⏰ Autonomous Scheduling & Automation

### Option A: Local Background Daemon
Run the agent as a background process checking every hour:
```bash
node marketing/cli.js run-autonomous --daemon --interval 60
```

### Option B: Crontab (e.g., daily at 9:00 AM)
```bash
0 9 * * * cd /path/to/browser-games && node marketing/cli.js run-autonomous >> /var/log/kreeda-marketing.log 2>&1
```

### Option C: GitHub Actions Workflow
Add `.github/workflows/marketing-agent.yml`:
```yaml
name: Autonomous Marketing Agent
on:
  schedule:
    - cron: '0 9 * * *' # Daily at 9:00 AM UTC
  workflow_dispatch:

jobs:
  run-marketing:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
      - name: Run Marketing Cycle
        env:
          GEMINI_API_KEY: ${{ secrets.GEMINI_API_KEY }}
          TWITTER_API_KEY: ${{ secrets.TWITTER_API_KEY }}
          TWITTER_ACCESS_TOKEN: ${{ secrets.TWITTER_ACCESS_TOKEN }}
        run: |
          node marketing/cli.js run-autonomous
```
