/**
 * The Briefing's shape (AGENTS_SPEC.md §6.6).
 *
 * The Agent writes structure, not prose, and `accept` renders the page. That
 * way the six sections the CMO expects are always all six, in the same order,
 * however the week went — and a quiet week cannot quietly become a short
 * Briefing that skips the part about what is blocked.
 */

const text = { type: 'string', minLength: 1 };

const bullet = {
  type: 'object',
  required: ['point'],
  additionalProperties: false,
  properties: {
    point: text,
    // §6.6: every claim traceable to a state file. This is the number.
    evidence: { type: ['string', 'null'] }
  }
};

export const schema = {
  type: 'object',
  required: ['weekEnding', 'headline', 'whatWeDid', 'whatWorked', 'whatDidnt', 'systemDecisions', 'cmoDecisions', 'nextWeek'],
  additionalProperties: false,
  properties: {
    weekEnding: { type: 'string', pattern: '^\\d{4}-\\d{2}-\\d{2}$' },
    headline: {
      type: 'array',
      minItems: 1,
      items: {
        type: 'object',
        required: ['metric', 'value'],
        additionalProperties: false,
        properties: {
          metric: text,
          value: text,
          // Week on week. "unmeasured" is an acceptable answer; a made-up
          // number is not.
          wow: { type: ['string', 'null'] }
        }
      }
    },
    whatWeDid: { type: 'array', items: bullet },
    whatWorked: { type: 'array', maxItems: 3, items: bullet },
    whatDidnt: { type: 'array', maxItems: 3, items: bullet },
    systemDecisions: { type: 'array', items: bullet },
    // The only section the CMO must act on. Empty is allowed, but only when
    // it is true.
    cmoDecisions: { type: 'array', items: bullet },
    nextWeek: { type: 'array', maxItems: 3, items: text }
  }
};
