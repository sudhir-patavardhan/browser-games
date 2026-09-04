/**
 * The Creative (AGENTS_SPEC.md §6.3).
 *
 * The one Agent that is a model call made by code rather than the routine's
 * own session: it runs per Post, at volume, and needs a browser and an
 * encoder, so it was already wired that way (ADR 0006).
 *
 * It turns a Draft into a Post the CMO can decide on: copy that obeys the
 * brand rules, a card or a video rendered and uploaded to the media release,
 * and the status moved to In review.
 *
 * When it cannot do that, the Post stays a Draft and the Run log says why.
 * It never publishes fallback copy — generic template copy going out under
 * the brand is worse than a quiet day.
 */

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { config } from '../../config.js';
import { GAME_CATALOG } from '../../knowledge/catalog.js';
import { X, FACEBOOK, toChannel } from '../../knowledge/channels.js';
import { GeminiClient, GeminiUnavailableError } from '../../ai/geminiClient.js';
import { SYSTEM_PROMPTS } from '../../ai/prompts.js';
import { GitHub } from '../../producer/github.js';
import { VisualStudio } from '../../studio/visualStudio.js';
import { VideoStudio } from '../../studio/videoStudio.js';
import { TogetherDirector } from '../../studio/togetherDirector.js';
import { transition, update, IN_REVIEW } from '../../producer/post.js';
import { enforce } from './brand.js';
import { xSingle, xThread, facebookPost, retryWith } from './prompts.js';

/** How many past Posts about a Game are shown to the model as few-shot. */
const FEW_SHOT = 3;

export class Creative {
  constructor({
    ai = new GeminiClient(),
    github = new GitHub(),
    visualStudio = new VisualStudio(),
    videoStudio = null,
    metrics = null
  } = {}) {
    this.ai = ai;
    this.github = github;
    this.visualStudio = visualStudio;
    this._videoStudio = videoStudio;
    this.metrics = metrics;
  }

  // Rendering a video pulls in Playwright and ffmpeg, so it is built only when
  // a Post actually needs one.
  get videoStudio() {
    this._videoStudio ||= new VideoStudio();
    return this._videoStudio;
  }

  /**
   * Fills one Draft.
   *
   * @param {Object} post a Draft.
   * @param {Object} [options]
   * @param {boolean} [options.dryRun] write the copy, render nothing, upload
   *        nothing, and leave the Post a Draft.
   * @returns {Promise<{ post: Object, filled: boolean, notes: string[], error: string|null }>}
   */
  async fill(post, { dryRun = false } = {}) {
    const notes = [];
    const game = GAME_CATALOG[post.gameId];
    if (!game) {
      return { post, filled: false, notes, error: `no Game "${post.gameId}" is on the hub, so there is nothing to write about` };
    }

    let content;
    try {
      content = await this.write(post, game, notes);
    } catch (err) {
      return { post, filled: false, notes, error: err.message };
    }

    if (dryRun) {
      notes.push('dry run: no Asset was rendered and nothing was uploaded');
      return { post: update(post, { content }), filled: false, notes, error: null };
    }

    let assets = [];
    try {
      assets = await this.render(post, game, notes);
    } catch (err) {
      // Copy without an Asset is still a Post the CMO can approve; a failed
      // render should not cost the writing too.
      notes.push(`no Asset: ${err.message}`);
    }

    return {
      post: transition(update(post, { content, assets }), IN_REVIEW),
      filled: true,
      notes,
      error: null
    };
  }

  /**
   * Writes the copy and holds it to the brand rules, giving the model exactly
   * one chance to fix what it broke.
   */
  async write(post, game, notes) {
    const channel = toChannel(post.channel);
    const examples = this.bestPastCopy(post.gameId);
    if (examples.length) notes.push(`few-shot: ${examples.length} past Post(s) that earned clicks for ${game.name}`);

    const build = channel === FACEBOOK ? facebookPost
      : post.format === 'thread' ? xThread
      : xSingle;
    const base = build({ game, post, examples });
    const context = { channel, category: game.category, gameUrl: game.url };

    let violations = [];
    for (let attempt = 1; attempt <= 2; attempt++) {
      const raw = await this.ai.generate({
        prompt: attempt === 1 ? base : base + retryWith(violations),
        systemInstruction: SYSTEM_PROMPTS.marketingStrategist,
        jsonMode: true,
        strict: true
      });

      const shaped = this.shape(raw, post, game);
      const checked = shaped.parts.map(text => enforce(text, context));
      violations = checked.flatMap(c => c.violations);

      for (const repair of checked.flatMap(c => c.repairs)) notes.push(`repaired: ${repair}`);

      if (!violations.length) {
        if (attempt === 2) notes.push('the first attempt broke a brand rule; the second was clean');
        return shaped.assemble(checked.map(c => c.text));
      }
    }

    throw new Error(`the copy broke the brand rules twice: ${violations.join('; ')}`);
  }

  /**
   * Normalises whatever the model returned into the parts that need checking,
   * and how to put them back together.
   */
  shape(raw, post, game) {
    const altText = String(raw?.altText || `${game.name} on Kreeda.`).slice(0, 900);

    if (post.format === 'thread' && Array.isArray(raw?.thread) && raw.thread.length) {
      const parts = raw.thread.map(t => String(typeof t === 'string' ? t : t.text || '').trim()).filter(Boolean);
      return {
        parts,
        assemble: checked => ({ text: checked[0], thread: checked.map(text => ({ text })), altText })
      };
    }

    const text = String(raw?.text || raw?.hook || '').trim();
    return { parts: [text], assemble: ([checked]) => ({ text: checked, thread: [], altText }) };
  }

  /**
   * The three best-performing past texts for this Game, by link-click rate —
   * so the model learns from what earned clicks, not from what sounds good.
   * @returns {string[]}
   */
  bestPastCopy(gameId) {
    const store = this.metrics?.load?.();
    if (!store?.tweets) return [];
    return Object.values(store.tweets)
      .filter(t => t.gameId === gameId && t.text && t.latest?.impressions > 0)
      .map(t => ({ text: t.text, rate: (t.latest.linkClicks || 0) / t.latest.impressions }))
      .sort((a, b) => b.rate - a.rate)
      .slice(0, FEW_SHOT)
      .map(t => t.text);
  }

  /**
   * Renders the Post's Assets and uploads them to the media release, so the
   * Review can play the exact file that will be published (ADR 0003).
   * @returns {Promise<Object[]>}
   */
  async render(post, game, notes) {
    const uploads = [];
    const stamp = `${post.id}`;

    if (post.format === 'video') {
      if (!TogetherDirector.hasStoryboard(post.gameId)) {
        throw new Error(`${game.name} has no storyboard, so a video Post cannot be filmed`);
      }
      const { mp4Path, squarePath, seconds } = await this.videoStudio.generateTogetherVideo(post.gameId);
      notes.push(`filmed ${seconds}s of ${game.name}`);
      uploads.push({ kind: 'video', file: mp4Path, name: `${stamp}.mp4` });
      if (squarePath) uploads.push({ kind: 'square', file: squarePath, name: `${stamp}-square.mp4` });
    }

    // Every Post gets a card: a link with an image earns more clicks, and the
    // Review has something to look at even for a text Post.
    const card = await this.renderCard(post, game);
    uploads.push({ kind: 'card', file: card, name: `${stamp}-card.png` });

    const assets = [];
    for (const upload of uploads) {
      const { url } = await this.github.uploadAsset(upload.file, { name: upload.name });
      assets.push({ kind: upload.kind, url });
    }
    notes.push(`uploaded ${assets.length} Asset(s) to the media release`);
    return assets;
  }

  /** The SVG card from the visual studio, screenshotted to a PNG. */
  async renderCard(post, game) {
    const svgPath = this.visualStudio.generateSocialCard(post.gameId);
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'kreeda-card-'));
    const pngPath = path.join(dir, `${post.id}-card.png`);

    const { chromium } = await import('playwright');
    const browser = await chromium.launch();
    try {
      const page = await browser.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1 });
      await page.goto(`file://${path.resolve(svgPath)}`);
      await page.screenshot({ path: pngPath });
    } finally {
      await browser.close();
    }
    return pngPath;
  }
}

export { GeminiUnavailableError, X, FACEBOOK, config };
