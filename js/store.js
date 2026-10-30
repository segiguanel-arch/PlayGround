// Persistence, profile, collection, decks and custom card storage.

import {
  STARTER_CARDS, STARTER_BY_ID, STARTER_DECK, DECK_SIZE, ELEMENTS,
  KEYWORDS, RARITIES, RANKS, rankFor
} from './data.js';

const PROFILE_KEY = 'aether.profile.v2';
const ART_DB = 'aether-art';
const ART_STORE = 'art';

const customArt = new Map();
let dbPromise = null;

function openDB() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise(resolve => {
    try {
      if (!('indexedDB' in window)) return resolve(null);
      const req = indexedDB.open(ART_DB, 1);
      req.onupgradeneeded = () => {
        if (!req.result.objectStoreNames.contains(ART_STORE)) req.result.createObjectStore(ART_STORE);
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
      req.onblocked = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
  return dbPromise;
}

async function idbPut(key, value) {
  const db = await openDB();
  if (!db) return;
  return new Promise(resolve => {
    try {
      const tx = db.transaction(ART_STORE, 'readwrite');
      tx.objectStore(ART_STORE).put(value, key);
      tx.oncomplete = () => resolve(true);
      tx.onerror = () => resolve(false);
    } catch { resolve(false); }
  });
}

async function idbDelete(key) {
  const db = await openDB();
  if (!db) return;
  return new Promise(resolve => {
    try {
      const tx = db.transaction(ART_STORE, 'readwrite');
      tx.objectStore(ART_STORE).delete(key);
      tx.oncomplete = () => resolve(true);
      tx.onerror = () => resolve(false);
    } catch { resolve(false); }
  });
}

async function idbGetAll() {
  const db = await openDB();
  if (!db) return {};
  return new Promise(resolve => {
    try {
      const tx = db.transaction(ART_STORE, 'readonly');
      const out = {};
      const req = tx.objectStore(ART_STORE).openCursor();
      req.onsuccess = () => {
        const cur = req.result;
        if (cur) {
          out[cur.key] = cur.value;
          cur.continue();
        } else resolve(out);
      };
      req.onerror = () => resolve({});
    } catch { resolve({}); }
  });
}

// ---------------------------------------------------------------------------
// Profile
// ---------------------------------------------------------------------------
function starterCopies(card) {
  if (card.rarity === 'legendary') return 1;
  if (card.rarity === 'epic') return 1;
  return 2;
}

function makeDefaultProfile() {
  const collection = {};
  STARTER_CARDS.forEach(c => { collection[c.id] = starterCopies(c); });
  const cards = {};
  STARTER_DECK.forEach(id => { cards[id] = (cards[id] || 0) + 1; });
  return {
    version: 2,
    name: 'Wanderer',
    wins: 0,
    losses: 0,
    collection,
    customCards: [],
    decks: [{ id: 'deck-starter', name: 'Starter Ascent', cards }],
    activeDeckId: 'deck-starter',
    settings: { sound: true, haptics: true, tilt: false, seenHelp: false },
    createdAt: Date.now()
  };
}

function sanitizeProfile(p) {
  const base = makeDefaultProfile();
  if (!p || typeof p !== 'object') return base;
  const profile = { ...base, ...p };
  profile.settings = { ...base.settings, ...(p.settings || {}) };
  profile.collection = { ...(p.collection || {}) };
  STARTER_CARDS.forEach(c => {
    if (!Number.isFinite(profile.collection[c.id]) || profile.collection[c.id] < 0) {
      profile.collection[c.id] = starterCopies(c);
    }
  });
  profile.customCards = Array.isArray(p.customCards) ? p.customCards.filter(c =>
    c && typeof c.id === 'string' && c.id.startsWith('custom-') && ELEMENTS[c.element]
  ) : [];
  // Clean deleted custom cards out of collection/decks.
  const validIds = new Set([...STARTER_CARDS.map(c => c.id), ...profile.customCards.map(c => c.id)]);
  for (const id of Object.keys(profile.collection)) {
    if (!validIds.has(id)) delete profile.collection[id];
  }
  profile.decks = Array.isArray(p.decks) ? p.decks.filter(d => d && typeof d.id === 'string') : [];
  if (!profile.decks.length) profile.decks = base.decks;
  profile.decks.forEach(d => {
    d.cards = d.cards && typeof d.cards === 'object' ? d.cards : {};
    for (const id of Object.keys(d.cards)) {
      if (!validIds.has(id) || !d.cards[id]) delete d.cards[id];
    }
    if (typeof d.name !== 'string' || !d.name.trim()) d.name = 'Untitled Deck';
  });
  if (!profile.decks.some(d => d.id === profile.activeDeckId)) profile.activeDeckId = profile.decks[0].id;
  if (typeof profile.name !== 'string' || !profile.name.trim()) profile.name = 'Wanderer';
  profile.name = profile.name.slice(0, 18);
  profile.wins = Math.max(0, Number(profile.wins) || 0);
  profile.losses = Math.max(0, Number(profile.losses) || 0);
  return profile;
}

let profile = null;

export function loadProfile() {
  if (profile) return profile;
  try {
    const raw = localStorage.getItem(PROFILE_KEY);
    profile = sanitizeProfile(raw ? JSON.parse(raw) : null);
  } catch {
    profile = makeDefaultProfile();
  }
  return profile;
}

export function saveProfile() {
  if (!profile) return;
  try {
    localStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
  } catch (e) {
    console.warn('Could not save profile', e);
  }
}

export function getProfile() {
  return loadProfile();
}

export function setPlayerName(name) {
  const p = getProfile();
  p.name = (name || '').trim().slice(0, 18) || 'Wanderer';
  saveProfile();
  return p.name;
}

export function recordResult(won) {
  const p = getProfile();
  if (won) p.wins += 1; else p.losses += 1;
  saveProfile();
}

export function resetProgress() {
  profile = makeDefaultProfile();
  saveProfile();
  customArt.clear();
  idbGetAll().then(async arts => {
    for (const key of Object.keys(arts)) await idbDelete(key);
  });
  return profile;
}

export function rank() {
  const p = getProfile();
  return rankFor(p.wins);
}

// ---------------------------------------------------------------------------
// Cards + collection
// ---------------------------------------------------------------------------
export function allCards() {
  const p = getProfile();
  return [...STARTER_CARDS, ...p.customCards];
}

export function getCard(id) {
  const p = getProfile();
  return STARTER_BY_ID[id] || p.customCards.find(c => c.id === id) || null;
}

export function ownedCount(id) {
  const p = getProfile();
  return p.collection[id] || 0;
}

export function ownedUnique() {
  const p = getProfile();
  return Object.keys(p.collection).filter(id => p.collection[id] > 0).length;
}

export function addCustomCard(draft, imageDataUrl) {
  const p = getProfile();
  const id = draft.id && draft.id.startsWith('custom-') ? draft.id
    : `custom-${Date.now().toString(36)}-${Math.floor(Math.random() * 1e4).toString(36)}`;
  const existingIndex = p.customCards.findIndex(c => c.id === id);
  const card = {
    id,
    name: (draft.name || 'Unnamed').trim().slice(0, 24),
    element: ELEMENTS[draft.element] ? draft.element : 'ember',
    cost: Math.max(1, Math.min(10, Number(draft.cost) || 1)),
    atk: Math.max(0, Math.min(20, Number(draft.atk) || 0)),
    hp: Math.max(1, Math.min(20, Number(draft.hp) || 1)),
    keywords: (draft.keywords || []).filter(k => KEYWORDS[k]).slice(0, 2),
    rarity: RARITIES[draft.rarity] ? draft.rarity : 'common',
    flavor: (draft.flavor || '').slice(0, 120),
    custom: true,
    createdAt: existingIndex >= 0 ? p.customCards[existingIndex].createdAt : Date.now()
  };
  if (existingIndex >= 0) p.customCards[existingIndex] = card;
  else p.customCards.unshift(card);

  if (imageDataUrl && imageDataUrl.startsWith('data:image')) {
    customArt.set(id, imageDataUrl);
    idbPut(id, imageDataUrl);
  } else if (existingIndex < 0) {
    customArt.delete(id);
  }

  if (existingIndex < 0) {
    p.collection[id] = card.rarity === 'legendary' ? 1 : 2;
  }
  saveProfile();
  return card;
}

export function removeCustomArt(id) {
  customArt.delete(id);
  idbDelete(id);
}

export function deleteCustomCard(id) {
  const p = getProfile();
  p.customCards = p.customCards.filter(c => c.id !== id);
  delete p.collection[id];
  p.decks.forEach(d => { delete d.cards[id]; });
  customArt.delete(id);
  idbDelete(id);
  saveProfile();
}

export async function hydrateArt() {
  const arts = await idbGetAll();
  for (const [key, value] of Object.entries(arts)) {
    if (typeof value === 'string' && value.startsWith('data:image')) customArt.set(key, value);
  }
}

export function customArtFor(id) {
  return customArt.get(id) || null;
}

// Compact uploaded image: 4:5 crop, 480×600, webp/jpeg.
export function processImageFile(file) {
  return new Promise((resolve, reject) => {
    if (!file || !file.type.startsWith('image/')) return reject(new Error('Please choose an image file.'));
    if (file.size > 14 * 1024 * 1024) return reject(new Error('Image is too large (max 14 MB).'));
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      try {
        const W = 480, H = 600;
        const c = document.createElement('canvas');
        c.width = W; c.height = H;
        const ctx = c.getContext('2d');
        const target = W / H;
        const srcRatio = img.width / img.height;
        let sw = img.width, sh = img.height, sx = 0, sy = 0;
        if (srcRatio > target) {
          sw = img.height * target;
          sx = (img.width - sw) / 2;
        } else {
          sh = img.width / target;
          sy = Math.max(0, (img.height - sh) * 0.35);
        }
        ctx.fillStyle = '#08070c';
        ctx.fillRect(0, 0, W, H);
        ctx.drawImage(img, sx, sy, sw, sh, 0, 0, W, H);
        // Cinematic grade: vignette + bottom fade
        const vig = ctx.createRadialGradient(W / 2, H / 2, 120, W / 2, H / 2, 360);
        vig.addColorStop(0, 'rgba(0,0,0,0)');
        vig.addColorStop(1, 'rgba(0,0,0,.55)');
        ctx.fillStyle = vig;
        ctx.fillRect(0, 0, W, H);
        const fade = ctx.createLinearGradient(0, H * 0.55, 0, H);
        fade.addColorStop(0, 'rgba(4,4,8,0)');
        fade.addColorStop(1, 'rgba(4,4,8,.8)');
        ctx.fillStyle = fade;
        ctx.fillRect(0, H * 0.55, W, H * 0.45);
        let out;
        try { out = c.toDataURL('image/webp', 0.85); } catch { out = c.toDataURL('image/jpeg', 0.86); }
        URL.revokeObjectURL(url);
        resolve(out);
      } catch (err) {
        URL.revokeObjectURL(url);
        reject(err);
      }
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('That image could not be read.'));
    };
    img.src = url;
  });
}

// ---------------------------------------------------------------------------
// Decks
// ---------------------------------------------------------------------------
export function activeDeck() {
  const p = getProfile();
  return p.decks.find(d => d.id === p.activeDeckId) || p.decks[0];
}

export function setActiveDeck(id) {
  const p = getProfile();
  if (p.decks.some(d => d.id === id)) {
    p.activeDeckId = id;
    saveProfile();
  }
}

export function createDeck(name) {
  const p = getProfile();
  const deck = {
    id: `deck-${Date.now().toString(36)}`,
    name: (name || 'New Deck').trim().slice(0, 24) || 'New Deck',
    cards: {}
  };
  p.decks.push(deck);
  p.activeDeckId = deck.id;
  saveProfile();
  return deck;
}

export function renameDeck(id, name) {
  const p = getProfile();
  const deck = p.decks.find(d => d.id === id);
  if (deck) {
    deck.name = (name || '').trim().slice(0, 24) || deck.name;
    saveProfile();
  }
}

export function deleteDeck(id) {
  const p = getProfile();
  if (p.decks.length <= 1) return false;
  p.decks = p.decks.filter(d => d.id !== id);
  if (p.activeDeckId === id) p.activeDeckId = p.decks[0].id;
  saveProfile();
  return true;
}

export function deckCount(deck) {
  return Object.values(deck?.cards || {}).reduce((a, b) => a + b, 0);
}

export function deckCardEntries(deck) {
  return Object.entries(deck?.cards || {}).map(([id, count]) => ({ card: getCard(id), count })).filter(e => e.card);
}

export function deckCardList(deck) {
  const out = [];
  for (const { card, count } of deckCardEntries(deck)) {
    for (let i = 0; i < count; i++) out.push(card);
  }
  return out;
}

export function maxCopies(card) {
  return card?.rarity === 'legendary' ? 1 : 2;
}

export function deckIsLegal(deck) {
  if (!deck) return false;
  const count = deckCount(deck);
  if (count !== DECK_SIZE) return false;
  for (const { card, count: n } of deckCardEntries(deck)) {
    if (n > maxCopies(card)) return false;
    if (n > ownedCount(card.id)) return false;
  }
  return true;
}

export function addCardToDeck(deck, cardId) {
  const card = getCard(cardId);
  if (!card) return { ok: false, reason: 'Card not found.' };
  const count = deckCount(deck);
  if (count >= DECK_SIZE) return { ok: false, reason: 'Your deck is full (24 cards).' };
  const used = deck.cards[cardId] || 0;
  if (used >= maxCopies(card)) return { ok: false, reason: `Max ${maxCopies(card)} copies allowed.` };
  if (used >= ownedCount(cardId)) return { ok: false, reason: 'You do not own another copy.' };
  deck.cards[cardId] = used + 1;
  saveProfile();
  return { ok: true };
}

export function removeCardFromDeck(deck, cardId) {
  if (!deck.cards[cardId]) return false;
  deck.cards[cardId] -= 1;
  if (deck.cards[cardId] <= 0) delete deck.cards[cardId];
  saveProfile();
  return true;
}

export function autoBuildDeck(deck) {
  const p = getProfile();
  deck.cards = {};
  const pool = allCards().filter(c => ownedCount(c.id) > 0);
  // Score cards for a flexible midrange curve, prefer affordable bodies.
  const scored = pool.map(c => {
    const curveFit = 1 - Math.abs((c.cost || 1) - 3.4) / 8;
    const keywordValue = (c.keywords || []).length * 0.55;
    const owned = ownedCount(c.id);
    const copyPenalty = Math.min(owned, maxCopies(c)) > 1 ? 0 : 0.15;
    return { c, score: (c.atk + c.hp) * 0.55 + keywordValue + curveFit * 3 + copyPenalty + Math.random() * 0.8 };
  }).sort((a, b) => b.score - a.score);

  const add = (card) => {
    const max = Math.min(maxCopies(card), ownedCount(card.id));
    for (let i = 0; i < max && deckCount(deck) < DECK_SIZE; i++) {
      deck.cards[card.id] = (deck.cards[card.id] || 0) + 1;
    }
  };
  // Ensure a spread of costs, then fill with the best remaining cards.
  const buckets = [1, 2, 2, 3, 3, 4, 4, 5, 6, 7];
  for (const cost of buckets) {
    if (deckCount(deck) >= DECK_SIZE - 4) break;
    const pick = scored.find(s => s.c.cost === cost && deckCount(deck) < DECK_SIZE &&
      (deck.cards[s.c.id] || 0) < Math.min(maxCopies(s.c), ownedCount(s.c.id)));
    if (pick) add(pick.c);
  }
  let guard = 0;
  while (deckCount(deck) < DECK_SIZE && guard++ < 200) {
    const pick = scored.find(s => (deck.cards[s.c.id] || 0) < Math.min(maxCopies(s.c), ownedCount(s.c.id)));
    if (!pick) break;
    add(pick.c);
  }
  saveProfile();
  return deckCount(deck);
}

export function deckCurve(deck) {
  const curve = [0, 0, 0, 0, 0, 0, 0, 0];
  for (const { card, count } of deckCardEntries(deck)) {
    const i = Math.max(0, Math.min(7, card.cost - 1));
    curve[i] += count;
  }
  return curve;
}
