/**
 * What the Media Buyer is allowed to propose (AGENTS_SPEC.md §6.4).
 *
 * A proposal is what the CMO ticks in the Review, so every field here is
 * something a person has to be able to read and agree to — including
 * `expectedOutcome`, which is the promise the Post-mortem later measures the
 * Campaign against.
 */

const text = { type: 'string', minLength: 1 };
const usd = { type: 'number', minimum: 0 };

export const schema = {
  type: 'object',
  required: ['gameId', 'angle', 'channel', 'tweetText', 'targeting', 'budget', 'expectedOutcome'],
  additionalProperties: false,
  properties: {
    channel: { type: 'string', enum: ['x', 'facebook'] },
    gameId: text,
    category: { type: ['string', 'null'] },
    angle: text,
    // The ad copy. §9.3: no hashtags, no @mentions, bare URL, ≤ 240 chars —
    // enforced in accept, where breaking it costs the Agent a retry.
    tweetText: { type: 'string', minLength: 1, maxLength: 240 },
    headline: { type: ['string', 'null'] },
    creative: {
      type: ['object', 'null'],
      required: ['type'],
      properties: { type: { type: 'string', enum: ['video', 'text', 'image'] }, assetUrl: { type: ['string', 'null'] } }
    },
    targeting: {
      type: 'object',
      required: ['countries'],
      additionalProperties: false,
      properties: {
        ageBucket: { type: ['string', 'null'] },
        interests: { type: 'array', items: text },
        keywords: { type: 'array', items: text },
        countries: { type: 'array', minItems: 1, items: { type: 'string', pattern: '^[A-Z]{2}$' } }
      }
    },
    budget: {
      type: 'object',
      required: ['dailyUsd', 'suggestedBecause'],
      additionalProperties: false,
      properties: {
        dailyUsd: usd,
        trialDays: { type: 'number', minimum: 1 },
        totalCapUsd: usd,
        // Why this number and not another. The budget rules are written in
        // Post-mortem terms, so this is where the Agent shows it read them.
        suggestedBecause: text
      }
    },
    expectedOutcome: {
      type: 'object',
      required: ['estClicks', 'estCpcUsd', 'basis'],
      additionalProperties: false,
      properties: {
        estClicks: { type: 'number', minimum: 0 },
        estCpcUsd: usd,
        estPlayers: { type: ['number', 'null'] },
        basis: text
      }
    }
  }
};
