import fs from 'node:fs';
import { config } from '../config.js';
import { UniversalPublisher } from '../publishers/index.js';

export class QueueManager {
  constructor(filePath = config.paths.queueFile) {
    this.filePath = filePath;
    this.publisher = new UniversalPublisher();
    this.ensureFile();
  }

  ensureFile() {
    if (!fs.existsSync(this.filePath)) {
      fs.writeFileSync(this.filePath, JSON.stringify([], null, 2));
    }
  }

  load() {
    this.ensureFile();
    try {
      return JSON.parse(fs.readFileSync(this.filePath, 'utf8'));
    } catch (e) {
      return [];
    }
  }

  save(items) {
    fs.writeFileSync(this.filePath, JSON.stringify(items, null, 2));
  }

  /**
   * Adds one or multiple items to the queue
   */
  add(itemOrItems) {
    const items = this.load();
    const toAdd = Array.isArray(itemOrItems) ? itemOrItems : [itemOrItems];

    for (const item of toAdd) {
      const entry = {
        id: item.id || `post-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        status: item.status || 'draft', // 'draft' | 'scheduled' | 'approved' | 'published' | 'archived'
        channel: item.channel || 'twitter',
        gameId: item.gameId || 'hub',
        scheduledDate: item.scheduledDate || new Date().toISOString().split('T')[0],
        content: item.content || {},
        createdAt: item.createdAt || new Date().toISOString(),
        publishedAt: item.publishedAt || null,
        publishResult: item.publishResult || null
      };
      items.push(entry);
    }

    this.save(items);
    return toAdd;
  }

  /**
   * Retrieves queue items
   */
  getAll({ status, channel, gameId } = {}) {
    let items = this.load();
    if (status) items = items.filter(i => i.status === status);
    if (channel) items = items.filter(i => i.channel === channel);
    if (gameId) items = items.filter(i => i.gameId === gameId);
    return items;
  }

  getById(id) {
    const items = this.load();
    return items.find(i => i.id === id) || null;
  }

  update(id, updates) {
    const items = this.load();
    const idx = items.findIndex(i => i.id === id);
    if (idx === -1) throw new Error(`Queue item ${id} not found`);

    items[idx] = { ...items[idx], ...updates, updatedAt: new Date().toISOString() };
    this.save(items);
    return items[idx];
  }

  approve(id) {
    return this.update(id, { status: 'approved' });
  }

  /**
   * Publishes a scheduled/approved item
   */
  async publish(id, dryRun) {
    const item = this.getById(id);
    if (!item) throw new Error(`Queue item ${id} not found`);

    console.log(`📡 Publishing post [${item.id}] to ${item.channel}...`);
    const result = await this.publisher.publish(item.channel, item.content, dryRun);

    return this.update(id, {
      status: result.success ? (result.mode === 'draft' ? 'draft_published' : 'published') : 'failed',
      publishedAt: new Date().toISOString(),
      publishResult: result
    });
  }

  /**
   * Publishes all pending approved items due on or before today
   */
  async processDueQueue(dryRun) {
    const today = new Date().toISOString().split('T')[0];
    const items = this.load();
    const due = items.filter(i => (i.status === 'approved' || i.status === 'scheduled') && i.scheduledDate <= today);

    console.log(`Processing ${due.length} due items in queue...`);
    const results = [];

    for (const item of due) {
      const res = await this.publish(item.id, dryRun);
      results.push(res);
    }

    return results;
  }
}
