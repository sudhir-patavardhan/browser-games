import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '../..');
const MARKETING_DIR = path.resolve(__dirname, '..');

// Lightweight zero-dependency .env loader
function loadEnv() {
  const envPath = path.join(MARKETING_DIR, '.env');
  if (fs.existsSync(envPath)) {
    const content = fs.readFileSync(envPath, 'utf8');
    for (const line of content.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const idx = trimmed.indexOf('=');
      if (idx > 0) {
        const key = trimmed.slice(0, idx).trim();
        const val = trimmed.slice(idx + 1).trim().replace(/^["']|["']$/g, '');
        if (!process.env[key]) {
          process.env[key] = val;
        }
      }
    }
  }
}

loadEnv();

export const config = {
  paths: {
    root: ROOT_DIR,
    marketing: MARKETING_DIR,
    data: path.join(MARKETING_DIR, 'data'),
    artifacts: path.join(MARKETING_DIR, 'artifacts'),
    queueFile: path.join(MARKETING_DIR, 'data', 'queue.json'),
    postMetricsFile: path.join(MARKETING_DIR, 'data', 'post-metrics.json'),
    lastCycleFile: path.join(MARKETING_DIR, 'data', 'last-cycle.json'),
    // The Run log and the Briefing are state: they live on marketing-state.
    reports: path.join(MARKETING_DIR, 'data', 'artifacts', 'reports'),
  },
  general: {
    baseUrl: process.env.BASE_URL || 'https://kreeda.games',
    repoUrl: process.env.REPO_URL || 'https://github.com/sudhir-patavardhan/browser-games',
    mode: process.env.MARKETING_MODE || 'draft', // 'draft' | 'live'
    brandName: 'Kreeda',
    tagline: 'Free browser games that start the second you tap'
  },
  ai: {
    geminiApiKey: process.env.GEMINI_API_KEY || '',
    geminiModel: process.env.GEMINI_MODEL || 'gemini-3.7-flash',
    geminiEndpoint: 'https://generativelanguage.googleapis.com/v1beta/models'
  },
  platforms: {
    twitter: {
      enabled: Boolean(process.env.TWITTER_API_KEY && process.env.TWITTER_ACCESS_TOKEN),
      apiKey: process.env.TWITTER_API_KEY || '',
      apiSecret: process.env.TWITTER_API_SECRET || '',
      accessToken: process.env.TWITTER_ACCESS_TOKEN || '',
      accessTokenSecret: process.env.TWITTER_ACCESS_TOKEN_SECRET || '',
      bearerToken: process.env.TWITTER_BEARER_TOKEN || ''
    },
    // A long-lived Page token, not a user token: it does not expire while the
    // CMO is an admin of the Page. `node cli.js fb token` mints one (§11).
    facebook: {
      enabled: Boolean(process.env.FACEBOOK_PAGE_TOKEN && process.env.FACEBOOK_PAGE_ID),
      pageToken: process.env.FACEBOOK_PAGE_TOKEN || '',
      pageId: process.env.FACEBOOK_PAGE_ID || '',
      // Only `fb token` and the preflight need these: minting a long-lived
      // Page token and inspecting one both have to prove they are the app.
      // Publishing a Post does not.
      appId: process.env.FACEBOOK_APP_ID || '',
      appSecret: process.env.FACEBOOK_APP_SECRET || ''
    }
  },
  // Play-together video posts: film one storyboarded game and post it, on a
  // cadence, as part of the autonomous cycle. The two demo names appear in
  // the footage; keep them short so they fit the games' 12-character inputs.
  together: {
    enabled: process.env.TOGETHER_VIDEO_DISABLED !== '1',
    cadenceDays: Number(process.env.TOGETHER_VIDEO_CADENCE_DAYS) || 2,
    names: (() => {
      const n = (process.env.TOGETHER_DEMO_NAMES || '').split(',').map(s => s.trim().slice(0, 12)).filter(Boolean);
      return n.length === 2 ? n : ['Maya', 'Arjun'];
    })(),
    stateFile: path.join(MARKETING_DIR, 'data', 'together-state.json')
  },
  // Paid campaigns on X Ads. The USD ceilings are hard limits: env vars can
  // lower them but never raise them.
  ads: {
    enabled: Boolean(process.env.X_ADS_ACCOUNT_ID),
    accountId: process.env.X_ADS_ACCOUNT_ID || '',
    // Conversion API (server-side): reports on-site conversions analytics.js
    // fires client-side back to Ads Manager. A separate credential from the
    // OAuth1 Ads API above — no developer-app approval needed for this one.
    pixelId: process.env.X_PIXEL_ID || '',
    pixelToken: process.env.X_PIXEL_TOKEN || '',
    fundingInstrumentId: process.env.X_ADS_FUNDING_INSTRUMENT_ID || '',
    currency: process.env.X_ADS_CURRENCY || 'USD',
    // Local currency units per 1 USD (e.g. ~84 for an INR-billed account).
    usdToLocalRate: Number(process.env.X_ADS_USD_TO_LOCAL_RATE) || 1,
    maxDailyPerCampaignUsd: Math.min(Number(process.env.X_ADS_MAX_DAILY_PER_CAMPAIGN_USD) || 10, 10),
    maxTotalDailyUsd: Math.min(Number(process.env.X_ADS_MAX_TOTAL_DAILY_USD) || 25, 25),
    // ADR 0004: every Campaign is a fixed three-day Trial.
    trialDays: Number(process.env.X_ADS_TRIAL_DAYS) || 3,
    maxActiveCampaigns: Number(process.env.X_ADS_MAX_ACTIVE_CAMPAIGNS) || 2,
    ledgerFile: path.join(MARKETING_DIR, 'data', 'ads-campaigns.json'),
    learningsFile: path.join(MARKETING_DIR, 'data', 'ads-learnings.json')
  }
};

// marketing/data is never created here: it is the marketing-state worktree
// (ADR 0001), and silently recreating it as a plain directory is how state
// ends up on a code branch. `node cli.js state init` checks it out; the
// Producer fails loudly when it is missing.
if (!fs.existsSync(config.paths.artifacts)) {
  fs.mkdirSync(config.paths.artifacts, { recursive: true });
}
