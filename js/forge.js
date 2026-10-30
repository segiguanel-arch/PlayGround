// Card Forge — live card designer with image upload / camera and custom stats.

import { ELEMENTS, RARITIES, KEYWORDS, KEYWORD_IDS } from './data.js';
import {
  getProfile, addCustomCard, customArtFor, deleteCustomCard, processImageFile,
  ownedCount, getCard
} from './store.js';
import {
  $, $$, esc, icon, cardHTML, toast, openSheet, sheetHead, closeSheet,
  confirmSheet, promptSheet, sound, haptic
} from './ui.js';
import { generateCardArt } from './art.js';

const DEFAULTS = () => ({
  id: null,
  name: '',
  element: 'ember',
  rarity: 'common',
  cost: 3,
  atk: 3,
  hp: 4,
  keywords: [],
  flavor: ''
});

const state = {
  draft: DEFAULTS(),
  seed: Math.floor(Math.random() * 99999),
  previewArt: null,
  image: null,
  editingId: null,
  ready: false,
  busy: false
};

let onSaved = null;

export function initForge(options = {}) {
  onSaved = options.onSaved || null;
  if (state.ready) return;
  state.ready = true;

  buildPickers();

  $('#forge-name').addEventListener('input', (e) => {
    state.draft.name = e.target.value;
    $('#forge-name-count').textContent = `${e.target.value.length}/24`;
    renderPreview();
  });
  $('#forge-flavor').addEventListener('input', (e) => {
    state.draft.flavor = e.target.value;
    $('#forge-flavor-count').textContent = `${e.target.value.length}/120`;
    renderPreview();
  });

  $$('.stepper').forEach(step => {
    step.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-step]');
      if (!btn) return;
      const stat = step.dataset.stat;
      const delta = Number(btn.dataset.step);
      const limits = { cost: [1, 10], atk: [0, 20], hp: [1, 20] };
      const [lo, hi] = limits[stat];
      state.draft[stat] = Math.max(lo, Math.min(hi, state.draft[stat] + delta));
      if (state.draft[stat] === lo || state.draft[stat] === hi) {
        sound.play('deny');
      } else {
        sound.play('tap');
      }
      haptic(4);
      renderStats();
      renderPreview();
    });
  });

  $('#forge-elements').addEventListener('click', (e) => {
    const btn = e.target.closest('[data-element]');
    if (!btn) return;
    state.draft.element = btn.dataset.element;
    state.seed = Math.floor(Math.random() * 99999);
    regenerateArt();
    renderPickers();
    renderPreview();
    sound.play('select');
    haptic(5);
  });

  $('#forge-rarities').addEventListener('click', (e) => {
    const btn = e.target.closest('[data-rarity]');
    if (!btn) return;
    state.draft.rarity = btn.dataset.rarity;
    renderPickers();
    renderPreview();
    sound.play('tap');
    haptic(4);
  });

  $('#forge-keywords').addEventListener('click', (e) => {
    const btn = e.target.closest('[data-kw]');
    if (!btn) return;
    if (btn.disabled && !btn.classList.contains('is-active')) return;
    const id = btn.dataset.kw;
    const has = state.draft.keywords.includes(id);
    if (has) {
      state.draft.keywords = state.draft.keywords.filter(k => k !== id);
    } else if (state.draft.keywords.length < 2) {
      state.draft.keywords.push(id);
    } else {
      sound.play('deny');
      toast('Only two keywords fit on a card.');
      return;
    }
    haptic(5);
    renderKeywordPicker();
    renderPreview();
  });

  $('#btn-regen-art').addEventListener('click', () => {
    state.seed = Math.floor(Math.random() * 99999);
    state.image = null;
    regenerateArt();
    renderPreview();
    sound.play('shuffle');
    haptic(8);
    toast('Artwork re-rolled.');
  });

  $('#btn-upload-art').addEventListener('click', () => $('#file-gallery').click());
  $('#btn-camera-art').addEventListener('click', () => $('#file-camera').click());
  $('#file-gallery').addEventListener('change', handleFile);
  $('#file-camera').addEventListener('change', handleFile);

  $('#forge-form').addEventListener('submit', (e) => {
    e.preventDefault();
    saveCard();
  });
  $('#btn-forge-clear').addEventListener('click', () => {
    resetForge();
    toast('Forge cleared.');
  });
  $('#btn-forge-new').addEventListener('click', () => resetForge());
  $('#btn-forge-save').addEventListener('click', () => { /* submit handles it */ });

  $('#forge-saved').addEventListener('click', (e) => {
    const item = e.target.closest('[data-custom]');
    if (!item) return;
    const id = item.dataset.custom;
    if (e.target.closest('[data-edit]')) openForge(id);
    else if (e.target.closest('[data-del]')) askDelete(id);
    else showCustomPreview(id);
  });

  // Preview tilt (mouse / pen only).
  const previewZone = $('.forge-preview');
  previewZone.addEventListener('pointermove', (e) => {
    if (e.pointerType === 'touch') return;
    const card = previewZone.querySelector('.card');
    if (!card) return;
    const r = previewZone.getBoundingClientRect();
    const px = (e.clientX - r.left) / r.width - 0.5;
    const py = (e.clientY - r.top) / r.height - 0.5;
    card.style.transform = `rotateX(${(-py * 11).toFixed(2)}deg) rotateY(${(px * 13).toFixed(2)}deg)`;
  });
  previewZone.addEventListener('pointerleave', () => {
    const card = previewZone.querySelector('.card');
    if (card) card.style.transform = '';
  });

  resetForge();
  renderSaved();
}

// ---------------------------------------------------------------------------
// Pickers
// ---------------------------------------------------------------------------
function hexToRgb(hex) {
  const n = parseInt(hex.replace('#', ''), 16);
  return `${(n >> 16) & 255},${(n >> 8) & 255},${n & 255}`;
}

function buildPickers() {
  $('#forge-elements').innerHTML = Object.entries(ELEMENTS).map(([id, el]) => `
    <button type="button" class="el-option" data-element="${id}" role="radio" aria-checked="false"
      style="--el:${el.c1};--glow:${el.glow}">
      ${icon(el.icon)}<span>${el.name}</span>
    </button>`).join('');

  $('#forge-rarities').innerHTML = Object.entries(RARITIES).map(([id, r]) => `
    <button type="button" class="rarity-option" data-rarity="${r.name.toLowerCase()}" role="radio" aria-checked="false"
      style="--rarity-color:${r.color}"><i></i><span>${r.name}</span></button>`).join('');

  $('#forge-keywords').innerHTML = KEYWORD_IDS.map(id => {
    const kw = KEYWORDS[id];
    return `<button type="button" class="kw-option" data-kw="${id}" aria-pressed="false"
      style="--kwc:${kw.color};--kwglow:${hexToRgb(kw.color)}">
      <span class="kwi">${kw.icon}</span><b>${kw.name}</b>
    </button>`;
  }).join('');
}

function renderPickers() {
  $$('#forge-elements .el-option').forEach(b => {
    const on = b.dataset.element === state.draft.element;
    b.classList.toggle('is-active', on);
    b.setAttribute('aria-checked', on ? 'true' : 'false');
  });
  $$('#forge-rarities .rarity-option').forEach(b => {
    const on = b.dataset.rarity === state.draft.rarity;
    b.classList.toggle('is-active', on);
    b.setAttribute('aria-checked', on ? 'true' : 'false');
  });
  $('#forge-rarity-hint').textContent = RARITIES[state.draft.rarity]?.name || 'Common';
  renderKeywordPicker();
}

function renderKeywordPicker() {
  $$('#forge-keywords .kw-option').forEach(b => {
    const on = state.draft.keywords.includes(b.dataset.kw);
    const full = state.draft.keywords.length >= 2 && !on;
    b.classList.toggle('is-active', on);
    b.setAttribute('aria-pressed', on ? 'true' : 'false');
    b.disabled = full;
  });
  $('#forge-kw-count').textContent = `${state.draft.keywords.length} / 2`;
  const help = $('#forge-keyword-help');
  if (!state.draft.keywords.length) {
    help.innerHTML = 'Choose up to two abilities. Tap to learn what they do.';
  } else {
    help.innerHTML = state.draft.keywords.map(k => {
      const kw = KEYWORDS[k];
      return `<b style="color:${kw.color}">${kw.name}</b> — ${esc(kw.short)}`;
    }).join('<br>');
  }
}

function renderStats() {
  $('#forge-cost').textContent = state.draft.cost;
  $('#forge-atk').textContent = state.draft.atk;
  $('#forge-hp').textContent = state.draft.hp;
}

// ---------------------------------------------------------------------------
// Preview
// ---------------------------------------------------------------------------
function regenerateArt() {
  const seedCard = {
    id: state.editingId || `forge-${state.draft.element}-${state.seed}`,
    name: state.draft.name || 'Forged Legend',
    element: state.draft.element,
    artVersion: state.seed
  };
  state.previewArt = generateCardArt(seedCard);
}

function renderPreview() {
  const preview = $('#forge-preview');
  if (!preview) return;
  const el = ELEMENTS[state.draft.element];
  const art = state.image || state.previewArt;
  const display = {
    ...state.draft,
    name: state.draft.name.trim() || 'Unnamed Legend',
    id: state.editingId || 'forge-preview',
    keywords: state.draft.keywords,
    element: el ? state.draft.element : 'ember'
  };
  preview.innerHTML = cardHTML(display, {
    art,
    flavor: true,
    className: 'card--showcase'
  });
}

// ---------------------------------------------------------------------------
// Images
// ---------------------------------------------------------------------------
async function handleFile(e) {
  const file = e.target.files?.[0];
  e.target.value = '';
  if (!file || state.busy) return;
  state.busy = true;
  const btns = $$('.tool-btn');
  btns.forEach(b => { b.disabled = true; b.style.opacity = '.5'; });
  toast('Tuning your artwork…', 1200);
  try {
    const data = await processImageFile(file);
    state.image = data;
    renderPreview();
    sound.play('play');
    haptic(12);
    toast('Artwork uploaded. It is stored on this device.');
  } catch (err) {
    sound.play('deny');
    toast(err.message || 'That image could not be used.');
  } finally {
    state.busy = false;
    btns.forEach(b => { b.disabled = false; b.style.opacity = ''; });
  }
}

// ---------------------------------------------------------------------------
// Save / edit / delete
// ---------------------------------------------------------------------------
function saveCard() {
  const name = state.draft.name.trim();
  if (name.length < 2) {
    sound.play('deny');
    haptic([10, 40, 10]);
    toast('Give your card a name first.');
    $('#forge-name').focus();
    return;
  }
  const draft = { ...state.draft, name };
  if (state.editingId) draft.id = state.editingId;
  const image = state.image || state.previewArt;
  const card = addCustomCard(draft, image);
  state.editingId = card.id;
  state.draft.id = card.id;
  sound.play('win');
  haptic([12, 30, 18]);
  toast(`${card.name} is forged and added to your collection.`, 2800);
  $('#forge-heading').textContent = 'Sharpen your legend';
  $('#btn-forge-save').innerHTML = `${icon('sparkle')}<span>Save changes</span>`;
  renderSaved();
  onSaved?.(card);
}

export function openForge(cardId = null) {
  if (!state.ready) initForge({ onSaved });
  resetForge(cardId ? getCard(cardId) : null);
  const scroll = $('.forge-scroll');
  if (scroll) scroll.scrollTop = 0;
}

function resetForge(custom = null) {
  state.draft = DEFAULTS();
  state.seed = Math.floor(Math.random() * 99999);
  state.image = null;
  state.editingId = null;

  if (custom && custom.id) {
    state.editingId = custom.id;
    state.draft = {
      id: custom.id,
      name: custom.name,
      element: custom.element,
      rarity: custom.rarity,
      cost: custom.cost,
      atk: custom.atk,
      hp: custom.hp,
      keywords: [...(custom.keywords || [])],
      flavor: custom.flavor || ''
    };
    const stored = customArtFor(custom.id);
    state.image = stored || null;
  }

  regenerateArt();

  $('#forge-name').value = state.draft.name;
  $('#forge-flavor').value = state.draft.flavor;
  $('#forge-name-count').textContent = `${state.draft.name.length}/24`;
  $('#forge-flavor-count').textContent = `${state.draft.flavor.length}/120`;
  $('#forge-heading').textContent = state.editingId ? 'Sharpen your legend' : 'Shape a legend';
  $('#btn-forge-save').innerHTML = `${icon('sparkle')}<span>${state.editingId ? 'Save changes' : 'Forge card'}</span>`;
  renderStats();
  renderPickers();
  renderPreview();
  renderSaved();
}

function renderSaved() {
  const customs = getProfile().customCards;
  $('#forge-saved-wrap').hidden = customs.length === 0;
  $('#forge-saved-count').textContent = String(customs.length);
  $('#forge-saved').innerHTML = customs.map(card => `
    <div class="saved-item" data-custom="${card.id}">
      ${cardHTML(card)}
      <div class="saved-item-actions">
        <button data-edit>Edit</button>
        <button data-del class="del">Delete</button>
      </div>
    </div>`).join('');
}

function showCustomPreview(id) {
  const card = getCard(id);
  if (!card) return;
  openSheet(`
    ${sheetHead(card.name, `${ELEMENTS[card.element].name} · ${RARITIES[card.rarity].name}`)}
    <div class="detail-wrap">
      <div class="detail-card">${cardHTML(card, { className: 'card--showcase', flavor: false })}</div>
      <div class="detail-copy">
        <div class="detail-stats">
          <div class="detail-stat"><b>${card.cost}</b><span>Aether</span></div>
          <div class="detail-stat"><b>${card.atk}</b><span>Attack</span></div>
          <div class="detail-stat"><b>${card.hp}</b><span>Health</span></div>
        </div>
        ${card.flavor ? `<p class="detail-flavor">“${esc(card.flavor)}”</p>` : ''}
        <div class="detail-actions">
          <button class="btn btn-ghost" data-close>Close</button>
          <button class="btn btn-primary" data-edit-one>${icon('edit')}Edit card</button>
        </div>
      </div>
    </div>`, {
    onMount(sheet) {
      sheet.querySelector('[data-edit-one]').addEventListener('click', () => {
        closeSheet();
        openForge(id);
      });
    }
  });
}

async function askDelete(id) {
  const card = getCard(id);
  if (!card) return;
  const ok = await confirmSheet({
    title: 'Delete forged card?',
    body: `“${esc(card.name)}” will be removed from your collection and all decks. This cannot be undone.`,
    confirm: 'Delete card',
    danger: true
  });
  if (!ok) return;
  deleteCustomCard(id);
  sound.play('deny');
  haptic([10, 30, 10]);
  if (state.editingId === id) resetForge();
  else renderSaved();
  onSaved?.(null);
  toast('Forged card deleted.');
}

export function refreshForgeIfOpen() {
  if (state.ready) {
    renderSaved();
    renderPreview();
  }
}
