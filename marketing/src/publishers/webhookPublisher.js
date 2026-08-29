import { config } from '../config.js';

export class WebhookPublisher {
  constructor(url = config.platforms.genericWebhook.url) {
    this.url = url;
  }

  get isConfigured() {
    return Boolean(this.url);
  }

  /**
   * Dispatches marketing payload to a generic webhook (Buffer, Make, Zapier, n8n)
   * @param {Object} payload
   * @param {boolean} [dryRun]
   */
  async publish(payload, dryRun = config.general.mode === 'draft') {
    if (dryRun || !this.isConfigured) {
      console.log(`[DRY-RUN / DRAFT] Webhook Payload dispatched for: ${payload.channel || 'generic'}`);
      return {
        success: true,
        channel: 'webhook',
        mode: 'draft',
        publishedAt: new Date().toISOString()
      };
    }

    try {
      const res = await fetch(this.url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          source: 'kreeda-marketing-agent',
          dispatchedAt: new Date().toISOString(),
          payload
        })
      });

      if (!res.ok) {
        throw new Error(`Webhook dispatch failed [${res.status}]: ${await res.text()}`);
      }

      return {
        success: true,
        channel: 'webhook',
        mode: 'live',
        publishedAt: new Date().toISOString()
      };
    } catch (err) {
      console.error('Webhook publish failed:', err.message);
      return {
        success: false,
        channel: 'webhook',
        error: err.message,
        publishedAt: new Date().toISOString()
      };
    }
  }
}
