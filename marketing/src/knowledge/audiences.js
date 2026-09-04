import { CHANNELS } from './channels.js';

/**
 * Audience personas, platform parameters, subreddits, hashtags, and growth hooks
 */
export const AUDIENCES = {
  personas: {
    casual_gamers: {
      name: 'Casual & Coffee-Break Gamers',
      tone: 'Fun, frictionless, inviting, highlighting instant play and 0 loading time',
      channels: CHANNELS,
      bestGames: ['drift', 'break-room', 'chroma-blocks', 'carrom']
    },
    web_developers: {
      name: 'Web Dev & Engineering Community',
      tone: 'Technical, deep, highlighting zero-dependency, single-file HTML, Canvas/WebGL, procedural WebAudio, WebRTC',
      channels: CHANNELS,
      bestGames: ['drift', 'ennead', 'chroma-blocks', 'carrom', 'dasanana']
    },
    indie_gamers: {
      name: 'Indie Game Enthusiasts & Speedrunners',
      tone: 'Gameplay-focused, mechanics-rich, challenging, emphasizing emergent physics and high-skill ceilings',
      channels: CHANNELS,
      bestGames: ['drift', 'road-rumble', 'last-16', 'fairway-four']
    },
    board_and_puzzle: {
      name: 'Strategy & Board Game Lovers',
      tone: 'Thoughtful, tactical, comparing against classic physical rules and AI depth',
      channels: CHANNELS,
      bestGames: ['carrom', 'ennead', 'break-room', 'blackjack']
    },
    // Twelve of the twenty-nine Games are social — the whole Friends circle
    // and Play together Categories — and until this persona existed the
    // Strategist had no voice to plan them in.
    friend_groups: {
      name: 'Friend Groups, Families & Party Hosts',
      tone: 'Warm and specific about what the group finds out about itself. Brand rule 1 applies: lead with the relationship, never with the one-phone mechanic',
      channels: CHANNELS,
      bestCategories: ['Friends circle', 'Play together']
    },
    students_and_teachers: {
      name: 'High-School Students & Their Teachers',
      tone: 'Plain and unpatronising, treating the daily grid as revision that happens to be a puzzle; the reveal is the teaching moment',
      channels: CHANNELS,
      bestCategories: ['Daily study grids']
    }
  },
  channels: {
    twitter: {
      maxChars: 280,
      format: 'Thread or single tweet with media and punchy hook',
      hashtags: ['#webdev', '#indiedev', '#gamedev', '#javascript', '#browsergames', '#gaming'],
      bestTimes: ['09:00', '13:00', '17:00']
    },
    facebook: {
      maxChars: 63206,
      format: 'Single post with engaging headline and link',
      bestTimes: ['09:00', '13:00', '17:00', '20:00']
    }
  }
};
