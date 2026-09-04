import { config } from '../config.js';

export class FacebookPublisher {
  constructor(cfg = config.platforms.facebook) {
    this.cfg = cfg;
  }

  get isConfigured() {
    return Boolean(this.cfg.pageToken && this.cfg.pageId);
  }

  /**
   * Publishes a post to Facebook
   * @param {Object} post - { text, videoPath }
   * @param {boolean} [dryRun]
   */
  async publish(post, dryRun = config.general.mode === 'draft') {
    const text = typeof post === 'string' ? post : (post.text || post.headline || '');
    const videoPath = typeof post === 'object' ? post.videoPath : undefined;

    if (dryRun || !this.isConfigured) {
      console.log(`[DRY-RUN / DRAFT] Facebook Post: "${text.slice(0, 100)}..."${videoPath ? ` (+ video: ${videoPath})` : ''}`);
      return {
        success: true,
        channel: 'facebook',
        mode: 'draft',
        postId: `sim-fb-${Date.now()}`,
        url: `https://facebook.com/${this.cfg.pageId}`,
        publishedAt: new Date().toISOString()
      };
    }

    try {
      const endpoint = `https://graph.facebook.com/v18.0/${this.cfg.pageId}/feed`;
      const params = new URLSearchParams({
        message: text,
        access_token: this.cfg.pageToken
      });

      let body;
      let headers = {};

      if (videoPath) {
        const form = new FormData();
        form.append('message', text);
        form.append('video_file', new File([await this.readFile(videoPath)], 'video.mp4', { type: 'video/mp4' }));
        form.append('access_token', this.cfg.pageToken);
        body = form;
      } else {
        body = params;
        headers['Content-Type'] = 'application/x-www-form-urlencoded';
      }

      const res = await fetch(endpoint, {
        method: 'POST',
        headers,
        body
      });

      if (!res.ok) {
        const errText = await res.text();
        throw new Error(`Facebook API error [${res.status}]: ${errText}`);
      }

      const data = await res.json();
      return {
        success: true,
        channel: 'facebook',
        mode: 'live',
        postId: data.id,
        url: `https://facebook.com/${data.id}`,
        publishedAt: new Date().toISOString()
      };
    } catch (err) {
      console.error('Facebook publish failed:', err.message);
      return {
        success: false,
        channel: 'facebook',
        error: err.message,
        publishedAt: new Date().toISOString()
      };
    }
  }

  async readFile(filePath) {
    const fs = await import('node:fs/promises');
    return fs.readFile(filePath);
  }
}
