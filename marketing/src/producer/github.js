/**
 * The Producer's GitHub access: the Review, and the media release.
 *
 * Everything goes through the REST API with a token rather than the `gh`
 * binary. The first cloud routine run failed with `spawn gh ENOENT` — a
 * sandbox has GH_TOKEN and no gh — and what matters is whether the Producer
 * can do the work, not how it authenticates.
 */

import fs from 'node:fs';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { config } from '../config.js';

const execFileAsync = promisify(execFile);

const API = 'https://api.github.com';
const UPLOADS = 'https://uploads.github.com';

/** The rolling Release every Asset lives on (ADR 0003). */
export const MEDIA_RELEASE_TAG = 'media';

/** Assets older than this are pruned, so the release does not grow forever. */
export const ASSET_TTL_DAYS = 30;

const CONTENT_TYPES = { '.mp4': 'video/mp4', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.webm': 'video/webm' };

export class GitHubError extends Error {
  constructor(message, status) {
    super(message);
    this.name = 'GitHubError';
    this.status = status;
  }
}

export class GitHub {
  /**
   * @param {Object} [options]
   * @param {string} [options.token] defaults to GH_TOKEN.
   * @param {string} [options.slug] owner/name; derived from the remote if absent.
   */
  constructor({ token = process.env.GH_TOKEN || '', slug = null } = {}) {
    this.token = token.trim();
    this._slug = slug;
  }

  /** owner/name, from the git remote if it names GitHub, else from config. */
  async slug() {
    if (this._slug) return this._slug;
    const from = url => url?.match(/github\.com[:/]([^/]+\/[^/\s]+?)(?:\.git)?$/)?.[1] || null;
    let remote = '';
    try {
      const { stdout } = await execFileAsync('git', ['remote', 'get-url', 'origin'], { cwd: config.paths.root });
      remote = stdout.trim();
    } catch { /* no remote; fall through to config */ }
    this._slug = from(remote) || from(config.general.repoUrl);
    if (!this._slug) throw new GitHubError('No GitHub repository to work against.');
    return this._slug;
  }

  /**
   * Falls back to whatever `gh` is logged in as, for a local machine with no
   * GH_TOKEN set. Resolved once.
   */
  async authToken() {
    if (this.token) return this.token;
    try {
      const { stdout } = await execFileAsync('gh', ['auth', 'token']);
      this.token = stdout.trim();
    } catch {
      throw new GitHubError('No GH_TOKEN, and gh is not logged in. The Producer cannot reach GitHub.');
    }
    return this.token;
  }

  async request(method, urlPath, { body, base = API, headers = {} } = {}) {
    const token = await this.authToken();
    const res = await fetch(urlPath.startsWith('http') ? urlPath : `${base}${urlPath}`, {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
        'User-Agent': 'kreeda-marketing',
        ...(body && !headers['Content-Type'] ? { 'Content-Type': 'application/json' } : {}),
        ...headers
      },
      body: body instanceof Buffer ? body : body ? JSON.stringify(body) : undefined
    });

    if (res.status === 204) return null;
    const text = await res.text();
    let parsed = null;
    try { parsed = JSON.parse(text); } catch { /* not JSON */ }

    if (!res.ok) {
      throw new GitHubError(`GitHub ${method} ${urlPath} failed [${res.status}]: ${parsed?.message || text.slice(0, 200)}`, res.status);
    }
    return parsed;
  }

  // --- the Review (§5.2) ---------------------------------------------------

  /** The open Review, or null. There is only ever one. */
  async openReview({ head = 'marketing-review', base = 'marketing-state' } = {}) {
    const slug = await this.slug();
    const owner = slug.split('/')[0];
    const prs = await this.request('GET', `/repos/${slug}/pulls?state=open&head=${owner}:${head}&base=${base}`);
    return prs?.[0] || null;
  }

  /**
   * Reviews merged since a moment — what a Publish Cycle reads to learn which
   * Posts the CMO approved (§5.1 step 1).
   * @param {string|null} since ISO timestamp; null means every merged Review.
   */
  async mergedReviews(since, { head = 'marketing-review', base = 'marketing-state' } = {}) {
    const slug = await this.slug();
    const owner = slug.split('/')[0];
    const prs = await this.request('GET', `/repos/${slug}/pulls?state=closed&head=${owner}:${head}&base=${base}&sort=updated&direction=desc&per_page=20`);
    return (prs || [])
      .filter(pr => pr.merged_at && (!since || pr.merged_at > since))
      .sort((a, b) => a.merged_at.localeCompare(b.merged_at));
  }

  async createPullRequest({ title, body, head, base }) {
    return this.request('POST', `/repos/${await this.slug()}/pulls`, { body: { title, body, head, base } });
  }

  async updatePullRequest(number, fields) {
    return this.request('PATCH', `/repos/${await this.slug()}/pulls/${number}`, { body: fields });
  }

  // --- the media release (ADR 0003) ----------------------------------------

  /**
   * The rolling `media` Release, created if it is not there yet. A Post's
   * video is rendered on one day and published on another, possibly on another
   * machine, so the Asset has to outlive the run that made it.
   */
  async mediaRelease() {
    const slug = await this.slug();
    try {
      return await this.request('GET', `/repos/${slug}/releases/tags/${MEDIA_RELEASE_TAG}`);
    } catch (err) {
      if (err.status !== 404) throw err;
      return this.request('POST', `/repos/${slug}/releases`, {
        body: {
          tag_name: MEDIA_RELEASE_TAG,
          name: 'Marketing media',
          body: 'Rendered Assets for Posts awaiting a Review. Previews are public before they are posted, which is fine — the content is about to be public. Assets older than thirty days are pruned (ADR 0003).',
          prerelease: true
        }
      });
    }
  }

  /**
   * Uploads one rendered file and returns the URL to put on the Post. An Asset
   * name that already exists is replaced, so re-rendering a Post does not
   * leave the old file behind for the CMO to preview by accident.
   * @returns {Promise<{ name: string, url: string, size: number }>}
   */
  async uploadAsset(filePath, { name = path.basename(filePath) } = {}) {
    const release = await this.mediaRelease();
    const existing = (release.assets || []).find(a => a.name === name);
    if (existing) await this.request('DELETE', `/repos/${await this.slug()}/releases/assets/${existing.id}`);

    const data = fs.readFileSync(filePath);
    const type = CONTENT_TYPES[path.extname(filePath).toLowerCase()] || 'application/octet-stream';
    const uploaded = await this.request('POST', `/repos/${await this.slug()}/releases/${release.id}/assets?name=${encodeURIComponent(name)}`, {
      base: UPLOADS,
      body: data,
      headers: { 'Content-Type': type, 'Content-Length': String(data.length) }
    });

    return { name: uploaded.name, url: uploaded.browser_download_url, size: uploaded.size };
  }

  /** Downloads an Asset the CMO already previewed, byte for byte. */
  async downloadAsset(url, toPath) {
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${await this.authToken()}`, 'User-Agent': 'kreeda-marketing' },
      redirect: 'follow'
    });
    if (!res.ok) throw new GitHubError(`Could not download the Asset at ${url} [${res.status}]`, res.status);
    fs.mkdirSync(path.dirname(toPath), { recursive: true });
    fs.writeFileSync(toPath, Buffer.from(await res.arrayBuffer()));
    return toPath;
  }

  /**
   * Drops Assets older than the TTL. Nothing published still needs them: the
   * Channel holds its own copy once a Post is out.
   * @returns {Promise<string[]>} the names pruned.
   */
  async pruneAssets({ now = new Date(), ttlDays = ASSET_TTL_DAYS } = {}) {
    const release = await this.mediaRelease();
    const cutoff = now.getTime() - ttlDays * 86_400_000;
    const stale = (release.assets || []).filter(a => new Date(a.created_at).getTime() < cutoff);
    for (const asset of stale) {
      await this.request('DELETE', `/repos/${await this.slug()}/releases/assets/${asset.id}`);
    }
    return stale.map(a => a.name);
  }
}
