/* All player-facing UI text (AGENTS.md). */

export const STRINGS = {
  title: 'Nippon Fuji',
  titleJp: 'ニッポン富士',
  intro: 'Work in progress.',
  paused: 'Paused.',
  start: 'Start',
  resume: 'Resume',
  volume: 'Volume',
  volumeAria: 'Volume',
  controlsTitle: 'Controls',
  /* What each key does, for the on-screen list (M4).  Only the ones that
   * belong where the player is are shown (ui/controls.js). */
  keys: {
    move: 'Move',
    run: 'Run',
    look: 'Look around',
    interact: 'Take / open',
    shop: 'Take / pay',
    map: 'Town map',
    sound: 'Sound',
    views: 'Time of day',
    choose: 'Choose',
    pause: 'Pause',
    closeMap: 'Close the map',
    leaveView: 'Look around',
    standUp: 'Stand up',
  },
  controls: [
    ['WASD', 'Move'],
    ['Mouse', 'Look'],
    ['Shift', 'Run'],
    ['E', 'Interact'],
    ['1 2 3', 'Time of day'],
    ['M', 'Map'],
    ['N', 'Sound'],
    ['Space', 'Pause'],
  ],
  soundOn: 'Sound on',
  soundOff: 'Sound off',
  coordsOn: 'coordinates on',
  coordsOff: 'coordinates off',
  copied: 'copied',
  heroViews: {
    morning: '1 · Morning',
    golden: '2 · Golden hour',
    night: '3 · Night',
  },
  map: {
    titleJp: '富士見町 マップ',
    title: 'Town map',
    close: 'M to close',
    here: 'You are here',
    todo: 'Things to do',
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
      station: { en: 'Sakura-Fuji Station', jp: 'さくら富士駅' },
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
    notOut: 'Pay at the till first',
    ate: 'Delicious. Step back onto the highlight for another',
    tipsy: 'That Strong Nine is living up to its name',
    lines: {
      irasshaimase: { jp: 'いらっしゃいませ！', en: 'Welcome!', dur: 1.3 },
      oazukari: { jp: 'お預かりします', en: "I'll take those.", dur: 1.2 },
      total: (n) => ({ jp: `${n}円になります`, en: `That comes to ¥${n.toLocaleString('en')}.`, dur: 1.7 }),
      arigatou: { jp: 'ありがとうございます', en: 'Thank you very much.', dur: 1.5 },
      farewell: { jp: 'ありがとうございました！', en: 'Thank you, come again!', dur: 1.7 },
    },
  },
  refOn: 'reference overlay on',
  refOff: 'reference overlay off',
  /* The slow-life bench by the paddies and 鏡池 (world/land/slowlife.js). */
  slowlife: {
    sit: 'Nowhere to be. Stay as long as you like.',
  },
};
