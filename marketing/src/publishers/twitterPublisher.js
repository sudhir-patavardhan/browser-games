import fs from 'node:fs';
import { config } from '../config.js';
import { buildOAuth1Header } from '../ads/oauth1.js';
import { X } from '../knowledge/channels.js';

// Twitter's POST /2/tweets requires OAuth 1.0a or OAuth2 user-context auth —
// a bare app-only bearer token cannot post on behalf of a user account. The
// signer lives in ads/oauth1.js because the X Ads API uses the same scheme.

export class TwitterPublisher {
  constructor(cfg = config.platforms.twitter) {
    this.cfg = cfg;
  }

  get isConfigured() {
    return Boolean(this.cfg.apiKey && this.cfg.apiSecret && this.cfg.accessToken && this.cfg.accessTokenSecret);
  }

  authHeader(method, url, signedParams) {
    return buildOAuth1Header({
      method,
      url,
      consumerKey: this.cfg.apiKey,
      consumerSecret: this.cfg.apiSecret,
      accessToken: this.cfg.accessToken,
      tokenSecret: this.cfg.accessTokenSecret,
      signedParams
    });
  }

  /**
   * Uploads a video via Twitter's chunked media upload (v1.1) and returns
   * a media_id_string usable in POST /2/tweets' media.media_ids.
   * @param {string} filePath - path to an .mp4 file
   */
  async uploadVideo(filePath) {
    const bytes = fs.readFileSync(filePath);
    const uploadUrl = 'https://upload.twitter.com/1.1/media/upload.json';

    // INIT
    const initParams = {
      command: 'INIT',
      total_bytes: String(bytes.length),
      media_type: 'video/mp4',
      media_category: 'tweet_video'
    };
    const initRes = await fetch(`${uploadUrl}?${new URLSearchParams(initParams)}`, {
      method: 'POST',
      headers: { Authorization: this.authHeader('POST', uploadUrl, initParams) }
    });
    if (!initRes.ok) throw new Error(`Twitter media INIT failed [${initRes.status}]: ${await initRes.text()}`);
    const { media_id_string: mediaId } = await initRes.json();

    // APPEND — chunked, 4MB per segment. command/media_id/segment_index travel
    // as signed query params; only the raw chunk goes in the multipart body.
    const chunkSize = 4 * 1024 * 1024;
    let segmentIndex = 0;
    for (let offset = 0; offset < bytes.length; offset += chunkSize) {
      const chunk = bytes.subarray(offset, offset + chunkSize);
      const appendParams = { command: 'APPEND', media_id: mediaId, segment_index: String(segmentIndex) };
      const form = new FormData();
      form.set('media', new Blob([chunk]));
      const appendRes = await fetch(`${uploadUrl}?${new URLSearchParams(appendParams)}`, {
        method: 'POST',
        headers: { Authorization: this.authHeader('POST', uploadUrl, appendParams) },
        body: form
      });
      if (!appendRes.ok) throw new Error(`Twitter media APPEND failed [${appendRes.status}]: ${await appendRes.text()}`);
      segmentIndex++;
    }

    // FINALIZE
    const finalizeParams = { command: 'FINALIZE', media_id: mediaId };
    const finalizeRes = await fetch(`${uploadUrl}?${new URLSearchParams(finalizeParams)}`, {
      method: 'POST',
      headers: { Authorization: this.authHeader('POST', uploadUrl, finalizeParams) }
    });
    if (!finalizeRes.ok) throw new Error(`Twitter media FINALIZE failed [${finalizeRes.status}]: ${await finalizeRes.text()}`);
    let status = await finalizeRes.json();

    // Poll STATUS until Twitter finishes transcoding, if needed
    let processingInfo = status.processing_info;
    const deadline = Date.now() + 60000;
    while (processingInfo && processingInfo.state !== 'succeeded') {
      if (processingInfo.state === 'failed') {
        throw new Error(`Twitter media processing failed: ${JSON.stringify(processingInfo.error || {})}`);
      }
      if (Date.now() > deadline) {
        throw new Error('Twitter media processing timed out after 60s');
      }
      await new Promise(r => setTimeout(r, (processingInfo.check_after_secs || 2) * 1000));

      const statusParams = { command: 'STATUS', media_id: mediaId };
      const statusRes = await fetch(`${uploadUrl}?${new URLSearchParams(statusParams)}`, {
        method: 'GET',
        headers: { Authorization: this.authHeader('GET', uploadUrl, statusParams) }
      });
      if (!statusRes.ok) throw new Error(`Twitter media STATUS failed [${statusRes.status}]: ${await statusRes.text()}`);
      status = await statusRes.json();
      processingInfo = status.processing_info;
    }

    return mediaId;
  }

  /**
   * Publishes a tweet or thread
   * @param {Object} post - { text, thread, hashtags, videoPath }
   * @param {boolean} [dryRun]
   */
  async publish(post, dryRun = config.general.mode === 'draft') {
    if (post && typeof post === 'object' && Array.isArray(post.thread) && post.thread.length > 0) {
      return await this.publishThread(post.thread, dryRun);
    }

    const text = typeof post === 'string' ? post : (post.text || post.headline || '');
    const videoPath = typeof post === 'object' ? post.videoPath : undefined;

    if (dryRun || !this.isConfigured) {
      console.log(`[DRY-RUN / DRAFT] Twitter Post: "${text.slice(0, 100)}..."${videoPath ? ` (+ video: ${videoPath})` : ''}`);
      return {
        success: true,
        channel: X,
        mode: 'draft',
        postId: `sim-tweet-${Date.now()}`,
        url: `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`,
        publishedAt: new Date().toISOString()
      };
    }

    try {
      let mediaIds;
      if (videoPath) {
        const mediaId = await this.uploadVideo(videoPath);
        mediaIds = [mediaId];
      }

      // Live Twitter API v2 POST /2/tweets (OAuth 1.0a user context)
      const endpoint = 'https://api.twitter.com/2/tweets';
      const headers = {
        'Content-Type': 'application/json',
        'Authorization': this.authHeader('POST', endpoint)
      };

      const body = { text };
      if (mediaIds) body.media = { media_ids: mediaIds };

      const res = await fetch(endpoint, {
        method: 'POST',
        headers,
        body: JSON.stringify(body)
      });

      if (!res.ok) {
        const errText = await res.text();
        throw new Error(`Twitter API error [${res.status}]: ${errText}`);
      }

      const data = await res.json();
      return {
        success: true,
        channel: X,
        mode: 'live',
        postId: data.data?.id,
        url: `https://twitter.com/i/web/status/${data.data?.id}`,
        publishedAt: new Date().toISOString()
      };
    } catch (err) {
      console.error('Twitter publish failed:', err.message);
      return {
        success: false,
        channel: X,
        error: err.message,
        publishedAt: new Date().toISOString()
      };
    }
  }

  /**
   * Publishes a thread: the first tweet, then each following tweet as a
   * reply to the one before it.
   * @param {Array<{text: string}>} tweets
   * @param {boolean} [dryRun]
   */
  async publishThread(tweets, dryRun = config.general.mode === 'draft') {
    const texts = tweets.map(t => (typeof t === 'string' ? t : t.text || '')).filter(Boolean);

    if (texts.length === 0) {
      return {
        success: false,
        channel: X,
        error: 'Thread has no tweet text',
        publishedAt: new Date().toISOString()
      };
    }

    if (dryRun || !this.isConfigured) {
      console.log(`[DRY-RUN / DRAFT] Twitter Thread (${texts.length} tweets): "${texts[0].slice(0, 100)}..."`);
      return {
        success: true,
        channel: X,
        mode: 'draft',
        postId: `sim-thread-${Date.now()}`,
        url: `https://twitter.com/intent/tweet?text=${encodeURIComponent(texts[0])}`,
        threadCount: texts.length,
        publishedAt: new Date().toISOString()
      };
    }

    const endpoint = 'https://api.twitter.com/2/tweets';
    const postedIds = [];

    try {
      let previousId;
      for (const text of texts) {
        const body = { text };
        if (previousId) body.reply = { in_reply_to_tweet_id: previousId };

        const res = await fetch(endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': this.authHeader('POST', endpoint)
          },
          body: JSON.stringify(body)
        });

        if (!res.ok) {
          const errText = await res.text();
          throw new Error(`Twitter API error [${res.status}]: ${errText}`);
        }

        const data = await res.json();
        previousId = data.data?.id;
        postedIds.push(previousId);
      }

      return {
        success: true,
        channel: X,
        mode: 'live',
        postId: postedIds[0],
        url: `https://twitter.com/i/web/status/${postedIds[0]}`,
        threadIds: postedIds,
        publishedAt: new Date().toISOString()
      };
    } catch (err) {
      console.error('Twitter thread publish failed:', err.message);
      return {
        success: false,
        channel: X,
        error: err.message,
        threadIds: postedIds,
        publishedAt: new Date().toISOString()
      };
    }
  }
}
