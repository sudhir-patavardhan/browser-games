import { config } from '../config.js';
import { FACEBOOK } from '../knowledge/channels.js';
import { GRAPH_VERSION } from './facebookAccess.js';

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
    // One attachment per Post: a video wins over a card when both exist.
    const imagePath = typeof post === 'object' && !videoPath ? post.imagePath : undefined;

    if (dryRun || !this.isConfigured) {
      console.log(`[DRY-RUN / DRAFT] Facebook Post: "${text.slice(0, 100)}..."${videoPath ? ` (+ video: ${videoPath})` : ''}${imagePath ? ` (+ card: ${imagePath})` : ''}`);
      return {
        success: true,
        channel: FACEBOOK,
        mode: 'draft',
        postId: `sim-fb-${Date.now()}`,
        url: `https://facebook.com/${this.cfg.pageId}`,
        publishedAt: new Date().toISOString()
      };
    }

    try {
      // Each kind of Post has its own endpoint: plain text to the Page's feed,
      // a video Asset to /videos, a card to /photos. /feed accepts neither
      // attachment (§11).
      const node = videoPath ? 'videos' : imagePath ? 'photos' : 'feed';
      const endpoint = `https://graph.facebook.com/${GRAPH_VERSION}/${this.cfg.pageId}/${node}`;

      let body;
      const headers = {};

      if (videoPath) {
        const form = new FormData();
        form.append('description', text);
        form.append('source', new File([await this.readFile(videoPath)], 'video.mp4', { type: 'video/mp4' }));
        form.append('access_token', this.cfg.pageToken);
        body = form;
      } else if (imagePath) {
        const form = new FormData();
        form.append('message', text);
        form.append('source', new File([await this.readFile(imagePath)], 'card.png', { type: 'image/png' }));
        form.append('access_token', this.cfg.pageToken);
        body = form;
      } else {
        body = new URLSearchParams({ message: text, access_token: this.cfg.pageToken });
        headers['Content-Type'] = 'application/x-www-form-urlencoded';
      }

      const res = await fetch(endpoint, { method: 'POST', headers, body });

      if (!res.ok) {
        const errText = await res.text();
        throw new Error(`Facebook API error [${res.status}]: ${errText}`);
      }

      const data = await res.json();
      // /photos answers with the photo's own id and, separately, the id of the
      // Post it created. Insights and permalinks are keyed on the Post, so
      // storing the photo id would leave the Analyst unable to read it.
      const postId = data.post_id || data.id;
      return {
        success: true,
        channel: FACEBOOK,
        mode: 'live',
        postId,
        photoId: data.post_id ? data.id : undefined,
        url: `https://facebook.com/${postId}`,
        publishedAt: new Date().toISOString()
      };
    } catch (err) {
      console.error('Facebook publish failed:', err.message);
      return {
        success: false,
        channel: FACEBOOK,
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
