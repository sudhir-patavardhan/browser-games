import fs from 'node:fs';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { chromium } from 'playwright';
import ffmpegPath from 'ffmpeg-static';
import { config } from '../config.js';
import { GAME_CATALOG } from '../knowledge/catalog.js';

const execFileAsync = promisify(execFile);

/**
 * Records real gameplay footage from the actual single-file HTML games and
 * converts it into a promotable MP4.
 *
 * Input during recording is generic (a spread of arrow/WASD/space key presses
 * and mouse movement/clicks) rather than tailored per-game scripted play,
 * since the catalog spans wildly different genres (racing, board, puzzle,
 * card games). This reliably produces real on-screen motion for most games,
 * but isn't guaranteed to showcase each game's best moment.
 */
export class VideoStudio {
  constructor(outputDir = path.join(config.paths.artifacts, 'videos')) {
    this.outputDir = outputDir;
    if (!fs.existsSync(this.outputDir)) {
      fs.mkdirSync(this.outputDir, { recursive: true });
    }
  }

  gameFilePath(gameId) {
    const game = GAME_CATALOG[gameId];
    if (!game) throw new Error(`Unknown game id: ${gameId}`);
    const gameDir = path.join(config.paths.root, gameId);
    const indexPath = path.join(gameDir, 'index.html');
    if (!fs.existsSync(indexPath)) {
      throw new Error(`No index.html found for game "${gameId}" at ${indexPath}`);
    }
    return indexPath;
  }

  /**
   * Records a short clip of real gameplay using a headless browser.
   * @param {string} gameId
   * @param {Object} [options]
   * @param {number} [options.durationSeconds]
   * @param {number} [options.width]
   * @param {number} [options.height]
   * @returns {Promise<string>} path to the recorded .webm file
   */
  async recordGameplay(gameId, { durationSeconds = 8, width = 720, height = 1280 } = {}) {
    const indexPath = this.gameFilePath(gameId);
    const tmpDir = fs.mkdtempSync(path.join(this.outputDir, `.rec-${gameId}-`));

    const browser = await chromium.launch();
    const context = await browser.newContext({
      viewport: { width, height },
      recordVideo: { dir: tmpDir, size: { width, height } }
    });
    const page = await context.newPage();

    try {
      await page.goto(`file://${indexPath}`, { waitUntil: 'load', timeout: 15000 });
      await page.waitForTimeout(500);
      if (gameId === 'drift') {
        await this.directDriftGameplay(page, { maxSeconds: Math.max(durationSeconds, 90) });
      } else {
        await this.simulateInput(page, { width, height, durationSeconds });
      }
    } finally {
      await page.close();
      await context.close();
      await browser.close();
    }

    const recordedFiles = fs.readdirSync(tmpDir).filter(f => f.endsWith('.webm'));
    if (recordedFiles.length === 0) {
      throw new Error(`No video was recorded for "${gameId}"`);
    }

    const finalPath = path.join(this.outputDir, `${gameId}-${Date.now()}.webm`);
    fs.renameSync(path.join(tmpDir, recordedFiles[0]), finalPath);
    fs.rmSync(tmpDir, { recursive: true, force: true });

    return finalPath;
  }

  /**
   * Generic input pattern: alternates keyboard and mouse activity so most
   * games (canvas-driven or DOM-driven, arrow-key or click-based) show motion.
   */
  async simulateInput(page, { width, height, durationSeconds }) {
    const keys = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'w', 'a', 's', 'd', 'Space'];
    const endAt = Date.now() + durationSeconds * 1000;
    let i = 0;

    while (Date.now() < endAt) {
      const key = keys[i % keys.length];
      await page.keyboard.down(key);
      await page.mouse.move(
        Math.random() * width,
        Math.random() * height,
        { steps: 5 }
      );
      await page.waitForTimeout(180);
      await page.keyboard.up(key);

      if (i % 3 === 0) {
        await page.mouse.click(Math.random() * width, Math.random() * height).catch(() => {});
      }

      i++;
      await page.waitForTimeout(120);
    }
  }

  /**
   * Drift ships a debug harness (window.__drift) for its own verification
   * suites: a pure-pursuit autopilot that follows the main road only (it has
   * no notion of rest-area exits, so it drives straight past them), and a
   * pause()-triggered "find nearest rest area and drive to it" maneuver
   * (togglePause() -> nextRest(), searching ~1.35km ahead/behind) that a
   * player normally reaches for manually. Drive with the autopilot until
   * within that search radius of the game's first service area (a fixed
   * point at the 3km mark), trigger the pull-in once, then let the game's
   * own pullInDrive take over — followed by ~6 real seconds of the charging
   * animation — instead of ending the clip mid-drive.
   */
  async directDriftGameplay(page, { maxSeconds = 90 } = {}) {
    await page.evaluate(() => window.__drift.start());
    await page.waitForTimeout(300);

    // autopilot() is a pure road-follower with no obstacle awareness, so it
    // plows straight through traffic/zombies — each collision costs a flat
    // battery chunk (crash penalty), which can drain the pack before the car
    // ever reaches the first rest stop. Keep the road clear for a clean take.
    const clearObstacles = () => page.evaluate(() => {
      window.__drift.traffic.stand();
      if (window.__drift.game) window.__drift.game.zombies.length = 0;
    });
    await clearObstacles();

    // g.dist accumulates in pixel-based world units, not meters (1px ≈ 0.1m
    // per the game's own SEG/KM_PTS scale) — convert before comparing against
    // the first facility's real-world 3km mark. Trigger once within the
    // ~1.35km rest-area search radius, with margin on both sides.
    const METERS_TO_DIST_UNITS = 10;
    const PULL_IN_TRIGGER_M = 1900 * METERS_TO_DIST_UNITS;
    const deadline = Date.now() + maxSeconds * 1000;
    let pulledIn = false;
    let parkedAt = null;

    while (Date.now() < deadline) {
      const state = await page.evaluate(({ pulledIn, triggerAt }) => {
        const g = window.__drift.game;
        if (!g) return null;

        let triggerInfo = null;
        if (g.pullIn || g.parked) {
          // Game's own pullInDrive/charging loop is driving now — hands off,
          // but govern speed directly: pullInDrive's own braking curve still
          // leaves the final "last few metres" precision-docking phase (the
          // sharp lateral cut into the actual charger bay) fast enough to
          // clip a kiosk/barrier and end the run before parking. Capping
          // speed to a crawl while pulling in trades a slower approach for a
          // reliable one.
          if (g.pullIn && g.speed > 120) {
            const ratio = 120 / g.speed;
            g.car.vx *= ratio;
            g.car.vy *= ratio;
            g.speed = 120;
          }
        } else if (!pulledIn && g.dist >= triggerAt) {
          // Mirrors togglePause()'s pull-in setup directly (nextRest() is a
          // reachable top-level function), since calling __drift.pause()
          // itself was observed to abort the maneuver moments after starting
          // it for reasons not fully traced through the game's state machine.
          g.cc = 0;
          const r = window.nextRest(g);
          triggerInfo = { idx: g.car.idx, r };
          g.pullIn = r || { c: g.car.idx + 34, side: 1, off: 0, shoulder: true };
        } else {
          window.__drift.autopilot();
        }

        return { dist: g.dist, pullIn: !!g.pullIn, pullInObj: g.pullIn, parked: !!g.parked, stall: g.stall, speed: g.speed, triggerInfo };
      }, { pulledIn, triggerAt: PULL_IN_TRIGGER_M });

      if (!state) break;
      if (process.env.DRIFT_DEBUG) {
        console.log(JSON.stringify({ ...state, pulledInFlag: pulledIn }));
      }

      if (!pulledIn && state.pullIn) pulledIn = true;
      if (state.parked && !parkedAt) {
        parkedAt = Date.now();
      }
      // Let the charging animation run for ~6 real seconds once parked, then stop.
      if (parkedAt && Date.now() - parkedAt > 6000) break;

      await page.waitForTimeout(100);
    }
  }

  /**
   * Converts a recorded .webm into an H.264/AAC .mp4 (required by Twitter's
   * media upload API, which does not accept webm).
   * @param {string} webmPath
   * @returns {Promise<string>} path to the .mp4 file
   */
  async convertToMp4(webmPath) {
    const mp4Path = webmPath.replace(/\.webm$/, '.mp4');
    try {
      await execFileAsync(ffmpegPath, [
        '-y',
        '-i', webmPath,
        '-c:v', 'libx264',
        '-pix_fmt', 'yuv420p',
        '-c:a', 'aac',
        '-movflags', '+faststart',
        mp4Path
      ]);
    } catch (err) {
      throw new Error(`ffmpeg conversion failed: ${err.message}`);
    }
    fs.unlinkSync(webmPath);
    return mp4Path;
  }

  /**
   * Records gameplay and returns a ready-to-post MP4 path.
   */
  async generateGameplayVideo(gameId, options = {}) {
    const webmPath = await this.recordGameplay(gameId, options);
    return this.convertToMp4(webmPath);
  }
}
