// Aether Kombat — core card data, elements and keyword rules.

export const ELEMENTS = {
  ember: {
    name: 'Ember', icon: 'flame', c1: '#ff9a52', c2: '#ff3f2f', deep: '#210704',
    glow: '255,106,42', rune: 'flame', blurb: 'Ferocious, fast, and born to burn.'
  },
  tide: {
    name: 'Tide', icon: 'wave', c1: '#77e4ff', c2: '#3d6bff', deep: '#04101f',
    glow: '76,201,240', rune: 'wave', blurb: 'Patient power that wears down any shore.'
  },
  verdant: {
    name: 'Verdant', icon: 'leaf', c1: '#b7f48a', c2: '#2fae6b', deep: '#04150b',
    glow: '124,226,122', rune: 'leaf', blurb: 'Ancient roots. Relentless growth.'
  },
  storm: {
    name: 'Storm', icon: 'bolt', c1: '#c6a7ff', c2: '#6b5cff', deep: '#0d0722',
    glow: '177,140,255', rune: 'bolt', blurb: 'Strike first. Strike loud. Strike true.'
  },
  umbra: {
    name: 'Umbra', icon: 'moon', c1: '#e383ff', c2: '#7a2dff', deep: '#120418',
    glow: '192,92,255', rune: 'eclipse', blurb: 'What the light forgets, the dark remembers.'
  },
  radiant: {
    name: 'Radiant', icon: 'sun', c1: '#ffe5a3', c2: '#ffb02e', deep: '#1e1403',
    glow: '255,217,122', rune: 'sun', blurb: 'Hold the line. Kindle the dawn.'
  }
};

export const RARITIES = {
  common: { name: 'Common', color: '#b9b4a7', rank: 0 },
  rare: { name: 'Rare', color: '#6cc4ff', rank: 1 },
  epic: { name: 'Epic', color: '#c68bff', rank: 2 },
  legendary: { name: 'Legendary', color: '#ffcf6a', rank: 3 }
};

export const KEYWORDS = {
  rush: {
    name: 'Rush', icon: '»', color: '#ffb15c',
    short: 'Can attack the turn it is summoned.'
  },
  ward: {
    name: 'Ward', icon: '◇', color: '#7ad7ff',
    short: 'Negates the first damage it takes.'
  },
  lifesteal: {
    name: 'Lifesteal', icon: '♥', color: '#ff7fa8',
    short: 'Heals your hero for damage dealt.'
  },
  blast: {
    name: 'Blast', icon: '✹', color: '#ffd36e',
    short: 'On play: deals 2 damage to the foe opposite.'
  },
  regen: {
    name: 'Regen', icon: '✚', color: '#8ef0a3',
    short: 'Heals 2 at the start of your turn.'
  },
  cleave: {
    name: 'Cleave', icon: '⌁', color: '#ff9c6e',
    short: 'When it attacks a unit, also deals 1 to adjacent foes.'
  }
};

export const KEYWORD_IDS = Object.keys(KEYWORDS);

// ---------------------------------------------------------------------------
// Starter set — 36 collectible cards across six elements.
// ---------------------------------------------------------------------------
export const STARTER_CARDS = [
  // Ember ------------------------------------------------------------------
  { id: 'cinder-whelp', name: 'Cinder Whelp', element: 'ember', cost: 1, atk: 1, hp: 2, keywords: ['rush'], rarity: 'common', flavor: 'Born in the first spark. Hungry for the last.' },
  { id: 'ashfang-raider', name: 'Ashfang Raider', element: 'ember', cost: 2, atk: 2, hp: 2, keywords: ['rush'], rarity: 'common', flavor: 'It raids the smoke before the fire has finished.' },
  { id: 'emberwing', name: 'Emberwing', element: 'ember', cost: 3, atk: 3, hp: 2, keywords: ['blast'], rarity: 'common', flavor: 'Every feather is a falling star.' },
  { id: 'magma-brute', name: 'Magma Brute', element: 'ember', cost: 4, atk: 5, hp: 4, keywords: [], rarity: 'common', flavor: 'The mountain walks when it is angry.' },
  { id: 'flame-oracle', name: 'Flame Oracle', element: 'ember', cost: 2, atk: 1, hp: 3, keywords: ['regen'], rarity: 'rare', flavor: 'She reads the future in her own palms.' },
  { id: 'pyre-colossus', name: 'Pyre Colossus', element: 'ember', cost: 7, atk: 8, hp: 8, keywords: ['cleave'], rarity: 'legendary', flavor: 'A funeral pyre the size of a city. Still burning.' },

  // Tide -------------------------------------------------------------------
  { id: 'tide-caller', name: 'Tide Caller', element: 'tide', cost: 1, atk: 1, hp: 3, keywords: [], rarity: 'common', flavor: 'The sea answers, but only when it wants to.' },
  { id: 'mist-sprite', name: 'Mist Sprite', element: 'tide', cost: 2, atk: 2, hp: 1, keywords: ['rush'], rarity: 'common', flavor: 'Gone before the foam settles.' },
  { id: 'coral-guardian', name: 'Coral Guardian', element: 'tide', cost: 3, atk: 2, hp: 6, keywords: ['ward'], rarity: 'rare', flavor: 'The reef remembers every blade that ever broke on it.' },
  { id: 'abyss-serpent', name: 'Abyss Serpent', element: 'tide', cost: 4, atk: 4, hp: 4, keywords: ['lifesteal'], rarity: 'common', flavor: 'It does not hunt. It simply waits where the light ends.' },
  { id: 'deep-oracle', name: 'Deep Oracle', element: 'tide', cost: 3, atk: 2, hp: 4, keywords: ['blast'], rarity: 'rare', flavor: 'Her prophecies arrive as bubbles, and all of them are true.' },
  { id: 'leviathan', name: 'Leviathan', element: 'tide', cost: 8, atk: 9, hp: 10, keywords: ['lifesteal', 'ward'], rarity: 'legendary', flavor: 'Sailors do not fear the storm. They fear what swims beneath it.' },

  // Verdant ----------------------------------------------------------------
  { id: 'thornling', name: 'Thornling', element: 'verdant', cost: 1, atk: 1, hp: 2, keywords: [], rarity: 'common', flavor: 'Small, sharp, and absolutely certain it belongs here.' },
  { id: 'sporeling', name: 'Sporeling', element: 'verdant', cost: 2, atk: 2, hp: 2, keywords: ['blast'], rarity: 'common', flavor: 'It blooms once. Everyone nearby regrets it.' },
  { id: 'grove-warden', name: 'Grove Warden', element: 'verdant', cost: 3, atk: 2, hp: 5, keywords: ['ward'], rarity: 'common', flavor: 'Older than the road that cuts through its grove.' },
  { id: 'verdant-stalker', name: 'Verdant Stalker', element: 'verdant', cost: 4, atk: 4, hp: 3, keywords: ['cleave'], rarity: 'rare', flavor: 'You will hear the leaves. That is the last thing you hear.' },
  { id: 'wildheart', name: 'Wildheart', element: 'verdant', cost: 5, atk: 6, hp: 5, keywords: ['lifesteal'], rarity: 'epic', flavor: 'The forest gave it a heart. It asks for one in return.' },
  { id: 'ancient-oak', name: 'Ancient Oak', element: 'verdant', cost: 6, atk: 4, hp: 9, keywords: ['regen'], rarity: 'rare', flavor: 'It has survived nine wars by refusing to move.' },

  // Storm ------------------------------------------------------------------
  { id: 'spark-imp', name: 'Spark Imp', element: 'storm', cost: 1, atk: 2, hp: 1, keywords: ['rush'], rarity: 'common', flavor: 'A hiccup of thunder with a very bad attitude.' },
  { id: 'static-djinn', name: 'Static Djinn', element: 'storm', cost: 2, atk: 1, hp: 2, keywords: ['lifesteal'], rarity: 'common', flavor: 'It grants one wish: more lightning.' },
  { id: 'storm-arcanist', name: 'Storm Arcanist', element: 'storm', cost: 3, atk: 3, hp: 3, keywords: ['blast'], rarity: 'rare', flavor: 'She draws sigils in the air. The air draws back.' },
  { id: 'volt-sentinel', name: 'Volt Sentinel', element: 'storm', cost: 4, atk: 3, hp: 6, keywords: ['ward'], rarity: 'common', flavor: 'The gate is closed. The gate is also humming.' },
  { id: 'thunder-roc', name: 'Thunder Roc', element: 'storm', cost: 5, atk: 6, hp: 4, keywords: ['rush'], rarity: 'epic', flavor: 'Its wingspan is measured in weather warnings.' },
  { id: 'tempest-queen', name: 'Tempest Queen', element: 'storm', cost: 7, atk: 7, hp: 7, keywords: ['blast', 'rush'], rarity: 'legendary', flavor: 'She arrives with the storm, and leaves before the rain.' },

  // Umbra ------------------------------------------------------------------
  { id: 'grave-shade', name: 'Grave Shade', element: 'umbra', cost: 1, atk: 1, hp: 1, keywords: ['lifesteal'], rarity: 'common', flavor: 'A memory that refused to be buried.' },
  { id: 'cursed-blade', name: 'Cursed Blade', element: 'umbra', cost: 2, atk: 3, hp: 2, keywords: [], rarity: 'common', flavor: 'The sword is not cursed. The hand that holds it is.' },
  { id: 'void-seer', name: 'Void Seer', element: 'umbra', cost: 3, atk: 2, hp: 4, keywords: ['blast'], rarity: 'common', flavor: 'It looked into nothing, and nothing looked back fondly.' },
  { id: 'bone-reaper', name: 'Bone Reaper', element: 'umbra', cost: 4, atk: 5, hp: 4, keywords: ['cleave'], rarity: 'rare', flavor: 'Harvest season never truly ends.' },
  { id: 'eclipse-knight', name: 'Eclipse Knight', element: 'umbra', cost: 5, atk: 5, hp: 5, keywords: ['ward'], rarity: 'epic', flavor: 'Sworn to the sun, dressed in its shadow.' },
  { id: 'nightmare', name: 'Nightmare', element: 'umbra', cost: 6, atk: 7, hp: 6, keywords: ['lifesteal'], rarity: 'epic', flavor: 'You have met it before. You just do not remember waking.' },

  // Radiant ----------------------------------------------------------------
  { id: 'dawn-acolyte', name: 'Dawn Acolyte', element: 'radiant', cost: 1, atk: 1, hp: 2, keywords: ['regen'], rarity: 'common', flavor: 'Every morning, she greets the sun by name.' },
  { id: 'radiant-squire', name: 'Radiant Squire', element: 'radiant', cost: 2, atk: 2, hp: 3, keywords: [], rarity: 'common', flavor: 'The armor is too big. The courage is not.' },
  { id: 'sun-sentinel', name: 'Sun Sentinel', element: 'radiant', cost: 3, atk: 3, hp: 5, keywords: ['ward'], rarity: 'common', flavor: 'It has stood at this gate since the first dawn.' },
  { id: 'golden-lion', name: 'Golden Lion', element: 'radiant', cost: 4, atk: 4, hp: 4, keywords: ['cleave'], rarity: 'rare', flavor: 'Its roar is the sound of a hundred banners rising.' },
  { id: 'lumen-drake', name: 'Lumen Drake', element: 'radiant', cost: 5, atk: 5, hp: 5, keywords: ['blast'], rarity: 'epic', flavor: 'It hoards light the way other drakes hoard gold.' },
  { id: 'seraph', name: 'Seraph', element: 'radiant', cost: 7, atk: 6, hp: 7, keywords: ['regen', 'ward'], rarity: 'legendary', flavor: 'Six wings. One purpose. No mercy.' }
];

export const STARTER_BY_ID = Object.fromEntries(STARTER_CARDS.map(c => [c.id, c]));

// A friendly, legal 24-card starting deck. Curves out with fast Ember and
// Storm openings, then closes with Radiant and Verdant finishers.
export const STARTER_DECK = [
  'cinder-whelp', 'cinder-whelp',
  'spark-imp', 'spark-imp',
  'tide-caller',
  'ashfang-raider', 'ashfang-raider',
  'sporeling', 'sporeling',
  'emberwing', 'emberwing',
  'storm-arcanist', 'storm-arcanist',
  'coral-guardian', 'coral-guardian',
  'grove-warden', 'grove-warden',
  'magma-brute', 'magma-brute',
  'abyss-serpent',
  'sun-sentinel',
  'wildheart',
  'lumen-drake',
  'seraph'
];

// The Ashen Warden's deck. Fair, but it will punish greedy lanes.
export const RIVAL_DECK = [
  'spark-imp', 'spark-imp',
  'grave-shade', 'grave-shade',
  'mist-sprite', 'mist-sprite',
  'cursed-blade', 'cursed-blade',
  'static-djinn', 'static-djinn',
  'storm-arcanist', 'storm-arcanist',
  'void-seer', 'void-seer',
  'coral-guardian', 'coral-guardian',
  'volt-sentinel', 'volt-sentinel',
  'bone-reaper', 'bone-reaper',
  'thunder-roc',
  'eclipse-knight',
  'nightmare',
  'tempest-queen'
];

export const RIVAL = {
  name: 'The Ashen Warden',
  title: 'Keeper of the Ninth Gate',
  element: 'umbra',
  taunts: [
    'Your spark is noted. It will not be missed.',
    'The gate has swallowed brighter souls than yours.',
    'Every lane is a grave waiting for a name.',
    'Ash remembers. I remember.'
  ]
};

export const RANKS = [
  { min: 0, name: 'Ashwalker' },
  { min: 2, name: 'Ember Adept' },
  { min: 5, name: 'Lane Keeper' },
  { min: 9, name: 'Runeblade' },
  { min: 14, name: 'Gatebreaker' },
  { min: 20, name: 'Aether Sovereign' }
];

export function rankFor(wins) {
  let rank = RANKS[0];
  for (const r of RANKS) if (wins >= r.min) rank = r;
  return rank;
}

export const DECK_SIZE = 24;
export const HAND_LIMIT = 8;
export const HERO_HP = 30;
export const LANES = 5;
export const MAX_MANA = 10;

export function keywordList(card) {
  return (card.keywords || []).filter(k => KEYWORDS[k]);
}

export function cardPower(card) {
  const kw = (card.keywords || []).length;
  return card.cost * 10 + card.atk * 2 + card.hp * 2 + kw * 5;
}
