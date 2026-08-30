/**
 * Audience personas, platform parameters, subreddits, hashtags, and growth hooks
 */
export const AUDIENCES = {
  personas: {
    casual_gamers: {
      name: 'Casual & Coffee-Break Gamers',
      tone: 'Fun, frictionless, inviting, highlighting instant play and 0 loading time',
      preferredPlatforms: ['twitter', 'reddit', 'tiktok', 'discord'],
      bestGames: ['drift', 'break-room', 'chroma-blocks', 'carrom']
    },
    web_developers: {
      name: 'Web Dev & Engineering Community',
      tone: 'Technical, deep, highlighting zero-dependency, single-file HTML, Canvas/WebGL, procedural WebAudio, WebRTC',
      preferredPlatforms: ['hackernews', 'twitter', 'reddit', 'devto'],
      bestGames: ['drift', 'ennead', 'chroma-blocks', 'carrom', 'dasanana']
    },
    indie_gamers: {
      name: 'Indie Game Enthusiasts & Speedrunners',
      tone: 'Gameplay-focused, mechanics-rich, challenging, emphasizing emergent physics and high-skill ceilings',
      preferredPlatforms: ['reddit', 'twitter', 'discord'],
      bestGames: ['drift', 'road-rumble', 'last-16', 'fairway-four']
    },
    board_and_puzzle: {
      name: 'Strategy & Board Game Lovers',
      tone: 'Thoughtful, tactical, comparing against classic physical rules and AI depth',
      preferredPlatforms: ['reddit', 'twitter'],
      bestGames: ['carrom', 'ennead', 'break-room', 'blackjack']
    }
  },
  channels: {
    twitter: {
      maxChars: 280,
      format: 'Thread or single tweet with media and punchy hook',
      hashtags: ['#webdev', '#indiedev', '#gamedev', '#javascript', '#browsergames', '#gaming'],
      bestTimes: ['09:00', '13:00', '17:00']
    },
    reddit: {
      subreddits: [
        { name: 'r/webgames', rule: 'Must link directly to game; no spam; title should explain mechanics' },
        { name: 'r/indiegames', rule: 'Highlight gameplay clips, mechanics, dev journey' },
        { name: 'r/playmygame', rule: 'Include game name, platform [Web], free tag, short synopsis' },
        { name: 'r/javascript', rule: 'Focus on technical breakdown, canvas/audio architecture, open source' },
        { name: 'r/gamedev', rule: 'Share technical post-mortems, procedural generation, WebRTC networking' },
        { name: 'r/climbing', rule: 'Deadpoint specific: share realistic flagging/dyno mechanic demo' }
      ]
    },
    hackernews: {
      types: ['Show HN', 'Tech Blog Post'],
      guidelines: 'Straightforward title without marketing buzzwords, open source GitHub link, technical explanation of constraints (single-file, 0 dependencies, WebAudio synthesis)'
    },
    producthunt: {
      taglineLength: 60,
      makerCommentFocus: 'Why we built Kreeda — restoring the era of instant, bloat-free browser games'
    },
    shorts: {
      durationSeconds: 30,
      structure: ['0-3s: Visual or text hook', '3-20s: High-energy gameplay demo', '20-30s: Payoff + Call to action']
    },
    devto: {
      tags: ['javascript', 'webdev', 'gamedev', 'showdev'],
      structure: ['Motivation & Rules of Constraint', 'Technical Architecture', 'Physics / Audio Deep-Dive', 'Open Source Link']
    }
  }
};
