/**
 * The vocabulary the Producer uses for readiness reports — smoke, and the
 * per-Channel preflights.
 *
 * Three outcomes, and the difference between the last two matters:
 *
 *   ok      the thing works.
 *   warn    the system runs without it, in a named reduced form. Carries the
 *           consequence, so the CMO reads what they lose rather than a colour.
 *   fail    a Cycle cannot do its job. Carries the remedy. Any fail makes the
 *           whole report blocked, and the command exit non-zero.
 *
 * A secret that a later Phase needs is a warn, not a fail: smoke is green when
 * everything today's Cycles touch is green.
 */

export const OK = 'ok';
export const WARN = 'warn';
export const FAIL = 'fail';

/** @typedef {{ label: string, status: 'ok'|'warn'|'fail', detail: string, note: string|null }} Check */

/** @returns {Check} */
export function ok(label, detail) {
  return { label, status: OK, detail, note: null };
}

/**
 * @param {string} consequence what the system loses while this stays broken.
 * @returns {Check}
 */
export function warn(label, detail, consequence) {
  return { label, status: WARN, detail, note: consequence };
}

/**
 * @param {string} remedy the command or CMO action that clears it.
 * @returns {Check}
 */
export function fail(label, detail, remedy) {
  return { label, status: FAIL, detail, note: remedy };
}

const GLYPH = { [OK]: 'ok  ', [WARN]: 'warn', [FAIL]: 'FAIL' };

/**
 * A titled report of named groups of Checks. Groups are printed in the order
 * they are opened, checks in the order they are added.
 */
export class CheckReport {
  /**
   * @param {string} title
   * @param {string} subtitle one line on what a reader is looking at.
   */
  constructor(title, subtitle = '') {
    this.title = title;
    this.subtitle = subtitle;
    /** @type {{ name: string, about: string, checks: Check[] }[]} */
    this.groups = [];
  }

  /**
   * Opens a group and returns a function that adds Checks to it.
   * @param {string} name
   * @param {string} about what this group of checks gates, in the system's own words.
   * @returns {(check: Check) => void}
   */
  group(name, about = '') {
    const group = { name, about, checks: [] };
    this.groups.push(group);
    return check => group.checks.push(check);
  }

  /** @returns {Check[]} */
  get checks() {
    return this.groups.flatMap(g => g.checks);
  }

  count(status) {
    return this.checks.filter(c => c.status === status).length;
  }

  /** True when at least one Check failed — nothing downstream should be trusted. */
  get blocked() {
    return this.count(FAIL) > 0;
  }

  /** The one-line verdict, without the detail. */
  get verdict() {
    const degraded = this.count(WARN);
    if (this.blocked) {
      return `${this.title} FAILED — ${this.count(FAIL)} blocking, ${degraded} degraded`;
    }
    return degraded
      ? `${this.title} GREEN, degraded — ${degraded} thing(s) the system runs without`
      : `${this.title} GREEN`;
  }

  /**
   * The whole report as text, for a routine transcript or a terminal.
   * @returns {string}
   */
  render() {
    const width = Math.max(...this.checks.map(c => c.label.length), 0);
    const lines = [`\n${this.title}`];
    if (this.subtitle) lines.push(this.subtitle);

    for (const group of this.groups) {
      lines.push('', group.about ? `${group.name} — ${group.about}` : group.name);
      if (!group.checks.length) lines.push('  (nothing to check)');
      for (const c of group.checks) {
        lines.push(`  ${GLYPH[c.status]}  ${c.label.padEnd(width)}  ${c.detail}`);
        if (c.note) lines.push(`        ${' '.repeat(width)}  -> ${c.note}`);
      }
    }

    lines.push('', this.verdict, '');
    return lines.join('\n');
  }
}
