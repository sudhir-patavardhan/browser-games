import { TwitterPublisher } from './twitterPublisher.js';
import { FacebookPublisher } from './facebookPublisher.js';
import { X, FACEBOOK, toChannel } from '../knowledge/channels.js';

/** Publishes a Post to whichever Channel its Slot names. */
export class UniversalPublisher {
  constructor() {
    this.publishers = {
      [X]: new TwitterPublisher(),
      [FACEBOOK]: new FacebookPublisher()
    };
  }

  /**
   * @param {string} channel a Channel, in any spelling `toChannel` accepts.
   * @param {Object} content the Post payload.
   * @param {boolean} [dryRun] when true, nothing leaves this machine.
   */
  async publish(channel, content, dryRun) {
    return this.publishers[toChannel(channel)].publish(content, dryRun);
  }

  /** Which Channels the Producer holds credentials for. */
  getStatus() {
    return {
      [X]: this.publishers[X].isConfigured,
      [FACEBOOK]: this.publishers[FACEBOOK].isConfigured
    };
  }
}
