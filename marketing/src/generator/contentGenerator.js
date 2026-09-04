import { GAME_CATALOG } from '../knowledge/catalog.js';
import { GeminiClient } from '../ai/geminiClient.js';
import { SYSTEM_PROMPTS, PROMPT_TEMPLATES } from '../ai/prompts.js';

/**
 * Turns a brief into the text of one Post.
 *
 * This is the model half of the Creative (AGENTS_SPEC.md §6.3). It writes and
 * returns; it does not save anything. The per-generation dumps it used to
 * leave under artifacts/<channel>/ are retired by the delete list — what a
 * Post says lives on the Post, in the queue, on the marketing-state branch,
 * and its rendered Assets live on the media release (ADR 0003).
 */
export class ContentGenerator {
  constructor(geminiClient = new GeminiClient()) {
    this.ai = geminiClient;
  }

  /**
   * Writes the content for one Post.
   * @param {string} gameId
   * @param {'x'|'facebook'} channel
   * @param {Object} [options]
   * @param {boolean} [options.isThread] X only: a thread rather than a single Post.
   * @param {string} [options.angle]
   * @param {string} [options.context]
   */
  async generate(gameId, channel, options = {}) {
    if (!['x', 'facebook'].includes(channel)) {
      throw new Error(`Unsupported Channel: ${channel}. There are two: 'x' and 'facebook'.`);
    }

    const game = GAME_CATALOG[gameId] || GAME_CATALOG.hub;

    // TODO(Phase 2, §6.3): Facebook needs its own longer-form facebookPost
    // prompt. Until it exists, both Channels share the X prompt, which is why
    // the Facebook lane is not live yet.
    const prompt = channel === 'x' && options.isThread
      ? PROMPT_TEMPLATES.twitterThread(game, options.angle || 'technical')
      : PROMPT_TEMPLATES.twitterSingle(game, options.context || '');

    const content = await this.ai.generate({
      prompt,
      systemInstruction: SYSTEM_PROMPTS.marketingStrategist,
      jsonMode: true
    });

    return { gameId, channel, content, createdAt: new Date().toISOString() };
  }
}
