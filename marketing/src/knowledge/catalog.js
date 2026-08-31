/**
 * Complete Marketing Dossier for all 12 Games on Kreeda + Hub
 */
export const GAME_CATALOG = {
  hub: {
    id: 'hub',
    name: 'Kreeda',
    genre: 'Instant Browser Game Portal',
    url: 'https://kreeda.games/',
    repoUrl: 'https://github.com/sudhir-patavardhan/browser-games',
    tagline: 'Free games that start the second you tap.',
    pitch: 'A collection of 12 polished, single-file browser games with zero build tools, zero frameworks, and zero dependencies. Works instantly on desktop and mobile.',
    highlights: [
      'No downloads, no logins, no paywalls, no tracking bloat',
      'Loads in under 100ms on 3G connections',
      'Single HTML file per game (pure vanilla JS + Canvas/WebGL)',
      '100% open source under MIT'
    ],
    targetAudiences: ['casual_gamers', 'indie_enthusiasts', 'web_developers', 'speedrunners', 'office_break_players'],
    viralHooks: [
      'Remember when web games loaded instantly and didn\'t ask for your email?',
      '12 full arcade games built with 0 dependencies and 0 build steps.',
      'How we fit an entire game arcade into standalone HTML files.'
    ]
  },
  drift: {
    id: 'drift',
    name: 'Drift',
    genre: 'Endless EV Drifting & Zombie Arcade',
    url: 'https://kreeda.games/drift/index.html',
    tagline: 'Grip is a budget. The battery is your life.',
    pitch: 'A bright, sunny endless drifting game with real weight-transfer and throttle dynamics — no handbrake. Drive a high-end EV across 4 procedural biomes, harvest zombie horde bounties, auto-park at EV fast chargers, and race daily seeded ghost lines.',
    mechanics: [
      'Real physics: weight transfer on braking initiates oversteer, power holds it, countersteer catches it',
      'EV battery economy: regen braking recharges pack; off-road grass drains 90x faster; rest-area DC fast chargers',
      '4 procedural biomes (Temperate, Rain belt, Snow country, Desert) with seamless continuous crossfades',
      'Zombie bounties with multiplier-based payouts, weapons armory (Pistol, SM-2, LR-7), oncoming traffic close-calls',
      'Daily road with deterministic ghost recording and 15 persistent badges'
    ],
    technicalHighlights: [
      'Dual-view rendering (First-person Cockpit HUD + Top-Down glance)',
      'WebAudio procedural EV motor sound (pitch = speed, loudness = |kW|, regen pitch bend)',
      'Headless browser verified physics invariants via Chrome CDP'
    ],
    targetAudiences: ['racing_fans', 'retro_arcade', 'ev_enthusiasts', 'speedrunners'],
    viralHooks: [
      'A drifting game where the battery is your health bar.',
      'We built a racing game with realistic weight transfer in a single index.html file.',
      'When you pause this drift game, your EV actually uses auto-park valet to plug into a DC fast charger.'
    ]
  },
  carrom: {
    id: 'carrom',
    name: 'Carrom',
    genre: 'Traditional Board Game Simulation',
    url: 'https://kreeda.games/carrom/index.html',
    tagline: 'Flick the striker, pocket the queen.',
    pitch: 'A polished arcade take on the classic Indian board game. Position your striker, aim with slingshot controls, and pocket your 9 carrommen and the red queen with realistic rigid-disc collision physics and a 3-difficulty AI.',
    mechanics: [
      'Rigid-disc physics with mass momentum ratios (Striker 2.2x vs Piece 1.0x)',
      'Continuous collision detection (sub-stepping) and corner pocket suction',
      'Official carrom rules: white/black pieces, red queen cover bonus, striker foul penalties',
      '3-tier AI that calculates ghost-ball pocket lines and restitution-corrected cushion bank shots'
    ],
    technicalHighlights: [
      'Procedural Canvas 2D wood board rendering with lacquer sheen',
      'Synthesized WebAudio wood-on-wood clacks and pocket thuds'
    ],
    targetAudiences: ['board_game_lovers', 'south_asian_gamers', 'physics_game_fans'],
    viralHooks: [
      'The classic Indian board game Carrom recreated in pure vanilla JavaScript.',
      'An AI opponent that calculates cushion bank shots in real time in your browser.'
    ]
  },
  'break-room': {
    id: 'break-room',
    name: '8-Ball Pool',
    genre: 'Physics 8-Ball Pool',
    url: 'https://kreeda.games/break-room/index.html',
    tagline: 'Real spin, called pockets, zero downloads.',
    pitch: 'Physics-driven 8-ball pool with full official rules, draggable spin control (topspin, backspin/draw, english), customizable felt themes, practice mode, 2P pass-and-play, and a smart AI opponent.',
    mechanics: [
      'Full 8-ball rules: open table, solid/stripe group claim, legal hit detection, called 8-ball pocket',
      'Interactive cue spin pad for realistic cue ball deflection and draw shots',
      'Pass-and-play local multiplayer, solo practice, and 3-difficulty AI'
    ],
    technicalHighlights: [
      'Ball specular lighting and rolling 3D shadow illusions in 2D Canvas',
      'WebAudio procedural pool ball clacks, rail thuds, and pocket drops'
    ],
    targetAudiences: ['pool_players', 'billiards_fans', 'casual_gamers'],
    viralHooks: [
      'Looking for a quick 8-ball pool game at work without downloading an app or watching ads?',
      'How to model cue ball spin and cushion restitution in vanilla JavaScript.'
    ]
  },
  'chroma-blocks': {
    id: 'chroma-blocks',
    name: 'Falling Blocks',
    genre: 'Neon Falling Blocks Puzzle',
    url: 'https://kreeda.games/chroma-blocks/index.html',
    tagline: 'Vibrant neon, pure flow state.',
    pitch: 'A neon falling-blocks puzzle in the spirit of modern Tetris. Features a 7-bag randomizer, hold slot, 3-piece next queue, ghost piece guide, SRS wall kicks, combo multipliers, and satisfying particle bursts.',
    mechanics: [
      'Standard 7-bag randomizer and Super Rotation System (SRS) wall kicks',
      'Ghost piece, hard/soft drops, lock delay, combo counter ladder',
      'Smooth keyboard + mobile touch controls'
    ],
    technicalHighlights: [
      'Glassmorphic dark UI with particle burst clear effects',
      'Procedural synth audio with distinct pitch keys for rotations and clears'
    ],
    targetAudiences: ['puzzle_lovers', 'tetris_fans', 'casual_gamers'],
    viralHooks: [
      'The cleanest, distraction-free falling blocks game on the web.',
      'No ads, no logins — just pure neon block stacking in 1 file.'
    ]
  },
  'last-16': {
    id: 'last-16',
    name: 'Knockout Football',
    genre: 'World Cup 2026 Arcade Football',
    url: 'https://kreeda.games/last-16/index.html',
    tagline: '16 nations. 4 real stars each. Lift the trophy.',
    pitch: 'Arcade soccer set at the World Cup 2026 knockout stage. Choose from 16 real nations and authentic star players, control them directly with smart AI teammates, manage sprint stamina, curl charged shots into the top corner, and win the tournament.',
    mechanics: [
      '16 real national teams with authentic kits and 4 star players with unique PAC/SHO/PAS/DEF/PHY stats',
      'Direct control with virtual joystick + Pass, Shoot (charged curl), Lofted Through-Ball, Slide Tackle',
      'Full tournament knockout bracket, penalty shootouts, match timer, radar minimap, half/full-time stats'
    ],
    technicalHighlights: [
      'Dynamic pitch radar canvas and flocking AI team positioning',
      'WebAudio procedural crowd murmur, roar, referee whistles, ball kicks'
    ],
    targetAudiences: ['soccer_fans', 'fifa_players', 'arcade_sports'],
    viralHooks: [
      'Play World Cup 2026 knockout football directly in your browser with 0 loading time.',
      'Control Mbappé, Messi, Bellingham, or Vinicius in this lightweight arcade soccer game.'
    ]
  },
  'road-rumble': {
    id: 'road-rumble',
    name: 'Road Rumble',
    genre: 'Motorcycle Racing Brawler',
    url: 'https://kreeda.games/road-rumble/index.html',
    tagline: 'Pin the throttle. Throw the punch.',
    pitch: 'A Road Rash / OutRun style racing brawler on a pseudo-3D highway. Sprint against 5 rival riders over elevation crests and tight turns, dodge oncoming traffic, and throw punches or swing roadside clubs to stay on your bike and finish first.',
    mechanics: [
      'Pseudo-3D raster road projection engine with hills, valleys, and centrifugal curves',
      '6-rider combat race with health and stamina bars, melee punches, and roadside clubs',
      'Oncoming civilian trucks and cars, wiping out rivals or crashing'
    ],
    technicalHighlights: [
      'Classic 90s raster road projection written from scratch in Canvas 2D',
      'Procedural engine rev audio synthesis with Doppler pitch shift'
    ],
    targetAudiences: ['retro_gamers', 'road_rash_fans', 'action_arcade'],
    viralHooks: [
      'We rebuilt 90s Road Rash in vanilla JavaScript with pseudo-3D raster projection.',
      'Motorcycle racing with melee combat directly in your mobile browser.'
    ]
  },
  'fairway-four': {
    id: 'fairway-four',
    name: 'Golf',
    genre: '3D Golf Simulation',
    url: 'https://kreeda.games/fairway-four/index.html',
    tagline: '4 pristine holes. Wind, Magnus lift, flowing greens.',
    pitch: 'Full-3D golf over four authored holes rendered with Three.js. Features cinematic camera swoops, a 3-click swing meter with draw/fade timing, wind and Magnus-lift ball aerodynamics, sand traps, water hazards, and sloped putting greens with flowing break particle grids.',
    mechanics: [
      'Full club selection: Driver, 3-Wood, Irons (3-9), Pitching/Sand Wedges, Putter',
      '3-click swing meter determining power, hook/slice spin, and strike quality',
      'Real aerodynamics: wind drift, Magnus lift, surface bounce damping (fairway, rough, sand, water)'
    ],
    technicalHighlights: [
      'Three.js WebGL terrain, camera interpolation fly-bys, dynamic green contour particle flow'
    ],
    targetAudiences: ['golf_fans', 'sports_gamers', '3d_web_enthusiasts'],
    viralHooks: [
      'A full 3D 4-hole golf game running smoothly in your browser with wind and aerodynamics.',
      'Check out how the putting green visualizes slope breaks with animated contour lines.'
    ]
  },
  ennead: {
    id: 'ennead',
    name: 'Tic Tac Toe',
    genre: 'Classic & Ultimate Tic-Tac-Toe',
    url: 'https://kreeda.games/ennead/index.html',
    tagline: 'From 3x3 to nested 9x9 mind games.',
    pitch: 'Configurable strategy board game with two modes sharing one engine. Classic mode lets you play any N×N board (3x3 up to 9x9) with customizable win length k (Gomoku). Ultimate mode features a nested 9x9 grid where every move sends your opponent to a specific sub-board.',
    mechanics: [
      'Classic Mode: 3x3 up to 9x9 with customizable k-in-a-row winning conditions',
      'Ultimate Mode: 9 sub-boards linked by move coordinates, meta-cell capture animations',
      'Minimax AI with alpha-beta pruning (Hard 3x3 is mathematically unbeatable), move undo, light/dark themes'
    ],
    technicalHighlights: [
      'Pure CSS Grid / DOM rendering with fluid layout',
      'State persisted via localStorage with instant resume'
    ],
    targetAudiences: ['strategy_gamers', 'board_game_fans', 'chess_and_puzzle_lovers'],
    viralHooks: [
      'If you think Tic-Tac-Toe is too simple, try Ultimate Tic-Tac-Toe where every move dictates your opponent\'s sub-board.',
      'Play Gomoku or Ultimate Tic-Tac-Toe against an unbeatable minimax AI.'
    ]
  },
  dasanana: {
    id: 'dasanana',
    name: 'Astra Duel',
    genre: 'Mythic Astra-Duel & Sanskrit Rhythm',
    url: 'https://kreeda.games/dasanana/index.html',
    tagline: 'Counter divine astras. Chant for tejas. Loose the Brahmāstra.',
    pitch: 'A Rāmāyaṇa epic astra-duel. Counter Rāvaṇa\'s divine missiles with the true cosmic element before they collide, rhythm-chant authentic Āditya-Hṛdayam Sanskrit ślokas to restore your solar energy, survive the Śakti spear, and loose your Brahmāstra.',
    mechanics: [
      'Astra elemental counter system (Fire vs Water, Wind vs Mountain, Darkness vs Light)',
      'Rhythm chanting of authentic Sanskrit verses from the Āditya-Hṛdayam (Devanāgarī + IAST)',
      'Boss progression: Khara → Indrajit → Rāvaṇa (10 regenerating heads & Brahmāstra showdown)'
    ],
    technicalHighlights: [
      'Procedural Indian classical audio synthesis: tanpura drone, temple bells, conch shell (śankha)',
      'Particle-based divine astra collision effects'
    ],
    targetAudiences: ['mythology_fans', 'rhythm_game_players', 'indian_culture_enthusiasts'],
    viralHooks: [
      'An epic Rāmāyaṇa astra duel game with authentic Sanskrit rhythm chanting in your browser.',
      'Counter Rāvaṇa\'s divine missiles using elemental astravidya in this mythic action game.'
    ]
  },
  blackjack: {
    id: 'blackjack',
    name: 'Blackjack',
    genre: 'Classic Casino Card Game',
    url: 'https://kreeda.games/blackjack/index.html',
    tagline: 'Classic felt. 3:2 payout. Dealer stands on 17.',
    pitch: 'A polished, distraction-free Blackjack game with casino-accurate rules, chip betting ($5–$500), persistent bankroll, double down, and smooth 3D card flips.',
    mechanics: [
      'Standard single-deck casino rules: Blackjack pays 3:2, dealer stands on all 17s',
      'Chip denominations ($5, $25, $100, $500) and persistent balance in localStorage'
    ],
    technicalHighlights: [
      'Smooth CSS 3D card flip animations and classic green felt aesthetics'
    ],
    targetAudiences: ['casino_card_players', 'casual_gamers'],
    viralHooks: [
      'Cleanest browser blackjack — no ads, no purchase prompts, real 3:2 payouts.'
    ]
  },

  // ---- "Play together": two people, one phone, pass-and-play ----
  sync: {
    id: 'sync',
    name: 'Duo Quiz',
    genre: 'Two-Player Relationship Game',
    category: 'together',
    url: 'https://kreeda.games/sync/index.html',
    tagline: 'How well do you actually know each other?',
    pitch: 'Two players, one phone. Answer each question for yourself, predict what the other person will say, then reveal together. Ten rounds that show where you are in sync — and where you have been guessing. Packs for new pairs, couples, friends, family and coworkers.',
    mechanics: [
      'Answer → predict → reveal loop across ten rounds',
      'Similarity and insight scored separately',
      'Question packs: new pair, couple, friends, family, coworkers'
    ],
    technicalHighlights: ['Single HTML file; answers never leave the phone'],
    targetAudiences: ['couples', 'new_couples', 'close_friends', 'families'],
    viralHooks: [
      'Predict how your partner answers — then find out how wrong you were.',
      'The ten-question game that tells you whether you actually know your best friend.'
    ]
  },
  windows: {
    id: 'windows',
    name: 'Blind Spots',
    genre: 'Johari Window for Two',
    category: 'together',
    url: 'https://kreeda.games/windows/index.html',
    tagline: 'How you see yourself vs how they see you.',
    pitch: 'A playable Johari Window for two people on one phone. Each of you picks six words for yourself and six for the other — then the panes fill in: what you both see, what only you see, and the blind spots they see in you.',
    mechanics: [
      'Forty adjectives; six picks for yourself, six for them',
      'Four panes: open, hidden, blind spot, unknown',
      'Reveal is simultaneous so nobody adjusts their answers'
    ],
    technicalHighlights: ['Single HTML file; nothing uploaded'],
    targetAudiences: ['couples', 'close_friends', 'coworkers', 'psychology_curious'],
    viralHooks: [
      'Find out your blind spots from the one person who actually sees them.',
      'A 5-minute Johari Window you can play on a date.'
    ]
  },
  split: {
    id: 'split',
    name: 'Share or Take',
    genre: 'Two-Player Trust Game',
    category: 'together',
    url: 'https://kreeda.games/split/index.html',
    tagline: 'Share or Take. The score says who won — the pattern says who you are.',
    pitch: 'Ten rounds of Share or Take between two people on one phone. Both share and everyone wins; one takes and burns the other; both take and it is mutual ruin. Round 4 pays double, round 7 is sealed, round 10 pays triple — and the pattern of your choices says more than the score.',
    mechanics: [
      'Prisoner\'s-dilemma payoff grid: 3/3, 0/5, 5/0, 1/1',
      'Special rounds: double, sealed, triple',
      'End-of-game pattern read-out for both players'
    ],
    technicalHighlights: ['Single HTML file; local only'],
    targetAudiences: ['couples', 'close_friends', 'siblings', 'game_theory_fans'],
    viralHooks: [
      'How much do you trust each other, really? Ten rounds will tell.',
      'Play the prisoner\'s dilemma with someone you love. Watch round 7.'
    ]
  },
  auction: {
    id: 'auction',
    name: 'Life Auction',
    genre: 'Two-Player Values Game',
    category: 'together',
    url: 'https://kreeda.games/auction/index.html',
    tagline: '100 coins. Ten things people want from life. You can\'t fund them all.',
    pitch: 'A pass-the-phone game about what you value. Each player gets 100 coins to bid, in private, on ten things people want from life — then you reveal together and see where your priorities line up and where they collide.',
    mechanics: [
      'Private sealed bids across ten life priorities',
      'Scarcity forces trade-offs — you can\'t fund everything',
      'Side-by-side reveal of both players\' allocations'
    ],
    technicalHighlights: ['Single HTML file; no accounts'],
    targetAudiences: ['couples', 'new_couples', 'close_friends', 'families'],
    viralHooks: [
      'Bid on what matters to you — then see what your partner bid on.',
      'A ten-minute game that starts the money-and-priorities conversation without the fight.'
    ]
  },
  fathom: {
    id: 'fathom',
    name: 'Deep Talk',
    genre: 'Guided Conversation for Two',
    category: 'together',
    url: 'https://kreeda.games/fathom/index.html',
    tagline: '36 questions deep — a guided dive for two.',
    pitch: 'Two people, one phone, a guided dive through three depths of conversation based on the 36 questions. Includes a real before-and-after closeness check-in so you can see what the conversation changed.',
    mechanics: [
      'Three depths, twelve questions each, escalating intimacy',
      'Before/after closeness check-in',
      'Take turns; nothing is scored, everything is shared'
    ],
    technicalHighlights: ['Single HTML file; ambient sound optional'],
    targetAudiences: ['couples', 'new_couples', 'close_friends', 'psychology_curious'],
    viralHooks: [
      'The 36 questions, as a game you can actually finish in one evening.',
      'Measure how much closer you feel after 36 questions — the game does it for you.'
    ]
  },

  // ---- Build-and-learn ----
  apogee: {
    id: 'apogee',
    name: 'Rocket Builder',
    genre: 'Rocket Builder',
    category: 'build',
    url: 'https://kreeda.games/apogee/index.html',
    tagline: 'Build a rocket from real parts, then see how high it flies.',
    pitch: 'Assemble a rocket from real parts — payload, tanks, engines, fins, avionics, boosters — learn what each one does, then launch and see how high your design flies. Cross the Kármán line to reach space.',
    mechanics: ['Part-by-part assembly with real trade-offs', 'Launch simulation with altitude read-out', 'Kármán line as the goal'],
    technicalHighlights: ['Single HTML file; physics runs in the browser'],
    targetAudiences: ['space_fans', 'stem_students', 'curious_builders'],
    viralHooks: ['Can your rocket cross the Kármán line? Build it and find out.']
  },
  garage: {
    id: 'garage',
    name: 'Car Builder',
    genre: 'Car Builder',
    category: 'build',
    url: 'https://kreeda.games/garage/index.html',
    tagline: 'Build a car from 19 real parts and learn what every one of them does.',
    pitch: 'Build a car from 19 real parts — chassis, carburetor, alternator, driveshaft — and learn what every one of them does along the way.',
    mechanics: ['19 real components with explanations', 'Assembly order matters'],
    technicalHighlights: ['Single HTML file'],
    targetAudiences: ['car_enthusiasts', 'stem_students', 'curious_builders'],
    viralHooks: ['Finally understand what an alternator does — by building the car around it.']
  },

  // ---- Daily grids ----
  quanta: {
    id: 'quanta',
    name: 'Physics Grid',
    genre: 'Daily Physics Grid',
    category: 'daily',
    url: 'https://kreeda.games/quanta/index.html',
    tagline: 'A daily physics grid: nine cells, nine guesses.',
    pitch: 'Three criteria down, three across, nine cells — name a physical quantity for every square. Vectors, SI units, dimensional formulae, and every answer revealed at the end.',
    mechanics: ['3×3 criteria grid', 'Nine guesses', 'New puzzle daily'],
    technicalHighlights: ['Single HTML file; daily seed'],
    targetAudiences: ['physics_students', 'teachers', 'daily_puzzle_players'],
    viralHooks: ['The daily grid for people who remember their dimensional formulae.']
  },
  radian: {
    id: 'radian',
    name: 'Trigonometry Grid',
    genre: 'Daily Trigonometry Grid',
    category: 'daily',
    url: 'https://kreeda.games/radian/index.html',
    tagline: 'A daily trigonometry grid on the unit circle.',
    pitch: 'Three criteria down, three across, nine cells — name an angle on the unit circle for every square, in degrees or radians.',
    mechanics: ['3×3 criteria grid', 'Degrees or radians', 'New puzzle daily'],
    technicalHighlights: ['Single HTML file; daily seed'],
    targetAudiences: ['math_students', 'teachers', 'daily_puzzle_players'],
    viralHooks: ['Nine angles, one unit circle, one shot a day.']
  },
  valence: {
    id: 'valence',
    name: 'Chemistry Grid',
    genre: 'Daily Chemistry Grid',
    category: 'daily',
    url: 'https://kreeda.games/valence/index.html',
    tagline: 'A daily chemistry grid — name an element for every square.',
    pitch: 'Three criteria down, three across, nine cells, nine guesses — name a chemical element for every square before the guesses run out. Built for high-school chemistry.',
    mechanics: ['3×3 criteria grid', 'Nine guesses', 'New puzzle daily'],
    technicalHighlights: ['Single HTML file; daily seed'],
    targetAudiences: ['chemistry_students', 'teachers', 'daily_puzzle_players'],
    viralHooks: ['Wordle for the periodic table.']
  }
};
