/**
 * The Creative's prompts (AGENTS_SPEC.md §6.3) and the two the paid lane
 * still uses. One Channel's prompt is never used for the other.
 */

export const SYSTEM_PROMPTS = {
  marketingStrategist: `You are an elite Growth & Marketing Agent for Kreeda (https://kreeda.games), a hub of instant, single-file browser games — 29 Games across 7 Categories.
Your core philosophy:
1. NEVER SOUND LIKE SPAM OR GENERIC AI MARKETING.
2. Lead with authentic value, surprising technical feats, or pure fun gameplay moments.
3. Respect each Channel's norms: X brevity, Facebook's longer form.
4. Highlight what makes Kreeda uniquely delightful:
   - Instant 0.1s load time on mobile & desktop
   - Zero downloads, zero accounts, zero pop-ups, zero paywalls
   - Single-file HTML engineering (vanilla JS, pure Canvas/WebGL, procedural WebAudio synth)
   - 100% open-source under MIT`
};

export const PROMPT_TEMPLATES = {
  twitterSingle: (game, context = '') => `Create a punchy, viral Twitter/X post for the browser game "${game.name}" on Kreeda.
Game URL: ${game.url}
Tagline: ${game.tagline}
Key features: ${game.mechanics?.join(', ')}
Hooks: ${game.hooks?.join(' | ')}
Additional context: ${context}

Requirements:
- Under 280 characters.
- Must include a gripping hook (first line).
- Must include the direct link (${game.url}) and 2-3 relevant hashtags (e.g. #indiedev #webdev #gamedev).
- Output JSON format: { "headline": "...", "text": "...", "hashtags": ["..."], "mediaSuggestion": "..." }`,

  twitterThread: (game, angle = 'technical') => `Create an engaging 4-5 tweet Twitter/X thread for "${game.name}" (${game.url}).
Angle: ${angle} (e.g. 'technical breakdown', 'gameplay mechanics showcase', or 'indie dev story').
Game Details:
- Pitch: ${game.pitch}
- Mechanics: ${JSON.stringify(game.mechanics)}
- Technical highlights: ${JSON.stringify(game.technicalHighlights || game.mechanics)}
- Repo: https://github.com/sudhir-patavardhan/browser-games

Requirements:
- Tweet 1: High-curiosity hook + video/GIF visual prompt + high viral energy.
- Tweet 2-3: Deep dive into the mechanic/engineering (e.g. weight transfer physics, procedural WebAudio, WebRTC, zero-build).
- Tweet 4: Why single-file zero-dependency web apps feel magical again.
- Tweet 5: Call to action (link to play + GitHub repo link).
- Output JSON: { "thread": [ { "tweetNumber": 1, "text": "...", "mediaNote": "..." } ] }`,

  togetherVideoPost: (game) => `Write one X (Twitter) post to accompany a 25-second video of two people playing "${game.name}" (${game.url}) together.
Tagline: ${game.tagline}
Pitch: ${game.pitch}
Hooks: ${game.hooks?.join(' | ')}

Rules:
- Lead with the relationship benefit — what the two people find out about each other, the feeling of the reveal. NEVER open with the mechanic ("one phone", "pass the phone", "two players"): that is how it works, not why anyone plays.
- Speak to couples, close friends, siblings, coworkers — people who already have someone to play with tonight.
- Plain, warm, specific. No exclamation-mark hype, no rocket emoji, no "game-changer".
- Under 240 characters including the URL exactly as given. At most two hashtags, at the very end.
- Also write alt text for the video: one sentence, what is visibly happening on screen.
Output JSON: { "text": "...", "altText": "..." }`,

  adsCampaignBrief: ({ catalog = [], learnings = null, organic = null, activeCampaigns = [], dailyBudgetUsd = 10 }) => `Plan the next paid X (Twitter) "Website traffic" campaign for Kreeda. Budget: $${dailyBudgetUsd}/day for a 2-day trial, so the ad must earn link clicks fast.

You may ONLY pick one of these games (use the exact "id" for gameId):
${catalog.map(g => `- id: "${g.id}", name: "${g.name}"${g.category ? ` [${g.category}]` : ''} — ${g.tagline} — ${g.url}`).join('\n')}

Campaigns currently running (avoid duplicating their game + angle):
${activeCampaigns.length ? activeCampaigns.map(c => `- ${c.gameId} / ${c.angle}`).join('\n') : '- none'}

What past campaigns taught us (most recent first; empty if this is the first):
${learnings ? JSON.stringify(learnings, null, 2) : 'No history yet — pick the game with the broadest appeal and the strongest, most concrete hook.'}

How our own organic posts have performed, by game (impressions, link clicks, CTR; the video posts are the [play-together] storyboards):
${organic && Object.keys(organic).length ? JSON.stringify(organic, null, 2) : 'No organic measurements yet.'}

Rules for the ad text:
- Lead with the benefit to the player, not the mechanics or the tech stack.
- For [play-together] games, lead with the relationship benefit — what the two people find out about each other — never with the one-phone / pass-the-phone mechanic. These ads run with the game's video creative, so the text can assume the viewer sees it being played.
- No hashtags at all (X rejects hashtags in ads). No @mentions.
- Include the game's URL exactly as listed above.
- Under 240 characters. Plain, specific, human.

Choose targeting for the audience most likely to click:
- ageBucket: one of AGE_18_PLUS, AGE_21_TO_34, AGE_25_TO_34, AGE_35_TO_49
- interests: 1-3 names from X's taxonomy, e.g. "Gaming", "Technology/Software Development", "Relationships", "Relationships/Dating"
- keywords: 4-7 short phrases people would post or search

Output JSON: { "gameId": "...", "angle": "<3-6 word label for this creative angle>", "tweetText": "...", "headline": "<website card headline, under 50 chars>", "ageBucket": "...", "interests": ["..."], "keywords": ["..."], "rationale": "<one sentence on why, citing the learnings if any>" }`,

  adsLearningsSummary: (records) => `You are reviewing paid X campaign results for Kreeda (free browser games). Each record has the game, the creative angle, targeting, spend in USD, impressions, link clicks, CTR and CPC, and whether it was kept or paused.

${JSON.stringify(records, null, 2)}

Write 3-5 short, concrete lessons for planning the next campaign (which games/angles/audiences earn cheap clicks, which don't, what to try next). Output JSON: { "lessons": ["..."], "recommendedNext": "<one sentence>" }`,

};
