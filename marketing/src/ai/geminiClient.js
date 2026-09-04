import { GoogleGenAI } from '@google/genai';
import { config } from '../config.js';

/**
 * Gemini AI Client for Autonomous Marketing
 * Uses Gemini 3.7 Flash for deep reasoning, creative writing, and opportunity analysis.
 *
 * Uses the official @google/genai SDK rather than raw fetch() calls, since AI Studio's
 * current "auth key" credentials (distinct from legacy static "AIzaSy..." keys) are bound
 * to a service account and are not accepted via a plain key= query param or header.
 */
/** The Creative could not write. The Post stays a Draft (§6.3). */
export class GeminiUnavailableError extends Error {
  constructor(message) {
    super(message);
    this.name = 'GeminiUnavailableError';
  }
}

export class GeminiClient {
  constructor(apiKey = config.ai.geminiApiKey, model = config.ai.geminiModel) {
    this.apiKey = apiKey;
    this.model = model;
  }

  get isConfigured() {
    return Boolean(this.apiKey && this.apiKey !== 'your_gemini_api_key_here');
  }

  /**
   * Generates content with Gemini 3.7 Flash
   * @param {Object} options
   * @param {string} options.prompt - Main user prompt
   * @param {string} [options.systemInstruction] - System prompt defining persona & rules
   * @param {number} [options.temperature] - Sampling temperature (0.2 to 1.0)
   * @param {boolean} [options.jsonMode] - Expect structured JSON response
   */
  async generate({ prompt, systemInstruction = '', temperature = 0.7, jsonMode = false, strict = false }) {
    if (!this.isConfigured) {
      if (strict) throw new GeminiUnavailableError('GEMINI_API_KEY is not set, so the Creative cannot write.');
      console.warn('⚠️ GEMINI_API_KEY not configured. Falling back to template generation engine.');
      return this.fallbackGenerator(prompt, jsonMode);
    }

    try {
      const ai = new GoogleGenAI({ apiKey: this.apiKey });

      const interaction = await ai.interactions.create({
        model: this.model,
        input: prompt,
        ...(systemInstruction ? { system_instruction: systemInstruction } : {}),
        generation_config: { temperature }
      });

      const text = (interaction.output_text || '').trim();

      if (jsonMode) {
        try {
          return JSON.parse(text);
        } catch (e) {
          // If JSON parsing fails, extract potential JSON substring
          const jsonMatch = text.match(/\{[\s\S]*\}|\[[\s\S]*\]/);
          if (jsonMatch) return JSON.parse(jsonMatch[0]);
          throw new Error(`Failed to parse JSON from Gemini response: ${text}`);
        }
      }

      return text.trim();
    } catch (err) {
      // §6.3: live mode never publishes fallback copy. A Post the Creative
      // could not write stays a Draft and is listed in the Run log, because
      // generic template copy going out under the brand is worse than silence.
      if (strict) throw new GeminiUnavailableError(`The Creative could not write: ${err.message}`);
      console.error('Gemini API call failed:', err.message);
      console.warn('Using deterministic fallback template...');
      return this.fallbackGenerator(prompt, jsonMode);
    }
  }

  /**
   * Deterministic high-quality fallback when offline or before API key is provided
   */
  fallbackGenerator(prompt, jsonMode) {
    if (jsonMode) {
      return {
        title: "Kreeda — Instant 0-Dependency Browser Games",
        headline: "Free browser games that start the second you tap",
        hook: "No downloads, no sign-ups, no ads. Games that start the millisecond you tap.",
        hookText: "No downloads, no sign-ups, no ads. Games that start the millisecond you tap.",
        body: "We built 12 polished arcade games in pure vanilla JavaScript and WebAudio. Every single game is a self-contained index.html file with zero build tools.\n\nPlay right now on your phone or desktop: https://kreeda.games/",
        bodyMarkdown: "Hey everyone! We built a collection of 12 polished, single-file browser games with 0 dependencies and 0 build tools.\n\nPlay instantly: https://kreeda.games/\nSource: https://github.com/sudhir-patavardhan/browser-games",
        contentMarkdown: "# Building 12 Browser Games with Zero Dependencies\n\nEvery game is an index.html file with procedural WebAudio.\n\nPlay: https://kreeda.games/",
        tags: ["webdev", "indiegames", "javascript", "gaming"],
        hashtags: ["#webdev", "#indiedev", "#javascript"],
        callToAction: "Try it instantly at https://kreeda.games",
        makerComment: "We built Kreeda to revive the era of instant, bloat-free browser games. Check out the source on GitHub: https://github.com/sudhir-patavardhan/browser-games",
        draftReply: "Check out Kreeda (https://kreeda.games) — 12 free browser games with 0 ads and instant load time. For racing/drifting, Drift (https://kreeda.games/drift/) has real weight transfer and EV battery mechanics!",
        relevanceScore: 92,
        recommendedGame: "drift",
        reasoning: "User is asking for lightweight web games with fast loading and no popups.",
        score: 9.2
      };
    }
    return `🎮 Kreeda — Free Browser Games\n\nNo downloads. No accounts. Pure gameplay.\n\nFrom realistic EV drifting with regenerative braking to traditional Carrom and 8-ball pool, play 12 polished games directly in your browser.\n\n👉 Play now: https://kreeda.games/\n\n#webdev #indiegames #gamedev #javascript`;
  }
}
