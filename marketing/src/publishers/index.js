import { TwitterPublisher } from './twitterPublisher.js';
import { FacebookPublisher } from './facebookPublisher.js';

export class UniversalPublisher {
  constructor() {
    this.twitter = new TwitterPublisher();
    this.facebook = new FacebookPublisher();
  }

  /**
   * Publishes content to the target channel
   * @param {string} channel - 'twitter' | 'facebook'
   * @param {Object} content - Post payload
   * @param {boolean} [dryRun]
   */
  async publish(channel, content, dryRun) {
    switch (channel) {
      case 'twitter':
        return await this.twitter.publish(content, dryRun);
      case 'facebook':
        return await this.facebook.publish(content, dryRun);
      default:
        throw new Error(`Unsupported channel: ${channel}. Supported channels: 'twitter', 'facebook'.`);
    }
  }

  /**
   * Returns a status report of which platform credentials are configured
   */
  getStatus() {
    return {
      twitter: this.twitter.isConfigured,
      facebook: this.facebook.isConfigured
    };
  }
}
