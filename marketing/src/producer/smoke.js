/**
 * The smoke routine (AGENTS_SPEC.md §3).
 *
 * A one-off Cycle that proves the machine a routine runs on can do everything
 * the Producer, the Creative and the Agents will ask of it: the secrets are
 * present, every host a Cycle calls is reachable, an Asset can be rendered,
 * and the Producer can push to the marketing-state branch (ADR 0001).
 *
 * Nothing else in the system is built until this is green. It is deliberately
 * self-contained — it must run before the catalog, the queue or the Agents
 * exist, so it imports as little of the system as it can.
 */

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import https from 'node:https';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

import { config } from '../config.js';
import { CheckReport, ok, warn, fail } from './checks.js';

const execFileAsync = promisify(execFile);

const STATE_BRANCH = 'marketing-state';
const ADD_TO_ENV = 'add it to the cloud environment (and marketing/.env to run the same Cycle locally)';

/**
 * Every secret in AGENTS_SPEC.md §3.
 *
 * `without` is what the system loses while it is missing, and `blocking` is
 * the question "can a Cycle that exists today do its job anyway?". A secret
 * only a later Phase needs degrades the report instead of blocking it.
 *
 * `public` marks the values that are not secrets — an account id, a currency,
 * a property id — which are printed, because seeing the wrong one is how a
 * misconfigured environment is usually caught.
 */
const SECRETS = [
  { name: 'TWITTER_API_KEY', without: 'the Producer cannot publish Posts on the X Channel', blocking: true },
  { name: 'TWITTER_API_SECRET', without: 'the Producer cannot publish Posts on the X Channel', blocking: true },
  { name: 'TWITTER_ACCESS_TOKEN', without: 'the Producer cannot publish Posts on the X Channel', blocking: true },
  { name: 'TWITTER_ACCESS_TOKEN_SECRET', without: 'the Producer cannot publish Posts on the X Channel', blocking: true },
  { name: 'TWITTER_BEARER_TOKEN', without: 'the Analyst gets no X metrics', blocking: true },
  { name: 'GEMINI_API_KEY', without: 'the Creative cannot fill a Post', blocking: true },
  { name: 'GEMINI_MODEL', without: '', blocking: false, optional: true, public: true },
  { name: 'FACEBOOK_PAGE_ID', without: 'the Producer cannot publish Posts on the Facebook Channel', blocking: true, public: true },
  {
    name: 'FACEBOOK_PAGE_TOKEN',
    without: 'the Producer cannot publish Posts on the Facebook Channel',
    blocking: true,
    remedy: 'run `node cli.js fb token` for a long-lived Page token, then ' + ADD_TO_ENV
  },
  {
    name: 'GH_TOKEN',
    // Not blocking on its own: locally the Producer pushes through gh's
    // keyring instead. What has to be true is that it can push at all, and
    // the State checks below are what prove that.
    without: 'a cloud routine cannot push marketing-state, open the Review, or upload Assets — locally gh may be logged in another way',
    blocking: false
  },
  { name: 'CMO_EMAIL', without: 'Alerts and the Briefing have nowhere to go', blocking: false },
  { name: 'X_ADS_ACCOUNT_ID', without: 'no Campaign can launch (Phase 4)', blocking: false, public: true },
  { name: 'X_ADS_CURRENCY', without: 'no Campaign can launch (Phase 4)', blocking: false, public: true },
  { name: 'X_ADS_USD_TO_LOCAL_RATE', without: 'the Caps cannot be converted to the billed currency (Phase 4)', blocking: false, public: true },
  { name: 'X_PIXEL_ID', without: 'Players cannot be attributed to a Campaign (Phase 4)', blocking: false, public: true },
  { name: 'X_PIXEL_TOKEN', without: 'Players cannot be attributed to a Campaign (Phase 4)', blocking: false },
  { name: 'GA4_PROPERTY_ID', without: 'the Analyst cannot count Players (Phase 3)', blocking: false, public: true },
  { name: 'GA4_SA_KEY', without: 'the Analyst cannot count Players (Phase 3)', blocking: false }
];

/** Every host a Cycle calls. Any HTTP answer proves DNS, TLS and egress. */
const HOSTS = [
  { host: 'api.x.com', used_for: 'publishing Posts and reading metrics on X' },
  { host: 'ads-api.x.com', used_for: 'Campaigns' },
  { host: 'graph.facebook.com', used_for: 'the Facebook Channel' },
  { host: 'generativelanguage.googleapis.com', used_for: 'the Creative' },
  { host: 'analyticsdata.googleapis.com', used_for: 'Players from GA4' },
  { host: 'api.github.com', used_for: 'marketing-state, the Review, and the media release' }
];

/** Runs a command without throwing. */
async function run(cmd, args, opts = {}) {
  try {
    const { stdout, stderr } = await execFileAsync(cmd, args, { encoding: 'utf8', ...opts });
    return { code: 0, stdout, stderr };
  } catch (err) {
    return {
      code: err.code ?? 1,
      stdout: err.stdout || '',
      stderr: err.stderr || err.message || '',
      failed: true
    };
  }
}

/** First non-empty line, for error details that must fit on one. */
function firstLine(text, max = 160) {
  const line = String(text || '').split('\n').map(s => s.trim()).find(Boolean) || 'no output';
  return line.length > max ? `${line.slice(0, max - 1)}…` : line;
}

// --- Secrets ---------------------------------------------------------------

/**
 * Reports each secret as present or missing, never its value. Two are read
 * further because a present-but-wrong value is worse than a missing one: the
 * GA4 service-account key must parse, and the currency rate must be a number.
 */
function checkSecrets(add) {
  for (const secret of SECRETS) {
    const value = (process.env[secret.name] || '').trim();

    if (!value) {
      if (secret.optional) {
        add(ok(secret.name, `unset — the Creative falls back to ${config.ai.geminiModel}`));
      } else if (secret.blocking) {
        add(fail(secret.name, `missing — ${secret.without}`, secret.remedy || ADD_TO_ENV));
      } else {
        add(warn(secret.name, 'missing', secret.without));
      }
      continue;
    }

    add(describeSecret(secret, value));
  }
}

/**
 * A present secret is reported by length alone. The two read further are the
 * ones where a present-but-wrong value is worse than a missing one.
 */
function describeSecret(secret, value) {
  if (secret.name === 'GA4_SA_KEY') {
    try {
      const key = JSON.parse(value);
      if (!key.client_email || !key.private_key) throw new Error('not a service-account key');
      return ok(secret.name, `present — ${key.client_email}`);
    } catch (err) {
      return fail(secret.name, `present but unreadable: ${err.message}`, 'paste the whole service-account JSON key as one value');
    }
  }

  if (secret.name === 'GA4_PROPERTY_ID' && value !== '548072389') {
    return warn(secret.name, `${value} — the spec names property 548072389`,
      'the Analyst would read a different property than the one played_30s reaches');
  }

  if (secret.name === 'X_ADS_USD_TO_LOCAL_RATE' && !(Number(value) > 0)) {
    return fail(secret.name, `${value} is not a positive number`,
      'set the local-currency units per 1 USD, or 1 for a USD-billed account');
  }

  if (secret.name === 'CMO_EMAIL' && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(value)) {
    return fail(secret.name, 'not an email address', 'Alerts and the Briefing are emailed to this address');
  }

  return ok(secret.name, secret.public ? value : `present (${value.length} chars)`);
}

// --- Reachability ----------------------------------------------------------

/** Resolves to the HTTP status, or rejects if the host cannot be reached at all. */
function probe(host, timeoutMs = 10_000) {
  return new Promise((resolve, reject) => {
    const startedAt = Date.now();
    const req = https.request({ host, path: '/', method: 'GET', timeout: timeoutMs }, res => {
      res.resume();
      resolve({ status: res.statusCode, ms: Date.now() - startedAt });
    });
    req.on('timeout', () => req.destroy(new Error(`no answer in ${timeoutMs} ms`)));
    req.on('error', reject);
    req.end();
  });
}

async function checkReachability(add) {
  const results = await Promise.all(HOSTS.map(async h => {
    try {
      return { ...h, ...(await probe(h.host)) };
    } catch (err) {
      return { ...h, error: err.message };
    }
  }));

  for (const r of results) {
    if (r.error) {
      add(fail(r.host, r.error, `a Cycle cannot reach this host, so ${r.used_for} is impossible from here`));
    } else {
      // Any answer proves DNS, TLS and egress; these paths need auth, so 4xx is expected.
      add(ok(r.host, `HTTP ${r.status} in ${r.ms} ms`));
    }
  }
}

// --- Assets ----------------------------------------------------------------

/** A two-second storyboard with real motion, so the encoder has something to do. */
const STORYBOARD_HTML = `<!doctype html><meta charset="utf-8">
<style>
  body { margin: 0; height: 100vh; display: grid; place-items: center;
         background: linear-gradient(160deg, #0b1020, #24304d); font: 700 44px/1.2 system-ui, sans-serif; color: #fff; }
  .card { text-align: center; animation: rise 2s ease-in-out infinite alternate; }
  .dot { width: 120px; height: 120px; margin: 32px auto 0; border-radius: 50%;
         background: #ffd166; animation: sweep 1s linear infinite alternate; }
  @keyframes rise { from { transform: translateY(40px) scale(.9); opacity: .4 } to { transform: none; opacity: 1 } }
  @keyframes sweep { from { transform: translateX(-160px) } to { transform: translateX(160px) } }
</style>
<div class="card">Kreeda<div class="dot"></div></div>`;

/**
 * Renders a two-second storyboard exactly the way the Creative renders a
 * Post's video Asset: Playwright records the page, ffmpeg encodes H.264.
 *
 * The encoder flags mirror VideoStudio.convertToMp4({ fps: 30, silent: true }).
 * They are repeated rather than imported so smoke stays runnable before the
 * catalog the studio depends on has been rebuilt.
 */
async function checkAssets(add) {
  const install = await run('npx', ['--yes', 'playwright', 'install', 'chromium'], {
    cwd: config.paths.marketing,
    timeout: 10 * 60_000,
    maxBuffer: 8 * 1024 * 1024
  });

  if (install.failed) {
    add(fail('chromium', `\`npx playwright install chromium\` failed: ${firstLine(install.stderr || install.stdout)}`,
      'video rendering becomes the manual `node cli.js media render <postId>` step on the CMO\'s machine, and the Creative queues text-and-card Posts only'));
    return;
  }
  add(ok('chromium', 'installed'));

  const ffmpegPath = (await import('ffmpeg-static')).default;
  const version = await run(ffmpegPath, ['-version']);
  if (version.failed) {
    add(fail('ffmpeg', `will not run: ${firstLine(version.stderr)}`, 'no video Asset can be encoded on this machine'));
    return;
  }
  add(ok('ffmpeg', firstLine(version.stdout).replace(/\s+Copyright.*$/, '')));

  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'kreeda-smoke-'));
  try {
    const { chromium } = await import('playwright');
    const startedAt = Date.now();

    const browser = await chromium.launch();
    const context = await browser.newContext({
      viewport: { width: 540, height: 960 },
      recordVideo: { dir, size: { width: 540, height: 960 } }
    });
    const page = await context.newPage();
    await page.setContent(STORYBOARD_HTML);
    await page.waitForTimeout(2000);
    await context.close();
    await browser.close();

    const webm = fs.readdirSync(dir).find(f => f.endsWith('.webm'));
    if (!webm) throw new Error('Playwright recorded no video');
    const mp4 = path.join(dir, 'smoke.mp4');

    const encode = await run(ffmpegPath, [
      '-y', '-i', path.join(dir, webm),
      '-c:v', 'libx264', '-preset', 'medium', '-crf', '20', '-pix_fmt', 'yuv420p',
      '-r', '30', '-an', '-movflags', '+faststart', mp4
    ], { timeout: 120_000, maxBuffer: 8 * 1024 * 1024 });

    if (encode.failed) throw new Error(`ffmpeg refused the recording: ${firstLine(encode.stderr)}`);

    const kb = Math.round(fs.statSync(mp4).size / 1024);
    if (kb < 1) throw new Error('ffmpeg wrote an empty MP4');
    add(ok('storyboard render', `2 s recorded and encoded to ${kb} KB of H.264 in ${((Date.now() - startedAt) / 1000).toFixed(1)} s`));
  } catch (err) {
    add(fail('storyboard render', err.message,
      'video rendering becomes the manual `node cli.js media render <postId>` step on the CMO\'s machine, and the Creative queues text-and-card Posts only'));
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

// --- State branch ----------------------------------------------------------

/**
 * The Producer is the only committer to marketing-state (ADR 0001), so this
 * asks three things: can this machine talk to GitHub as someone, may that
 * someone write to the repo, and does the branch exist to be written to.
 */
async function checkStateBranch(add) {
  const repo = config.paths.root;

  const auth = await run('gh', ['auth', 'status']);
  if (auth.failed) {
    add(fail('gh auth status', firstLine(auth.stderr || auth.stdout),
      'the Producer cannot open the Review or upload Assets to the media release'));
  } else {
    // gh prints its status on stderr; the account line is the one that matters.
    const text = `${auth.stdout}\n${auth.stderr}`;
    add(ok('gh auth status', firstLine(text.split('\n').find(l => /Logged in|account/i.test(l)) || text)));
  }

  const permissions = await run('gh', ['api', 'repos/{owner}/{repo}', '--jq', '.permissions.push'], { cwd: repo });
  const canPush = permissions.stdout.trim() === 'true';
  if (permissions.failed) {
    add(fail('repo write access', firstLine(permissions.stderr), 'the token cannot be checked; the Producer may fail mid-Cycle'));
  } else if (!canPush) {
    add(fail('repo write access', 'the token cannot push to this repo',
      'give GH_TOKEN write access — it pushes marketing-state, opens the Review, and uploads Assets'));
  } else {
    add(ok('repo write access', 'the token can push, open the Review, and upload release Assets'));
  }

  const remote = await run('git', ['ls-remote', '--heads', 'origin', STATE_BRANCH], { cwd: repo });
  if (remote.failed) {
    add(fail(`origin/${STATE_BRANCH}`, firstLine(remote.stderr), 'the Producer cannot read state'));
    return;
  }
  if (!remote.stdout.trim()) {
    add(fail(`origin/${STATE_BRANCH}`, 'the branch does not exist yet',
      'run `node cli.js state init` to create the orphan branch all state lives on (ADR 0001)'));
    return;
  }
  add(ok(`origin/${STATE_BRANCH}`, `exists at ${remote.stdout.trim().slice(0, 7)}`));

  // A same-sha dry-run push: it authenticates against receive-pack, which is
  // the write path a Cycle actually uses, and updates nothing.
  await run('git', ['fetch', '--quiet', 'origin', STATE_BRANCH], { cwd: repo });
  const push = await run('git', ['push', '--dry-run', 'origin', `FETCH_HEAD:refs/heads/${STATE_BRANCH}`], { cwd: repo });
  if (push.failed) {
    add(fail(`push ${STATE_BRANCH}`, firstLine(push.stderr), 'the Producer cannot commit state at the end of a Cycle'));
  } else {
    add(ok(`push ${STATE_BRANCH}`, 'accepted (dry run)'));
  }

  const worktree = path.join(config.paths.marketing, 'data');
  const listed = await run('git', ['worktree', 'list', '--porcelain'], { cwd: repo });
  const onStateBranch = listed.stdout.includes(`refs/heads/${STATE_BRANCH}`);
  if (onStateBranch) {
    add(ok('data worktree', `marketing/data is the ${STATE_BRANCH} worktree`));
  } else if (fs.existsSync(worktree)) {
    add(fail('data worktree', `marketing/data exists but is not the ${STATE_BRANCH} worktree`,
      `run \`node cli.js state init\` — state on a code branch is the bug ADR 0001 closes`));
  } else {
    add(fail('data worktree', 'marketing/data is not checked out',
      `run \`git worktree add marketing/data ${STATE_BRANCH}\``));
  }
}

// --- The routine -----------------------------------------------------------

/**
 * Runs every smoke check and returns the report. The caller decides what to do
 * with `report.blocked`.
 * @returns {Promise<CheckReport>}
 */
export async function runSmoke() {
  const report = new CheckReport(
    'KREEDA MARKETING — SMOKE',
    'Can this machine run a Cycle? (AGENTS_SPEC.md §3)'
  );

  checkSecrets(report.group('Secrets', 'read from the environment; values are never printed'));
  await checkReachability(report.group('Reachability', 'every host a Cycle calls'));
  await checkAssets(report.group('Assets', 'the Creative renders a Post\'s video and card here'));
  await checkStateBranch(report.group('State', 'ADR 0001 — the Producer is the only committer to marketing-state'));

  return report;
}
