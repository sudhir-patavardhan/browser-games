/**
 * What every test gets: a state directory of its own, and no network.
 *
 * AGENTS_SPEC.md §13 — no test reaches X, Facebook, Gemini or GA4, and none
 * writes to the marketing-state worktree. Both are enforced here rather than
 * left to each test's good behaviour.
 */

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { after } from 'node:test';

/**
 * A temporary state directory, removed when the test file finishes.
 * @returns {string}
 */
export function tempStateDir() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'kreeda-test-state-'));
  after(() => fs.rmSync(dir, { recursive: true, force: true }));
  return dir;
}

/** A path inside a fresh temp state directory, seeded with `contents`. */
export function tempStateFile(name, contents = []) {
  const file = path.join(tempStateDir(), name);
  fs.writeFileSync(file, JSON.stringify(contents, null, 2));
  return file;
}

/**
 * Makes any outward call fail loudly for the rest of the file. A test that
 * reaches the network is a test that can fail because someone else's service
 * is down, or that can publish something.
 */
export function noNetwork() {
  const real = { fetch: globalThis.fetch };
  const refuse = url => {
    throw new Error(`A test tried to reach ${url}. Tests run against a stubbed network (§13).`);
  };
  globalThis.fetch = (input) => refuse(typeof input === 'string' ? input : input?.url ?? 'the network');
  after(() => { globalThis.fetch = real.fetch; });
}
