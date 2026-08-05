#!/usr/bin/env node
// Regenerates /sitemap.xml from the game cards in index.html.
// Run after adding a game: node scripts/gen-sitemap.js
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');

const slugs = [...html.matchAll(/data-game="([^"]+)"/g)].map(m => m[1]);
if (!slugs.length) {
  console.error('No data-game slugs found in index.html — aborting.');
  process.exit(1);
}

const urls = [
  { loc: 'https://kreeda.games/', changefreq: 'weekly', priority: '1.0' },
  ...slugs.map((slug, i) => ({
    loc: `https://kreeda.games/${slug}/`,
    changefreq: 'monthly',
    priority: i < 2 ? '0.9' : '0.8',
  })),
];

const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map(u => `  <url>
    <loc>${u.loc}</loc>
    <changefreq>${u.changefreq}</changefreq>
    <priority>${u.priority}</priority>
  </url>`).join('\n')}
</urlset>
`;

fs.writeFileSync(path.join(root, 'sitemap.xml'), xml);
console.log(`sitemap.xml written with ${urls.length} URLs (${slugs.length} games).`);
