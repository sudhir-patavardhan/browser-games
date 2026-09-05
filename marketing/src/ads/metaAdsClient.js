/**
 * The Meta Marketing API — Facebook Campaigns.
 *
 * A sibling of xAdsClient, not a shared abstraction: the two APIs agree on
 * almost nothing. X has Campaign -> line item -> promoted tweet; Meta has
 * Campaign -> Ad Set -> Ad, with the creative a fourth object of its own. X
 * signs every request with OAuth 1.0a; Meta takes a bearer token. Pretending
 * they are the same shape would cost more than writing both.
 *
 * Budgets are in the account's currency, in **minor units** — paise for an INR
 * account, cents for USD. The Caps are in USD, so every amount converts on the
 * way in and nothing in this file guesses the rate.
 */

import { config } from '../config.js';

export const GRAPH_VERSION = 'v21.0';
const GRAPH = `https://graph.facebook.com/${GRAPH_VERSION}`;

/** Meta's own name for "send people to a website". */
export const TRAFFIC_OBJECTIVE = 'OUTCOME_TRAFFIC';

/** Optimise for people who click through, not for people who merely see it. */
export const LINK_CLICKS = 'LINK_CLICKS';

/** Access failures, so a Cycle can report `blocked` rather than `failed`. */
export class MetaAdsAccessError extends Error {
  constructor(message) {
    super(message);
    this.name = 'MetaAdsAccessError';
  }
}

/** Codes that mean "these credentials may not do this", not "this request was wrong". */
const ACCESS_CODES = new Set([190, 200, 10, 272, 294]);

export class MetaAdsClient {
  constructor({
    token = config.platforms.facebook.adsToken,
    accountId = config.platforms.facebook.adAccountId,
    pageId = config.platforms.facebook.pageId,
    currency = config.platforms.facebook.adsCurrency,
    usdToLocalRate = config.ads.usdToLocalRate
  } = {}) {
    this.token = token;
    this.accountId = String(accountId || '').replace(/^act_/, '');
    this.pageId = pageId;
    this.currency = currency;
    this.usdToLocalRate = usdToLocalRate;
  }

  get isConfigured() {
    return Boolean(this.token && this.accountId && this.pageId);
  }

  get account() {
    return `act_${this.accountId}`;
  }

  /**
   * A USD Cap as Meta wants it: minor units of the account's own currency.
   * An INR account takes paise, so $5 at 84/USD is 42000.
   */
  usdToMinorUnits(usd) {
    if (this.currency !== 'USD' && this.usdToLocalRate === 1) {
      throw new Error(`The ad account bills in ${this.currency} but no conversion rate is set — refusing to guess what a dollar is worth.`);
    }
    return Math.round(usd * this.usdToLocalRate * 100);
  }

  minorUnitsToUsd(minor) {
    return minor / 100 / this.usdToLocalRate;
  }

  /**
   * @param {'GET'|'POST'|'DELETE'} method
   * @param {string} path relative to the Graph root, with no query string.
   * @param {Object} [params]
   */
  async request(method, path, params = {}) {
    const url = new URL(`${GRAPH}${path.startsWith('/') ? path : `/${path}`}`);
    const body = new URLSearchParams({ access_token: this.token });

    for (const [key, value] of Object.entries(params)) {
      if (value === undefined || value === null) continue;
      const encoded = typeof value === 'object' ? JSON.stringify(value) : String(value);
      if (method === 'GET') url.searchParams.set(key, encoded);
      else body.set(key, encoded);
    }
    if (method === 'GET') url.searchParams.set('access_token', this.token);

    const res = await fetch(url, {
      method,
      ...(method === 'GET' ? {} : { body, headers: { 'Content-Type': 'application/x-www-form-urlencoded' } })
    });
    const answer = await res.json().catch(() => ({}));

    if (!res.ok || answer.error) {
      const err = answer.error || {};
      const detail = [err.message, err.error_user_title, err.error_user_msg].filter(Boolean).join(' — ');
      if (ACCESS_CODES.has(err.code)) {
        throw new MetaAdsAccessError(`The Marketing API refused these credentials (code ${err.code}): ${detail}`);
      }
      throw new Error(`Meta ${method} ${path} failed [${res.status}] ${err.code || ''}: ${detail || 'unknown error'}`);
    }
    return answer;
  }

  /** Whether the account can be reached and is in a state that can spend. */
  async probeAccess() {
    try {
      const account = await this.request('GET', `/${this.account}`, {
        fields: 'name,account_status,currency,amount_spent,funding_source_details,disable_reason'
      });
      return {
        authorized: true,
        name: account.name,
        currency: account.currency,
        // 1 is ACTIVE; anything else cannot deliver.
        active: account.account_status === 1,
        accountStatus: account.account_status,
        funded: Boolean(account.funding_source_details?.id || account.funding_source_details?.display_string),
        funding: account.funding_source_details?.display_string || null,
        spentUsd: this.minorUnitsToUsd(Number(account.amount_spent || 0))
      };
    } catch (err) {
      return { authorized: false, error: err.message };
    }
  }

  // --- the three levels, each created paused (§8.2) -------------------------

  /**
   * A Campaign. Meta's daily budget can live here or on the Ad Set; it goes on
   * the Ad Set, so one Campaign could later hold several audiences under one
   * ceiling without the ceiling moving.
   */
  async createCampaign({ name, objective = TRAFFIC_OBJECTIVE, status = 'PAUSED' }) {
    return this.request('POST', `/${this.account}/campaigns`, {
      name,
      objective,
      status,
      special_ad_categories: [],
      buying_type: 'AUCTION',
      // The budget lives on the Ad Set, so Meta insists we say whether Ad Sets
      // may share it. False: sharing lets one Ad Set borrow 20% of another's
      // budget, which would make a per-Campaign Cap mean less than it says.
      is_adset_budget_sharing_enabled: false
    });
  }

  /**
   * An Ad Set: the money, the audience and the clock. `lifetime_budget` with an
   * end time is what makes a Trial a Trial — Meta stops it on its own when
   * either runs out, so a Cycle that never runs cannot leave one spending.
   */
  async createAdSet({
    campaignId, name, dailyUsd, endTime, countries = ['IN'], ageMin = 18, ageMax = 65,
    interests = [], status = 'PAUSED'
  }) {
    const targeting = {
      geo_locations: { countries },
      age_min: ageMin,
      age_max: ageMax,
      ...(interests.length ? { flexible_spec: [{ interests }] } : {}),
      // Advantage audience off. It lets Meta spend outside the audience we
      // chose, which would make a Post-mortem unable to say whether the
      // audience or the creative was what worked — and learning that is the
      // whole point of a Trial.
      targeting_automation: { advantage_audience: 0 }
    };

    return this.request('POST', `/${this.account}/adsets`, {
      name,
      campaign_id: campaignId,
      daily_budget: this.usdToMinorUnits(dailyUsd),
      billing_event: 'IMPRESSIONS',
      optimization_goal: LINK_CLICKS,
      bid_strategy: 'LOWEST_COST_WITHOUT_CAP',
      targeting,
      end_time: endTime,
      status
    });
  }

  /** The creative: what a person actually sees. */
  async createCreative({ name, message, link, imageHash = null, headline = null, description = null }) {
    const linkData = {
      link,
      message,
      ...(headline ? { name: headline } : {}),
      ...(description ? { description } : {}),
      ...(imageHash ? { image_hash: imageHash } : {}),
      call_to_action: { type: 'PLAY_GAME', value: { link } }
    };
    // No degrees_of_freedom_spec: Meta deprecated opting out of standard
    // enhancements, and sending the field is now rejected outright. Meta may
    // therefore adjust the creative it shows; that is worth knowing when a
    // Post-mortem tries to explain what happened.
    return this.request('POST', `/${this.account}/adcreatives`, {
      name,
      object_story_spec: { page_id: this.pageId, link_data: linkData }
    });
  }

  /** Uploads a card and returns its hash, which is how a creative refers to it. */
  async uploadImage(filePath) {
    const fs = await import('node:fs/promises');
    const path = await import('node:path');
    const bytes = await fs.readFile(filePath);
    const form = new FormData();
    form.append('access_token', this.token);
    form.append('filename', new File([bytes], path.basename(filePath), { type: 'image/png' }));

    const res = await fetch(`${GRAPH}/${this.account}/adimages`, { method: 'POST', body: form });
    const answer = await res.json().catch(() => ({}));
    if (!res.ok || answer.error) {
      throw new Error(`Could not upload the card: ${answer.error?.message || res.status}`);
    }
    const image = Object.values(answer.images || {})[0];
    if (!image?.hash) throw new Error('Meta accepted the card but returned no hash.');
    return image.hash;
  }

  /** The Ad: an Ad Set and a creative, joined. */
  async createAd({ adSetId, creativeId, name, status = 'PAUSED' }) {
    return this.request('POST', `/${this.account}/ads`, {
      name,
      adset_id: adSetId,
      creative: { creative_id: creativeId },
      status
    });
  }

  async setStatus(id, status) {
    return this.request('POST', `/${id}`, { status });
  }

  /** What a Campaign has earned, for the kill rules and the Post-mortem. */
  async campaignStats(campaignId, { since, until } = {}) {
    const answer = await this.request('GET', `/${campaignId}/insights`, {
      fields: 'impressions,clicks,inline_link_clicks,spend,cpc,ctr',
      ...(since && until ? { time_range: { since, until } } : { date_preset: 'maximum' })
    });
    const row = answer.data?.[0] || {};
    const spendLocal = Number(row.spend || 0);
    return {
      impressions: Number(row.impressions || 0),
      // inline_link_clicks is clicks on the link itself; `clicks` counts every
      // click on the ad, including the Page name, and would flatter the CTR.
      urlClicks: Number(row.inline_link_clicks || 0),
      spendUsd: spendLocal / this.usdToLocalRate,
      spendLocal
    };
  }

  async campaigns() {
    const answer = await this.request('GET', `/${this.account}/campaigns`, {
      fields: 'name,status,effective_status,objective,created_time,stop_time',
      limit: 50
    });
    return answer.data || [];
  }
}
