import fs from 'node:fs';
import { config } from '../config.js';

export class TelemetryTracker {
  constructor(filePath = config.paths.telemetryFile) {
    this.filePath = filePath;
    this.ensureFile();
  }

  ensureFile() {
    if (!fs.existsSync(this.filePath)) {
      const initial = {
        totalCampaigns: 0,
        totalPosts: 0,
        channelBreakdown: {
          twitter: { posts: 0, estimatedClicks: 0 },
          reddit: { posts: 0, estimatedClicks: 0 },
          hackernews: { posts: 0, estimatedClicks: 0 },
          devto: { posts: 0, estimatedClicks: 0 },
          shorts: { posts: 0, estimatedClicks: 0 }
        },
        gamePerformance: {},
        recentEvents: []
      };
      fs.writeFileSync(this.filePath, JSON.stringify(initial, null, 2));
    }
  }

  load() {
    this.ensureFile();
    try {
      return JSON.parse(fs.readFileSync(this.filePath, 'utf8'));
    } catch (e) {
      return {};
    }
  }

  save(data) {
    fs.writeFileSync(this.filePath, JSON.stringify(data, null, 2));
  }

  recordEvent(eventName, details = {}) {
    const data = this.load();
    const event = {
      event: eventName,
      timestamp: new Date().toISOString(),
      details
    };

    data.recentEvents = data.recentEvents || [];
    data.recentEvents.push(event);
    if (data.recentEvents.length > 200) data.recentEvents.shift();

    if (eventName === 'post_published') {
      data.totalPosts = (data.totalPosts || 0) + 1;
      const ch = details.channel || 'generic';
      if (!data.channelBreakdown[ch]) data.channelBreakdown[ch] = { posts: 0, estimatedClicks: 0 };
      data.channelBreakdown[ch].posts += 1;

      const g = details.gameId || 'hub';
      if (!data.gamePerformance[g]) data.gamePerformance[g] = { posts: 0, score: 0 };
      data.gamePerformance[g].posts += 1;
    }

    this.save(data);
    return event;
  }

  getSummary() {
    return this.load();
  }
}
