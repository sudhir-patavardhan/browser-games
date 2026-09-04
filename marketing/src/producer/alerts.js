/**
 * Alerts (CONTEXT.md, §5.1 step 8).
 *
 * An email the Producer sends only when something needs the CMO now: a
 * Campaign paused or stuck, a publish that failed after retries, a token about
 * to expire. **A quiet day sends nothing** — an Alert that arrives every day
 * is one nobody reads.
 *
 * The Producer does not send email. It writes a file to the outbox and the
 * routine's session sends it with the Gmail connector, then deletes it (§3).
 * That keeps the Producer deterministic and keeps mail credentials out of it.
 */

import fs from 'node:fs';
import path from 'node:path';
import { config } from '../config.js';

/** A token this close to expiry is an Alert in its own right. */
export const TOKEN_WARNING_DAYS = 14;

export class Outbox {
  constructor(dir = path.join(config.paths.data, 'outbox')) {
    this.dir = dir;
  }

  /**
   * Writes one email for the routine session to send.
   * @returns {string|null} the path written, or null when there is nobody to
   *          send to — CMO_EMAIL unset is a warning, not a reason to send mail
   *          nowhere.
   */
  write({ subject, body, to = process.env.CMO_EMAIL, name = 'alert' }, now = new Date()) {
    if (!to) return null;
    fs.mkdirSync(this.dir, { recursive: true });
    const file = path.join(this.dir, `${name}-${now.toISOString().replace(/[:.]/g, '-')}.md`);
    fs.writeFileSync(file, `to: ${to}\nsubject: ${subject}\n\n${body.trim()}\n`);
    return file;
  }

  /** What is waiting to be sent. */
  pending() {
    if (!fs.existsSync(this.dir)) return [];
    return fs.readdirSync(this.dir).filter(f => f.endsWith('.md')).map(f => path.join(this.dir, f));
  }
}

/**
 * Turns a Cycle's alerts into one email, or nothing at all. One email per
 * Cycle rather than one per problem: three Alerts about the same bad morning
 * should not be three emails.
 * @returns {string|null} the file written, or null on a quiet day.
 */
export function sendAlerts(runLog, { outbox = new Outbox(), reviewUrl = null, now = new Date() } = {}) {
  if (!runLog.alerts.length) return null;

  const body = [
    `The ${runLog.cycle} Cycle needs you.`,
    '',
    ...runLog.alerts.map(a => `- ${a}`),
    '',
    ...(reviewUrl ? [`The Review: ${reviewUrl}`, ''] : []),
    '---',
    '',
    runLog.render()
  ].join('\n');

  return outbox.write({
    subject: `Kreeda marketing: ${runLog.alerts.length} thing(s) need you`,
    body,
    name: 'alert'
  }, now);
}

/**
 * The Alert for a credential running out, if it is close enough to matter.
 * @returns {string|null}
 */
export function tokenExpiryAlert(name, expiresAt, now = new Date()) {
  if (!expiresAt) return null;
  const days = Math.floor((expiresAt.getTime() - now.getTime()) / 86_400_000);
  if (days > TOKEN_WARNING_DAYS) return null;
  return days < 0
    ? `${name} expired ${-days} day(s) ago — that Channel cannot publish until it is replaced`
    : `${name} expires in ${days} day(s)`;
}
