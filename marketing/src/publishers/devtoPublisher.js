import { config } from '../config.js';

export class DevtoPublisher {
  constructor(apiKey = config.platforms.devto.apiKey) {
    this.apiKey = apiKey;
  }

  get isConfigured() {
    return Boolean(this.apiKey);
  }

  /**
   * Publishes technical article to Dev.to
   * @param {Object} article - { title, contentMarkdown, tags }
   * @param {boolean} [dryRun]
   */
  async publish(article, dryRun = config.general.mode === 'draft') {
    const title = article.title || 'How we built 12 browser games with zero build tools';
    const bodyMarkdown = article.contentMarkdown || article.body || '';
    const tags = article.tags || ['javascript', 'webdev', 'gamedev', 'showdev'];

    if (dryRun || !this.isConfigured) {
      console.log(`[DRY-RUN / DRAFT] Dev.to Article: "${title}"`);
      return {
        success: true,
        channel: 'devto',
        mode: 'draft',
        publishedAt: new Date().toISOString()
      };
    }

    try {
      const res = await fetch('https://dev.to/api/articles', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'api-key': this.apiKey
        },
        body: JSON.stringify({
          article: {
            title,
            published: false, // Create as draft by default for safe review
            body_markdown: bodyMarkdown,
            tags
          }
        })
      });

      if (!res.ok) {
        throw new Error(`Dev.to API error [${res.status}]: ${await res.text()}`);
      }

      const data = await res.json();
      return {
        success: true,
        channel: 'devto',
        mode: 'live',
        articleId: data.id,
        url: data.url,
        publishedAt: new Date().toISOString()
      };
    } catch (err) {
      console.error('Dev.to publish failed:', err.message);
      return {
        success: false,
        channel: 'devto',
        error: err.message,
        publishedAt: new Date().toISOString()
      };
    }
  }
}
