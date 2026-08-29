import { config } from '../config.js';

export class DiscordPublisher {
  constructor(webhookUrl = config.platforms.discord.webhookUrl) {
    this.webhookUrl = webhookUrl;
  }

  get isConfigured() {
    return Boolean(this.webhookUrl && this.webhookUrl.startsWith('https://discord.com/api/webhooks/'));
  }

  /**
   * Posts an announcement or campaign alert to Discord
   * @param {Object} payload - { title, description, url, color, fields }
   * @param {boolean} [dryRun]
   */
  async publish(payload, dryRun = config.general.mode === 'draft') {
    const title = payload.title || '🎮 New Kreeda Update / Campaign';
    const description = payload.description || payload.body || payload.text || '';

    if (dryRun || !this.isConfigured) {
      console.log(`[DRY-RUN / DRAFT] Discord Announcement: "${title}"`);
      return {
        success: true,
        channel: 'discord',
        mode: 'draft',
        publishedAt: new Date().toISOString()
      };
    }

    try {
      const body = {
        username: 'Kreeda Marketing Agent',
        avatar_url: 'https://kreeda.games/og.png',
        embeds: [
          {
            title,
            description,
            url: payload.url || 'https://kreeda.games',
            color: payload.color || 0x5CFF6E, // Accent green
            footer: {
              text: 'Kreeda — Instant Browser Games'
            },
            timestamp: new Date().toISOString()
          }
        ]
      };

      const res = await fetch(this.webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });

      if (!res.ok) {
        throw new Error(`Discord Webhook failed [${res.status}]: ${await res.text()}`);
      }

      return {
        success: true,
        channel: 'discord',
        mode: 'live',
        publishedAt: new Date().toISOString()
      };
    } catch (err) {
      console.error('Discord publish failed:', err.message);
      return {
        success: false,
        channel: 'discord',
        error: err.message,
        publishedAt: new Date().toISOString()
      };
    }
  }
}
