/**
 * Writing insights.json, once the Analyst's answer has passed its schema.
 *
 * The Producer stamps `generatedAt` and the window rather than trusting the
 * Agent to: a stale insight that claims to be fresh is worse than no insight,
 * and every later Agent decides how much to trust this file by its date.
 */

import fs from 'node:fs';
import path from 'node:path';
import { config } from '../../config.js';

export async function accept(output, { now = new Date(), dryRun = false } = {}) {
  const file = path.join(config.paths.data, 'insights.json');
  const insights = { ...output, generatedAt: now.toISOString() };

  if (!dryRun) fs.writeFileSync(file, `${JSON.stringify(insights, null, 2)}\n`);

  const strongest = output.recommendations?.[0]?.do;
  return {
    wrote: dryRun ? [] : [file],
    summary: `${output.games.length} Game(s), ${output.recommendations.length} recommendation(s), `
      + `paid readiness: ${output.paidReadiness?.gameId || 'none named'}`
      + (strongest ? ` — top recommendation: ${strongest}` : '')
  };
}
