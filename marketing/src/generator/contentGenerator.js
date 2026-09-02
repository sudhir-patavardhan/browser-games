import fs from 'node:fs';
import path from 'node:path';
import { config } from '../config.js';
import { GAME_CATALOG } from '../knowledge/catalog.js';
import { AUDIENCES } from '../knowledge/audiences.js';
import { GeminiClient } from '../ai/geminiClient.js';
import { SYSTEM_PROMPTS, PROMPT_TEMPLATES } from '../ai/prompts.js';

export class ContentGenerator {
  constructor(geminiClient = new GeminiClient()) {
    this.ai = geminiClient;
  }

  /**
   * Generates marketing material for a specific game
   * @param {string} gameId - e.g. 'drift', 'carrom', 'hub'
   * @param {'twitter'|'facebook'} channel
   * @param {Object} [options]
   */
  async generate(gameId, channel, options = {}) {
    if (!['twitter', 'facebook'].includes(channel)) {
      throw new Error(`Unsupported channel: ${channel}. Supported channels: 'twitter', 'facebook'.`);
    }

    const game = GAME_CATALOG[gameId] || GAME_CATALOG.hub;
    let result = null;

    if (channel === 'twitter') {
      const isThread = options.isThread || false;
      if (isThread) {
        result = await this.ai.generate({
          prompt: PROMPT_TEMPLATES.twitterThread(game, options.angle || 'technical'),
          systemInstruction: SYSTEM_PROMPTS.marketingStrategist,
          jsonMode: true
        });
      } else {
        result = await this.ai.generate({
          prompt: PROMPT_TEMPLATES.twitterSingle(game, options.context || ''),
          systemInstruction: SYSTEM_PROMPTS.marketingStrategist,
          jsonMode: true
        });
      }
    } else if (channel === 'facebook') {
      result = await this.ai.generate({
        prompt: PROMPT_TEMPLATES.twitterSingle(game, options.context || ''),
        systemInstruction: SYSTEM_PROMPTS.marketingStrategist,
        jsonMode: true
      });
    }

    // Save as local artifact
    const artifactPath = this.saveArtifact(channel, gameId, result);
    return {
      gameId,
      channel,
      content: result,
      artifactPath,
      createdAt: new Date().toISOString()
    };
  }

  /**
   * Generates a social campaign for a game across Twitter and Facebook
   * @param {string} gameId
   */
  async generateFullCampaign(gameId) {
    const game = GAME_CATALOG[gameId] || GAME_CATALOG.hub;
    console.log(`🚀 Generating social campaign for ${game.name}...`);

    const [twitterSingle, twitterThread, facebook] = await Promise.all([
      this.generate(gameId, 'twitter', { isThread: false }),
      this.generate(gameId, 'twitter', { isThread: true, angle: 'technical' }),
      this.generate(gameId, 'facebook')
    ]);

    const campaign = {
      id: `campaign-${gameId}-${Date.now()}`,
      gameId,
      gameName: game.name,
      createdAt: new Date().toISOString(),
      deliverables: {
        twitterSingle,
        twitterThread,
        facebook
      }
    };

    const campaignPath = path.join(config.paths.artifacts, `campaign-${gameId}-${Date.now()}.json`);
    fs.writeFileSync(campaignPath, JSON.stringify(campaign, null, 2));
    console.log(`✅ Campaign generated and saved to ${campaignPath}`);
    return campaign;
  }

  saveArtifact(channel, gameId, data) {
    const channelDir = path.join(config.paths.artifacts, channel);
    if (!fs.existsSync(channelDir)) {
      fs.mkdirSync(channelDir, { recursive: true });
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `${gameId}-${timestamp}.json`;
    const filePath = path.join(channelDir, filename);

    fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
    return filePath;
  }
}
