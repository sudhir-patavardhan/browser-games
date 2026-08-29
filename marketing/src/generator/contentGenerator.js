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
   * Generates marketing material for a specific game and channel
   * @param {string} gameId - e.g. 'drift', 'carrom', 'hub'
   * @param {'twitter'|'reddit'|'hackernews'|'producthunt'|'shorts'|'devto'} channel
   * @param {Object} [options]
   */
  async generate(gameId, channel, options = {}) {
    const game = GAME_CATALOG[gameId] || GAME_CATALOG.hub;
    let result = null;

    switch (channel) {
      case 'twitter': {
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
        break;
      }

      case 'reddit': {
        const subreddit = options.subreddit || 'r/webgames';
        result = await this.ai.generate({
          prompt: PROMPT_TEMPLATES.redditPost(game, subreddit),
          systemInstruction: SYSTEM_PROMPTS.marketingStrategist,
          jsonMode: true
        });
        break;
      }

      case 'hackernews': {
        result = await this.ai.generate({
          prompt: PROMPT_TEMPLATES.hackerNewsPost(game, options.type || 'Show HN'),
          systemInstruction: SYSTEM_PROMPTS.marketingStrategist,
          jsonMode: true
        });
        break;
      }

      case 'producthunt': {
        result = await this.ai.generate({
          prompt: PROMPT_TEMPLATES.productHuntKit(),
          systemInstruction: SYSTEM_PROMPTS.marketingStrategist,
          jsonMode: true
        });
        break;
      }

      case 'shorts': {
        result = await this.ai.generate({
          prompt: PROMPT_TEMPLATES.shortVideoScript(game),
          systemInstruction: SYSTEM_PROMPTS.marketingStrategist,
          jsonMode: true
        });
        break;
      }

      case 'devto': {
        result = await this.ai.generate({
          prompt: PROMPT_TEMPLATES.devtoArticle(game),
          systemInstruction: SYSTEM_PROMPTS.marketingStrategist,
          jsonMode: true
        });
        break;
      }

      default:
        throw new Error(`Unknown marketing channel: ${channel}`);
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
   * Generates a 360-degree cross-platform launch campaign for a game
   * @param {string} gameId
   */
  async generateFullCampaign(gameId) {
    const game = GAME_CATALOG[gameId] || GAME_CATALOG.hub;
    console.log(`🚀 Generating 360° campaign for ${game.name}...`);

    const [twitterSingle, twitterThread, redditWebgames, redditIndiedev, hackerNews, shortVideo, devArticle] = await Promise.all([
      this.generate(gameId, 'twitter', { isThread: false }),
      this.generate(gameId, 'twitter', { isThread: true, angle: 'technical' }),
      this.generate(gameId, 'reddit', { subreddit: 'r/webgames' }),
      this.generate(gameId, 'reddit', { subreddit: 'r/indiegames' }),
      this.generate(gameId, 'hackernews', { type: 'Show HN' }),
      this.generate(gameId, 'shorts'),
      this.generate(gameId, 'devto')
    ]);

    const campaign = {
      id: `campaign-${gameId}-${Date.now()}`,
      gameId,
      gameName: game.name,
      createdAt: new Date().toISOString(),
      deliverables: {
        twitterSingle,
        twitterThread,
        redditWebgames,
        redditIndiedev,
        hackerNews,
        shortVideo,
        devArticle
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
