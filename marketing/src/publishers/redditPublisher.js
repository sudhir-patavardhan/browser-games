import { config } from '../config.js';

export class RedditPublisher {
  constructor(cfg = config.platforms.reddit) {
    this.cfg = cfg;
  }

  get isConfigured() {
    return Boolean(this.cfg.enabled);
  }

  /**
   * Publishes or simulates a post to a subreddit
   * @param {Object} post - { subreddit, title, bodyMarkdown, url }
   * @param {boolean} [dryRun]
   */
  async publish(post, dryRun = config.general.mode === 'draft') {
    const sub = (post.subreddit || 'r/webgames').replace(/^r\//, '');
    const title = post.title || 'Kreeda — Free browser games with 0 dependencies';

    if (dryRun || !this.isConfigured) {
      console.log(`[DRY-RUN / DRAFT] Reddit r/${sub}: "${title}"`);
      return {
        success: true,
        channel: 'reddit',
        subreddit: `r/${sub}`,
        mode: 'draft',
        postId: `sim-reddit-${Date.now()}`,
        url: `https://www.reddit.com/r/${sub}/submit?title=${encodeURIComponent(title)}`,
        publishedAt: new Date().toISOString()
      };
    }

    try {
      // 1. Obtain OAuth Token
      const tokenUrl = 'https://www.reddit.com/api/v1/access_token';
      const auth = Buffer.from(`${this.cfg.clientId}:${this.cfg.clientSecret}`).toString('base64');
      
      const tokenRes = await fetch(tokenUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${auth}`,
          'Content-Type': 'application/x-www-form-urlencoded',
          'User-Agent': this.cfg.userAgent
        },
        body: new URLSearchParams({
          grant_type: 'password',
          username: this.cfg.username,
          password: this.cfg.password
        })
      });

      if (!tokenRes.ok) {
        throw new Error(`Reddit Auth failed: ${await tokenRes.text()}`);
      }

      const tokenData = await tokenRes.json();
      const accessToken = tokenData.access_token;

      // 2. Submit post
      const submitUrl = 'https://oauth.reddit.com/api/submit';
      const submitParams = new URLSearchParams({
        sr: sub,
        kind: post.bodyMarkdown ? 'self' : 'link',
        title: title,
        resubmit: 'true',
        api_type: 'json'
      });

      if (post.bodyMarkdown) {
        submitParams.set('text', post.bodyMarkdown);
      } else if (post.url) {
        submitParams.set('url', post.url);
      }

      const submitRes = await fetch(submitUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'User-Agent': this.cfg.userAgent,
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: submitParams
      });

      const submitData = await submitRes.json();
      const postUrl = submitData?.json?.data?.url || `https://reddit.com/r/${sub}`;

      return {
        success: true,
        channel: 'reddit',
        subreddit: `r/${sub}`,
        mode: 'live',
        postId: submitData?.json?.data?.id,
        url: postUrl,
        publishedAt: new Date().toISOString()
      };
    } catch (err) {
      console.error('Reddit publish failed:', err.message);
      return {
        success: false,
        channel: 'reddit',
        error: err.message,
        publishedAt: new Date().toISOString()
      };
    }
  }
}
