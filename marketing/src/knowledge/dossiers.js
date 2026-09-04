/**
 * The Dossiers: marketing's hand-written knowledge about each Game.
 *
 * A Dossier describes a Game — its pitch, hooks, mechanics and audiences. It
 * never decides whether the Game exists or which Category it is in: the hub
 * page decides both (ADR 0002), and `catalog.js` merges the two. That is why
 * there is no name, url or category in here; those would drift.
 *
 * Every Game on the hub needs a Dossier, and a test fails when one is missing.
 */

export const DOSSIERS = {
  // --- Friends circle ------------------------------------------------------
  // These seven are group games. Brand rule 1: the copy leads with what the
  // circle finds out about itself, never with the one-phone mechanic.

  'circle': {
    tagline: 'Find out who in the circle actually knows you.',
    pitch: 'One friend takes the spotlight and secretly answers two questions about themselves while everyone else predicts what they said. The reveal is a knowledge map across the whole group — who reads whom accurately, and who has been guessing for years.',
    mechanics: [
      'The spotlight moves around the circle; each turn is two questions',
      'Everyone predicts the spotlit friend\'s answers before they are shown',
      'Scores build a knowledge map of who knows whom, not a single winner',
      '3-8 players share one phone'
    ],
    audiences: ['close_friends', 'families', 'coworkers', 'couples'],
    hooks: [
      'You have known them ten years. Two questions decide whether that is true.',
      'The interesting number is not who won. It is who knows whom.',
      'A quiz where every answer is one of your friends.'
    ]
  },

  'prism': {
    tagline: 'One friend calling you stubborn is an opinion. Five choosing it is a portrait.',
    pitch: 'One friend steps into the mirror and picks six words for themselves; every other friend independently picks six for them. Where the choices agree and where they miss becomes a consensus Johari window — the things the room sees that you do not.',
    mechanics: [
      'One friend in the mirror per round, the rest choosing words for them',
      'Six words self-chosen against six from every other player, picked blind',
      'Agreement across the group builds a consensus Johari window',
      'Open, blind and hidden quadrants are read out together',
      '3-7 players share one phone'
    ],
    audiences: ['close_friends', 'psychology_curious', 'coworkers', 'couples'],
    hooks: [
      'The words your friends pick for you, and the one you would never pick yourself.',
      'A blind spot is not a blind spot until more than one person sees it.',
      'A Johari window with the people who actually know you in it.'
    ]
  },

  'alibi': {
    tagline: 'Everyone answers honestly. Then the room works out who said what.',
    pitch: 'Everyone secretly answers the same prompt, the answers come back shuffled, and the circle pins each one on its author. Reading the room correctly scores detective points; every friend you fool scores you chameleon points — so honesty costs nothing and being unreadable pays.',
    mechanics: [
      'One prompt, answered anonymously by everyone',
      'Answers return shuffled, to be pinned on their authors',
      'Detective points for a correct pin, chameleon points for each friend fooled',
      'Two ways to win, so a shy player and a loud one both have a route',
      '3-8 players share one phone'
    ],
    audiences: ['close_friends', 'coworkers', 'families', 'party_hosts'],
    hooks: [
      'Anonymity makes people honest. Then you have to work out who was.',
      'Two ways to win: read your friends, or be the one nobody can read.',
      'The answer everyone assumed was his turns out to be hers.'
    ]
  },

  'herd': {
    tagline: 'Think like the room, or wear the black sheep.',
    pitch: 'Everyone secretly answers the same prompt trying to match what most of the group will say. The biggest cluster scores and the lone answer wears the black sheep. Nothing personal is revealed, which makes it the round that gets a quiet group talking before anything riskier.',
    mechanics: [
      'A shared prompt, answered secretly, aiming at the majority rather than the truth',
      'The largest matching cluster scores; a lone answer takes the black sheep',
      'Nothing personal is disclosed, so a new group can open with it',
      '3-8 players share one phone'
    ],
    audiences: ['close_friends', 'coworkers', 'families', 'party_hosts'],
    hooks: [
      'The point is not the right answer. It is the answer everyone else gave.',
      'The round that gets a quiet table talking, before anything riskier.',
      'Being the only one who said it is its own kind of prize.'
    ]
  },

  'alter': {
    tagline: 'Answer as your friend. Then watch them answer for real.',
    pitch: 'Everyone plays the next person around the circle for three questions, then the real person answers the same three. The room sees the impression against the reality, arrow by arrow — how someone comes across against how they would put it themselves.',
    mechanics: [
      'Each player answers three questions as the next person in the circle',
      'The real person then answers the same three',
      'Arrows around a casting circle show impression against reality',
      'Everyone is impersonated exactly once, so nobody is singled out',
      '3-8 players share one phone'
    ],
    audiences: ['close_friends', 'families', 'coworkers', 'couples'],
    hooks: [
      'How you would answer as your friend, and how they actually did.',
      'The gap between how you come across and how you would put it.',
      'Everyone does an impression. Only one person can mark it.'
    ]
  },

  'lore': {
    tagline: 'The only quiz your group can play, because you wrote it about yourselves.',
    pitch: 'Each friend secretly writes one question about the group\'s shared history, hiding the real answer among two decoys they invent, and then everyone plays the finished quiz. It sorts the people who remember the holiday from the people who have been improvising it for years.',
    mechanics: [
      'Every player writes one question about the group\'s shared history',
      'The true answer hides among two decoys its author invents',
      'The group then plays the assembled quiz together',
      'Writing a good decoy is its own skill, and it scores',
      '3-8 players share one phone'
    ],
    audiences: ['close_friends', 'families', 'siblings', 'coworkers'],
    hooks: [
      'A trivia night where the trivia is you.',
      'Who remembers the holiday, and who has been making it up?',
      'The decoys tell you as much about their author as the answers do.'
    ]
  },

  'capsule': {
    tagline: 'Seal tonight\'s predictions. Find out at the reunion who called it.',
    pitch: 'The group seals predictions about each other — who moves abroad, who goes viral, who is late to the reunion — and opens them together months later. It plays twice: once for the argument about what to write, and once when the answers actually arrive.',
    mechanics: [
      'Predictions written about each other, then sealed',
      'The capsule is opened together at a chosen later date',
      'The same session plays twice: sealing it, and finding out',
      '2-8 players share one phone'
    ],
    audiences: ['close_friends', 'families', 'couples', 'coworkers'],
    hooks: [
      'The game you finish months after you start it.',
      'Write down who you think your friends will become. Check in a year.',
      'Half of it is the argument tonight. The other half arrives later.'
    ]
  },

  // --- Daily study grids ---------------------------------------------------
  // Built for high-school science. The reveal is the teaching moment: it lists
  // every answer that would have worked, not just the ones the player found.

  'isomer': {
    tagline: 'Nine cells, nine guesses, one organic compound each.',
    pitch: 'A daily organic chemistry grid: three criteria down, three across, and every cell wants a compound that satisfies both — alkane or acid, gas or solid, fuel or household product. When the guesses run out the reveal lists every compound that would have worked, which is where most of the learning is.',
    mechanics: [
      'A 3x3 grid of intersecting criteria, nine guesses for nine cells',
      'Every answer must satisfy both its row and its column',
      'The reveal lists every valid compound, not only the ones found',
      'A new grid each day, sized for a high-school chemistry course'
    ],
    audiences: ['chemistry_students', 'stem_students', 'teachers', 'daily_puzzle_players'],
    hooks: [
      'Name a compound that is both an acid and a household product. Now eight more.',
      'The reveal teaches more than the round does.',
      'Chemistry revision that behaves like a daily puzzle.'
    ]
  },

  'wattage': {
    tagline: 'Nine cells, nine guesses, one energy source each.',
    pitch: 'A daily energy-sources grid: three criteria down, three across, and every cell wants a source that satisfies both — renewable or not, burned or not, mined or drilled. When the guesses run out the reveal lists every source that would have worked.',
    mechanics: [
      'A 3x3 grid of intersecting criteria, nine guesses for nine cells',
      'Every answer must satisfy both its row and its column',
      'The reveal lists every valid source, not only the ones found',
      'A new grid each day, sized for a high-school science course'
    ],
    audiences: ['stem_students', 'teachers', 'daily_puzzle_players', 'curious_builders'],
    hooks: [
      'Renewable and burned. Name one that is both, then do it eight more times.',
      'The reveal teaches more than the round does.',
      'A daily grid for the energy chapter nobody revises.'
    ]
  },

  'hub': {
    tagline: "Free games that start the second you tap.",
    pitch: "Twenty-nine polished, single-file browser games across seven Categories, with zero build tools, zero frameworks and zero dependencies. Every one starts instantly on desktop and mobile.",
    mechanics: [
      "No downloads, no logins, no paywalls, no tracking bloat",
      "Loads in under 100ms on 3G connections",
      "Single HTML file per game (pure vanilla JS + Canvas/WebGL)",
      "100% open source under MIT"
    ],
    audiences: [
      "casual_gamers",
      "indie_enthusiasts",
      "web_developers",
      "speedrunners",
      "office_break_players"
    ],
    hooks: [
      "Remember when web games loaded instantly and didn't ask for your email?",
      "Twenty-nine browser games, no dependencies and no build step between any of them.",
      "How we fit an entire game arcade into standalone HTML files."
    ]
  },

  'drift': {
    tagline: "Grip is a budget. The battery is your life.",
    pitch: "A bright, sunny endless drifting game with real weight-transfer and throttle dynamics — no handbrake. Drive a high-end EV across 4 procedural biomes, harvest zombie horde bounties, auto-park at EV fast chargers, and race daily seeded ghost lines.",
    mechanics: [
      "Real physics: weight transfer on braking initiates oversteer, power holds it, countersteer catches it",
      "EV battery economy: regen braking recharges pack; off-road grass drains 90x faster; rest-area DC fast chargers",
      "4 procedural biomes (Temperate, Rain belt, Snow country, Desert) with seamless continuous crossfades",
      "Zombie bounties with multiplier-based payouts, weapons armory (Pistol, SM-2, LR-7), oncoming traffic close-calls",
      "Daily road with deterministic ghost recording and 15 persistent badges"
    ],
    technicalHighlights: [
      "Dual-view rendering (First-person Cockpit HUD + Top-Down glance)",
      "WebAudio procedural EV motor sound (pitch = speed, loudness = |kW|, regen pitch bend)",
      "Headless browser verified physics invariants via Chrome CDP"
    ],
    audiences: [
      "racing_fans",
      "retro_arcade",
      "ev_enthusiasts",
      "speedrunners"
    ],
    hooks: [
      "A drifting game where the battery is your health bar.",
      "We built a racing game with realistic weight transfer in a single index.html file.",
      "When you pause this drift game, your EV actually uses auto-park valet to plug into a DC fast charger."
    ]
  },

  'carrom': {
    tagline: "Flick the striker, pocket the queen.",
    pitch: "A polished arcade take on the classic Indian board game. Position your striker, aim with slingshot controls, and pocket your 9 carrommen and the red queen with realistic rigid-disc collision physics and a 3-difficulty AI.",
    mechanics: [
      "Rigid-disc physics with mass momentum ratios (Striker 2.2x vs Piece 1.0x)",
      "Continuous collision detection (sub-stepping) and corner pocket suction",
      "Official carrom rules: white/black pieces, red queen cover bonus, striker foul penalties",
      "3-tier AI that calculates ghost-ball pocket lines and restitution-corrected cushion bank shots"
    ],
    technicalHighlights: [
      "Procedural Canvas 2D wood board rendering with lacquer sheen",
      "Synthesized WebAudio wood-on-wood clacks and pocket thuds"
    ],
    audiences: [
      "board_game_lovers",
      "south_asian_gamers",
      "physics_game_fans"
    ],
    hooks: [
      "The classic Indian board game Carrom recreated in pure vanilla JavaScript.",
      "An AI opponent that calculates cushion bank shots in real time in your browser."
    ]
  },

  'break-room': {
    tagline: "Real spin, called pockets, zero downloads.",
    pitch: "Physics-driven 8-ball pool with full official rules, draggable spin control (topspin, backspin/draw, english), customizable felt themes, practice mode, 2P pass-and-play, and a smart AI opponent.",
    mechanics: [
      "Full 8-ball rules: open table, solid/stripe group claim, legal hit detection, called 8-ball pocket",
      "Interactive cue spin pad for realistic cue ball deflection and draw shots",
      "Pass-and-play local multiplayer, solo practice, and 3-difficulty AI"
    ],
    technicalHighlights: [
      "Ball specular lighting and rolling 3D shadow illusions in 2D Canvas",
      "WebAudio procedural pool ball clacks, rail thuds, and pocket drops"
    ],
    audiences: [
      "pool_players",
      "billiards_fans",
      "casual_gamers"
    ],
    hooks: [
      "Looking for a quick 8-ball pool game at work without downloading an app or watching ads?",
      "How to model cue ball spin and cushion restitution in vanilla JavaScript."
    ]
  },

  'chroma-blocks': {
    tagline: "Vibrant neon, pure flow state.",
    pitch: "A neon falling-blocks puzzle in the spirit of modern Tetris. Features a 7-bag randomizer, hold slot, 3-piece next queue, ghost piece guide, SRS wall kicks, combo multipliers, and satisfying particle bursts.",
    mechanics: [
      "Standard 7-bag randomizer and Super Rotation System (SRS) wall kicks",
      "Ghost piece, hard/soft drops, lock delay, combo counter ladder",
      "Smooth keyboard + mobile touch controls"
    ],
    technicalHighlights: [
      "Glassmorphic dark UI with particle burst clear effects",
      "Procedural synth audio with distinct pitch keys for rotations and clears"
    ],
    audiences: [
      "puzzle_lovers",
      "tetris_fans",
      "casual_gamers"
    ],
    hooks: [
      "The cleanest, distraction-free falling blocks game on the web.",
      "No ads, no logins — just pure neon block stacking in 1 file."
    ]
  },

  'last-16': {
    tagline: "16 nations. 4 real stars each. Lift the trophy.",
    pitch: "Arcade soccer set at the World Cup 2026 knockout stage. Choose from 16 real nations and authentic star players, control them directly with smart AI teammates, manage sprint stamina, curl charged shots into the top corner, and win the tournament.",
    mechanics: [
      "16 real national teams with authentic kits and 4 star players with unique PAC/SHO/PAS/DEF/PHY stats",
      "Direct control with virtual joystick + Pass, Shoot (charged curl), Lofted Through-Ball, Slide Tackle",
      "Full tournament knockout bracket, penalty shootouts, match timer, radar minimap, half/full-time stats"
    ],
    technicalHighlights: [
      "Dynamic pitch radar canvas and flocking AI team positioning",
      "WebAudio procedural crowd murmur, roar, referee whistles, ball kicks"
    ],
    audiences: [
      "soccer_fans",
      "fifa_players",
      "arcade_sports"
    ],
    hooks: [
      "Play World Cup 2026 knockout football directly in your browser with 0 loading time.",
      "Control Mbappé, Messi, Bellingham, or Vinicius in this lightweight arcade soccer game."
    ]
  },

  'road-rumble': {
    tagline: "Pin the throttle. Throw the punch.",
    pitch: "A Road Rash / OutRun style racing brawler on a pseudo-3D highway. Sprint against 5 rival riders over elevation crests and tight turns, dodge oncoming traffic, and throw punches or swing roadside clubs to stay on your bike and finish first.",
    mechanics: [
      "Pseudo-3D raster road projection engine with hills, valleys, and centrifugal curves",
      "6-rider combat race with health and stamina bars, melee punches, and roadside clubs",
      "Oncoming civilian trucks and cars, wiping out rivals or crashing"
    ],
    technicalHighlights: [
      "Classic 90s raster road projection written from scratch in Canvas 2D",
      "Procedural engine rev audio synthesis with Doppler pitch shift"
    ],
    audiences: [
      "retro_gamers",
      "road_rash_fans",
      "action_arcade"
    ],
    hooks: [
      "We rebuilt 90s Road Rash in vanilla JavaScript with pseudo-3D raster projection.",
      "Motorcycle racing with melee combat directly in your mobile browser."
    ]
  },

  'fairway-four': {
    tagline: "4 pristine holes. Wind, Magnus lift, flowing greens.",
    pitch: "Full-3D golf over four authored holes rendered with Three.js. Features cinematic camera swoops, a 3-click swing meter with draw/fade timing, wind and Magnus-lift ball aerodynamics, sand traps, water hazards, and sloped putting greens with flowing break particle grids.",
    mechanics: [
      "Full club selection: Driver, 3-Wood, Irons (3-9), Pitching/Sand Wedges, Putter",
      "3-click swing meter determining power, hook/slice spin, and strike quality",
      "Real aerodynamics: wind drift, Magnus lift, surface bounce damping (fairway, rough, sand, water)"
    ],
    technicalHighlights: [
      "Three.js WebGL terrain, camera interpolation fly-bys, dynamic green contour particle flow"
    ],
    audiences: [
      "golf_fans",
      "sports_gamers",
      "3d_web_enthusiasts"
    ],
    hooks: [
      "A full 3D 4-hole golf game running smoothly in your browser with wind and aerodynamics.",
      "Check out how the putting green visualizes slope breaks with animated contour lines."
    ]
  },

  'ennead': {
    tagline: "From 3x3 to nested 9x9 mind games.",
    pitch: "Configurable strategy board game with two modes sharing one engine. Classic mode lets you play any N×N board (3x3 up to 9x9) with customizable win length k (Gomoku). Ultimate mode features a nested 9x9 grid where every move sends your opponent to a specific sub-board.",
    mechanics: [
      "Classic Mode: 3x3 up to 9x9 with customizable k-in-a-row winning conditions",
      "Ultimate Mode: 9 sub-boards linked by move coordinates, meta-cell capture animations",
      "Minimax AI with alpha-beta pruning (Hard 3x3 is mathematically unbeatable), move undo, light/dark themes"
    ],
    technicalHighlights: [
      "Pure CSS Grid / DOM rendering with fluid layout",
      "State persisted via localStorage with instant resume"
    ],
    audiences: [
      "strategy_gamers",
      "board_game_fans",
      "chess_and_puzzle_lovers"
    ],
    hooks: [
      "If you think Tic-Tac-Toe is too simple, try Ultimate Tic-Tac-Toe where every move dictates your opponent's sub-board.",
      "Play Gomoku or Ultimate Tic-Tac-Toe against an unbeatable minimax AI."
    ]
  },

  'dasanana': {
    tagline: "Counter divine astras. Chant for tejas. Loose the Brahmāstra.",
    pitch: "A Rāmāyaṇa epic astra-duel. Counter Rāvaṇa's divine missiles with the true cosmic element before they collide, rhythm-chant authentic Āditya-Hṛdayam Sanskrit ślokas to restore your solar energy, survive the Śakti spear, and loose your Brahmāstra.",
    mechanics: [
      "Astra elemental counter system (Fire vs Water, Wind vs Mountain, Darkness vs Light)",
      "Rhythm chanting of authentic Sanskrit verses from the Āditya-Hṛdayam (Devanāgarī + IAST)",
      "Boss progression: Khara → Indrajit → Rāvaṇa (10 regenerating heads & Brahmāstra showdown)"
    ],
    technicalHighlights: [
      "Procedural Indian classical audio synthesis: tanpura drone, temple bells, conch shell (śankha)",
      "Particle-based divine astra collision effects"
    ],
    audiences: [
      "mythology_fans",
      "rhythm_game_players",
      "indian_culture_enthusiasts"
    ],
    hooks: [
      "An epic Rāmāyaṇa astra duel game with authentic Sanskrit rhythm chanting in your browser.",
      "Counter Rāvaṇa's divine missiles using elemental astravidya in this mythic action game."
    ]
  },

  'blackjack': {
    tagline: "Classic felt. 3:2 payout. Dealer stands on 17.",
    pitch: "A polished, distraction-free Blackjack game with casino-accurate rules, chip betting ($5–$500), persistent bankroll, double down, and smooth 3D card flips.",
    mechanics: [
      "Standard single-deck casino rules: Blackjack pays 3:2, dealer stands on all 17s",
      "Chip denominations ($5, $25, $100, $500) and persistent balance in localStorage"
    ],
    technicalHighlights: [
      "Smooth CSS 3D card flip animations and classic green felt aesthetics"
    ],
    audiences: [
      "casino_card_players",
      "casual_gamers"
    ],
    hooks: [
      "Cleanest browser blackjack — no ads, no purchase prompts, real 3:2 payouts."
    ]
  },

  'sync': {
    tagline: "How well do you actually know each other?",
    pitch: "Two players, one phone. Answer each question for yourself, predict what the other person will say, then reveal together. Ten rounds that show where you are in sync — and where you have been guessing. Packs for new pairs, couples, friends, family and coworkers.",
    mechanics: [
      "Answer → predict → reveal loop across ten rounds",
      "Similarity and insight scored separately",
      "Question packs: new pair, couple, friends, family, coworkers"
    ],
    technicalHighlights: [
      "Single HTML file; answers never leave the phone"
    ],
    audiences: [
      "couples",
      "new_couples",
      "close_friends",
      "families"
    ],
    hooks: [
      "Predict how your partner answers — then find out how wrong you were.",
      "The ten-question game that tells you whether you actually know your best friend."
    ]
  },

  'windows': {
    tagline: "How you see yourself vs how they see you.",
    pitch: "A playable Johari Window for two people on one phone. Each of you picks six words for yourself and six for the other — then the panes fill in: what you both see, what only you see, and the blind spots they see in you.",
    mechanics: [
      "Forty adjectives; six picks for yourself, six for them",
      "Four panes: open, hidden, blind spot, unknown",
      "Reveal is simultaneous so nobody adjusts their answers"
    ],
    technicalHighlights: [
      "Single HTML file; nothing uploaded"
    ],
    audiences: [
      "couples",
      "close_friends",
      "coworkers",
      "psychology_curious"
    ],
    hooks: [
      "Find out your blind spots from the one person who actually sees them.",
      "A 5-minute Johari Window you can play on a date."
    ]
  },

  'split': {
    tagline: "Share or Take. The score says who won — the pattern says who you are.",
    pitch: "Ten rounds of Share or Take between two people on one phone. Both share and everyone wins; one takes and burns the other; both take and it is mutual ruin. Round 4 pays double, round 7 is sealed, round 10 pays triple — and the pattern of your choices says more than the score.",
    mechanics: [
      "Prisoner's-dilemma payoff grid: 3/3, 0/5, 5/0, 1/1",
      "Special rounds: double, sealed, triple",
      "End-of-game pattern read-out for both players"
    ],
    technicalHighlights: [
      "Single HTML file; local only"
    ],
    audiences: [
      "couples",
      "close_friends",
      "siblings",
      "game_theory_fans"
    ],
    hooks: [
      "How much do you trust each other, really? Ten rounds will tell.",
      "Play the prisoner's dilemma with someone you love. Watch round 7."
    ]
  },

  'auction': {
    tagline: "100 coins. Ten things people want from life. You can't fund them all.",
    pitch: "A pass-the-phone game about what you value. Each player gets 100 coins to bid, in private, on ten things people want from life — then you reveal together and see where your priorities line up and where they collide.",
    mechanics: [
      "Private sealed bids across ten life priorities",
      "Scarcity forces trade-offs — you can't fund everything",
      "Side-by-side reveal of both players' allocations"
    ],
    technicalHighlights: [
      "Single HTML file; no accounts"
    ],
    audiences: [
      "couples",
      "new_couples",
      "close_friends",
      "families"
    ],
    hooks: [
      "Bid on what matters to you — then see what your partner bid on.",
      "A ten-minute game that starts the money-and-priorities conversation without the fight."
    ]
  },

  'fathom': {
    tagline: "36 questions deep — a guided dive for two.",
    pitch: "Two people, one phone, a guided dive through three depths of conversation based on the 36 questions. Includes a real before-and-after closeness check-in so you can see what the conversation changed.",
    mechanics: [
      "Three depths, twelve questions each, escalating intimacy",
      "Before/after closeness check-in",
      "Take turns; nothing is scored, everything is shared"
    ],
    technicalHighlights: [
      "Single HTML file; ambient sound optional"
    ],
    audiences: [
      "couples",
      "new_couples",
      "close_friends",
      "psychology_curious"
    ],
    hooks: [
      "The 36 questions, as a game you can actually finish in one evening.",
      "Measure how much closer you feel after 36 questions — the game does it for you."
    ]
  },

  'apogee': {
    tagline: "Build a rocket from real parts, then see how high it flies.",
    pitch: "Assemble a rocket from real parts — payload, tanks, engines, fins, avionics, boosters — learn what each one does, then launch and see how high your design flies. Cross the Kármán line to reach space.",
    mechanics: [
      "Part-by-part assembly with real trade-offs",
      "Launch simulation with altitude read-out",
      "Kármán line as the goal"
    ],
    technicalHighlights: [
      "Single HTML file; physics runs in the browser"
    ],
    audiences: [
      "space_fans",
      "stem_students",
      "curious_builders"
    ],
    hooks: [
      "Can your rocket cross the Kármán line? Build it and find out."
    ]
  },

  'garage': {
    tagline: "Build a car from 19 real parts and learn what every one of them does.",
    pitch: "Build a car from 19 real parts — chassis, carburetor, alternator, driveshaft — and learn what every one of them does along the way.",
    mechanics: [
      "19 real components with explanations",
      "Assembly order matters"
    ],
    technicalHighlights: [
      "Single HTML file"
    ],
    audiences: [
      "car_enthusiasts",
      "stem_students",
      "curious_builders"
    ],
    hooks: [
      "Finally understand what an alternator does — by building the car around it."
    ]
  },

  'quanta': {
    tagline: "A daily physics grid: nine cells, nine guesses.",
    pitch: "Three criteria down, three across, nine cells — name a physical quantity for every square. Vectors, SI units, dimensional formulae, and every answer revealed at the end.",
    mechanics: [
      "3×3 criteria grid",
      "Nine guesses",
      "New puzzle daily"
    ],
    technicalHighlights: [
      "Single HTML file; daily seed"
    ],
    audiences: [
      "physics_students",
      "teachers",
      "daily_puzzle_players"
    ],
    hooks: [
      "The daily grid for people who remember their dimensional formulae."
    ]
  },

  'radian': {
    tagline: "A daily trigonometry grid on the unit circle.",
    pitch: "Three criteria down, three across, nine cells — name an angle on the unit circle for every square, in degrees or radians.",
    mechanics: [
      "3×3 criteria grid",
      "Degrees or radians",
      "New puzzle daily"
    ],
    technicalHighlights: [
      "Single HTML file; daily seed"
    ],
    audiences: [
      "math_students",
      "teachers",
      "daily_puzzle_players"
    ],
    hooks: [
      "Nine angles, one unit circle, one shot a day."
    ]
  },

  'valence': {
    tagline: "A daily chemistry grid — name an element for every square.",
    pitch: "Three criteria down, three across, nine cells, nine guesses — name a chemical element for every square before the guesses run out. Built for high-school chemistry.",
    mechanics: [
      "3×3 criteria grid",
      "Nine guesses",
      "New puzzle daily"
    ],
    technicalHighlights: [
      "Single HTML file; daily seed"
    ],
    audiences: [
      "chemistry_students",
      "teachers",
      "daily_puzzle_players"
    ],
    hooks: [
      "Wordle for the periodic table."
    ]
  },
};
