import crypto from 'node:crypto';
import { config } from '../config.js';

function percentEncode(str) {
  return encodeURIComponent(str).replace(/[!*'()]/g, c => '%' + c.charCodeAt(0).toString(16).toUpperCase());
}

/**
 * Builds an OAuth 1.0a "Authorization" header for a user-context request.
 * Twitter's POST /2/tweets requires OAuth 1.0a or OAuth2 user-context auth —
 * a bare app-only bearer token cannot post on behalf of a user account.
 */
function buildOAuth1Header({ method, url, consumerKey, consumerSecret, accessToken, tokenSecret }) {
  const oauthParams = {
    oauth_consumer_key: consumerKey,
    oauth_nonce: crypto.randomBytes(16).toString('hex'),
    oauth_signature_method: 'HMAC-SHA1',
    oauth_timestamp: Math.floor(Date.now() / 1000).toString(),
    oauth_token: accessToken,
    oauth_version: '1.0'
  };

  const paramString = Object.keys(oauthParams)
    .sort()
    .map(k => `${percentEncode(k)}=${percentEncode(oauthParams[k])}`)
    .join('&');

  const baseString = [method.toUpperCase(), percentEncode(url), percentEncode(paramString)].join('&');
  const signingKey = `${percentEncode(consumerSecret)}&${percentEncode(tokenSecret)}`;
  const signature = crypto.createHmac('sha1', signingKey).update(baseString).digest('base64');

  const headerParams = { ...oauthParams, oauth_signature: signature };
  return 'OAuth ' + Object.keys(headerParams)
    .sort()
    .map(k => `${percentEncode(k)}="${percentEncode(headerParams[k])}"`)
    .join(', ');
}

export class TwitterPublisher {
  constructor(cfg = config.platforms.twitter) {
    this.cfg = cfg;
  }

  get isConfigured() {
    return Boolean(this.cfg.apiKey && this.cfg.apiSecret && this.cfg.accessToken && this.cfg.accessTokenSecret);
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
      // Live Twitter API v2 POST /2/tweets (OAuth 1.0a user context)
      const endpoint = 'https://api.twitter.com/2/tweets';
      const headers = {
        'Content-Type': 'application/json',
        'Authorization': buildOAuth1Header({
          method: 'POST',
          url: endpoint,
          consumerKey: this.cfg.apiKey,
          consumerSecret: this.cfg.apiSecret,
          accessToken: this.cfg.accessToken,
          tokenSecret: this.cfg.accessTokenSecret
        })
      };

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
