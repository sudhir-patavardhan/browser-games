import { config } from '../config.js';
import { buildOAuth1Header } from './oauth1.js';

const BASE = 'https://ads-api.x.com/12';

export class AdsApiAccessError extends Error {
  constructor(message) {
    super(message);
    this.name = 'AdsApiAccessError';
  }
}

/**
 * Thin client for the X Ads API v12 (OAuth 1.0a user context — the same
 * app keys and access token used for organic posting, but the app must be
 * separately approved for Ads API access; until then every call fails with
 * UNAUTHORIZED_CLIENT_APPLICATION, which surfaces here as AdsApiAccessError).
 *
 * Budgets and charges are "local micro" units of the account currency
 * (1 unit = 1,000,000 micro). Callers convert from USD via adsPolicy.
 */
export class XAdsClient {
  constructor(cfg = config.platforms.twitter, ads = config.ads) {
    this.cfg = cfg;
    this.accountId = ads.accountId;
    this.fundingInstrumentId = ads.fundingInstrumentId;
  }

  get isConfigured() {
    return Boolean(this.cfg.apiKey && this.cfg.apiSecret && this.cfg.accessToken && this.cfg.accessTokenSecret && this.accountId);
  }

  async request(method, path, params = {}) {
    const url = `${BASE}${path}`;
    const upper = method.toUpperCase();
    const hasBody = upper === 'POST' || upper === 'PUT';
    // Ads API takes all parameters as query/form params, and they must be signed.
    const stringParams = Object.fromEntries(
      Object.entries(params).filter(([, v]) => v !== undefined && v !== null).map(([k, v]) => [k, Array.isArray(v) ? v.join(',') : String(v)])
    );
    const auth = buildOAuth1Header({
      method: upper,
      url,
      consumerKey: this.cfg.apiKey,
      consumerSecret: this.cfg.apiSecret,
      accessToken: this.cfg.accessToken,
      tokenSecret: this.cfg.accessTokenSecret,
      signedParams: stringParams
    });

    const qs = new URLSearchParams(stringParams).toString();
    const res = await fetch(hasBody ? url : (qs ? `${url}?${qs}` : url), {
      method: upper,
      headers: {
        Authorization: auth,
        ...(hasBody ? { 'Content-Type': 'application/x-www-form-urlencoded' } : {})
      },
      body: hasBody ? qs : undefined
    });

    const text = await res.text();
    let json = null;
    try { json = JSON.parse(text); } catch { /* non-JSON error body */ }

    if (!res.ok) {
      const code = json?.errors?.[0]?.code;
      const message = json?.errors?.[0]?.message || text;
      if (code === 'UNAUTHORIZED_CLIENT_APPLICATION') {
        throw new AdsApiAccessError('This developer app is not approved for the X Ads API yet (UNAUTHORIZED_CLIENT_APPLICATION). Request access at https://docs.x.com/forms/ads-api-access, then regenerate the access token.');
      }
      throw new Error(`Ads API ${upper} ${path} failed [${res.status}] ${code || ''}: ${message}`);
    }
    return json;
  }

  /** Cheap capability check: lists ad accounts visible to this token. */
  async probeAccess() {
    try {
      const res = await this.request('GET', '/accounts');
      return { authorized: true, accounts: res.data || [] };
    } catch (err) {
      if (err instanceof AdsApiAccessError) return { authorized: false, error: err.message };
      throw err;
    }
  }

  async getFundingInstruments() {
    const res = await this.request('GET', `/accounts/${this.accountId}/funding_instruments`);
    return res.data || [];
  }

  /**
   * Resolves the funding instrument to charge: the configured one, or the
   * single active card on the account.
   */
  async resolveFundingInstrument() {
    if (this.fundingInstrumentId) return { id: this.fundingInstrumentId };
    const instruments = (await this.getFundingInstruments()).filter(f => f.able_to_fund && f.entity_status === 'ACTIVE');
    if (instruments.length === 0) throw new Error('No active funding instrument on the ads account — add a card in Ads Manager > Billing.');
    return instruments[0];
  }

  async createCampaign({ name, fundingInstrumentId, dailyBudgetMicro, totalBudgetMicro, status = 'ACTIVE' }) {
    const res = await this.request('POST', `/accounts/${this.accountId}/campaigns`, {
      name,
      funding_instrument_id: fundingInstrumentId,
      daily_budget_amount_local_micro: dailyBudgetMicro,
      total_budget_amount_local_micro: totalBudgetMicro,
      entity_status: status,
      budget_optimization: 'LINE_ITEM'
    });
    return res.data;
  }

  async createLineItem({ campaignId, fundingInstrumentId, name, dailyBudgetMicro, totalBudgetMicro, startTime, endTime, status = 'ACTIVE' }) {
    const res = await this.request('POST', `/accounts/${this.accountId}/line_items`, {
      campaign_id: campaignId,
      funding_instrument_id: fundingInstrumentId,
      name,
      objective: 'WEBSITE_CLICKS',
      goal: 'LINK_CLICKS',
      product_type: 'PROMOTED_TWEETS',
      placements: 'ALL_ON_TWITTER',
      bid_strategy: 'AUTO_BID',
      daily_budget_amount_local_micro: dailyBudgetMicro,
      total_budget_amount_local_micro: totalBudgetMicro,
      start_time: startTime,
      end_time: endTime,
      entity_status: status
    });
    return res.data;
  }

  async addTargeting(lineItemId, targetingType, targetingValue) {
    const res = await this.request('POST', `/accounts/${this.accountId}/targeting_criteria`, {
      line_item_id: lineItemId,
      targeting_type: targetingType,
      targeting_value: targetingValue
    });
    return res.data;
  }

  /** Country-level location id for an ISO-3166 alpha-2 code, e.g. "US". */
  async lookupCountry(countryCode) {
    const res = await this.request('GET', `/accounts/${this.accountId}/targeting_criteria/locations`, { country_code: countryCode, location_type: 'COUNTRIES' });
    const hit = (res.data || [])[0];
    if (!hit) throw new Error(`No location targeting value found for country ${countryCode}`);
    return hit.targeting_value;
  }

  /** Interest id by (prefix) name, e.g. "Gaming" or "Relationships/Dating". */
  async lookupInterest(name) {
    const res = await this.request('GET', `/accounts/${this.accountId}/targeting_criteria/interests`, { q: name.split('/').pop().trim() });
    const items = res.data || [];
    const exact = items.find(i => i.name.toLowerCase() === name.toLowerCase());
    const hit = exact || items[0];
    if (!hit) throw new Error(`No interest targeting value found for "${name}"`);
    return { id: hit.targeting_value, name: hit.name };
  }

  async promoteTweet(lineItemId, tweetId) {
    const res = await this.request('POST', `/accounts/${this.accountId}/promoted_tweets`, {
      line_item_id: lineItemId,
      tweet_ids: tweetId
    });
    return res.data;
  }

  async setCampaignStatus(campaignId, status) {
    const res = await this.request('PUT', `/accounts/${this.accountId}/campaigns/${campaignId}`, { entity_status: status });
    return res.data;
  }

  /**
   * Totals for one or more campaigns over [start, end). The sync stats endpoint
   * allows at most 7 days and whole-hour boundaries.
   * @returns {Object<string, {impressions:number, urlClicks:number, engagements:number, spendLocal:number}>}
   */
  async getCampaignStats(campaignIds, start, end) {
    const floorHour = d => { const x = new Date(d); x.setUTCMinutes(0, 0, 0); return x; };
    const ceilHour = d => { const x = floorHour(d); if (x < d) x.setUTCHours(x.getUTCHours() + 1); return x; };
    let startTime = floorHour(start);
    const endTime = ceilHour(end);
    const maxSpan = 7 * 86_400_000;
    if (endTime - startTime > maxSpan) startTime = new Date(endTime.getTime() - maxSpan);

    const res = await this.request('GET', `/stats/accounts/${this.accountId}`, {
      entity: 'CAMPAIGN',
      entity_ids: campaignIds.slice(0, 20).join(','),
      start_time: startTime.toISOString().replace(/\.\d{3}Z$/, 'Z'),
      end_time: endTime.toISOString().replace(/\.\d{3}Z$/, 'Z'),
      granularity: 'TOTAL',
      metric_groups: 'ENGAGEMENT,BILLING',
      placement: 'ALL_ON_TWITTER'
    });

    const sum = arr => (Array.isArray(arr) ? arr.reduce((a, b) => a + (b || 0), 0) : 0);
    const out = {};
    for (const entry of res.data || []) {
      const m = entry.id_data?.[0]?.metrics || {};
      out[entry.id] = {
        impressions: sum(m.impressions),
        urlClicks: sum(m.url_clicks),
        engagements: sum(m.engagements),
        spendLocal: sum(m.billed_charge_local_micro) / 1_000_000
      };
    }
    return out;
  }
}
