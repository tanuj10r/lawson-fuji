/* All player-facing UI text (AGENTS.md). */

/* The game's name (Tan, 2026-09-28: it lives at takemebacktojapan.com).  The
 * town keeps its own name (data/town.js TOWN_NAME), shown as the place line;
 * the store stays NIPPON.  docs/decisions/start-screens.md. */
export const GAME = {
  title: 'Take Me Back to Japan',
  titleJp: '日本へ、もう一度',
  url: 'takemebacktojapan.com',
};

/* Every key the game answers to, once: the start and pause cards list them
 * all in this order (core/hud.js) and the corner panel shows the ones that
 * belong where you stand (main.js controlRows, ui/controls.js), from here.
 * `keys` are drawn as key caps.  WASD still walks, unadvertised (Tan: the
 * arrow keys are the ones shown). */
const CONTROLS = {
  move: { keys: ['↑', '↓', '←', '→'], what: 'Move' },
  look: { keys: ['Mouse'], what: 'Look around' },
  run: { keys: ['Shift'], what: 'Run' },
  interact: { keys: ['E'], what: 'Interact' },
  views: { keys: ['1', '2', '3'], what: 'Time of day' },
  home: { keys: ['R'], what: 'Back to the start' },
  whistle: { keys: ['F'], what: 'Whistle for Hachi' },
  map: { keys: ['M'], what: 'Map' },
  sound: { keys: ['N'], what: 'Sound' },
  pause: { keys: ['Space'], what: 'Pause' },
};

export const STRINGS = {
  title: GAME.title,
  titleJp: GAME.titleJp,
  url: GAME.url,
  tagline: 'A small town under Mt. Fuji. Take your time.',
  paused: 'Paused',
  start: 'Start',
  resume: 'Resume',
  volume: 'Volume',
  volumeAria: 'Volume',
  controlsTitle: 'Controls',
  credit: 'Built on Sakura Crossing (MIT)',
  artAlt: 'Golden hour under Mt. Fuji: Han leans on his orange RX-7 with a shiba beside him, across the road from the NIPPON konbini, cherry trees in bloom.',
  /* The cards' list, in order (every key). */
  controls: Object.values(CONTROLS),
  /* The corner panel's rows, by name: [key caps, what it does]. */
  control: (id) => [CONTROLS[id].keys, CONTROLS[id].what],
  /* Rows only the corner panel shows, where they apply. */
  keys: {
    choose: 'Choose',
    closeMap: 'Close the map',
    standUp: 'Stand up',
  },
  soundOn: 'Sound on',
  soundOff: 'Sound off',
  coordsOn: 'coordinates on',
  coordsOff: 'coordinates off',
  copied: 'copied',
  /* Hachi's hello (the guide pup, animals/guide.js): a caption the first time you look at it, off the famous view */
  hachi: { hi: "Hi, I'm Hachi!", line: "Follow me, I'll show you around town. Wander off whenever you like: press F to whistle and I'll come running." },
  map: {
    titleJp: '富士川口湖町 マップ',
    title: 'Fujikawaguchikko',
    close: 'M to close',
    here: 'You are here',
    todo: 'Things to do',
    hear: 'Things to hear',
    north: 'N',
    scale: (m) => `${m} m`,
    /* The places' labels (config.js PLACES): English, the Japanese name small beside it. */
    places: {
      lawson: { en: 'Nippon Mart', jp: 'ニッポン' },
      start: { en: 'Nippon Mart Viewpoint', jp: '富士山ビュー' },
      han: { en: 'Tokyo Drift', jp: 'ハンのRX-7' },
      spine: { en: 'Shopping street', jp: '商店街' },
      donpen: { en: 'Donpen-do', jp: 'ドンペン堂' },
      shrine: { en: 'Inari shrine', jp: '富士見稲荷神社' },
      plaza: { en: 'Station plaza', jp: '駅前広場' },
      station: { en: 'Fujikawaguchikko Station', jp: '富士川口湖駅' },
      crossing: { en: 'Level crossing', jp: '踏切' },
      pond: { en: 'Kagami Pond', jp: '鏡池' },
      slowlife: { en: 'Slow-life bench', jp: 'ひと休み' },
      river: { en: 'The river', jp: '桜川' },
      deerGate: { en: 'Deer Park (coming soon)', jp: '鹿公園' },
    },
  },
  /* The konbini (Tan's experience): English only; product names come from
   * the catalogue, the cashier's lines are Japanese said aloud with an
   * English subtitle (`jp` shown small beside it, as product names are). */
  store: {
    menuTitle: 'What would you like?',
    menuHint: 'Press a number',
    recommended: 'Recommended',
    menuNames: { strong_nine: 'Strong Nine' },
    menuNotes: { strong_nine: 'Lemon beer · 9%' },
    notOut: 'Pay at the till first',
    ate: 'Delicious. Step back onto the highlight for another',
    tipsy: 'That Strong Nine is living up to its name',
  },
  refOn: 'reference overlay on',
  refOff: 'reference overlay off',
};
