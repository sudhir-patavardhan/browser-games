/**
 * marketing-state — the orphan branch every state file lives on (ADR 0001).
 *
 * `main` holds code. State is committed to `marketing-state`, which is checked
 * out as a git worktree at `marketing/data/` by every routine and locally, so
 * a daily Cycle rewriting the queue never rebuilds the public site and no code
 * branch carrying a stale copy can rewind live state on merge.
 *
 * `node cli.js state init` is the one command that sets this up, and it is
 * idempotent: a routine can call it at the start of a Cycle and it will fetch
 * what already exists rather than create anything.
 */

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

import { config } from '../config.js';
import { CheckReport, ok, warn, fail } from './checks.js';

const execFileAsync = promisify(execFile);

export const STATE_BRANCH = 'marketing-state';

/**
 * What a brand-new state branch contains. Every reader gets a well-shaped
 * empty document rather than a missing file, and the names are the ones in
 * AGENTS_SPEC.md §4.
 */
const EMPTY_STATE = {
  'queue.json': [],
  'insights.json': {
    generatedAt: null, window: null,
    games: [], categories: [], windows: [], topAngles: [], anomalies: [], recommendations: [],
    paidReadiness: null
  },
  'weekly-plan.json': { weekOf: null, strategy: '', items: [], adsFocus: null, experiments: [] },
  'ads-proposals.json': [],
  'ads-campaigns.json': [],
  'ads-learnings.json': [],
  'post-metrics.json': { updatedAt: null, tweets: {} },
  'fb-metrics.json': { updatedAt: null, posts: {} },
  'intents.json': [],
  'review.json': { lastSyncedAt: null, prNumber: null },
  'last-cycle.json': {}
};

/** Directories that exist from the first commit, so nothing has to create them mid-Cycle. */
const STATE_DIRS = ['agent-io', 'outbox', 'artifacts/reports', 'artifacts/rehearsals'];

/** State files the delete list (§12) retires; they are not carried onto the branch. */
const RETIRED = new Set(['opportunities.json', 'together-state.json', 'telemetry.json']);

const BRANCH_README = `# marketing-state

Kreeda marketing's state. **Code does not live here** — this branch is checked out
as a git worktree at \`marketing/data/\` and holds only what the system writes:
the Post queue, the Campaign ledger, metrics, Agent outputs, Run logs and the
Briefing.

The Producer is the only committer. The daily Review targets this branch.
See \`marketing/docs/adr/0001-state-lives-on-an-orphan-branch.md\` on \`main\`.
`;

async function git(args, opts = {}) {
  try {
    const { stdout, stderr } = await execFileAsync('git', args, {
      cwd: config.paths.root, encoding: 'utf8', ...opts
    });
    return { code: 0, stdout, stderr };
  } catch (err) {
    return { code: err.code ?? 1, stdout: err.stdout || '', stderr: err.stderr || err.message, failed: true };
  }
}

function firstLine(text, max = 160) {
  const line = String(text || '').split('\n').map(s => s.trim()).find(Boolean) || 'no output';
  return line.length > max ? `${line.slice(0, max - 1)}…` : line;
}

/**
 * Lays out the branch's first commit in a scratch directory: the state files
 * already on this machine, minus the retired ones, with any missing document
 * filled in empty.
 * @returns {{ dir: string, adopted: string[] }}
 */
function layOutSeed(from) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'kreeda-state-seed-'));
  const adopted = [];

  if (fs.existsSync(from)) {
    for (const name of fs.readdirSync(from)) {
      if (!name.endsWith('.json') || RETIRED.has(name)) continue;
      fs.copyFileSync(path.join(from, name), path.join(dir, name));
      adopted.push(name);
    }
  }

  for (const [name, doc] of Object.entries(EMPTY_STATE)) {
    if (adopted.includes(name)) continue;
    fs.writeFileSync(path.join(dir, name), `${JSON.stringify(doc, null, 2)}\n`);
  }

  for (const sub of STATE_DIRS) {
    fs.mkdirSync(path.join(dir, sub), { recursive: true });
    fs.writeFileSync(path.join(dir, sub, '.gitkeep'), '');
  }
  fs.writeFileSync(path.join(dir, 'README.md'), BRANCH_README);

  return { dir, adopted };
}

/**
 * Commits the seed directory as a parentless commit and points the branch at
 * it, using a scratch index so the working tree and the real index are never
 * touched.
 * @returns {Promise<string>} the new commit sha
 */
async function createOrphanBranch(seedDir) {
  // The scratch index must live outside the seed directory, or `git add -A`
  // stages the index itself onto the branch.
  const indexFile = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'kreeda-state-index-')), 'index');
  const env = {
    ...process.env,
    GIT_INDEX_FILE: indexFile,
    GIT_DIR: path.join(config.paths.root, '.git'),
    GIT_WORK_TREE: seedDir
  };

  const add = await git(['add', '-A', '-f', '.'], { cwd: seedDir, env });
  if (add.failed) throw new Error(`could not stage the seed: ${firstLine(add.stderr)}`);

  const tree = await git(['write-tree'], { cwd: seedDir, env });
  if (tree.failed) throw new Error(`could not write the seed tree: ${firstLine(tree.stderr)}`);

  const message = 'Open the marketing-state branch\n\nState lives here, code lives on main (ADR 0001).';
  const commit = await git(['commit-tree', tree.stdout.trim(), '-m', message], { cwd: seedDir, env });
  if (commit.failed) throw new Error(`could not commit the seed: ${firstLine(commit.stderr)}`);

  const sha = commit.stdout.trim();
  const ref = await git(['update-ref', `refs/heads/${STATE_BRANCH}`, sha]);
  if (ref.failed) throw new Error(`could not point ${STATE_BRANCH} at the seed: ${firstLine(ref.stderr)}`);

  return sha;
}

async function localBranchExists() {
  const r = await git(['rev-parse', '--verify', '--quiet', `refs/heads/${STATE_BRANCH}`]);
  return !r.failed && Boolean(r.stdout.trim());
}

async function remoteBranchSha(remote) {
  const r = await git(['ls-remote', '--heads', remote, STATE_BRANCH]);
  if (r.failed) return { error: firstLine(r.stderr) };
  const sha = r.stdout.trim().split(/\s+/)[0] || '';
  return { sha };
}

/** Where the state worktree is checked out, if it is. */
async function worktreePath() {
  const list = await git(['worktree', 'list', '--porcelain']);
  if (list.failed) return null;
  const blocks = list.stdout.split('\n\n');
  for (const block of blocks) {
    if (!block.includes(`refs/heads/${STATE_BRANCH}`)) continue;
    const line = block.split('\n').find(l => l.startsWith('worktree '));
    if (line) return line.slice('worktree '.length).trim();
  }
  return null;
}

/**
 * Makes `marketing-state` exist on the remote and be checked out at
 * `marketing/data/`. Safe to re-run.
 *
 * @param {{ remote?: string, push?: boolean }} [options]
 * @returns {Promise<CheckReport>}
 */
export async function initState({ remote = 'origin', push = true } = {}) {
  const report = new CheckReport(
    'MARKETING STATE',
    `ADR 0001 — state on ${STATE_BRANCH}, checked out at marketing/data/`
  );
  const add = report.group('Branch', 'the orphan branch the Producer commits to');
  const dataDir = config.paths.data;

  const remoteRef = await remoteBranchSha(remote);
  if (remoteRef.error) {
    add(fail(`${remote}/${STATE_BRANCH}`, remoteRef.error, 'the Producer cannot reach the remote to read or write state'));
    return report;
  }

  if (remoteRef.sha) {
    add(ok(`${remote}/${STATE_BRANCH}`, `already open at ${remoteRef.sha.slice(0, 7)}`));
    const fetched = await git(['fetch', remote, `+refs/heads/${STATE_BRANCH}:refs/remotes/${remote}/${STATE_BRANCH}`]);
    if (fetched.failed) {
      add(fail('fetch', firstLine(fetched.stderr), 'the local worktree cannot be created from a branch it has not fetched'));
      return report;
    }
    if (!(await localBranchExists())) {
      const track = await git(['branch', '--track', STATE_BRANCH, `${remote}/${STATE_BRANCH}`]);
      if (track.failed) {
        add(fail(`local ${STATE_BRANCH}`, firstLine(track.stderr), 'create it by hand with `git branch --track`'));
        return report;
      }
      add(ok(`local ${STATE_BRANCH}`, `tracking ${remote}/${STATE_BRANCH}`));
    } else {
      add(ok(`local ${STATE_BRANCH}`, 'already present'));
    }
  } else {
    let seed;
    try {
      seed = layOutSeed(dataDir);
      const sha = await createOrphanBranch(seed.dir);
      add(ok(`local ${STATE_BRANCH}`, seed.adopted.length
        ? `opened at ${sha.slice(0, 7)}, adopting ${seed.adopted.length} state file(s) from marketing/data/`
        : `opened at ${sha.slice(0, 7)} with empty state`));
    } catch (err) {
      add(fail(`local ${STATE_BRANCH}`, err.message, 'the branch could not be created; nothing was changed'));
      return report;
    } finally {
      if (seed) fs.rmSync(seed.dir, { recursive: true, force: true });
    }

    if (push) {
      const pushed = await git(['push', '-u', remote, `${STATE_BRANCH}:${STATE_BRANCH}`]);
      if (pushed.failed) {
        add(fail(`push to ${remote}`, firstLine(pushed.stderr), 'the branch exists locally only; a routine will not find it'));
      } else {
        add(ok(`push to ${remote}`, `${STATE_BRANCH} published`));
      }
    } else {
      add(warn(`push to ${remote}`, 'skipped (--no-push)', 'a routine will not find the branch until it is pushed'));
    }
  }

  await attachWorktree(report.group('Worktree', 'marketing/data/ is the branch, not a directory on main'), dataDir);
  return report;
}

async function attachWorktree(add, dataDir) {
  const existing = await worktreePath();
  if (existing) {
    add(path.resolve(existing) === path.resolve(dataDir)
      ? ok('marketing/data', `checked out from ${STATE_BRANCH}`)
      : warn('marketing/data', `${STATE_BRANCH} is checked out at ${existing} instead`,
        'the Producer writes state wherever the worktree is; move it or remove the other one'));
    return;
  }

  // git worktree add refuses a path that already holds files, and the files
  // here are the very state we just seeded the branch with — so they are put
  // aside rather than deleted, and the branch checkout takes their place.
  if (fs.existsSync(dataDir) && fs.readdirSync(dataDir).length) {
    const asideName = `data.before-${STATE_BRANCH}-${new Date().toISOString().slice(0, 10)}`;
    const aside = path.join(config.paths.marketing, asideName);
    fs.renameSync(dataDir, aside);
    add(ok('previous marketing/data', `moved aside to marketing/${asideName}`));
  } else if (fs.existsSync(dataDir)) {
    fs.rmdirSync(dataDir);
  }

  const added = await git(['worktree', 'add', dataDir, STATE_BRANCH]);
  if (added.failed) {
    add(fail('marketing/data', firstLine(added.stderr), `run \`git worktree add marketing/data ${STATE_BRANCH}\` by hand`));
    return;
  }
  add(ok('marketing/data', `checked out from ${STATE_BRANCH}`));
}
