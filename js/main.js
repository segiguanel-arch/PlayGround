// Aether Kombat — app boot, navigation, home, profile and settings.

import { ELEMENTS, KEYWORDS, rankFor, STARTER_CARDS } from './data.js';
import {
  loadProfile, getProfile, saveProfile, setPlayerName, hydrateArt, resetProgress,
  activeDeck, deckIsLegal, deckCount, ownedUnique, rank, allCards, getCard, customArtFor
} from './store.js';
import {
  $, $$, esc, icon, cardHTML, toast, openSheet, sheetHead, closeSheet,
  confirmSheet, sound, haptic, initAmbient, onTilt, onShake, setTilt, tiltEnabled,
  restoreTilt, playerAvatar, motionIsIOS, syncSoundSetting, mountTilt3d
} from './ui.js';
import { initLibrary, openLibrary, refreshLibrary } from './library.js';
import { initForge, openForge } from './forge.js';
import { initBattle, startBattle } from './battle.js';

let current = 'home';
let libraryReady = false;
let forgeReady = false;
let battleReady = false;
let homeCardsRendered = false;
let ambient = null;

// ---------------------------------------------------------------------------
// Boot
// ---------------------------------------------------------------------------
async function boot() {
  loadProfile();
  syncSoundSetting();

  try { await hydrateArt(); } catch { /* art is optional */ }

  renderHome();
  setupGlobal();
  initAmbientLayer();
  bindEvents();

  setTimeout(() => $('#boot')?.classList.add('is-hidden'), 500);
  document.addEventListener('pointerdown', () => sound.unlock(), { once: true });

  window.__AETHER__ = {
    ready: true,
    version: '1.0.0',
    getProfile,
    getAllCards: allCards,
    getCard,
    activeDeck,
    startBattle: () => enterBattle(activeDeck()),
    openLibrary: (tab = 'decks') => navigateLibrary(tab),
    openForge: () => navigateForge(),
    rank
  };
}

function setupGlobal() {
  document.addEventListener('pointerdown', () => {
    if (getProfile().settings.sound) sound.unlock();
  }, { passive: true });
  restoreTilt();
  refreshMetaButtons();
}

function initAmbientLayer() {
  const canvas = $('#ambient');
  if (!canvas) return;
  ambient = initAmbient(canvas);
  onTilt(({ x, y }) => ambient?.setTilt?.(x, y));
  onShake(() => {
    if (current !== 'home') return;
    if (!tiltEnabled()) return;
    sound.play('shuffle');
    haptic(18);
    toast('The gate shivers beneath your feet.');
    const cards = $$('.home-card');
    cards.forEach((c, i) => {
      c.animate([
        { transform: c.style.transform || 'none' },
        { transform: 'translateY(-10px) rotate(0deg) scale(1.02)' },
        { transform: c.style.transform || 'none' }
      ], { duration: 700, delay: i * 60, easing: 'ease-out' });
    });
  });
}

// ---------------------------------------------------------------------------
// Home
// ---------------------------------------------------------------------------
function renderHome() {
  const p = getProfile();
  const avatar = playerAvatar(120);
  $('#home-avatar').innerHTML = `<img src="${avatar}" alt="">`;
  $('#home-name').textContent = p.name;
  $('#home-rank').textContent = rankFor(p.wins).name;
  $('#stat-wins').textContent = p.wins;
  $('#stat-losses').textContent = p.losses;
  $('#stat-cards').textContent = ownedUnique();

  const deck = activeDeck();
  const legal = deckIsLegal(deck);
  $('#home-deck-label').textContent = deck ? `${deck.name} · ${deckCount(deck)}/${24} cards${legal ? '' : ' · incomplete'}` : 'No deck ready';
  $('#quick-decks-sub').textContent = `${p.decks.length} deck${p.decks.length === 1 ? '' : 's'}`;
  $('#quick-collection-sub').textContent = `${ownedUnique()} cards · ${p.customCards.length} forged`;

  if (!homeCardsRendered) {
    const showcase = ['pyre-colossus', 'seraph', 'tempest-queen'].map(getCard).filter(Boolean);
    const classes = ['home-card--l', 'home-card--c', 'home-card--r'];
    $('#home-cards').innerHTML = showcase.map((card, i) => `
      <div class="home-card ${classes[i] || 'home-card--c'}">
        ${cardHTML(card, { flavor: false, className: 'card--showcase' })}
      </div>`).join('');
    homeCardsRendered = true;
  }
  refreshMetaButtons();
}

function refreshMetaButtons() {
  const p = getProfile();
  const soundBtn = $('#btn-sound-home');
  soundBtn.setAttribute('aria-pressed', String(!!p.settings.sound));
  soundBtn.querySelector('use').setAttribute('href', p.settings.sound ? '#i-sound' : '#i-mute');
  soundBtn.querySelector('b').textContent = p.settings.sound ? 'On' : 'Off';

  const tiltBtn = $('#btn-tilt-home');
  tiltBtn.setAttribute('aria-pressed', String(tiltEnabled()));
  tiltBtn.querySelector('b').textContent = tiltEnabled() ? 'On' : 'Off';
}

function toggleSound() {
  const p = getProfile();
  p.settings.sound = !p.settings.sound;
  saveProfile();
  sound.enabled = p.settings.sound;
  refreshMetaButtons();
  if (p.settings.sound) { sound.unlock(); sound.play('tap'); }
  toast(p.settings.sound ? 'Sound on.' : 'Sound muted.');
  haptic(5);
}

async function toggleTilt() {
  const next = !tiltEnabled();
  const res = await setTilt(next);
  refreshMetaButtons();
  if (res.ok) {
    toast(res.enabled ? 'Tilt controls on — move your device to shift the arena.' : 'Tilt controls off.');
    haptic(8);
    sound.play(res.enabled ? 'play' : 'tap');
  }
}

// ---------------------------------------------------------------------------
// Navigation
// ---------------------------------------------------------------------------
function showScreen(name) {
  if (current === name) return;
  const prev = $(`#screen-${current}`);
  const next = $(`#screen-${name}`);
  if (!next) return;
  prev?.classList.remove('is-active');
  next.classList.add('is-active');
  current = name;
  closeSheet();
  if (name !== 'battle') document.body.classList.remove('in-battle');
  else document.body.classList.add('in-battle');
}

function goHome() {
  showScreen('home');
  renderHome();
}

function ensureLibrary() {
  if (libraryReady) return;
  initLibrary({
    onPlay: (deck) => enterBattle(deck),
    onForge: () => navigateForge(),
    onEdit: (id) => navigateForge(id)
  });
  libraryReady = true;
}

function navigateLibrary(tab = 'decks') {
  ensureLibrary();
  openLibrary(tab);
  showScreen('library');
  sound.play('tap');
  haptic(4);
}

function ensureForge() {
  if (forgeReady) return;
  initForge({
    onSaved: () => {
      libraryReady && refreshLibrary();
      renderHome();
    }
  });
  forgeReady = true;
}

function navigateForge(cardId = null) {
  ensureForge();
  openForge(cardId);
  showScreen('forge');
  sound.play('tap');
  haptic(4);
}

function ensureBattle() {
  if (battleReady) return;
  initBattle({
    onExit: () => goHome(),
    onResult: () => renderHome()
  });
  battleReady = true;
}

function enterBattle(deck) {
  if (!deck) { toast('Create a deck first.'); navigateLibrary('decks'); return; }
  if (!deckIsLegal(deck)) {
    const n = deckCount(deck);
    toast(n < 24 ? `Your deck needs ${24 - n} more cards.` : 'Your deck is not legal yet.');
    navigateLibrary('decks');
    return;
  }
  ensureBattle();
  showScreen('battle');
  requestAnimationFrame(() => {
    startBattle(deck, {
      onExit: () => goHome(),
      onResult: () => renderHome()
    });
  });
  sound.play('tap');
  haptic(10);
}

// ---------------------------------------------------------------------------
// Sheets
// ---------------------------------------------------------------------------
function showSettings() {
  const p = getProfile();
  const iosNote = motionIsIOS()
    ? '<span>On iPhone and iPad, motion access is requested when you first enable tilt.</span>'
    : '<span>Uses your device accelerometer for a subtle 3D parallax.</span>';
  openSheet(`
    ${sheetHead('Settings', 'Tune the arena to your liking.')}
    <div class="sheet-body">
      <div class="sheet-row">
        <div class="sheet-row-copy"><b>Sound</b><span>Summons, impacts and victory themes.</span></div>
        <button class="switch" id="set-sound" role="switch" aria-checked="${!!p.settings.sound}"></button>
      </div>
      <div class="sheet-row">
        <div class="sheet-row-copy"><b>Haptics</b><span>Short vibrations on plays and hits.</span></div>
        <button class="switch" id="set-haptics" role="switch" aria-checked="${!!p.settings.haptics}"></button>
      </div>
      <div class="sheet-row">
        <div class="sheet-row-copy"><b>Tilt controls</b>${iosNote}</div>
        <button class="switch" id="set-tilt" role="switch" aria-checked="${tiltEnabled()}"></button>
      </div>
      <div class="sheet-row">
        <div class="sheet-row-copy"><b>How to play</b><span>Rules, keywords and touch gestures.</span></div>
        <button class="btn btn-ghost btn-sm" id="set-help">Open</button>
      </div>
      <div class="sheet-row">
        <div class="sheet-row-copy"><b>Reset progress</b><span>Delete your forged cards, decks and record.</span></div>
        <button class="btn btn-ghost btn-sm" id="set-reset" style="color:var(--red);border-color:rgba(255,106,87,.25)">Reset</button>
      </div>
      <div class="about-block">
        <p>AETHER KOMBAT <span>v1.0</span></p>
        <p>Built for touch. Forged offline. Your cards live on this device.</p>
      </div>
      <button class="btn btn-primary" data-close>Done</button>
    </div>`, {
    onMount(sheet) {
      sheet.querySelector('#set-sound').addEventListener('click', (e) => {
        p.settings.sound = !p.settings.sound;
        saveProfile();
        sound.enabled = p.settings.sound;
        e.currentTarget.setAttribute('aria-checked', String(p.settings.sound));
        if (p.settings.sound) { sound.unlock(); sound.play('tap'); }
        refreshMetaButtons();
      });
      sheet.querySelector('#set-haptics').addEventListener('click', (e) => {
        p.settings.haptics = !p.settings.haptics;
        saveProfile();
        e.currentTarget.setAttribute('aria-checked', String(p.settings.haptics));
        if (p.settings.haptics) haptic(14);
      });
      sheet.querySelector('#set-tilt').addEventListener('click', async (e) => {
        e.currentTarget.disabled = true;
        const res = await setTilt(!tiltEnabled());
        e.currentTarget.disabled = false;
        e.currentTarget.setAttribute('aria-checked', String(!!res.ok && res.enabled));
        refreshMetaButtons();
        if (res.ok) toast(res.enabled ? 'Tilt controls enabled.' : 'Tilt controls off.');
      });
      sheet.querySelector('#set-help').addEventListener('click', () => { closeSheet(); setTimeout(showHelp, 220); });
      sheet.querySelector('#set-reset').addEventListener('click', async () => {
        closeSheet();
        setTimeout(async () => {
          const ok = await confirmSheet({
            title: 'Erase everything?',
            body: 'This removes your forged cards and artwork, all decks, and your win record from this device. It cannot be undone.',
            confirm: 'Erase progress',
            danger: true
          });
          if (!ok) return;
          resetProgress();
          syncSoundSetting();
          await setTilt(false);
          homeCardsRendered = false;
          libraryReady = false;
          forgeReady = false;
          if ($('#screen-library').classList.contains('is-active')) {
            ensureLibrary();
            openLibrary('decks');
          }
          if ($('#screen-forge').classList.contains('is-active')) {
            forgeReady = false;
            ensureForge();
            openForge();
          }
          renderHome();
          toast('Progress erased. The gate is quiet again.');
          sound.play('lose');
        }, 220);
      });
    }
  });
}

function showProfile() {
  const p = getProfile();
  const el = p.settings.avatarElement || 'radiant';
  openSheet(`
    ${sheetHead('Your legend', `${rankFor(p.wins).name} · ${p.wins}W / ${p.losses}L`)}
    <div class="sheet-body">
      <div class="profile-hero">
        <div class="profile-avatar-lg" id="profile-avatar-lg"><img src="${playerAvatar(180)}" alt=""></div>
        <div class="profile-hero-copy">
          <label class="mini-label" for="profile-name-input">Combat name</label>
          <input class="text-input" id="profile-name-input" maxlength="18" value="${esc(p.name)}" autocomplete="off">
          <p>${ownedUnique()} unique cards · ${p.customCards.length} forged</p>
        </div>
      </div>
      <div class="field">
        <div class="field-label"><span>Avatar sigil</span><span class="hint">Element of your banner</span></div>
        <div class="element-picker avatar-picker" id="profile-elements">
          ${Object.entries(ELEMENTS).map(([id, e]) => `
            <button type="button" class="el-option ${id === el ? 'is-active' : ''}" data-el="${id}"
              style="--el:${e.c1};--glow:${e.glow}">${icon(e.icon)}<span>${e.name}</span></button>`).join('')}
        </div>
      </div>
      <button class="btn btn-primary" id="profile-save">Save legend</button>
    </div>`, {
    onMount(sheet) {
      let chosen = el;
      sheet.querySelector('#profile-elements').addEventListener('click', (e) => {
        const b = e.target.closest('[data-el]');
        if (!b) return;
        chosen = b.dataset.el;
        $$('.el-option', sheet).forEach(x => x.classList.toggle('is-active', x === b));
        // Preview the avatar immediately.
        import('./art.js').then(({ elementSigil }) => {
          sheet.querySelector('#profile-avatar-lg').innerHTML = `<img src="${elementSigil(chosen, 180)}" alt="">`;
        });
        sound.play('tap');
        haptic(4);
      });
      sheet.querySelector('#profile-save').addEventListener('click', () => {
        const name = setPlayerName(sheet.querySelector('#profile-name-input').value);
        p.settings.avatarElement = chosen;
        saveProfile();
        renderHome();
        closeSheet();
        toast(`The gate knows you as ${name}.`);
        sound.play('play');
        haptic(10);
      });
    }
  });
}

function showHelp() {
  openSheet(`
    ${sheetHead('How to Kombat', 'A tactical duel in five lanes.')}
    <div class="sheet-body rules-copy">
      <p><b>Goal.</b> Break the enemy hero from 30 life to zero. Summon units into five lanes, then strike the opponent opposite.</p>
      <p><b>Turn.</b> You gain one aether each turn (max 10) and draw a card. Tap a hand card, then a glowing lane — or drag it. New units cannot attack until your next turn unless they have Rush.</p>
      <p><b>Combat.</b> Tap a glowing unit to attack the unit opposite. If the lane is empty, the hero takes the hit. Damage is simultaneous. Cleave splashes adjacent lanes; Lifesteal heals your hero; Ward absorbs the first blow.</p>
      <p><b>Deck.</b> Exactly 24 cards, up to 2 copies (1 Legendary). Build decks in the Card Hall. Forge your own units with custom art and stats in the Card Forge.</p>
      <p><b>Touch & tilt.</b> Everything is built for touch. Enable <b>Tilt</b> in Settings or on the home screen for motion parallax. On iOS, motion access is requested the first time you enable it.</p>
      <div class="detail-kw-list">
        ${Object.entries(KEYWORDS).map(([id, kw]) => `
          <div class="detail-kw"><span class="kwi" style="color:${kw.color};background:rgba(255,255,255,.05)">${kw.icon}</span><span><b>${kw.name}</b><span>${kw.short}</span></span></div>`).join('')}
      </div>
      <button class="btn btn-primary" data-close style="margin-top:4px">To the gate</button>
    </div>`);
}

// ---------------------------------------------------------------------------
// Events
// ---------------------------------------------------------------------------
function bindEvents() {
  $('#btn-play').addEventListener('click', () => enterBattle(activeDeck()));
  $('#btn-settings-home').addEventListener('click', () => { sound.play('tap'); showSettings(); });
  $('#btn-help-home').addEventListener('click', () => { sound.play('tap'); showHelp(); });
  $('#btn-profile').addEventListener('click', () => { sound.play('tap'); showProfile(); });
  $('#btn-tilt-home').addEventListener('click', toggleTilt);
  $('#btn-sound-home').addEventListener('click', toggleSound);
  $$('.quick-card[data-nav]').forEach(btn => {
    btn.addEventListener('click', () => {
      const nav = btn.dataset.nav;
      if (nav === 'forge') navigateForge();
      else navigateLibrary(nav === 'collection' ? 'collection' : 'decks');
    });
  });
  $$('[data-back]').forEach(btn => {
    btn.addEventListener('click', () => { sound.play('tap'); goHome(); });
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && $('#sheet-backdrop')?.hidden && current !== 'battle') goHome();
  });
}

// Start
boot().catch(err => {
  console.error(err);
  $('#boot')?.classList.add('is-hidden');
  toast('Something interrupted the summoning. Reload to try again.');
});
