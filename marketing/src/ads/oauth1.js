import crypto from 'node:crypto';

export function percentEncode(str) {
  return encodeURIComponent(String(str)).replace(/[!*'()]/g, c => '%' + c.charCodeAt(0).toString(16).toUpperCase());
}

/**
 * Builds an OAuth 1.0a "Authorization" header (HMAC-SHA1, user context).
 *
 * Both the X API (posting) and the X Ads API authenticate this way. Query-string
 * and x-www-form-urlencoded parameters must be folded into the signature base
 * string, so pass them as `signedParams`; JSON bodies are not part of the
 * signature.
 */
export function buildOAuth1Header({ method, url, consumerKey, consumerSecret, accessToken, tokenSecret, signedParams = {} }) {
  const oauthParams = {
    oauth_consumer_key: consumerKey,
    oauth_nonce: crypto.randomBytes(16).toString('hex'),
    oauth_signature_method: 'HMAC-SHA1',
    oauth_timestamp: Math.floor(Date.now() / 1000).toString(),
    oauth_token: accessToken,
    oauth_version: '1.0'
  };

  const allParams = { ...oauthParams, ...signedParams };
  const paramString = Object.keys(allParams)
    .sort()
    .map(k => `${percentEncode(k)}=${percentEncode(allParams[k])}`)
    .join('&');

  const baseString = [method.toUpperCase(), percentEncode(url), percentEncode(paramString)].join('&');
  const signingKey = `${percentEncode(consumerSecret)}&${percentEncode(tokenSecret)}`;
  const signature = crypto.createHmac('sha1', signingKey).update(baseString).digest('base64');

  const headerParams = { ...oauthParams, oauth_signature: signature };
  return 'OAuth ' + Object.keys(headerParams)
    .sort()
    .map(k => `${percentEncode(k)}="${percentEncode(headerParams[k])}"`)
    .join(', ');
}
