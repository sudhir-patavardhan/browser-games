/**
 * Specialized prompts for all marketing channels
 */

export const SYSTEM_PROMPTS = {
  marketingStrategist: `You are an elite Growth & Marketing Agent for Kreeda (https://kreeda.games), a collection of 12 zero-dependency, single-file browser games.
Your core philosophy:
1. NEVER SOUND LIKE SPAM OR GENERIC AI MARKETING.
2. Lead with authentic value, surprising technical feats, or pure fun gameplay moments.
3. Respect community norms (e.g. Reddit rules, Hacker News guidelines, X brevity).
4. Highlight what makes Kreeda uniquely delightful:
   - Instant 0.1s load time on mobile & desktop
   - Zero downloads, zero accounts, zero pop-ups, zero paywalls
   - Single-file HTML engineering (vanilla JS, pure Canvas/WebGL, procedural WebAudio synth)
   - 100% open-source under MIT`,

  scoutLeadAnalyst: `You are an Opportunity Analyst for Kreeda. Your job is to analyze social posts and queries from users searching for games, technical showcases, or game dev inspiration.
You must:
1. Determine if Kreeda or a specific Kreeda game genuinely solves their request.
2. Assign a relevance score (0-100).
3. If relevant, draft a natural, ultra-helpful, genuine response that introduces the right game without being pushy.`
};

export const PROMPT_TEMPLATES = {
  twitterSingle: (game, context = '') => `Create a punchy, viral Twitter/X post for the browser game "${game.name}" on Kreeda.
Game URL: ${game.url}
Tagline: ${game.tagline}
Key features: ${game.highlights?.join(', ') || game.mechanics?.join(', ')}
Viral Hooks: ${game.viralHooks?.join(' | ')}
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
- Mechanics: ${JSON.stringify(game.mechanics || game.highlights)}
- Technical highlights: ${JSON.stringify(game.technicalHighlights || game.highlights)}
- Repo: https://github.com/sudhir-patavardhan/browser-games

Requirements:
- Tweet 1: High-curiosity hook + video/GIF visual prompt + high viral energy.
- Tweet 2-3: Deep dive into the mechanic/engineering (e.g. weight transfer physics, procedural WebAudio, WebRTC, zero-build).
- Tweet 4: Why single-file zero-dependency web apps feel magical again.
- Tweet 5: Call to action (link to play + GitHub repo link).
- Output JSON: { "thread": [ { "tweetNumber": 1, "text": "...", "mediaNote": "..." } ] }`,

  redditPost: (game, subreddit = 'r/webgames') => `Create a high-converting, community-appropriate Reddit post for ${subreddit} about "${game.name}".
Game URL: ${game.url}
Game Pitch: ${game.pitch}
Mechanics: ${JSON.stringify(game.mechanics || game.highlights)}
Subreddit Context: ${subreddit}

Guidelines:
- If r/webgames: Title must be descriptive, honest, and mention [HTML5]/[Web]. Body can be concise, inviting feedback.
- If r/indiegames or r/gamedev: Focus on mechanics, developer decisions, and lessons learned.
- If r/javascript: Focus on pure vanilla JS architecture, WebAudio synthesis, Canvas performance.
- Output JSON: { "subreddit": "${subreddit}", "title": "...", "bodyMarkdown": "...", "flair": "..." }`,

  hackerNewsPost: (game, type = 'Show HN') => `Create a "Show HN" submission and top-level maker comment for Hacker News.
Focus: "${game.name} — ${game.tagline}"
Portal: https://kreeda.games
Repo: https://github.com/sudhir-patavardhan/browser-games
Highlights: Single-file HTML, zero build tools, zero dependencies, procedural WebAudio, verified headless physics.

Requirements:
- HN Title: Clean, factual, no marketing buzzwords (e.g. "Show HN: Drift – A single-file endless EV racing game with procedural WebAudio").
- Maker Comment: Explain motivation, technical decisions, physics/rendering challenges, and ask for community feedback on performance or mechanics.
- Output JSON: { "title": "...", "url": "${game.url}", "makerComment": "..." }`,

  productHuntKit: () => `Create a complete Product Hunt launch kit for Kreeda (https://kreeda.games).
Highlights: 12 instant single-file browser games with 0 dependencies, 0 downloads, 0 paywalls.

Requirements:
- Name: Kreeda
- Tagline: (Under 60 characters)
- Short Description: (1-2 sentences)
- Pricing: 100% Free
- Maker First Comment: Passionate story about reviving the golden era of instant web games without bloat.
- Key Product Features: 5 clear bullet points.
- Output JSON: { "name": "Kreeda", "tagline": "...", "shortDescription": "...", "makerComment": "...", "featureBullets": ["..."] }`,

  shortVideoScript: (game) => `Create a 20-30 second viral TikTok / Reels / YouTube Shorts video script for "${game.name}".
Game: ${game.name} (${game.tagline})
Pitch: ${game.pitch}
Viral Hooks: ${game.viralHooks?.join(' | ')}

Format:
- 0-3s: Visual on-screen text hook + startling sound/visual cue.
- 3-18s: Fast-paced gameplay sequence showing core tension (e.g., drifting near a barrier, pocketing queen, dyno jump, 90s brawling).
- 18-25s: Climax / payoff.
- 25-30s: Clear CTA: "Free in your browser right now on Kreeda.games - no download".
- Output JSON: { "title": "...", "hookText": "...", "duration": "25s", "scenes": [ { "time": "0-3s", "visual": "...", "voiceover": "...", "onScreenText": "..." } ], "caption": "...", "hashtags": ["..."] }`,

  devtoArticle: (game) => `Write an in-depth technical article for Dev.to / Hashnode about the architecture of "${game.name}".
Game URL: ${game.url}
Repo: https://github.com/sudhir-patavardhan/browser-games
Tech Stack: Single-file HTML5, Canvas 2D / WebGL, Web Audio API, zero build tools.

Structure:
1. The 0-Dependency Challenge: Why we chose zero frameworks and single HTML files.
2. Architecture breakdown of ${game.name}: The render loop and state management.
3. Physics / Math breakdown: How the mechanics are calculated.
4. Procedural WebAudio: Synthesizing real sound without loading audio files.
5. Verification: How headless Chrome verifies physics.
6. Play the game & view the source code.
- Output JSON: { "title": "...", "tags": ["javascript", "webdev", "gamedev", "showdev"], "contentMarkdown": "..." }`,

  adsCampaignBrief: ({ catalog = [], learnings = null, activeCampaigns = [], dailyBudgetUsd = 10 }) => `Plan the next paid X (Twitter) "Website traffic" campaign for Kreeda. Budget: $${dailyBudgetUsd}/day for a 2-day trial, so the ad must earn link clicks fast.

You may ONLY pick one of these games (use the exact "id" for gameId):
${catalog.map(g => `- id: "${g.id}", name: "${g.name}" — ${g.tagline} — ${g.url}`).join('\n')}

Campaigns currently running (avoid duplicating their game + angle):
${activeCampaigns.length ? activeCampaigns.map(c => `- ${c.gameId} / ${c.angle}`).join('\n') : '- none'}

What past campaigns taught us (most recent first; empty if this is the first):
${learnings ? JSON.stringify(learnings, null, 2) : 'No history yet — pick the game with the broadest appeal and the strongest, most concrete hook.'}

Rules for the ad text:
- Lead with the benefit to the player, not the mechanics or the tech stack.
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

  opportunityDraft: (post, catalog = []) => `Analyze this social post / user query and draft a personalized, helpful reply introducing the most appropriate Kreeda game:
User Post: "${post.content}"
Platform: "${post.platform}"
Author: "${post.author}"

You may ONLY recommend one of these actual Kreeda games (use the exact "id" value for recommendedGame — never invent a game that isn't in this list):
${catalog.map(g => `- id: "${g.id}", name: "${g.name}" — ${g.tagline}`).join('\n')}

Determine:
1. Relevance score (0-100)
2. Best matching game id from the list above (if nothing fits well, use "hub")
3. Natural, friendly reply that directly addresses their question and mentions the game as an instant solution.
- Output JSON: { "relevanceScore": 85, "recommendedGame": "...", "reasoning": "...", "draftReply": "..." }`
};
