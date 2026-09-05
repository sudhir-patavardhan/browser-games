/**
 * The gate between an Agent and the Producer (ADR 0006).
 *
 * An Agent proposes by writing JSON; `accept` runs it through here first.
 * Malformed output is rejected with the path of what is wrong, never patched:
 * the previous state file stands and the Run log says why. That is the whole
 * reason a role's schema is code rather than prose in a prompt.
 *
 * A deliberately small dialect — object/array/string/number/boolean/null,
 * `required`, `enum`, `pattern`, `minItems`, `minimum`, `maximum` — because a
 * schema nobody can read is a contract nobody can hold the Agent to.
 */

const typeOf = value => {
  if (value === null) return 'null';
  if (Array.isArray(value)) return 'array';
  return typeof value;
};

/**
 * @param {*} value the Agent's output.
 * @param {Object} schema the role's schema.
 * @param {string} [at] the JSON path being checked, for the error message.
 * @returns {string[]} every problem found; empty means valid.
 */
export function validate(value, schema, at = 'output') {
  const problems = [];
  const types = [].concat(schema.type || []);

  if (types.length && !types.includes(typeOf(value))) {
    return [`${at}: expected ${types.join(' or ')}, got ${typeOf(value)}`];
  }

  if (schema.enum && !schema.enum.includes(value)) {
    problems.push(`${at}: ${JSON.stringify(value)} is not one of ${schema.enum.map(v => JSON.stringify(v)).join(', ')}`);
  }

  if (typeOf(value) === 'string') {
    if (schema.pattern && !new RegExp(schema.pattern).test(value)) {
      problems.push(`${at}: ${JSON.stringify(value)} does not match ${schema.pattern}`);
    }
    if (schema.maxLength != null && value.length > schema.maxLength) {
      problems.push(`${at}: ${value.length} characters, at most ${schema.maxLength} allowed`);
    }
    if (schema.minLength != null && value.length < schema.minLength) {
      problems.push(`${at}: ${JSON.stringify(value)} is too short — at least ${schema.minLength} character(s)`);
    }
  }

  if (typeOf(value) === 'number') {
    if (schema.minimum != null && value < schema.minimum) problems.push(`${at}: ${value} is below the minimum ${schema.minimum}`);
    if (schema.maximum != null && value > schema.maximum) problems.push(`${at}: ${value} is above the maximum ${schema.maximum}`);
  }

  if (typeOf(value) === 'array') {
    if (schema.minItems != null && value.length < schema.minItems) problems.push(`${at}: ${value.length} item(s), at least ${schema.minItems} required`);
    if (schema.maxItems != null && value.length > schema.maxItems) problems.push(`${at}: ${value.length} item(s), at most ${schema.maxItems} allowed`);
    if (schema.items) value.forEach((item, i) => problems.push(...validate(item, schema.items, `${at}[${i}]`)));
  }

  if (typeOf(value) === 'object') {
    for (const key of schema.required || []) {
      if (!(key in value)) problems.push(`${at}.${key}: required, and missing`);
    }
    for (const [key, sub] of Object.entries(schema.properties || {})) {
      if (key in value) problems.push(...validate(value[key], sub, `${at}.${key}`));
    }
    if (schema.additionalProperties === false) {
      const allowed = new Set(Object.keys(schema.properties || {}));
      for (const key of Object.keys(value)) {
        if (!allowed.has(key)) problems.push(`${at}.${key}: not a field this role writes`);
      }
    }
  }

  return problems;
}

/** Rejection carries the problems, so the Run log can say exactly what was wrong. */
export class RejectedOutput extends Error {
  constructor(role, problems) {
    super(`The ${role}'s output was rejected:\n  - ${problems.join('\n  - ')}`);
    this.name = 'RejectedOutput';
    this.role = role;
    this.problems = problems;
  }
}
