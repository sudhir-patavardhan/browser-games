/**
 * Writing the Plan, and the Draft Posts it implies (AGENTS_SPEC.md §6.2).
 *
 * A Plan that is only a document is a Plan nothing acts on. Accepting one
 * writes `weekly-plan.json` **and** puts one Draft Post per item in the queue,
 * which is what the Creative fills and the Review asks the CMO to approve.
 *
 * The two rules the Producer enforces rather than trusting: the per-Channel
 * write budget, and no Game more than twice in the week. The Strategist is
 * told them; `accept` is where they bite.
 */

import fs from 'node:fs';
import path from 'node:path';
import { config } from '../../config.js';
import { GAME_CATALOG } from '../../knowledge/catalog.js';
import { Queue } from '../../producer/queue.js';
import { makePost } from '../../producer/post.js';
import { RejectedOutput } from '../validate.js';

const MAX_PER_GAME_PER_WEEK = 2;
const MAX_PER_CHANNEL_PER_WEEK = 7;

/** The rules that are cheaper to enforce than to explain twice. */
export function checkPlan(output) {
  const problems = [];
  const perGame = {};
  const perChannel = {};

  for (const [i, item] of output.items.entries()) {
    if (!GAME_CATALOG[item.gameId] || item.gameId === 'hub') {
      problems.push(`items[${i}].gameId: "${item.gameId}" is not a Game on the hub`);
    }
    if (item.basis === 'insight' && !item.because) {
      problems.push(`items[${i}].because: an item based on an insight must say which one`);
    }
    perGame[item.gameId] = (perGame[item.gameId] || 0) + 1;
    perChannel[item.channel] = (perChannel[item.channel] || 0) + 1;
  }

  for (const [gameId, count] of Object.entries(perGame)) {
    if (count > MAX_PER_GAME_PER_WEEK) {
      problems.push(`${gameId} appears ${count} times; no Game runs more than ${MAX_PER_GAME_PER_WEEK} times a week`);
    }
  }
  for (const [channel, count] of Object.entries(perChannel)) {
    if (count > MAX_PER_CHANNEL_PER_WEEK) {
      problems.push(`${channel} has ${count} Posts; the write budget is ${MAX_PER_CHANNEL_PER_WEEK} per Channel per week`);
    }
  }

  // Two Posts in the same Slot on the same Channel is one Post nobody sees.
  const slots = new Set();
  for (const [i, item] of output.items.entries()) {
    const key = `${item.channel} ${item.slot.date} ${item.slot.window}`;
    if (slots.has(key)) problems.push(`items[${i}].slot: ${key} is already taken by an earlier item`);
    slots.add(key);
  }

  return problems;
}

export async function accept(output, { now = new Date(), dryRun = false } = {}) {
  const problems = checkPlan(output);
  if (problems.length) throw new RejectedOutput('strategist', problems);

  const planFile = path.join(config.paths.data, 'weekly-plan.json');
  const plan = {
    weekOf: output.weekOf,
    strategy: output.strategy,
    items: output.items,
    adsFocus: output.adsFocus ?? null,
    experiments: output.experiments || [],
    plannedAt: now.toISOString()
  };

  const drafts = output.items.map(item => makePost({
    channel: item.channel,
    gameId: item.gameId,
    category: item.category || GAME_CATALOG[item.gameId]?.category || '',
    slot: item.slot,
    format: item.format,
    angle: item.angle,
    persona: item.persona || '',
    brief: item.brief,
    successMetric: item.successMetric || ''
  }, now));

  if (dryRun) {
    return { wrote: [], summary: `[dry run] ${drafts.length} Draft Post(s) for the week of ${output.weekOf}` };
  }

  fs.writeFileSync(planFile, `${JSON.stringify(plan, null, 2)}\n`);
  const queue = new Queue();
  queue.add(drafts, now);

  const byChannel = drafts.reduce((acc, d) => ({ ...acc, [d.channel]: (acc[d.channel] || 0) + 1 }), {});
  return {
    wrote: [planFile, config.paths.queueFile],
    summary: `week of ${output.weekOf}: ${drafts.length} Draft Post(s) `
      + `(${Object.entries(byChannel).map(([c, n]) => `${n} on ${c}`).join(', ')})`
      + `${output.adsFocus ? `, paid focus ${output.adsFocus.gameId}` : ''}`
  };
}
