/**
 * What the Strategist is allowed to write (AGENTS_SPEC.md §6.2).
 *
 * Every item becomes a Draft Post, so the fields here are the fields the
 * Creative will fill and the CMO will approve. `slot` is validated hard: a
 * Post with a Slot the Producer cannot parse never publishes and quietly
 * expires three days later.
 */

const text = { type: 'string', minLength: 1 };

export const schema = {
  type: 'object',
  required: ['weekOf', 'strategy', 'items'],
  additionalProperties: false,
  properties: {
    weekOf: { type: 'string', pattern: '^\\d{4}-\\d{2}-\\d{2}$' },
    // One paragraph, citing the insights it came from. The Chief of Staff
    // quotes this to the CMO.
    strategy: { type: 'string', minLength: 40 },
    items: {
      type: 'array',
      minItems: 1,
      maxItems: 14,
      items: {
        type: 'object',
        required: ['slot', 'channel', 'gameId', 'format', 'angle', 'brief'],
        additionalProperties: false,
        properties: {
          slot: {
            type: 'object',
            required: ['date', 'window'],
            additionalProperties: false,
            properties: {
              date: { type: 'string', pattern: '^\\d{4}-\\d{2}-\\d{2}$' },
              window: { type: 'string', enum: ['09', '13', '17'] }
            }
          },
          channel: { type: 'string', enum: ['x', 'facebook'] },
          gameId: text,
          category: { type: ['string', 'null'] },
          format: { type: 'string', enum: ['single', 'thread', 'video', 'image'] },
          angle: text,
          persona: { type: ['string', 'null'] },
          // What the Creative is being asked to write. Two or three sentences.
          brief: { type: 'string', minLength: 20 },
          successMetric: { type: ['string', 'null'] },
          // §6.2: every angle traces to an insight or is labelled an
          // experiment. This is that label, and it is not optional.
          basis: { type: 'string', enum: ['insight', 'experiment'] },
          because: { type: ['string', 'null'] }
        }
      }
    },
    adsFocus: {
      type: ['object', 'null'],
      required: ['gameId', 'rationale'],
      properties: {
        gameId: text,
        category: { type: ['string', 'null'] },
        angle: { type: ['string', 'null'] },
        rationale: text
      }
    },
    experiments: { type: 'array', maxItems: 1, items: text }
  }
};
