// Deck builder + collection browser.

import {
  ELEMENTS, KEYWORDS, RARITIES, DECK_SIZE
} from './data.js';
import {
  getProfile, allCards, getCard, ownedCount, activeDeck, setActiveDeck,
  createDeck, renameDeck, deleteDeck, deckCount, deckCardEntries, deckIsLegal,
  addCardToDeck, removeCardFromDeck, autoBuildDeck, deckCurve, saveProfile
} from './store.js';
import {
  $, $$, esc, icon, cardHTML, artFor, toast, openSheet, sheetHead, closeSheet,
  promptSheet, confirmSheet, sound, haptic, mountTilt3d
} from './ui.js';

const state = {
  tab: 'decks',
  deckSearch: '',
  deckEl: 'all',
  colSearch: '',
  colEl: 'all',
  colMine: false,
  ready: false
};
let hooks = { onPlay: null, onForge: null, onEdit: null };

export function initLibrary(options = {}) {
  hooks = { ...hooks, ...options };
  if (state.ready) return;
  state.ready = true;

  $$('.lib-tabs .seg').forEach(btn => {
    btn.addEventListener('click', () => setTab(btn.dataset.libtarget));
  });

  $('#btn-deck-rename').addEventListener('click', renameActiveDeck);
  $('#btn-deck-delete').addEventListener('click', deleteActiveDeck);
  $('#btn-autobuild').addEventListener('click', () => {
    const deck = activeDeck();
    autoBuildDeck(deck);
    sound.play('shuffle');
    haptic(12);
    renderDeckPanel();
    renderDeckPool();
    toast('Auto-built a balanced curve from your collection.');
  });
  $('#btn-deck-play').addEventListener('click', playActiveDeck);
  $('#btn-new-custom').addEventListener('click', () => hooks.onForge?.());
  $('#btn-library-help').addEventListener('click', showLibraryHelp);

  $('#deck-search').addEventListener('input', (e) => {
    state.deckSearch = e.target.value.trim().toLowerCase();
    renderDeckPool();
  });
  $('#collection-search').addEventListener('input', (e) => {
    state.colSearch = e.target.value.trim().toLowerCase();
    renderCollection();
  });
  $('#btn-filter-mine').addEventListener('click', () => {
    state.colMine = !state.colMine;
    $('#btn-filter-mine').classList.toggle('is-active', state.colMine);
    renderCollection();
  });

  buildElementFilter($('#deck-el-filter'), () => state.deckEl, (el) => { state.deckEl = el; renderDeckPool(); });
  buildElementFilter($('#collection-el-filter'), () => state.colEl, (el) => { state.colEl = el; renderCollection(); });

  $('#deck-pool').addEventListener('click', (e) => {
    const item = e.target.closest('[data-card]');
    if (!item) return;
    const deck = activeDeck();
    const res = addCardToDeck(deck, item.dataset.card);
    if (!res.ok) {
      sound.play('deny');
      haptic([8, 40, 8]);
      toast(res.reason);
      return;
    }
    sound.play('tap');
    haptic(5);
    renderDeckPanel();
    renderDeckPool();
  });

  $('#deck-cards').addEventListener('click', (e) => {
    const mini = e.target.closest('[data-card]');
    if (!mini) return;
    const deck = activeDeck();
    if (removeCardFromDeck(deck, mini.dataset.card)) {
      sound.play('tap');
      haptic(5);
      renderDeckPanel();
      renderDeckPool();
    }
  });

  $('#collection-grid').addEventListener('click', (e) => {
    const item = e.target.closest('[data-card]');
    if (!item) return;
    showCardDetail(item.dataset.card);
  });

  renderDeckChips();
  renderAll();
}

export function openLibrary(tab = 'decks') {
  state.tab = tab;
  renderAll();
  setTab(tab);
}

export function refreshLibrary() {
  renderDeckChips();
  renderAll();
}

function setTab(tab) {
  state.tab = tab;
  const tabs = $$('.lib-tabs .seg');
  tabs.forEach(t => {
    const on = t.dataset.libtarget === tab;
    t.classList.toggle('is-active', on);
    t.setAttribute('aria-selected', on ? 'true' : 'false');
  });
  $('.segmented').dataset.index = tab === 'collection' ? '1' : '0';
  $('#lib-decks').hidden = tab !== 'decks';
  $('#lib-collection').hidden = tab !== 'collection';
  $('#library-scroll').scrollTop = 0;
}

function renderAll() {
  renderDeckChips();
  renderDeckPanel();
  renderDeckPool();
  renderCollection();
}

function buildElementFilter(container, activeFn, onPick) {
  container.innerHTML = `
    <button class="chip" data-el="all" aria-label="All elements">${icon('sparkle')}</button>
    ${Object.entries(ELEMENTS).map(([id, el]) =>
    `<button class="chip" data-el="${id}" aria-label="${el.name}">${icon(el.icon)}</button>`).join('')}`;
  container.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-el]');
    if (!btn) return;
    onPick(btn.dataset.el);
    $$('[data-el]', container).forEach(b => b.classList.toggle('is-active', b.dataset.el === activeFn()));
    sound.play('tap');
    haptic(4);
  });
  const sync = () => $$('[data-el]', container).forEach(b => b.classList.toggle('is-active', b.dataset.el === activeFn()));
  sync();
  container._sync = sync;
}

function renderDeckChips() {
  const p = getProfile();
  const el = $('#deck-chips');
  el.innerHTML = p.decks.map(d => {
    const count = deckCount(d);
    const legal = deckIsLegal(d);
    return `<button class="deck-chip ${d.id === p.activeDeckId ? 'is-active' : ''}" data-deck="${d.id}">
      <span>${esc(d.name)}</span><small>${count}/${DECK_SIZE}${legal ? '' : ' !'}</small>
    </button>`;
  }).join('') + `<button class="deck-chip-add" id="btn-new-deck" aria-label="Create a new deck">${icon('plus')}</button>`;

  $$('.deck-chip', el).forEach(btn => {
    btn.addEventListener('click', () => {
      if (btn.dataset.deck === p.activeDeckId) return;
      setActiveDeck(btn.dataset.deck);
      sound.play('tap');
      haptic(5);
      renderDeckChips();
      renderDeckPanel();
      renderDeckPool();
    });
  });
  $('#btn-new-deck').addEventListener('click', async () => {
    const name = await promptSheet({ title: 'New deck', label: 'Deck name', value: 'My Kombat Deck', placeholder: 'Name your deck', confirm: 'Create' });
    if (!name) return;
    const deck = createDeck(name);
    toast(`“${deck.name}” created.`);
    haptic(10);
    renderDeckChips();
    renderDeckPanel();
    renderDeckPool();
  });
}

function renderDeckPanel() {
  const deck = activeDeck();
  if (!deck) return;
  const count = deckCount(deck);
  const legal = deckIsLegal(deck);
  const entries = deckCardEntries(deck).sort((a, b) => a.card.cost - b.card.cost || a.card.name.localeCompare(b.card.name));
  const p = getProfile();

  $('#deck-name').textContent = deck.name;
  $('#deck-sub').textContent = `${count} of ${DECK_SIZE} cards · ${delegatedElementLabel(deck)}`;
  $('#deck-counter').textContent = `${count} / ${DECK_SIZE}`;
  const validity = $('#deck-validity');
  validity.classList.toggle('is-bad', !legal);
  validity.innerHTML = `${icon(legal ? 'shield' : 'lock')}<span>${legal ? 'Legal' : count < DECK_SIZE ? 'Incomplete' : 'Illegal'}</span>`;

  const curve = deckCurve(deck);
  const max = Math.max(1, ...curve);
  $('#deck-curve').innerHTML = curve.map((n, i) =>
    `<span class="curve-bar"><i style="height:${Math.max(4, (n / max) * 30)}px"></i><em>${i + 1}</em></span>`).join('');

  const avg = count ? entries.reduce((a, e) => a + e.card.cost * e.count, 0) / count : 0;
  $('#deck-avg').textContent = avg ? avg.toFixed(1) : '0';
  $('#deck-units').textContent = count;

  $('#deck-cards').innerHTML = entries.length ? entries.map(({ card, count: n }) => `
    <button class="deck-mini" data-card="${card.id}" aria-label="Remove ${esc(card.name)} from deck">
      ${cardHTML(card, { variant: 'tiny' })}
      <span class="deck-mini-count">×${n}</span>
      <span class="deck-mini-remove">${icon('minus')}</span>
    </button>`).join('') : `<div class="deck-empty">Your deck is empty. Add cards from your collection below.</div>`;

  const playBtn = $('#btn-deck-play');
  playBtn.classList.toggle('is-disabled', !legal);
  playBtn.setAttribute('aria-disabled', legal ? 'false' : 'true');
  $('#btn-deck-delete').style.display = p.decks.length > 1 ? '' : 'none';
}

function delegatedElementLabel(deck) {
  const els = new Set(deckCardEntries(deck).map(e => e.card.element));
  if (!els.size) return 'no element';
  return [...els].map(e => ELEMENTS[e].name).join(' · ');
}

function renderDeckPool() {
  const deck = activeDeck();
  if (!deck) return;
  const q = state.deckSearch;
  const cards = allCards()
    .filter(c => ownedCount(c.id) > 0)
    .filter(c => state.deckEl === 'all' || c.element === state.deckEl)
    .filter(c => !q || c.name.toLowerCase().includes(q) || (KEYWORDS[c.keywords?.[0]]?.name || '').toLowerCase().includes(q))
    .sort((a, b) => a.cost - b.cost || (RARITIES[b.rarity]?.rank || 0) - (RARITIES[a.rarity]?.rank || 0) || a.name.localeCompare(b.name));

  const el = $('#deck-pool');
  el.innerHTML = cards.map(card => {
    const used = deck.cards[card.id] || 0;
    const max = Math.min(card.rarity === 'legendary' ? 1 : 2, ownedCount(card.id));
    const maxed = used >= max || deckCount(deck) >= DECK_SIZE;
    return `<button class="pool-item ${maxed ? 'is-maxed' : ''}" data-card="${card.id}" aria-label="Add ${esc(card.name)} to deck">
      ${cardHTML(card)}
      <span class="pool-add ${maxed ? 'is-owned' : ''}">${maxed ? '✓' : icon('plus')}</span>
      <span class="pool-meta"><span class="owned">${used}/${max} in deck</span>${card.custom ? '<span class="custom-tag">Forged</span>' : `<span>${ownedCount(card.id)} owned</span>`}</span>
    </button>`;
  }).join('');
  $('#deck-pool-empty').hidden = cards.length > 0;
  $('#deck-counter').textContent = `${deckCount(deck)} / ${DECK_SIZE}`;
}

function renderCollection() {
  const q = state.colSearch;
  const mine = getProfile().customCards;
  const cards = allCards()
    .filter(c => ownedCount(c.id) > 0)
    .filter(c => state.colEl === 'all' || c.element === state.colEl)
    .filter(c => !state.colMine || c.custom)
    .filter(c => !q || c.name.toLowerCase().includes(q))
    .sort((a, b) => (RARITIES[b.rarity]?.rank || 0) - (RARITIES[a.rarity]?.rank || 0) || a.cost - b.cost || a.name.localeCompare(b.name));

  $('#collection-count').textContent = `${cards.length} cards · ${cards.reduce((a, c) => a + ownedCount(c.id), 0)} owned${mine.length ? ` · ${mine.length} forged` : ''}`;
  $('#collection-grid').innerHTML = cards.map(card => `
    <button class="pool-item collection-item" data-card="${card.id}" aria-label="View ${esc(card.name)}">
      ${cardHTML(card)}
      <span class="pool-meta">
        <span class="owned">${ownedCount(card.id)} owned</span>
        ${card.custom ? '<span class="custom-tag">Forged</span>' : `<span>${RARITIES[card.rarity]?.name || ''}</span>`}
      </span>
    </button>`).join('');
  $('#collection-empty').hidden = cards.length > 0;
}

function showCardDetail(id) {
  const card = getCard(id);
  if (!card) return;
  const el = ELEMENTS[card.element];
  const rarity = RARITIES[card.rarity] || RARITIES.common;
  const owned = ownedCount(id);
  const deck = activeDeck();
  const inDeck = deck?.cards?.[id] || 0;
  const max = card.rarity === 'legendary' ? 1 : 2;
  const canAdd = inDeck < max && deckCount(deck) < DECK_SIZE && owned > inDeck;
  sound.play('tap');
  openSheet(`
    <div class="detail-wrap">
      <div class="detail-card" id="detail-card">${cardHTML(card, { className: 'card--showcase', flavor: false })}</div>
      <div class="detail-copy">
        <div class="detail-title-row">
          <div><span class="detail-el" style="--el:${el.c1}">${el.name} · ${rarity.name}</span><h3>${esc(card.name)}</h3></div>
          <span class="owned-badge">${owned} owned</span>
        </div>
        <div class="detail-stats">
          <div class="detail-stat"><b>${card.cost}</b><span>Aether</span></div>
          <div class="detail-stat"><b>${card.atk}</b><span>Attack</span></div>
          <div class="detail-stat"><b>${card.hp}</b><span>Health</span></div>
        </div>
        ${card.keywords?.length ? `<div class="detail-kw-list">${card.keywords.map(k => {
    const kw = KEYWORDS[k];
    return `<div class="detail-kw"><span class="kwi" style="color:${kw.color};background:rgba(255,255,255,.05)">${kw.icon}</span><span><b>${kw.name}</b><span>${kw.short}</span></span></div>`;
  }).join('')}</div>` : ''}
        ${card.flavor ? `<p class="detail-flavor">“${esc(card.flavor)}”</p>` : ''}
        <div class="detail-meta">
          <span class="detail-pill">${el.blurb}</span>
          ${card.custom ? '<span class="detail-pill">Forged by you</span>' : '<span class="detail-pill">Starter set</span>'}
          ${inDeck ? `<span class="detail-pill">${inDeck} in ${esc(deck.name)}</span>` : ''}
        </div>
        <div class="detail-actions">
          ${card.custom ? `<button class="btn btn-ghost" data-edit>Edit card</button>` : ''}
          <button class="btn btn-primary" data-add ${canAdd ? '' : 'disabled'} style="${canAdd ? '' : 'opacity:.45'}">
            ${icon('plus')} ${inDeck >= max ? 'Max copies' : deckCount(deck) >= DECK_SIZE ? 'Deck full' : 'Add to deck'}
          </button>
        </div>
      </div>
    </div>`, {
    onMount(sheet) {
      const cardNode = sheet.querySelector('#detail-card .card');
      if (cardNode) mountTilt3d(cardNode, 7);
      const add = sheet.querySelector('[data-add]');
      if (add) add.addEventListener('click', () => {
        const res = addCardToDeck(activeDeck(), id);
        if (!res.ok) { sound.play('deny'); toast(res.reason); return; }
        sound.play('play');
        haptic(8);
        toast(`${card.name} added to ${activeDeck().name}.`);
        closeSheet();
        refreshLibrary();
      });
      const edit = sheet.querySelector('[data-edit]');
      if (edit) edit.addEventListener('click', () => {
        closeSheet();
        hooks.onEdit?.(id);
      });
    }
  });
}

function playActiveDeck() {
  const deck = activeDeck();
  if (!deckIsLegal(deck)) {
    sound.play('deny');
    haptic([8, 40, 8]);
    const count = deckCount(deck);
    toast(count < DECK_SIZE ? `Your deck needs ${DECK_SIZE - count} more cards.` : 'Fix the deck before entering the arena.');
    return;
  }
  sound.play('tap');
  hooks.onPlay?.(deck);
}

async function renameActiveDeck() {
  const deck = activeDeck();
  const name = await promptSheet({ title: 'Rename deck', label: 'Deck name', value: deck.name, confirm: 'Rename' });
  if (!name) return;
  renameDeck(deck.id, name);
  renderDeckChips();
  renderDeckPanel();
  toast('Deck renamed.');
}

async function deleteActiveDeck() {
  const p = getProfile();
  if (p.decks.length <= 1) {
    toast('You must keep at least one deck.');
    return;
  }
  const deck = activeDeck();
  const ok = await confirmSheet({
    title: 'Delete deck?',
    body: `“${esc(deck.name)}” and its card list will be removed. Your collection is untouched.`,
    confirm: 'Delete deck',
    danger: true
  });
  if (!ok) return;
  deleteDeck(deck.id);
  sound.play('deny');
  renderAll();
  toast('Deck deleted.');
}

function showLibraryHelp() {
  openSheet(`
    ${sheetHead('Building a deck', 'Twenty-four cards. Five lanes. One gate.')}
    <div class="sheet-body rules-copy">
      <p>Your deck must contain exactly <b>24 cards</b>, with at most 2 copies of a card (1 if Legendary).</p>
      <p>Tap cards in your collection to add them. Tap a card in your deck strip to remove a copy. <b>Auto-build</b> fills a balanced curve for you.</p>
      <p>Each unit occupies one of five lanes. Units attack the enemy directly opposite. If that lane is empty, they strike the enemy hero.</p>
      <p>Summoned units cannot attack until your next turn unless they have <b>Rush</b>. Newly drawn cards go to your hand — you draw one at the start of every turn.</p>
      <p>Aether grows by one each turn, up to ten. If you run out of cards, fatigue begins to bite.</p>
      <button class="btn btn-primary" data-close style="margin-top:6px">Understood</button>
    </div>`);
}

// Refresh when the forge adds a card.
export function libraryAfterForge() {
  if (!state.ready) return;
  renderDeckChips();
  renderDeckPanel();
  renderDeckPool();
  renderCollection();
}
