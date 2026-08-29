import { TwitterPublisher } from './twitterPublisher.js';
import { RedditPublisher } from './redditPublisher.js';
import { DiscordPublisher } from './discordPublisher.js';
import { WebhookPublisher } from './webhookPublisher.js';
import { DevtoPublisher } from './devtoPublisher.js';

export class UniversalPublisher {
  constructor() {
    this.twitter = new TwitterPublisher();
    this.reddit = new RedditPublisher();
    this.discord = new DiscordPublisher();
    this.webhook = new WebhookPublisher();
    this.devto = new DevtoPublisher();
  }

  /**
   * Publishes content to the target channel
   * @param {string} channel - 'twitter' | 'reddit' | 'discord' | 'webhook' | 'devto' | 'shorts'
   * @param {Object} content - Post payload
   * @param {boolean} [dryRun]
   */
  async publish(channel, content, dryRun) {
    switch (channel) {
      case 'twitter':
        return await this.twitter.publish(content, dryRun);
      case 'reddit':
        return await this.reddit.publish(content, dryRun);
      case 'discord':
        return await this.discord.publish(content, dryRun);
      case 'devto':
        return await this.devto.publish(content, dryRun);
      case 'shorts':
      case 'webhook':
      default:
        return await this.webhook.publish(content, dryRun);
    }
  }

  /**
   * Returns a status report of which platform credentials are configured
   */
  getStatus() {
    return {
      twitter: this.twitter.isConfigured,
      reddit: this.reddit.isConfigured,
      discord: this.discord.isConfigured,
      devto: this.devto.isConfigured,
      webhook: this.webhook.isConfigured
    };
  }
}
