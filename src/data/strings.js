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
  /* Space was pressed but the browser wants a click for the pointer (some do): the card stays, and says so */
  pointerRefused: { start: 'This browser wants a click: press Start', resume: 'This browser wants a click: press Resume' },
  resume: 'Resume',
  volume: 'Volume',
  volumeAria: 'Volume',
  controlsTitle: 'Controls',
  credit: 'Built on Sakura Crossing (MIT)',
  credits: 'Credits',
  artAlt: 'Golden hour under Mt. Fuji: a shiba sits on a zebra crossing by a green walk light, a local train waits at the level crossing, a red torii, the NIPPON konbini, the ドンペン堂 megastore, Han leaning on his orange RX-7, a bench and a jizo under cherry blossom.',
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
  /* Waiting on platform 1 for the next train (world/line/station.js, ui/trainWait.js): "Next train · 0:25" */
  nextTrain: (secs) => `Next train  ·  ${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')}`,
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
   * the catalogue (the Japanese shown small beside them). */
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
  /* Made by Tan (ui/maker.js): the chip on every card, the postcard when Hachi's tour is over */
  maker: {
    name: 'Made by Tan',
    line: 'Free, no ads. Say hi?',
    follow: 'Free, no ads. Follow along for the next town.',
    coffee: 'Coffee',
    coffeeLong: 'Buy Tan a coffee',
    x: 'Tan on X',
    github: 'Tan on GitHub',
    site: 'Tan’s site, tanuj.fyi',
    avatarAlt: 'Tan',
  },
  postcard: {
    label: 'A postcard from Fujikawaguchikko',
    title: 'Greetings from Fujikawaguchikko',
    msg: 'You’ve seen the whole town, and Hachi’s napping by the gate. Send it to someone who misses Japan too.',
    /* opened from the pause card before Hachi's tour is over */
    msgEarly: 'Wish you were here. A little town under Mt. Fuji, and a shiba called Hachi to show you round. Send it to someone who misses Japan too.',
    to: 'To: a friend who misses Japan',
    share: 'Share',
    copy: 'Copy link',
    copied: 'Link copied',
    post: 'Post',
    postAria: 'Post it on X',
    shareText: 'I just walked a little town under Mt. Fuji, in my browser.',
    follow: 'Follow for the next town.',
    back: 'Back',
    backAria: 'Back to the menu',
    close: 'Space to walk on  ·  Back or Esc for the menu',
    closeTouch: 'Back, or a tap outside the card, for the menu',
    /* the selfie postcard (ui/postcardSelfie.js): asked for, never by itself */
    selfie: {
      add: 'Add your selfie 📷',
      note: 'Your photo stays on your device',
      asking: 'Allow the camera to take your selfie',
      noCamera: 'No camera? Choose a photo instead.',
      badPhoto: 'That photo would not open. Try another.',
      choose: 'Choose a photo',
      shutter: 'Take photo',
      cancel: 'Cancel',
      retake: 'Retake',
      save: 'Save image',
      caption: 'Hachi and me',
      alt: 'Your postcard: your photo in Fujikawaguchikko, Hachi over the corner',
      file: 'takemebacktojapan-postcard.jpg',
    },
    /* the little postcard by the pause card, every pause */
    mini: 'Your postcard ✉',
    miniAria: 'Open your postcard',
  },
  refOn: 'reference overlay on',
  refOff: 'reference overlay off',
  /* The cards index.html paints before the game's code runs (QA-001/003/004/012).
   * vite.config.js writes these into index.html at build time (%S:boot.loading%),
   * so a phone reads them without downloading the game. */
  boot: {
    loading: 'Loading the town…',
    building: 'Building the town…',
    ready: 'Almost there…',
  },
  gate: {
    phoneTitle: 'Best on a computer',
    phone: 'A small town under Mt. Fuji, made to be walked with a keyboard and mouse. Open this link on a desktop or laptop for the full stroll.',
    copy: 'Copy link',
    share: 'Share',
    copied: 'Link copied',
    noglTitle: 'Your browser can’t draw the town',
    nogl: 'This game needs WebGL 2, which is turned off or not available here. Try the latest Chrome, Edge, Firefox or Safari on a computer, with hardware acceleration on.',
    lostTitle: 'The graphics card reset',
    lost: 'Reload to continue.',
    reload: 'Reload',
  },
};
