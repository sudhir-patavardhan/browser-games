/**
 * What a Post-mortem must contain (AGENTS_SPEC.md §6.5).
 *
 * This file is the Media Buyer's mandatory input, and `label` is what the
 * budget ladder reads: a Winner earns a doubled budget, two consecutive Losers
 * stop the Game getting money at all. So "Winner" is a decision about the next
 * Campaign's money, not a compliment.
 */

const text = { type: 'string', minLength: 1 };

export const schema = {
  type: 'object',
  required: ['campaignId', 'gameId', 'angle', 'label', 'angleVerdict', 'gameVerdict', 'changeNextTime'],
  additionalProperties: false,
  properties: {
    campaignId: text,
    gameId: text,
    angle: text,
    channel: { type: ['string', 'null'] },
    label: { type: 'string', enum: ['Winner', 'Loser'] },
    // §6.5: the angle is judged separately from the Game. An angle can fail on
    // a Game worth backing, and the next Campaign needs to know which failed.
    angleVerdict: text,
    gameVerdict: text,
    promisedVsDelivered: { type: ['string', 'null'] },
    costPerPlayerUsd: { type: ['number', 'null'] },
    costPerClickUsd: { type: ['number', 'null'] },
    playersFromCampaign: { type: ['number', 'null'] },
    // One thing. A list of six is a list nobody acts on.
    changeNextTime: text,
    dailyBudgetUsd: { type: ['number', 'null'] }
  }
};
