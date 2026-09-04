/**
 * What the Creative is asked for (AGENTS_SPEC.md §6.3).
 *
 * One prompt per Channel, never shared: X is 280 characters and Facebook is
 * long-form, and a tweet posted to a Page reads like a tweet posted to a Page.
 *
 * Every prompt carries the same three things — the Dossier so the model knows
 * the Game, the brief so it knows the angle, and the best-performing past
 * copy for that Game as few-shot so it learns from what actually earned
 * clicks rather than from what sounds good.
 */

/** The rules stated to the model as well as enforced in code (§9). */
const BRAND_RULES = `Rules, all of them absolute:
- Never write like AI marketing. No rocket emoji, no "game-changer", no "revolutionary", at most one exclamation mark in the whole post, and preferably none.
- Never invent anything: no player counts, no awards, no rankings, no quoted testimonials. If you cannot stand behind it, do not write it.
- Write the bare game URL exactly as given. Do not add tracking parameters; they are added when the post goes out.
- At most two hashtags, and only after the link. None is usually better.`;

const SOCIAL_RULE = `This Game is played by a group in one room. Lead with what the people
playing find out about each other — that is the reason anyone plays it. Never
open with the mechanic ("one phone", "pass the phone", "3-8 players"); the
mechanic is how it works, not why it is worth an evening.`;

/** Curated Play-together lines that earned their place, as few-shot. */
export const SOCIAL_EXAMPLES = [
  'You have known them ten years. Two questions decide whether that is true.',
  'One friend calling you stubborn is an opinion. Five choosing it is a portrait.',
  'Anonymity makes people honest. Then you have to work out who was.',
  'The gap between how you come across and how you would put it.'
];

function dossier(game) {
  return [
    `Game: ${game.name} (${game.category})`,
    `URL: ${game.url}`,
    `Tagline: ${game.tagline}`,
    `Pitch: ${game.pitch}`,
    game.mechanics?.length ? `Mechanics: ${game.mechanics.join(' | ')}` : '',
    game.hooks?.length ? `Hooks marketing believes in: ${game.hooks.join(' | ')}` : '',
    game.blurb ? `How the site describes it: ${game.blurb}` : ''
  ].filter(Boolean).join('\n');
}

function brief(post) {
  return [
    post.angle ? `Angle: ${post.angle}` : '',
    post.persona ? `Written for: ${post.persona}` : '',
    post.brief ? `Brief: ${post.brief}` : '',
    post.successMetric ? `This Post succeeds if: ${post.successMetric}` : ''
  ].filter(Boolean).join('\n') || 'No brief was given; write the strongest honest Post you can for this Game.';
}

function fewShot(examples, category) {
  const lines = [...(examples || [])];
  if (['Play together', 'Friends circle'].includes(category)) lines.push(...SOCIAL_EXAMPLES);
  if (!lines.length) return '';
  return `\nCopy that has worked for Kreeda before — match this register, do not copy the words:\n${lines.map(l => `- ${l}`).join('\n')}\n`;
}

function socialNote(category) {
  return ['Play together', 'Friends circle'].includes(category) ? `\n${SOCIAL_RULE}\n` : '';
}

/** A single Post on X: one tweet, at most 280 characters including the link. */
export function xSingle({ game, post, examples }) {
  return `Write one X post for this Game.

${dossier(game)}

${brief(post)}
${socialNote(game.category)}${fewShot(examples, game.category)}
${BRAND_RULES}
- The whole post must be at most 240 characters, not counting the URL.
- One idea. A post that says one thing well beats a post that lists features.

Return JSON: { "text": "the post, including the URL on its own line at the end", "altText": "a one-sentence description of the image that will accompany it, for a screen reader" }`;
}

/** A thread on X: a first tweet that earns the second. */
export function xThread({ game, post, examples }) {
  return `Write a short X thread for this Game: 3 to 5 posts.

${dossier(game)}

${brief(post)}
${socialNote(game.category)}${fewShot(examples, game.category)}
${BRAND_RULES}
- Each post is at most 240 characters, not counting the URL.
- The first post has to earn the second. Do not open with "A thread:" or a number.
- The URL goes in the first post and nowhere else.

Return JSON: { "thread": [{ "text": "..." }, ...], "altText": "a one-sentence description of the image accompanying the first post" }`;
}

/** A Facebook Post: longer-form, and never a tweet pasted onto a Page. */
export function facebookPost({ game, post, examples }) {
  return `Write one Facebook Page post for this Game.

${dossier(game)}

${brief(post)}
${socialNote(game.category)}${fewShot(examples, game.category)}
${BRAND_RULES}
- Facebook is long-form: 3 to 5 short paragraphs, 400 to 900 characters. Do not write a tweet here.
- Open with the situation a reader recognises, not with the product.
- The URL goes on its own line at the end.

Return JSON: { "text": "the post", "altText": "a one-sentence description of the image that will accompany it, for a screen reader" }`;
}

/** Fed back when the first attempt broke a rule, so the retry knows what to fix. */
export function retryWith(violations) {
  return `\nYour previous attempt was rejected for these reasons:\n${violations.map(v => `- ${v}`).join('\n')}\nWrite it again, fixing every one. Do not argue with the rules.`;
}
