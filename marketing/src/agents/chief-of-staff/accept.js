/**
 * Rendering and delivering the Briefing (AGENTS_SPEC.md §6.6).
 *
 * Three destinations, one text: the state branch keeps it, the outbox carries
 * it to the CMO's inbox, and the Sunday Review uses it as its body. The
 * Producer does not send email — it writes the file and the routine session
 * sends it (§5).
 */

import fs from 'node:fs';
import path from 'node:path';
import { config } from '../../config.js';
import { Outbox } from '../../producer/alerts.js';

const line = b => `- ${b.point}${b.evidence ? ` — ${b.evidence}` : ''}`;

/** Six sections, in this order, however the week went. */
export function renderBriefing(out) {
  const md = [`# Kreeda — week ending ${out.weekEnding}`, ''];

  md.push('## The numbers', '');
  for (const h of out.headline) {
    md.push(`- **${h.metric}:** ${h.value}${h.wow ? ` (${h.wow} week on week)` : ''}`);
  }
  md.push('');

  const section = (title, items, empty) => {
    md.push(`## ${title}`, '');
    if (!items?.length) md.push(`_${empty}_`);
    else md.push(...items.map(line));
    md.push('');
  };

  section('What we did', out.whatWeDid, 'Nothing went out this week.');
  section('What worked', out.whatWorked, 'Nothing cleared the bar for a claim this week.');
  section('What did not', out.whatDidnt, 'Nothing failed loudly enough to name.');
  section('What the system decided', out.systemDecisions, 'The system took no decisions of its own this week.');
  section('Decisions needed from you', out.cmoDecisions, 'Nothing is waiting on you.');

  md.push('## Next week', '');
  if (!out.nextWeek?.length) md.push('_No Plan has been written yet._');
  else md.push(...out.nextWeek.map(l => `- ${l}`));
  md.push('');

  return md.join('\n');
}

export async function accept(output, { now = new Date(), dryRun = false } = {}) {
  const body = renderBriefing(output);
  const file = path.join(config.paths.reports, 'briefing.md');

  if (dryRun) return { wrote: [], summary: `[dry run] Briefing for the week ending ${output.weekEnding}` };

  fs.mkdirSync(config.paths.reports, { recursive: true });
  fs.writeFileSync(file, `${body}\n`);

  // CMO_EMAIL unset returns null rather than sending mail nowhere; the
  // Briefing still exists on the state branch, and the blocker is one the
  // Chief of Staff was told to list.
  const sent = new Outbox().write({
    subject: `Kreeda — week ending ${output.weekEnding}`,
    body,
    name: 'briefing'
  }, now);

  return {
    wrote: [file, sent].filter(Boolean),
    summary: `Briefing for the week ending ${output.weekEnding}: `
      + `${output.cmoDecisions.length} decision(s) need you`
      + (sent ? ', queued in the outbox' : ' (CMO_EMAIL unset — not queued for sending)')
  };
}
