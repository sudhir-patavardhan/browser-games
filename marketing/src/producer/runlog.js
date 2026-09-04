/**
 * The Run log (CONTEXT.md): the Producer's account of one Cycle, written for
 * operators — what was published, launched, paused, retried or skipped, and
 * why. It becomes the body of the daily Review.
 *
 * Every line is attributed to an Agent by name or to "policy", so a reader can
 * always tell whether a decision was judgement or a rule.
 */

import fs from 'node:fs';
import path from 'node:path';
import { config } from '../config.js';

export class RunLog {
  /** @param {string} cycle which Cycle this is — Publish, Morning desk, Planning. */
  constructor(cycle, now = new Date()) {
    this.cycle = cycle;
    this.startedAt = now;
    this.steps = [];
    this.alerts = [];
  }

  /** Opens a step and returns the recorders for it. */
  step(name) {
    const step = { step: name, lines: [] };
    this.steps.push(step);
    const add = mark => (text, by = 'policy') => { step.lines.push({ mark, text, by }); return this; };
    return { did: add('•'), skipped: add('–'), failed: add('!'), note: add(' ') };
  }

  /** Something the CMO needs to know about now (§5.1 step 8). */
  alert(text) {
    this.alerts.push(text);
    return this;
  }

  /** True when nothing happened worth an email. */
  get quiet() {
    return this.alerts.length === 0;
  }

  counts() {
    const lines = this.steps.flatMap(s => s.lines);
    return {
      did: lines.filter(l => l.mark === '•').length,
      skipped: lines.filter(l => l.mark === '–').length,
      failed: lines.filter(l => l.mark === '!').length
    };
  }

  render() {
    const { did, skipped, failed } = this.counts();
    const out = [
      `**${this.cycle}** · ${this.startedAt.toISOString().replace('T', ' ').slice(0, 16)} UTC · ` +
      `${did} done, ${skipped} skipped${failed ? `, **${failed} failed**` : ''}`,
      ''
    ];

    for (const step of this.steps) {
      if (!step.lines.length) continue;
      out.push(`**${step.step}**`);
      for (const line of step.lines) {
        const by = line.by === 'policy' ? '' : ` _(${line.by})_`;
        const prefix = line.mark === '!' ? '**failed:** ' : line.mark === '–' ? '_skipped:_ ' : '';
        out.push(`- ${prefix}${line.text}${by}`);
      }
      out.push('');
    }

    if (!this.steps.some(s => s.lines.length)) out.push('_Nothing to do this Cycle._', '');
    return out.join('\n');
  }

  /** Writes the Run log to the state branch, where the Review reads it. */
  write(file = path.join(config.paths.reports, 'run-log.md')) {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, `${this.render()}\n`);
    return file;
  }
}
