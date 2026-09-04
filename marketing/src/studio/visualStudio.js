import fs from 'node:fs';
import path from 'node:path';
import { config } from '../config.js';
import { GAME_CATALOG } from '../knowledge/catalog.js';

/**
 * Visual Asset & Social Card Generator Studio
 * Produces crisp SVG and marketing assets for games and campaigns.
 */
export class VisualStudio {
  constructor(outputDir = path.join(config.paths.artifacts, 'visual-assets')) {
    this.outputDir = outputDir;
    if (!fs.existsSync(this.outputDir)) {
      fs.mkdirSync(this.outputDir, { recursive: true });
    }
  }

  /**
   * Generates a high-res 1200x630 Social Banner SVG for a game
   * @param {string} gameId
   */
  generateSocialCard(gameId) {
    const game = GAME_CATALOG[gameId] || GAME_CATALOG.hub;
    
    // Aesthetic color schemes per game
    const themes = {
      drift: { g1: '#21e6ff', g2: '#a239ff', g3: '#5CFF6E', bg: '#07070d', accent: '#5CFF6E' },
      carrom: { g1: '#ffd23f', g2: '#ff8a1e', g3: '#f3e6c2', bg: '#15181c', accent: '#ffd23f' },
      'break-room': { g1: '#ffd23f', g2: '#ff6b3d', g3: '#2ecc71', bg: '#0d0a08', accent: '#2ecc71' },
      'chroma-blocks': { g1: '#21e6ff', g2: '#ff4d6d', g3: '#a239ff', bg: '#05050a', accent: '#21e6ff' },
      'last-16': { g1: '#2bff88', g2: '#ffd93d', g3: '#21c7ff', bg: '#04140a', accent: '#2bff88' },
      'road-rumble': { g1: '#ff5a4d', g2: '#ffd24a', g3: '#4aa3ff', bg: '#0a0d12', accent: '#ff5a4d' },
      'fairway-four': { g1: '#5cb86e', g2: '#a8e6cf', g3: '#ffd3b6', bg: '#0a1410', accent: '#5cb86e' },
      ennead: { g1: '#ff6a52', g2: '#4fa9ee', g3: '#ffc23d', bg: '#0e1220', accent: '#ff6a52' },
      dasanana: { g1: '#ff8a1e', g2: '#ffd76b', g3: '#e8360a', bg: '#1a0c02', accent: '#ffd76b' },
      blackjack: { g1: '#f4d35e', g2: '#1b7a3f', g3: '#0c4a24', bg: '#05140a', accent: '#f4d35e' },
      hub: { g1: '#21e6ff', g2: '#a239ff', g3: '#5CFF6E', bg: '#07070d', accent: '#5CFF6E' }
    };

    const t = themes[gameId] || themes.hub;

    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 630" width="1200" height="630">
  <defs>
    <radialGradient id="bgGlow" cx="20%" cy="20%" r="70%">
      <stop offset="0%" stop-color="${t.g1}" stop-opacity="0.22" />
      <stop offset="60%" stop-color="${t.g2}" stop-opacity="0.08" />
      <stop offset="100%" stop-color="${t.bg}" stop-opacity="1" />
    </radialGradient>
    <linearGradient id="textGrad" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="${t.g1}" />
      <stop offset="50%" stop-color="${t.g2}" />
      <stop offset="100%" stop-color="${t.g3}" />
    </linearGradient>
    <filter id="shadow" x="-10%" y="-10%" width="120%" height="120%">
      <feDropShadow dx="0" dy="8" stdDeviation="16" flood-color="#000000" flood-opacity="0.6"/>
    </filter>
  </defs>

  <!-- Background -->
  <rect width="1200" height="630" fill="${t.bg}"/>
  <rect width="1200" height="630" fill="url(#bgGlow)"/>

  <!-- Subtle Grid Lines -->
  <g opacity="0.08" stroke="#ffffff" stroke-width="1">
    <line x1="0" y1="105" x2="1200" y2="105"/>
    <line x1="0" y1="210" x2="1200" y2="210"/>
    <line x1="0" y1="315" x2="1200" y2="315"/>
    <line x1="0" y1="420" x2="1200" y2="420"/>
    <line x1="0" y1="525" x2="1200" y2="525"/>
    <line x1="200" y1="0" x2="200" y2="630"/>
    <line x1="400" y1="0" x2="400" y2="630"/>
    <line x1="600" y1="0" x2="600" y2="630"/>
    <line x1="800" y1="0" x2="800" y2="630"/>
    <line x1="1000" y1="0" x2="1000" y2="630"/>
  </g>

  <!-- Brand Pill -->
  <g transform="translate(80, 70)">
    <rect width="160" height="38" rx="19" fill="rgba(255,255,255,0.08)" stroke="rgba(255,255,255,0.18)" stroke-width="1"/>
    <circle cx="24" cy="19" r="6" fill="${t.accent}"/>
    <text x="42" y="24" fill="#ffffff" font-family="-apple-system, system-ui, sans-serif" font-weight="800" font-size="15" letter-spacing="1">KREEDA</text>
  </g>

  <!-- Genre Tag -->
  <g transform="translate(260, 70)">
    <rect width="200" height="38" rx="19" fill="rgba(255,255,255,0.05)" stroke="rgba(255,255,255,0.12)" stroke-width="1"/>
    <text x="18" y="24" fill="#a6a6b8" font-family="-apple-system, system-ui, sans-serif" font-weight="600" font-size="14">${escapeXml(game.category || '')}</text>
  </g>

  <!-- Game Title -->
  <text x="80" y="220" fill="url(#textGrad)" font-family="-apple-system, system-ui, sans-serif" font-weight="900" font-size="76" letter-spacing="-1" filter="url(#shadow)">${escapeXml(game.name)}</text>

  <!-- Tagline -->
  <text x="80" y="280" fill="#f4f4f8" font-family="-apple-system, system-ui, sans-serif" font-weight="700" font-size="28" letter-spacing="0">${escapeXml(game.tagline)}</text>

  <!-- Feature Highlights Box -->
  <g transform="translate(80, 330)">
    <rect width="1040" height="150" rx="18" fill="rgba(18,18,28,0.7)" stroke="rgba(255,255,255,0.12)" stroke-width="1"/>
    
    <g transform="translate(30, 42)">
      <circle cx="10" cy="0" r="4" fill="${t.accent}"/>
      <text x="24" y="5" fill="#f4f4f8" font-family="-apple-system, system-ui, sans-serif" font-weight="600" font-size="18">0.1s Instant Play — No Downloads, No Accounts, 100% Free</text>
    </g>

    <g transform="translate(30, 82)">
      <circle cx="10" cy="0" r="4" fill="${t.accent}"/>
      <text x="24" y="5" fill="#a6a6b8" font-family="-apple-system, system-ui, sans-serif" font-weight="500" font-size="17">${escapeXml(game.mechanics?.[0] || 'Single-file vanilla JavaScript & Canvas 2D engine')}</text>
    </g>

    <g transform="translate(30, 122)">
      <circle cx="10" cy="0" r="4" fill="${t.accent}"/>
      <text x="24" y="5" fill="#a6a6b8" font-family="-apple-system, system-ui, sans-serif" font-weight="500" font-size="17">${escapeXml(game.mechanics?.[1] || game.technicalHighlights?.[0] || 'Synthesized WebAudio procedural sound effects')}</text>
    </g>
  </g>

  <!-- Footer Play CTA -->
  <g transform="translate(80, 530)">
    <rect width="220" height="52" rx="26" fill="${t.accent}"/>
    <text x="45" y="32" fill="#07070d" font-family="-apple-system, system-ui, sans-serif" font-weight="800" font-size="18" letter-spacing="0.5">PLAY INSTANTLY ➔</text>
  </g>

  <text x="330" y="563" fill="#a6a6b8" font-family="-apple-system, system-ui, sans-serif" font-weight="600" font-size="18">${escapeXml(game.url)}</text>
</svg>`;

    const fileName = `${gameId}-social-card.svg`;
    const filePath = path.join(this.outputDir, fileName);
    fs.writeFileSync(filePath, svg);
    return filePath;
  }

  /**
   * Generates social cards for the entire catalog
   */
  generateAllCards() {
    const cards = {};
    for (const gameId of Object.keys(GAME_CATALOG)) {
      cards[gameId] = this.generateSocialCard(gameId);
    }
    return cards;
  }
}

function escapeXml(unsafe) {
  if (!unsafe) return '';
  return String(unsafe)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}
