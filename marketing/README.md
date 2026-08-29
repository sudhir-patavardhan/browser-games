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

# 5. Launch the local interactive web dashboard
node marketing/cli.js dashboard
# 👉 Open in browser: http://localhost:3030
```

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
| `node marketing/cli.js dashboard` | Starts the interactive web dashboard on `http://localhost:3030` |

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
