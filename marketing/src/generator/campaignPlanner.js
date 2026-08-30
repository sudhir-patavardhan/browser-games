import { GAME_CATALOG } from '../knowledge/catalog.js';
import { ContentGenerator } from './contentGenerator.js';

export class CampaignPlanner {
  constructor(generator = new ContentGenerator()) {
    this.generator = generator;
  }

  /**
   * Plans a weekly marketing calendar covering 7 days of structured growth
   * @param {Date} [startDate]
   */
  async planWeeklyCalendar(startDate = new Date()) {
    const gameKeys = Object.keys(GAME_CATALOG).filter(k => k !== 'hub');
    const schedule = [];

    const days = [
      {
        day: 'Monday',
        theme: 'Spotlight Showcase',
        channel: 'twitter',
        focusGame: 'drift',
        options: { isThread: true, angle: 'gameplay mechanics' },
        description: 'Deep-dive into core game mechanics with a video/GIF'
      },
      {
        day: 'Tuesday',
        theme: 'Tech & Architecture Tuesday',
        channel: 'devto',
        focusGame: 'ennead',
        options: {},
        description: 'Deep-dive article on minimax AI with alpha-beta pruning & single-file architecture'
      },
      {
        day: 'Wednesday',
        theme: 'Classic Board Game Revived',
        channel: 'reddit',
        focusGame: 'carrom',
        options: { subreddit: 'r/webgames' },
        description: 'Introduce Carrom physics and AI cushion bank calculations to web gamers'
      },
      {
        day: 'Thursday',
        theme: 'Shorts & TikTok Viral Reel',
        channel: 'shorts',
        focusGame: 'road-rumble',
        options: {},
        description: 'Fast-paced Road Rash style motorcycle combat reel'
      },
      {
        day: 'Friday',
        theme: 'Community Weekend Challenge',
        channel: 'twitter',
        focusGame: 'drift',
        options: { context: 'Friday Daily Road Drift Challenge — Beat the developer ghost score!' },
        description: 'Call out players to race today’s daily seed and share scores'
      },
      {
        day: 'Saturday',
        theme: 'Indie Game Spotlight',
        channel: 'reddit',
        focusGame: 'dasanana',
        options: { subreddit: 'r/indiegames' },
        description: 'Showcase the mythological astra-countering combat and tejas mechanics'
      },
      {
        day: 'Sunday',
        theme: 'Relax & Chill Arcade',
        channel: 'twitter',
        focusGame: 'break-room',
        options: { context: 'Sunday pool practice — relaxing 8-ball with real cue ball spin' },
        description: 'Highlight casual distraction-free 8-ball pool'
      }
    ];

    for (let i = 0; i < days.length; i++) {
      const item = days[i];
      const postDate = new Date(startDate);
      postDate.setDate(startDate.getDate() + i);

      console.log(`📅 Planning ${item.day}: ${item.theme} (${item.focusGame} on ${item.channel})...`);
      const generated = await this.generator.generate(item.focusGame, item.channel, item.options);

      schedule.push({
        id: `plan-${item.day.toLowerCase()}-${Date.now()}-${i}`,
        scheduledDate: postDate.toISOString().split('T')[0],
        dayOfWeek: item.day,
        theme: item.theme,
        channel: item.channel,
        gameId: item.focusGame,
        gameName: GAME_CATALOG[item.focusGame]?.name || item.focusGame,
        description: item.description,
        status: 'scheduled',
        content: generated.content,
        createdAt: new Date().toISOString()
      });
    }

    return {
      planId: `weekly-plan-${startDate.toISOString().split('T')[0]}`,
      startDate: startDate.toISOString().split('T')[0],
      items: schedule
    };
  }
}
