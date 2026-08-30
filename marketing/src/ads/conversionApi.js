import { config } from '../config.js';

/**
 * X's Conversion API (server-side): reports on-site conversions the pixel
 * fires client-side (played_30s, etc. — see analytics.js) back to Ads
 * Manager, keyed by X_PIXEL_ID. This is a different credential from the Ads
 * API itself (a bare X-Pixel-Token header, not OAuth 1.0a) and a different
 * approval gate — pixel + token come from Ads Manager > Events manager
 * directly, no developer-app review needed, so this can work even while the
 * OAuth1 Ads API access above is still pending.
 */
export class ConversionApiClient {
  constructor(cfg = config.ads) {
    this.pixelId = cfg.pixelId;
    this.token = cfg.pixelToken;
  }

  get isConfigured() {
    return Boolean(this.pixelId && this.token);
  }

  /**
   * @param {Object} conv
   * @param {string} conv.eventId      the tw-<pixel>-xxxxx id from Events manager
   * @param {Date|string} [conv.time]  defaults to now
   * @param {string} [conv.conversionId] your own id, for de-duplication with pixel-fired events
   * @param {string} [conv.sourceUrl]
   * @param {Object} [conv.identifier] at least one of twclid / hashedEmail / hashedPhone / (ip + userAgent)
   */
  async send(conv, dryRun = config.general.mode === 'draft') {
    const identifiers = [];
    if (conv.identifier) {
      const id = conv.identifier;
      const entry = {};
      if (id.twclid) entry.twclid = id.twclid;
      if (id.hashedEmail) entry.hashed_email = id.hashedEmail;
      if (id.hashedPhone) entry.hashed_phone_number = id.hashedPhone;
      if (id.ip && id.userAgent) { entry.ip_address = id.ip; entry.user_agent = id.userAgent; }
      if (Object.keys(entry).length) identifiers.push(entry);
    }

    const payload = {
      conversions: [{
        conversion_time: new Date(conv.time || Date.now()).toISOString(),
        event_id: conv.eventId,
        ...(conv.conversionId ? { conversion_id: conv.conversionId } : {}),
        ...(conv.sourceUrl ? { event_source_url: conv.sourceUrl } : {}),
        ...(identifiers.length ? { identifiers } : {})
      }]
    };

    if (dryRun || !this.isConfigured) {
      console.log(`[DRY-RUN / DRAFT] X Conversion API: ${conv.eventId}${conv.sourceUrl ? ` (${conv.sourceUrl})` : ''}`);
      return { success: true, mode: 'draft', payload };
    }

    try {
      const res = await fetch(`https://ads-api.x.com/12/measurement/conversions/${this.pixelId}`, {
        method: 'POST',
        headers: { 'X-Pixel-Token': this.token, 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (!res.ok) throw new Error(`[${res.status}] ${await res.text()}`);
      return { success: true, mode: 'live' };
    } catch (err) {
      console.error('X Conversion API send failed:', err.message);
      return { success: false, error: err.message };
    }
  }
}
