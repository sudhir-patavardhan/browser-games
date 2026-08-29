import { config } from '../config.js';

export class TwitterPublisher {
  constructor(cfg = config.platforms.twitter) {
    this.cfg = cfg;
  }

  get isConfigured() {
    return Boolean(this.cfg.enabled || this.cfg.bearerToken);
  }

  /**
   * Publishes a tweet or thread
   * @param {Object} post - { text, thread, hashtags }
   * @param {boolean} [dryRun]
   */
  async publish(post, dryRun = config.general.mode === 'draft') {
    const text = typeof post === 'string' ? post : (post.text || post.headline || '');

    if (dryRun || !this.isConfigured) {
      console.log(`[DRY-RUN / DRAFT] Twitter Post: "${text.slice(0, 100)}..."`);
      return {
        success: true,
        channel: 'twitter',
        mode: 'draft',
        postId: `sim-tweet-${Date.now()}`,
        url: `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`,
        publishedAt: new Date().toISOString()
      };
    }

    try {
      // Live Twitter API v2 POST /2/tweets
      const endpoint = 'https://api.twitter.com/2/tweets';
      const headers = {
        'Content-Type': 'application/json'
      };

      if (this.cfg.bearerToken) {
        headers['Authorization'] = `Bearer ${this.cfg.bearerToken}`;
      }

      const res = await fetch(endpoint, {
        method: 'POST',
        headers,
        body: JSON.stringify({ text })
      });

      if (!res.ok) {
        const errText = await res.text();
        throw new Error(`Twitter API error [${res.status}]: ${errText}`);
      }

      const data = await res.json();
      return {
        success: true,
        channel: 'twitter',
        mode: 'live',
        postId: data.data?.id,
        url: `https://twitter.com/i/web/status/${data.data?.id}`,
        publishedAt: new Date().toISOString()
      };
    } catch (err) {
      console.error('Twitter publish failed:', err.message);
      return {
        success: false,
        channel: 'twitter',
        error: err.message,
        publishedAt: new Date().toISOString()
      };
    }
  }
}
