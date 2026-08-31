import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';
import { config } from '../config.js';
import { GAME_CATALOG } from '../knowledge/catalog.js';

/**
 * Scripted, cinematic playthroughs of the Play-together games, recorded as
 * vertical video (9:16) for X / Reels / Shorts.
 *
 * The generic recorder in VideoStudio mashes arrow keys, which works for an
 * arcade game and produces nothing watchable for a game that needs two names
 * typed, a pack chosen, cells tapped and a phone handed over. So each of these
 * games gets a STORYBOARD: a real session driven through the real UI at a
 * human pace, with captions laid over the top that tell the story the ad
 * needs to tell — what the two players find out about each other — never the
 * one-phone mechanic (that is the how, not the why).
 *
 * Captions and the end card are injected into the page as fixed overlays that
 * ignore pointer events, so they never get in the way of the scripted taps.
 */

export const DEMO_NAMES = ['Maya', 'Arjun'];

/* Runs inside the page before any game script: zooms the page to phone scale
   and defines the overlay helpers. The recording viewport is the full
   1080×1920 output frame (Playwright's screencast captures CSS pixels and
   never upscales), so the page is zoomed 2× to lay out as a 540-px-wide phone
   and render crisp at output resolution. Overlay sizes below are in pre-zoom
   CSS pixels. */
function overlayInit() {
  document.addEventListener('DOMContentLoaded', () => { document.documentElement.style.zoom = '2'; });
  const FONT = '-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif';
  const css = `
#__kbrand{position:fixed;top:14px;left:50%;transform:translateX(-50%);z-index:99990;font:800 12px/1 ${FONT};letter-spacing:2.4px;color:#fff;background:rgba(0,0,0,.42);padding:9px 14px;border-radius:999px;pointer-events:none}
#__kcap{position:fixed;left:50%;bottom:13%;transform:translateX(-50%) translateY(12px);width:90%;z-index:99991;text-align:center;opacity:0;transition:opacity .35s ease,transform .35s ease;pointer-events:none}
#__kcap.on{opacity:1;transform:translateX(-50%) translateY(0)}
#__kcap b{display:inline-block;font:900 27px/1.22 ${FONT};color:#fff;background:rgba(10,8,18,.8);padding:13px 20px;border-radius:18px;box-shadow:0 10px 34px rgba(0,0,0,.5)}
#__kcap small{display:block;margin-top:9px;font:700 16px/1.3 ${FONT};color:#fff;text-shadow:0 2px 10px rgba(0,0,0,.9)}
#__kend{position:fixed;inset:0;z-index:99995;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;padding:44px;opacity:0;transition:opacity .55s ease;pointer-events:none}
#__kend.on{opacity:1}
#__kend h1{font:900 58px/1.05 ${FONT};margin:0 0 16px;color:#fff;letter-spacing:-1px}
#__kend p{font:700 23px/1.4 ${FONT};color:#fff;opacity:.94;margin:0 0 30px;max-width:420px}
#__kend .url{font:900 24px/1 ${FONT};color:#0b0b12;background:#fff;padding:18px 28px;border-radius:999px;box-shadow:0 12px 40px rgba(0,0,0,.35)}
#__kend .fine{margin-top:24px;font:700 15px/1.4 ${FONT};color:#fff;opacity:.85;letter-spacing:.5px}`;

  window.__kdir = {
    ensure() {
      if (!document.getElementById('__kstyle')) {
        const s = document.createElement('style'); s.id = '__kstyle'; s.textContent = css; document.head.appendChild(s);
      }
      if (!document.getElementById('__kbrand')) {
        const b = document.createElement('div'); b.id = '__kbrand'; b.textContent = 'KREEDA.GAMES'; document.body.appendChild(b);
      }
    },
    cap(text, sub, pos) {
      this.ensure();
      let el = document.getElementById('__kcap');
      if (!el) { el = document.createElement('div'); el.id = '__kcap'; document.body.appendChild(el); }
      el.classList.remove('on');
      if (!text) return;
      // 'top' keeps a caption off a screen whose own controls sit low (the hand-off)
      el.style.top = pos === 'top' ? '16%' : 'auto';
      el.style.bottom = pos === 'top' ? 'auto' : '13%';
      el.innerHTML = '<b></b><small></small>';
      el.querySelector('b').textContent = text;
      const small = el.querySelector('small');
      small.textContent = sub || '';
      small.hidden = !sub;
      void el.offsetWidth;
      el.classList.add('on');
    },
    end({ title, line, url, fine, g1, g2 }) {
      this.ensure();
      let el = document.getElementById('__kend');
      if (!el) { el = document.createElement('div'); el.id = '__kend'; document.body.appendChild(el); }
      el.style.background = `linear-gradient(160deg, ${g1} 0%, ${g2} 100%)`;
      el.innerHTML = '<h1></h1><p></p><div class="url"></div><div class="fine"></div>';
      el.querySelector('h1').textContent = title;
      el.querySelector('p').textContent = line;
      el.querySelector('.url').textContent = url;
      el.querySelector('.fine').textContent = fine || 'Free  ·  No app  ·  No sign-up';
      const cap = document.getElementById('__kcap');
      if (cap) cap.classList.remove('on');
      void el.offsetWidth;
      el.classList.add('on');
    }
  };
}

const escapeRe = s => String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * Storyboards. Each `run(api, [nameA, nameB])` drives one full session.
 * Timings are tuned for ~25–30 s of footage; keep taps visible (≥ 500 ms
 * apart) where the viewer is meant to follow, and quick (≈ 250 ms) where the
 * caption says "ten questions" and the eye only needs to see progress.
 */
export const STORYBOARDS = {
  sync: {
    title: 'Sync',
    line: 'How well do you actually know each other?',
    url: 'kreeda.games/sync',
    colors: ['#7c5cff', '#ff6b9d'],
    async run(api, [A, B]) {
      await api.cap('How well do you actually know each other?', 'A ten-question game for two');
      await api.hold(2300);
      await api.fill('#inA', A);
      await api.hold(350);
      await api.fill('#inB', B);
      await api.hold(500);
      await api.tap('[data-pack="c"]');
      await api.hold(900);
      await api.tap('#bStart');
      await api.hold(700);

      await api.cap(`${A} answers for herself…`, `…and guesses what ${B} would say`);
      // Slow, visible taps on the first three cards so the two-column idea lands.
      for (let q = 0; q < 3; q++) {
        await api.tap(`.cell[data-q="${q}"][data-col="me"][data-i="${q % 2}"]`);
        await api.hold(550);
        await api.tap(`.cell[data-q="${q}"][data-col="them"][data-i="1"]`);
        await api.hold(1000);   // the finished card swishes away, the next slides in
      }
      await api.cap('Ten questions. Two columns.', 'Your answer — and your guess for them');
      for (let q = 3; q < 10; q++) {
        await api.tap(`.cell[data-q="${q}"][data-col="me"][data-i="${q % 2}"]`);
        await api.hold(220);
        // two wrong guesses, so the reveal has something to talk about
        await api.tap(`.cell[data-q="${q}"][data-col="them"][data-i="${q === 3 || q === 7 ? 2 : 1}"]`);
        await api.hold(470);
      }
      await api.hold(400);
      await api.tap('#bLock');
      await api.cap('Pass the phone.', 'Nothing shows until you’ve both locked in', 'top');
      await api.hold(1600);

      await api.tap('#bReady');
      await api.hold(400);
      await api.cap(`${B}’s turn.`, 'No peeking');
      for (let q = 0; q < 10; q++) {
        await api.tap(`.cell[data-q="${q}"][data-col="me"][data-i="1"]`);
        await api.hold(150);
        await api.tap(`.cell[data-q="${q}"][data-col="them"][data-i="${q === 5 ? 2 : q % 2}"]`);
        await api.hold(300);
      }
      await api.hold(400);
      await api.tap('#bLock');
      await api.cap('Then the reveal.', '');
      await api.hold(1800);   // rings fill, numbers count up

      const a = await api.readAttr('.ring.ra .rv b', 'data-n');
      const b = await api.readAttr('.ring.rb .rv b', 'data-n');
      await api.cap(`${A} knows ${B}: ${a}%`, `${B} knows ${A}: ${b}%`);
      await api.hold(2400);
      await api.cap('Every answer, side by side.', 'The misses are the conversation');
      await api.scrollBy(560, 2200);
      await api.scrollBy(520, 1800);
      await api.end({ title: 'Sync', line: 'Find out tonight — ten questions, one reveal.', url: 'kreeda.games/sync' });
      await api.hold(2700);
    }
  },

  windows: {
    title: 'Windows',
    line: 'How you see yourself vs how they see you.',
    url: 'kreeda.games/windows',
    colors: ['#2bb3a3', '#ffb020'],
    async run(api, [A, B]) {
      await api.cap('How you see yourself vs how they see you.', 'Forty words. Two people.');
      await api.hold(2300);
      await api.fill('#nameA', A);
      await api.hold(350);
      await api.fill('#nameB', B);
      await api.hold(600);
      await api.tap('#startBtn');
      await api.hold(800);

      await api.cap(`${A} picks six words for herself…`, '');
      for (const w of ['Warm', 'Funny', 'Curious', 'Loyal', 'Stubborn', 'Dreamy']) {
        await api.tapWord(w);
        await api.hold(560);
      }
      await api.hold(450);
      await api.tap('#pickConfirm');
      await api.hold(1000);   // the sheet swooshes out, pass two slides in
      await api.cap(`…and six for ${B}.`, 'The him she actually knows');
      for (const w of ['Kind', 'Playful', 'Brave', 'Independent', 'Blunt', 'Careful']) {
        await api.tapWord(w);
        await api.hold(300);
      }
      await api.hold(400);
      await api.tap('#pickConfirm');
      await api.cap('Pass the phone.', 'Nothing shows until you’ve both locked in', 'top');
      await api.hold(1600);

      await api.tap('#hoReady');
      await api.hold(400);
      await api.cap(`${B}’s turn.`, 'Six for himself, six for her');
      for (const w of ['Kind', 'Playful', 'Brave', 'Ambitious', 'Blunt', 'Practical']) {
        await api.tapWord(w);
        await api.hold(200);
      }
      await api.tap('#pickConfirm');
      await api.hold(900);
      for (const w of ['Warm', 'Funny', 'Curious', 'Dependable', 'Restless', 'Dreamy']) {
        await api.tapWord(w);
        await api.hold(200);
      }
      await api.hold(350);
      await api.tap('#pickConfirm');
      await api.cap('Then the windows open.', '');
      await api.hold(1900);

      const a = await api.readAttr('.ring.ra .rv b', 'data-n');
      const b = await api.readAttr('.ring.rb .rv b', 'data-n');
      await api.cap(`${B} sees ${A}: ${a}%`, `${A} sees ${B}: ${b}%`);
      await api.hold(2300);
      await api.cap('What you both see. What only one of you does.', 'Blind spots included');
      await api.scrollBy(900, 2400);
      await api.scrollBy(760, 2000);
      await api.end({ title: 'Windows', line: 'Find your blind spots — from the one person who sees them.', url: 'kreeda.games/windows' });
      await api.hold(2700);
    }
  }
};

export class TogetherDirector {
  constructor(outputDir = path.join(config.paths.artifacts, 'videos')) {
    this.outputDir = outputDir;
    if (!fs.existsSync(this.outputDir)) fs.mkdirSync(this.outputDir, { recursive: true });
  }

  static hasStoryboard(gameId) {
    return Boolean(STORYBOARDS[gameId]);
  }

  static storyboardGames() {
    return Object.keys(STORYBOARDS);
  }

  /**
   * Records one storyboard at 1080×1920. The page is zoomed 2× (see
   * overlayInit) so the games lay out as they do on a 540-px-wide phone and
   * fill the frame. Taps are dispatched as DOM clicks rather than pointer
   * clicks: no cursor is visible in the footage anyway, and it keeps the
   * timing exact instead of waiting out each swish/arrive animation.
   * @returns {Promise<{ webmPath: string, seconds: number }>}
   */
  async record(gameId, { names = config.together.names, viewport = { width: 1080, height: 1920 }, scale = 1, size = { width: 1080, height: 1920 } } = {}) {
    const board = STORYBOARDS[gameId];
    if (!board) throw new Error(`No storyboard for "${gameId}" — storyboards exist for: ${Object.keys(STORYBOARDS).join(', ')}`);
    if (!GAME_CATALOG[gameId]) throw new Error(`Unknown game id: ${gameId}`);
    const indexPath = path.join(config.paths.root, gameId, 'index.html');
    if (!fs.existsSync(indexPath)) throw new Error(`No index.html for "${gameId}" at ${indexPath}`);

    const tmpDir = fs.mkdtempSync(path.join(this.outputDir, `.rec-${gameId}-`));
    const browser = await chromium.launch();
    const context = await browser.newContext({
      viewport,
      deviceScaleFactor: scale,
      colorScheme: 'dark',
      reducedMotion: 'no-preference',
      recordVideo: { dir: tmpDir, size }
    });
    await context.addInitScript(overlayInit);
    const page = await context.newPage();
    const started = Date.now();

    const api = {
      page,
      hold: ms => page.waitForTimeout(ms),
      cap: (text, sub, pos) => page.evaluate(([t, s, p]) => window.__kdir.cap(t, s, p), [text, sub || '', pos || '']),
      end: opts => page.evaluate(o => window.__kdir.end(o), { ...opts, g1: board.colors[0], g2: board.colors[1] }),
      fill: (sel, value) => page.fill(sel, value),
      tap: async sel => {
        const el = page.locator(sel).first();
        await el.waitFor({ state: 'attached', timeout: 8000 });
        await el.evaluate(node => node.click());
      },
      tapWord: async text => {
        const el = page.locator('.word', { hasText: new RegExp(`^${escapeRe(text)}$`) }).first();
        await el.waitFor({ state: 'attached', timeout: 8000 });
        await el.evaluate(node => node.click());
      },
      readAttr: (sel, attr) => page.locator(sel).first().getAttribute(attr),
      scrollBy: async (dy, ms) => {
        await page.evaluate(d => window.scrollBy({ top: d, behavior: 'smooth' }), dy);
        await page.waitForTimeout(ms);
      }
    };

    try {
      await page.goto(`file://${indexPath}`, { waitUntil: 'load', timeout: 15000 });
      await page.waitForTimeout(400);
      await board.run(api, names);
    } finally {
      await page.close();
      await context.close();
      await browser.close();
    }

    const recorded = fs.readdirSync(tmpDir).filter(f => f.endsWith('.webm'));
    if (recorded.length === 0) throw new Error(`No video was recorded for "${gameId}"`);
    const webmPath = path.join(this.outputDir, `${gameId}-together-${Date.now()}.webm`);
    fs.renameSync(path.join(tmpDir, recorded[0]), webmPath);
    fs.rmSync(tmpDir, { recursive: true, force: true });
    return { webmPath, seconds: Math.round((Date.now() - started) / 100) / 10 };
  }
}
