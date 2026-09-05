/**
 * The prepare/accept sandwich (AGENTS_SPEC.md §6, ADR 0006).
 *
 * Five of the six Agents are the routine's own Claude session, not an API call.
 * The Producer cannot call them, so it does the two halves it *can* do:
 *
 *   prepare  gathers every input the role is entitled to into one file, and
 *            names the prompt to read and the path to write the answer to
 *   accept   validates that answer against the role's schema and, only if it
 *            passes, writes the role's state file
 *
 * Between the two, a session reads the prompt and thinks. That is the Agent.
 * An Agent proposes; only the Producer executes.
 */

import fs from 'node:fs';
import path from 'node:path';
import { config } from '../config.js';
import { validate, RejectedOutput } from './validate.js';

/** The five judgment roles. The Creative is a Gemini call, not one of these. */
export const ROLES = ['analyst', 'strategist', 'media-buyer', 'performance-analyst', 'chief-of-staff'];

const AGENTS_DIR = path.join(config.paths.marketing, 'src', 'agents');
const IO_DIR = path.join(config.paths.data, 'agent-io');

/** Where a role reads its inputs, its prompt, and writes its answer. */
export function ioPaths(role) {
  return {
    input: path.join(IO_DIR, `${role}.input.json`),
    output: path.join(IO_DIR, `${role}.output.json`),
    prompt: path.join(AGENTS_DIR, role, 'PROMPT.md')
  };
}

function assertRole(role) {
  if (!ROLES.includes(role)) {
    throw new Error(`"${role}" is not an Agent. The roles are: ${ROLES.join(', ')}.`);
  }
}

const part = (role, file) => import(`./${role}/${file}.js`);

/**
 * Gathers one role's inputs and writes them where the session will read them.
 *
 * @returns {Promise<{ role, input, prompt, output, summary }>} the three paths
 *          plus a one-line summary of what was gathered.
 */
export async function prepare(role, { now = new Date(), ...options } = {}) {
  assertRole(role);
  const { prepare: gather } = await part(role, 'prepare');
  const paths = ioPaths(role);

  const gathered = await gather({ now, ...options });
  const input = {
    role,
    preparedAt: now.toISOString(),
    // The session is told, in the file itself, what it is being asked for.
    writeYourAnswerTo: paths.output,
    readYourPromptAt: paths.prompt,
    ...gathered
  };

  fs.mkdirSync(IO_DIR, { recursive: true });
  fs.writeFileSync(paths.input, `${JSON.stringify(input, null, 2)}\n`);

  return { role, ...paths, summary: gathered.summary || `${role} inputs gathered` };
}

/**
 * Validates a role's answer and, only if it passes, writes its state file.
 *
 * @throws {RejectedOutput} when the answer does not match the role's schema —
 *         the previous state file stands, untouched.
 * @returns {Promise<{ role, wrote: string[], summary: string }>}
 */
export async function accept(role, { now = new Date(), dryRun = false, file = null } = {}) {
  assertRole(role);
  const paths = ioPaths(role);
  const from = file || paths.output;

  if (!fs.existsSync(from)) {
    throw new Error(`Nothing to accept: ${from} does not exist. Run "agent prepare ${role}" and write the answer there.`);
  }

  let output;
  try {
    output = JSON.parse(fs.readFileSync(from, 'utf8'));
  } catch (err) {
    throw new RejectedOutput(role, [`${path.basename(from)} is not valid JSON: ${err.message}`]);
  }

  const { schema } = await part(role, 'schema');
  const problems = validate(output, schema);
  if (problems.length) throw new RejectedOutput(role, problems);

  const { accept: write } = await part(role, 'accept');
  const result = await write(output, { now, dryRun });

  return { role, wrote: result.wrote || [], summary: result.summary || `${role} accepted` };
}

export { RejectedOutput };
