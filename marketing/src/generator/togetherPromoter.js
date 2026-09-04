import fs from 'node:fs';
import { config } from '../config.js';
import { GAME_CATALOG } from '../knowledge/catalog.js';
import { GeminiClient } from '../ai/geminiClient.js';
import { SYSTEM_PROMPTS, PROMPT_TEMPLATES } from '../ai/prompts.js';
import { UniversalPublisher } from '../publishers/index.js';
import { QueueManager } from '../scheduler/queueManager.js';
import { VideoStudio } from '../studio/videoStudio.js';
import { TogetherDirector } from '../studio/togetherDirector.js';
import { X } from '../knowledge/channels.js';

export const TOGETHER_GAMES = Object.values(GAME_CATALOG).filter(g => g.category === 'together').map(g => g.id);

/**
 * Copy the agent can post without an AI key. Every line leads with what the
 * two people find out about each other — never with "one phone" or "pass the
 * phone", which is the mechanic, not the reason to play. Organic posts may
 * carry a hashtag or two; ads strip them (X rejects hashtags in promoted posts).
 */
export const FALLBACK_COPY = {
  sync: {
    text: 'How well do you actually know each other? Ten questions — your answers, and your guesses about theirs. The reveal is the fun part. Free, no app: https://kreeda.games/sync/ #couples #games',
    altText: 'Two people play Sync: ten questions answered for yourself and guessed for the other, then a reveal with three scores.'
  },
  windows: {
    text: 'How you see yourself vs how they see you. Six words each — then the blind spots, from the one person who actually sees them. Free, no app: https://kreeda.games/windows/ #couples #friends',
    altText: 'Two people play Windows: each picks six words for themselves and six for the other, then both Johari windows open.'
  },
  split: {
    text: 'How much do you trust each other, really? Ten rounds of Share or Take. The score says who won — the pattern says who you are. Free, no app: https://kreeda.games/split/ #couples #games',
    altText: 'Two people play Split: ten hidden rounds of Share or Take, then a read-out of how each of them played.'
  },
  auction: {
    text: '100 coins. Ten things people want from life. Bid in private, reveal together — and see where your priorities line up and where they collide. Free, no app: https://kreeda.games/auction/ #couples',
    altText: 'Two people play The Auction: sealed bids on ten life priorities, then both spending profiles side by side.'
  },
  fathom: {
    text: 'The 36 questions, as a game you can actually finish in one evening — with a before-and-after closeness check so you can see what changed. Free, no app: https://kreeda.games/fathom/ #couples',
    altText: 'Two people play Fathom: a guided dive through three depths of questions with a closeness check before and after.'
  }
};

/**
 * Turns one Play-together game into a posted (or drafted) video tweet:
 * render the storyboard, write the copy, publish, record it in the queue,
 * and remember which game went last so the rotation moves on.
 */
export class TogetherPromoter {
  constructor({ ai = new GeminiClient(), publisher = new UniversalPublisher(), queue = new QueueManager(), studio = new VideoStudio(), stateFile = config.together.stateFile } = {}) {
    this.ai = ai;
    this.publisher = publisher;
    this.queue = queue;
    this.studio = studio;
    this.stateFile = stateFile;
  }

  loadState() {
    if (!fs.existsSync(this.stateFile)) return { lastGameId: null, lastPostedAt: null, history: [] };
    try { return JSON.parse(fs.readFileSync(this.stateFile, 'utf8')); } catch { return { lastGameId: null, lastPostedAt: null, history: [] }; }
  }

  saveState(state) {
    fs.writeFileSync(this.stateFile, JSON.stringify(state, null, 2));
  }

  /** Games that can be filmed right now, in catalog order. */
  filmable() {
    return TOGETHER_GAMES.filter(id => TogetherDirector.hasStoryboard(id));
  }

  /** The next game in rotation after the one that went last. */
  nextGame(state = this.loadState()) {
    const pool = this.filmable();
    if (pool.length === 0) return null;
    const i = pool.indexOf(state.lastGameId);
    return pool[(i + 1) % pool.length];
  }

  /** True when the cadence says a video post is due. */
  isDue(state = this.loadState(), cadenceDays = config.together.cadenceDays) {
    if (!state.lastPostedAt) return true;
    return (Date.now() - new Date(state.lastPostedAt).getTime()) >= cadenceDays * 86_400_000;
  }

  /** Post copy: AI with the relationship-benefit brief, else the fallback; always sanitized. */
  async copyFor(gameId) {
    const game = GAME_CATALOG[gameId];
    const fallback = FALLBACK_COPY[gameId] || { text: `${game.tagline} Free, no app: ${game.url}`, altText: `${game.name} being played by two people.` };
    let draft = null;
    if (this.ai.isConfigured) {
      try {
        draft = await this.ai.generate({
          prompt: PROMPT_TEMPLATES.togetherVideoPost(game),
          systemInstruction: SYSTEM_PROMPTS.marketingStrategist,
          jsonMode: true
        });
      } catch { draft = null; }
    }
    return this.sanitize(draft, game, fallback);
  }

  sanitize(draft, game, fallback) {
    let text = String(draft?.text || '').replace(/\s+/g, ' ').trim();
    const leadsWithMechanic = /^(one phone|pass the phone|two players?, one phone)/i.test(text);
    if (!text || leadsWithMechanic) text = fallback.text;
    const url = game.url.replace(/index\.html$/, '');
    if (!/kreeda\.games\/[a-z-]+/.test(text)) text = `${text} ${url}`.trim();
    // organic posts: at most two hashtags, and never before the link
    const tags = (text.match(/#\w+/g) || []).slice(0, 2);
    text = text.replace(/#\w+/g, '').replace(/\s{2,}/g, ' ').trim();
    if (tags.length) text = `${text} ${tags.join(' ')}`;
    if (text.length > 275) text = `${text.slice(0, 275 - url.length - 1).trim()} ${url}`;
    const altText = String(draft?.altText || fallback.altText).slice(0, 900);
    return { text, altText };
  }

  /**
   * @param {Object} [opts]
   * @param {string} [opts.gameId]   default: next in rotation
   * @param {boolean} [opts.dryRun]  default true — never posts unless false
   * @param {boolean} [opts.video]   default true — set false to skip rendering (copy + queue only)
   */
  async promote({ gameId, dryRun = true, video = true } = {}) {
    const state = this.loadState();
    const id = gameId || this.nextGame(state);
    if (!id) throw new Error('No Play-together game has a storyboard yet.');
    const game = GAME_CATALOG[id];
    if (!game) throw new Error(`Unknown game id "${id}"`);

    let videoPath = null, squarePath = null, renderSeconds = null;
    if (video) {
      if (!TogetherDirector.hasStoryboard(id)) throw new Error(`No storyboard for "${id}" (have: ${this.filmable().join(', ')}) — pass video:false to post copy only`);
      console.log(`🎬 Filming ${game.name} (${config.together.names.join(' & ')})…`);
      const out = await this.studio.generateTogetherVideo(id);
      videoPath = out.mp4Path; squarePath = out.squarePath; renderSeconds = out.seconds;
      console.log(`✅ ${videoPath} (${renderSeconds}s of footage) + square variant ${squarePath}`);
    }

    const copy = await this.copyFor(id);
    console.log(`📝 ${copy.text}`);
    const publishResult = await this.publisher.publish(X, { text: copy.text, videoPath }, dryRun);

    const now = new Date().toISOString();
    const [entry] = this.queue.add({
      channel: X,
      gameId: id,
      status: publishResult.success ? (publishResult.mode === 'draft' ? 'draft_published' : 'published') : 'failed',
      scheduledDate: now.slice(0, 10),
      content: { kind: 'together-video', text: copy.text, altText: copy.altText, videoPath, squarePath },
      publishedAt: now,
      publishResult
    });

    state.lastGameId = id;
    state.lastPostedAt = now;
    state.history = [...(state.history || []), {
      gameId: id, at: now, mode: publishResult.mode || (dryRun ? 'draft' : 'live'),
      postId: publishResult.postId || null, url: publishResult.url || null, videoPath, squarePath
    }].slice(-50);
    this.saveState(state);

    return { gameId: id, text: copy.text, altText: copy.altText, videoPath, squarePath, renderSeconds, publishResult, queueId: entry.id };
  }
}
