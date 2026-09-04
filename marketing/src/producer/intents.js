/**
 * Idempotency (§4).
 *
 * Every outward action records an intent *before* the API call. If a Cycle
 * dies between the call and the record of its result, the next Cycle finds the
 * intent and knows the action may already have happened — so it checks the
 * Channel before doing it again rather than posting twice.
 *
 * This is the direct answer to the August 2026 double-posting: the ledger of
 * what we meant to do is written first, and it is the thing consulted before
 * anything is done twice.
 */

import fs from 'node:fs';
import path from 'node:path';
import { config } from '../config.js';

/** How far back to look for a Post that may already carry this intent. */
export const RECENT_MS = 3_600_000;

/** Intents older than this have been resolved one way or another. */
const PRUNE_AFTER_MS = 7 * 86_400_000;

let counter = 0;

export class Intents {
  constructor(file = path.join(config.paths.data, 'intents.json')) {
    this.file = file;
  }

  load() {
    if (!fs.existsSync(this.file)) return [];
    try {
      const parsed = JSON.parse(fs.readFileSync(this.file, 'utf8'));
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  save(intents) {
    fs.mkdirSync(path.dirname(this.file), { recursive: true });
    fs.writeFileSync(this.file, `${JSON.stringify(intents, null, 2)}\n`);
    return intents;
  }

  /**
   * Records what is about to be attempted, and returns its id. Call this
   * before the API call, never after.
   *
   * @param {Object} intent
   * @param {string} intent.kind 'publish' | 'launch' | 'pause' | 'upload'
   * @param {string} intent.target the Post or Campaign id.
   * @param {string} [intent.channel]
   * @returns {{ id: string, kind: string, target: string, at: string }}
   */
  record({ kind, target, channel = null }, now = new Date()) {
    const intent = {
      id: `intent-${now.getTime().toString(36)}-${(counter++).toString(36)}${Math.random().toString(36).slice(2, 6)}`,
      kind,
      target,
      channel,
      at: now.toISOString(),
      result: null
    };
    this.save([...this.prune(now), intent]);
    return intent;
  }

  /** Marks an intent as having finished, so a retry knows it is done. */
  complete(id, result, now = new Date()) {
    const intents = this.load();
    const intent = intents.find(i => i.id === id);
    if (!intent) throw new Error(`No intent ${id} to complete.`);
    intent.result = result;
    intent.completedAt = now.toISOString();
    this.save(intents);
    return intent;
  }

  /**
   * An intent for this action that was recorded but never completed — the
   * shape of a Cycle that died mid-flight. The caller must check the Channel
   * before acting on it.
   * @returns {Object|null}
   */
  unfinished({ kind, target }, { now = new Date(), withinMs = RECENT_MS } = {}) {
    const since = now.getTime() - withinMs;
    return this.load().find(i =>
      i.kind === kind && i.target === target && !i.result &&
      new Date(i.at).getTime() >= since
    ) || null;
  }

  /** A completed intent for this action, meaning it definitely happened. */
  finished({ kind, target }) {
    return this.load().find(i => i.kind === kind && i.target === target && i.result) || null;
  }

  /** Drops intents old enough that whatever they meant is long settled. */
  prune(now = new Date()) {
    const cutoff = now.getTime() - PRUNE_AFTER_MS;
    return this.load().filter(i => new Date(i.at).getTime() >= cutoff);
  }
}
