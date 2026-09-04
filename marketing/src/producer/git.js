/**
 * The Producer's git: committing state, and the branch the Review is opened
 * from.
 *
 * State is committed directly to `marketing-state` (ADR 0001) — the Producer
 * is its only committer. The Review is a pull request from `marketing-review`
 * into `marketing-state`, and a pull request needs a diff, so that branch is
 * marketing-state plus one commit carrying the Run log. Merging it is the
 * CMO's approval; the state itself is already landed, so an unmerged Review
 * never strands a Cycle's work.
 */

import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { config } from '../config.js';
import { STATE_BRANCH } from './state.js';
import { REVIEW_HEAD } from './review.js';

const execFileAsync = promisify(execFile);

async function git(args, cwd = config.paths.data) {
  try {
    const { stdout } = await execFileAsync('git', args, { cwd, encoding: 'utf8' });
    return { ok: true, out: stdout.trim() };
  } catch (err) {
    return { ok: false, out: (err.stderr || err.message || '').trim() };
  }
}

/** Anything uncommitted in the state worktree. */
export async function stateIsDirty() {
  const status = await git(['status', '--porcelain']);
  return status.ok && status.out.length > 0;
}

/**
 * Commits everything in the state worktree and pushes it, rebasing once if the
 * remote moved (§4: push with rebase-and-retry).
 * @returns {Promise<{ committed: boolean, pushed: boolean, detail: string }>}
 */
export async function commitState(message) {
  if (!(await stateIsDirty())) return { committed: false, pushed: false, detail: 'no state changed this Cycle' };

  const add = await git(['add', '-A']);
  if (!add.ok) return { committed: false, pushed: false, detail: `could not stage state: ${add.out}` };

  const commit = await git(['commit', '-m', message]);
  if (!commit.ok) return { committed: false, pushed: false, detail: `could not commit state: ${commit.out}` };

  let push = await git(['push', 'origin', `HEAD:${STATE_BRANCH}`]);
  if (!push.ok) {
    // Files never overlap between routines, so a rebase is clean when it is
    // needed at all.
    const pull = await git(['pull', '--rebase', 'origin', STATE_BRANCH]);
    if (!pull.ok) return { committed: true, pushed: false, detail: `committed, but could not rebase: ${pull.out}` };
    push = await git(['push', 'origin', `HEAD:${STATE_BRANCH}`]);
  }

  return {
    committed: true,
    pushed: push.ok,
    detail: push.ok ? 'state committed and pushed' : `committed, but the push failed: ${push.out}`
  };
}

/**
 * Points `marketing-review` one empty commit ahead of `marketing-state`, so
 * the pull request exists and has something to merge.
 *
 * The commit is deliberately empty. State is already on marketing-state — the
 * Producer commits it directly (ADR 0001), so an unmerged Review never
 * strands a Cycle's work — and approving is a signal, not a content change.
 * What the CMO is deciding on lives in the pull request body.
 *
 * Built with plumbing so the worktree and the index are never touched: a
 * Cycle must not leave a half-made commit behind if it dies here.
 *
 * @returns {Promise<{ ok: boolean, detail: string }>}
 */
export async function refreshReviewBranch(title, now = new Date()) {
  const head = await git(['rev-parse', 'HEAD']);
  if (!head.ok) return { ok: false, detail: `no state commit to open a Review from: ${head.out}` };

  const tree = await git(['rev-parse', 'HEAD^{tree}']);
  if (!tree.ok) return { ok: false, detail: `could not read the state tree: ${tree.out}` };

  const message = `${title}\n\nMerging this approves every ticked item in the pull request body and\nrejects every unticked one. The state it decides on is already on\n${STATE_BRANCH}; this commit is empty on purpose.`;
  const commit = await git(['commit-tree', tree.out, '-p', head.out, '-m', message]);
  if (!commit.ok) return { ok: false, detail: `could not build the Review commit: ${commit.out}` };

  // Force, because marketing-review is a disposable pointer, not history.
  const push = await git(['push', '--force', 'origin', `${commit.out}:refs/heads/${REVIEW_HEAD}`]);
  if (!push.ok) return { ok: false, detail: `could not update ${REVIEW_HEAD}: ${push.out}` };

  return { ok: true, detail: `${REVIEW_HEAD} is one commit ahead of ${STATE_BRANCH} at ${commit.out.slice(0, 7)}` };
}

export { STATE_BRANCH, REVIEW_HEAD };
