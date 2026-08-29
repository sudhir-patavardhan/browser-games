import fs from 'node:fs';
import { config } from '../config.js';
import { GAME_CATALOG } from '../knowledge/catalog.js';
import { GeminiClient } from '../ai/geminiClient.js';
import { SYSTEM_PROMPTS, PROMPT_TEMPLATES } from '../ai/prompts.js';

export class OpportunityScout {
  constructor(geminiClient = new GeminiClient()) {
    this.ai = geminiClient;
  }

  /**
   * Evaluates a batch of community queries / posts and drafts contextual responses
   * @param {Array<{id: string, platform: string, author: string, content: string, url: string}>} queries
   */
  async evaluateQueries(queries) {
    const results = [];

    const catalogList = Object.values(GAME_CATALOG).map(g => ({ id: g.id, name: g.name, tagline: g.tagline }));
    const validGameIds = new Set(catalogList.map(g => g.id));

    for (const query of queries) {
      console.log(`🔍 Scouting lead on ${query.platform} by ${query.author}: "${query.content.slice(0, 50)}..."`);

      const analysis = await this.ai.generate({
        prompt: PROMPT_TEMPLATES.opportunityDraft(query, catalogList),
        systemInstruction: SYSTEM_PROMPTS.scoutLeadAnalyst,
        jsonMode: true
      });

      const recommendedGame = validGameIds.has(analysis.recommendedGame) ? analysis.recommendedGame : 'hub';

      const lead = {
        id: query.id || `lead-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        discoveredAt: new Date().toISOString(),
        platform: query.platform,
        author: query.author,
        sourceUrl: query.url || '',
        queryContent: query.content,
        relevanceScore: analysis.relevanceScore || 75,
        recommendedGame,
        reasoning: analysis.reasoning || '',
        draftReply: analysis.draftReply || '',
        status: (analysis.relevanceScore || 75) >= 70 ? 'qualified' : 'low_relevance'
      };

      results.push(lead);
    }

    this.saveOpportunities(results);
    return results;
  }

  /**
   * Generates a sample scan of relevant community search topics to demonstrate scout in action
   */
  async scanSimulatedFeeds() {
    const seedQueries = [
      {
        id: 'reddit-webgames-01',
        platform: 'Reddit (r/webgames)',
        author: 'u/arcade_seeker',
        url: 'https://reddit.com/r/webgames/comments/sample1',
        content: 'Anyone know any good arcade racing or drifting web games that do not have 50 popups and load fast on Chrome?'
      },
      {
        id: 'reddit-climbing-02',
        platform: 'Reddit (r/climbing)',
        author: 'u/boulder_bro',
        url: 'https://reddit.com/r/climbing/comments/sample2',
        content: 'Are there any realistic climbing or bouldering browser games that actually simulate flagging and dynos?'
      },
      {
        id: 'hn-ask-03',
        platform: 'Hacker News',
        author: 'gamedev_curious',
        url: 'https://news.ycombinator.com/item?id=sample3',
        content: 'Show me impressive modern web games that don’t use heavy engines or 50MB asset bundles. Love seeing pure Canvas and WebAudio projects.'
      },
      {
        id: 'twitter-break-04',
        platform: 'Twitter/X',
        author: '@casual_coder',
        url: 'https://twitter.com/casual_coder/status/sample4',
        content: 'Need a quick 3-minute browser game to play during lunch break. No sign up, no tutorial please!'
      }
    ];

    return await this.evaluateQueries(seedQueries);
  }

  saveOpportunities(newLeads) {
    let existing = [];
    if (fs.existsSync(config.paths.opportunitiesFile)) {
      try {
        existing = JSON.parse(fs.readFileSync(config.paths.opportunitiesFile, 'utf8'));
      } catch (e) {
        existing = [];
      }
    }

    // Merge by id
    const map = new Map(existing.map(item => [item.id, item]));
    for (const lead of newLeads) {
      map.set(lead.id, lead);
    }

    const merged = Array.from(map.values());
    fs.writeFileSync(config.paths.opportunitiesFile, JSON.stringify(merged, null, 2));
    console.log(`💾 Saved ${merged.length} opportunity leads to ${config.paths.opportunitiesFile}`);
  }
}
