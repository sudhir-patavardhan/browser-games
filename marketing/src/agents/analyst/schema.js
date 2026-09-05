/**
 * What the Analyst is allowed to write (AGENTS_SPEC.md §6.1).
 *
 * `insights.json` is read by the Strategist, the Media Buyer and the Chief of
 * Staff, so its shape is a contract between four Agents, not a preference.
 * Every recommendation carries its evidence and a confidence, because a
 * recommendation the next Agent cannot check is a recommendation it has to
 * take on faith.
 */

const number = { type: ['number', 'null'] };
const text = { type: 'string', minLength: 1 };

export const schema = {
  type: 'object',
  required: ['window', 'games', 'categories', 'windows', 'topAngles', 'anomalies', 'recommendations', 'paidReadiness'],
  additionalProperties: false,
  properties: {
    window: {
      type: 'object',
      required: ['days'],
      properties: { days: { type: 'number', minimum: 1 }, from: { type: ['string', 'null'] }, to: { type: ['string', 'null'] } }
    },
    games: {
      type: 'array',
      items: {
        type: 'object',
        required: ['gameId', 'impressions', 'linkClicks', 'players'],
        properties: {
          gameId: text,
          category: { type: ['string', 'null'] },
          impressions: number, linkClicks: number, sessions: number,
          gameStarts: number, players: number,
          ctrPercent: number, playRate: number,
          note: { type: ['string', 'null'] }
        }
      }
    },
    categories: {
      type: 'array',
      items: {
        type: 'object',
        required: ['category', 'players'],
        properties: { category: text, impressions: number, linkClicks: number, sessions: number, players: number, ctrPercent: number, playRate: number }
      }
    },
    windows: {
      type: 'array',
      items: {
        type: 'object',
        required: ['window', 'players'],
        properties: { window: { type: 'string', enum: ['09', '13', '17'] }, posts: number, impressions: number, linkClicks: number, players: number, ctrPercent: number }
      }
    },
    topAngles: {
      type: 'array',
      items: {
        type: 'object',
        required: ['angle', 'evidence'],
        properties: { angle: text, gameId: { type: ['string', 'null'] }, channel: { type: ['string', 'null'] }, evidence: text }
      }
    },
    anomalies: {
      type: 'array',
      items: {
        type: 'object',
        required: ['what', 'evidence'],
        properties: {
          what: text,
          evidence: text,
          // §6.1: sessions with near-zero game_start is a landing or tracking
          // fault, and saying so is not the same as saying the marketing failed.
          kind: { type: 'string', enum: ['marketing', 'landing', 'tracking', 'delivery'] }
        }
      }
    },
    recommendations: {
      type: 'array',
      items: {
        type: 'object',
        required: ['do', 'because', 'confidence'],
        properties: {
          do: text,
          // Every recommendation cites numbers. That is the rule the Analyst
          // exists to keep.
          because: text,
          confidence: { type: 'string', enum: ['high', 'medium', 'low'] }
        }
      }
    },
    paidReadiness: {
      type: ['object', 'null'],
      required: ['gameId', 'why'],
      properties: {
        gameId: text,
        category: { type: ['string', 'null'] },
        angle: { type: ['string', 'null'] },
        why: text,
        ready: { type: 'boolean' }
      }
    }
  }
};
