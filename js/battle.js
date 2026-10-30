// Battle UI — lanes, hand gestures, combat choreography and the Ashen Warden AI.

import {
  KEYWORDS, ELEMENTS, RARITIES, RIVAL, RIVAL_DECK, rankFor
} from './data.js';
import {
  getProfile, getCard, deckCardList, recordResult, saveProfile
} from './store.js';
import { Game } from './engine.js';
import { elementSigil } from './art.js';
import {
  $, $$, esc, icon, cardHTML, artFor, toast, openSheet, sheetHead, confirmSheet,
  closeSheet, sound, haptic, flashScreen, floatDamage, burstSparks, aiAvatar,
  setTilt, tiltEnabled, reducedMotion, shakeElement, cardEl, mountTilt3d
} from './ui.js';

const SLOT = 5;
let game = null;
let hooks = { onExit: null, onResult: null };
let deckRef = null;
let selectedHand = -1;
let actionLock = false;
let resultShown = false;
let timers = new Set();
let epoch = 0;
let stats = { turns: 0 };
let ready = false;
let drag = null;
let suppressClick = false;
let feedTimer = 0;

export function initBattle(options = {}) {
  hooks = { ...hooks, ...options };
  if (ready) return;
  ready = true;

  $('#btn-end-turn').addEventListener('click', () => endTurn());
  $('#btn-concede').addEventListener('click', concede);
  $('#btn-battle-help').addEventListener('click', showBattleHelp);
  $('#battle-menu').addEventListener('click', showBattleMenu);
  $('#btn-result-home').addEventListener('click', () => {
    cleanupBattle();
    hooks.onExit?.('home');
  });
  $('#btn-rematch').addEventListener('click', () => {
    if (deckRef) startBattle(deckRef);
  });

  $('#arena').addEventListener('click', onArenaClick);
  $('#hand').addEventListener('pointerdown', onHandPointerDown);
  window.addEventListener('resize', () => { if (game) layoutHand(); }, { passive: true });
  document.addEventListener('keydown', (e) => {
    if (!game || !$('#screen-battle').classList.contains('is-active')) return;
    if (e.key === 'Escape') {
      if (selectedHand >= 0) { selectedHand = -1; renderHand(); }
      else closeSheet();
    }
  });
}

// ---------------------------------------------------------------------------
// Lifecycle
// ---------------------------------------------------------------------------
export function startBattle(deck, options = {}) {
  hooks = { ...hooks, ...options };
  deckRef = deck;
  cleanupBattle();
  hideResult();
  selectedHand = -1;
  actionLock = false;
  resultShown = false;

  const profile = getProfile();
  const playerCards = deckCardList(deck);
  const aiCards = RIVAL_DECK.map(id => getCard(id)).filter(Boolean);
  game = new Game({
    playerName: profile.name,
    playerDeck: playerCards,
    aiName: RIVAL.name,
    aiDeck: aiCards
  });
  game.start();
  stats = { turns: 0 };

  const player = profile;
  $('#battle-ai-name').textContent = RIVAL.name;
  $('#battle-player-name').textContent = player.name;
  $('#battle-player-rank').textContent = rankFor(player.wins).name;
  $('#battle-ai-avatar').innerHTML = `<img src="${aiAvatar(140)}" alt="">`;
  const myAvatar = $('#battle-player-avatar');
  myAvatar.innerHTML = `<img src="${elementSigil(player.settings.avatarElement || 'radiant', 140)}" alt="">`;
  $('#result-overlay').hidden = true;

  renderAll();
  feed(RIVAL.taunts[Math.floor(Math.random() * RIVAL.taunts.length)]);
  sound.play('turn');
  later(160, () => showTurnBanner('Your Turn', false));
  later(300, () => updateTurnUI());
}

export function leaveBattle() {
  cleanupBattle();
}

function cleanupBattle() {
  epoch++;
  timers.forEach(t => clearTimeout(t));
  timers.clear();
  clearTimeout(feedTimer);
  closeSheet();
  document.querySelectorAll('.drag-ghost').forEach(n => n.remove());
  document.querySelectorAll('.hand-card.is-dragging').forEach(n => n.classList.remove('is-dragging'));
  drag = null;
  actionLock = false;
  game = null;
  selectedHand = -1;
}

function later(ms, fn) {
  const e = epoch;
  const t = setTimeout(() => {
    timers.delete(t);
    if (e === epoch) fn();
  }, ms);
  timers.add(t);
  return t;
}

function hideResult() {
  const overlay = $('#result-overlay');
  if (overlay) overlay.hidden = true;
  $('#result-card')?.classList.remove('lose');
}

// ---------------------------------------------------------------------------
// Rendering
// ---------------------------------------------------------------------------
function renderAll() {
  if (!game) return;
  renderHeroes();
  renderBoard('player');
  renderBoard('ai');
  renderHand();
  updateTurnUI();
}

function renderHeroes() {
  if (!game) return;
  const p = game.player, ai = game.ai;
  const pHp = $('#battle-player-hp');
  const aHp = $('#battle-ai-hp');
  pHp.style.width = `${(p.hp / p.maxHp) * 100}%`;
  aHp.style.width = `${(ai.hp / ai.maxHp) * 100}%`;
  pHp.classList.toggle('low', p.hp <= 10);
  aHp.classList.toggle('low', ai.hp <= 10);
  $('#battle-player-hp-text').textContent = p.hp;
  $('#battle-ai-hp-text').textContent = ai.hp;
  $('#battle-ai-hand').textContent = ai.hand.length;
  $('#battle-ai-deck').textContent = ai.deck.length;

  const crystals = $('#mana-crystals');
  crystals.innerHTML = Array.from({ length: 10 }, (_, i) => {
    const filled = i < p.mana;
    const maxed = i < p.maxMana;
    return `<span class="crystal ${filled ? 'is-filled' : maxed ? 'is-max' : 'is-spent'}"></span>`;
  }).join('');
  $('#mana-count').textContent = `${p.mana} / ${p.maxMana}`;
  $('#mana-count').classList.toggle('low', p.mana === 0);
}

function unitHTML(unit, side) {
  const card = unit.card;
  const el = ELEMENTS[card.element] || ELEMENTS.ember;
  const kw = unit.keywords.slice(0, 3).map(k => {
    const def = KEYWORDS[k];
    return `<span class="unit-kw" title="${esc(def.name)}" style="color:${def.color}">${def.icon}</span>`;
  }).join('');
  return `
    <button class="unit ${side} ${unit.canAttack && side === 'player' ? 'is-ready' : ''}"
      data-uid="${unit.uid}" data-lane="${unit.lane}" data-side="${side}"
      style="--el:${el.c1};--el2:${el.c2}" aria-label="${esc(card.name)}, ${unit.atk} attack, ${unit.hp} health">
      <img class="unit-art" src="${artFor(card)}" alt="" draggable="false" decoding="async">
      ${unit.canAttack && side === 'player' ? '<span class="ready-mark">✦</span>' : ''}
      <div class="unit-kws">${kw}</div>
      ${unit.ward ? '<span class="unit-ward"></span>' : ''}
      <div class="unit-stats">
        <span class="u-stat atk">${unit.atk}</span>
        <span class="u-stat hp ${unit.hp < unit.maxHp ? 'damaged' : ''}">${unit.hp}</span>
      </div>
    </button>`;
}

function renderBoard(side) {
  const row = side === 'player' ? $('#board-player') : $('#board-ai');
  const s = game.side(side);
  row.innerHTML = s.board.map((unit, lane) => `
    <div class="lane ${unit ? '' : 'is-empty'} ${side === 'player' ? 'player-lane' : 'enemy-lane'}"
      data-side="${side}" data-lane="${lane}">
      ${unit ? unitHTML(unit, side) : ''}
    </div>`).join('');
}

function handCardClasses(entry, index) {
  const p = game.player;
  const affordable = entry.card.cost <= p.mana;
  const canPlace = game.player.board.some(u => !u);
  const cls = ['hand-card'];
  if (game.state.phase !== 'player' || actionLock || game.over) cls.push('is-disabled');
  if (!affordable) cls.push('is-unaffordable');
  if (affordable && canPlace && game.state.phase === 'player' && !actionLock) cls.push('is-playable');
  if (selectedHand === index) cls.push('is-selected');
  return cls.join(' ');
}

function renderHand() {
  if (!game) return;
  const hand = $('#hand');
  const p = game.player;
  if (!p.hand.length) {
    hand.innerHTML = '<div class="hand-empty">Your hand is empty</div>';
    return;
  }
  hand.innerHTML = p.hand.map((entry, i) => `
    <button class="${handCardClasses(entry, i)}" data-index="${i}" style="z-index:${i + 1}"
      aria-label="Play ${esc(entry.card.name)} for ${entry.card.cost} aether">
      ${cardHTML(entry.card, { flavor: false })}
    </button>`).join('');

  $$('.hand-card', hand).forEach(el => {
    el.addEventListener('click', (e) => { e.stopPropagation(); });
  });
  requestAnimationFrame(layoutHand);
  setTimeout(layoutHand, 60);
}

function layoutHand() {
  if (!game) return;
  const hand = $('#hand');
  const cards = $$('.hand-card', hand);
  if (!cards.length) return;
  const W = hand.clientWidth;
  const cw = cards[0].offsetWidth || 92;
  const n = cards.length;
  const step = n > 1 ? Math.min(cw * 0.7, (W - cw - 10) / (n - 1)) : 0;
  const mid = (n - 1) / 2;
  cards.forEach((card, i) => {
    const offset = (i - mid) * step;
    const rot = (i - mid) * Math.min(4.2, 20 / Math.max(n, 1));
    const y = Math.abs(i - mid) * 2.2;
    const selected = i === selectedHand;
    card.style.transform = `translateX(calc(-50% + ${offset}px)) rotate(${rot}deg) translateY(${selected ? -22 : y}px) scale(${selected ? 1.06 : 1})`;
    card.style.zIndex = selected ? 30 : i + 1;
  });
}

function updateTurnUI() {
  if (!game) return;
  const pill = $('#turn-pill');
  const phase = game.state.phase;
  pill.classList.remove('enemy', 'over');
  if (game.over) {
    pill.classList.add('over');
    pill.querySelector('span').textContent = 'Duel ended';
  } else if (phase === 'ai') {
    pill.classList.add('enemy');
    pill.querySelector('span').textContent = 'Enemy turn';
  } else {
    pill.querySelector('span').textContent = 'Your turn';
  }

  const endBtn = $('#btn-end-turn');
  const waiting = phase !== 'player' || actionLock || game.over;
  endBtn.classList.toggle('is-waiting', waiting);
  endBtn.disabled = waiting;
  const canAct = game.playableHand('player').some(p => p.affordable) || game.readyCount('player') > 0;
  endBtn.classList.toggle('is-pulse', !waiting && !canAct);

  const hint = $('#battle-hint');
  if (game.over) hint.textContent = 'The gate has decided.';
  else if (phase === 'ai') hint.textContent = 'The Ashen Warden is plotting…';
  else if (selectedHand >= 0) hint.textContent = 'Tap a glowing lane to summon.';
  else if (game.readyCount('player') > 0) hint.textContent = `${game.readyCount('player')} unit${game.readyCount('player') > 1 ? 's' : ''} ready to strike.`;
  else if (game.player.mana > 0) hint.textContent = 'Tap a card, then choose a lane.';
  else hint.textContent = 'Tap a ready unit to strike, then end your turn.';

  $$('#hand .hand-card').forEach((el, i) => {
    const entry = game.player.hand[i];
    if (!entry) return;
    el.className = handCardClasses(entry, i);
    if (el.classList.contains('is-selected')) el.style.zIndex = 30;
  });
  layoutHand();
}

function feed(text) {
  const el = $('#battle-feed');
  if (!el || !text) return;
  el.textContent = text;
  el.classList.add('is-fresh');
  clearTimeout(feedTimer);
  feedTimer = setTimeout(() => el.classList.remove('is-fresh'), 2800);
}

function showTurnBanner(text, enemy = false) {
  const banner = $('#turn-banner');
  banner.classList.remove('is-show', 'enemy');
  if (enemy) banner.classList.add('enemy');
  banner.querySelector('span').textContent = text;
  void banner.offsetWidth;
  banner.classList.add('is-show');
}

// ---------------------------------------------------------------------------
// Interaction
// ---------------------------------------------------------------------------
function onArenaClick(e) {
  if (!game || suppressClick) return;
  const unitEl = e.target.closest('.unit');
  if (unitEl) {
    const side = unitEl.dataset.side;
    const lane = Number(unitEl.dataset.lane);
    if (side === 'player') {
      if (game.state.phase !== 'player') {
        toast('Wait for your turn.');
        return;
      }
      const unit = game.player.board[lane];
      if (!unit) return;
      if (!unit.canAttack) {
        sound.play('deny');
        toast(unit.card.keywords?.includes('rush') ? 'That unit has already struck.' : 'Summoned units strike next turn.');
        return;
      }
      if (selectedHand >= 0) { selectedHand = -1; updateTurnUI(); }
      attackLane('player', lane);
    } else {
      showUnitCard(side, lane);
    }
    return;
  }
  const laneEl = e.target.closest('.lane');
  if (laneEl && laneEl.dataset.side === 'player') {
    if (selectedHand >= 0) {
      playFromHand(selectedHand, Number(laneEl.dataset.lane));
    }
  }
}

function onHandPointerDown(e) {
  if (!game) return;
  const card = e.target.closest('.hand-card');
  if (!card) return;
  if (game.state.phase !== 'player' || actionLock || game.over) {
    sound.play('deny');
    toast('You cannot play cards right now.');
    return;
  }
  const index = Number(card.dataset.index);
  const entry = game.player.hand[index];
  if (!entry) return;
  e.preventDefault();
  const rect = card.getBoundingClientRect();
  drag = {
    index, card, entry, startX: e.clientX, startY: e.clientY,
    moved: false, ghost: null, rect, pointerId: e.pointerId, lane: -1
  };
  window.addEventListener('pointermove', onHandPointerMove, { passive: false });
  window.addEventListener('pointerup', onHandPointerUp);
  window.addEventListener('pointercancel', onHandPointerUp);
}

function onHandPointerMove(e) {
  if (!drag) return;
  const dx = e.clientX - drag.startX;
  const dy = e.clientY - drag.startY;
  if (!drag.moved && Math.hypot(dx, dy) < 7) return;
  if (!drag.moved) {
    drag.moved = true;
    selectionClear();
    drag.card.classList.add('is-dragging');
    drag.card.style.opacity = '0.25';
    const ghost = drag.card.querySelector('.card').cloneNode(true);
    ghost.classList.add('drag-ghost');
    ghost.style.width = drag.rect.width + 'px';
    ghost.style.height = drag.rect.height + 'px';
    document.body.appendChild(ghost);
    drag.ghost = ghost;
    sound.play('select');
    haptic(4);
  }
  e.preventDefault();
  if (drag.ghost) {
    drag.ghost.style.left = `${e.clientX - drag.rect.width / 2}px`;
    drag.ghost.style.top = `${e.clientY - drag.rect.height / 2}px`;
  }
  const under = document.elementFromPoint(e.clientX, e.clientY);
  const laneEl = under?.closest?.('.lane');
  clearLaneHighlights();
  if (laneEl && laneEl.dataset.side === 'player') {
    const lane = Number(laneEl.dataset.lane);
    if (!game.player.board[lane] && drag.entry.card.cost <= game.player.mana) {
      drag.lane = lane;
      laneEl.classList.add('is-target');
    } else {
      drag.lane = -1;
    }
  } else {
    drag.lane = -1;
  }
}

function onHandPointerUp(e) {
  window.removeEventListener('pointermove', onHandPointerMove);
  window.removeEventListener('pointerup', onHandPointerUp);
  window.removeEventListener('pointercancel', onHandPointerUp);
  if (!drag) return;
  const d = drag;
  drag = null;
  if (d.ghost) d.ghost.remove();
  d.card.classList.remove('is-dragging');
  d.card.style.opacity = '';
  clearLaneHighlights();

  if (d.moved) {
    suppressClick = true;
    setTimeout(() => { suppressClick = false; }, 120);
    if (d.lane >= 0) {
      playFromHand(d.index, d.lane);
    } else {
      sound.play('deny');
      haptic(6);
      toast('Drop a unit into an empty lane it can afford.');
      renderHand();
    }
    return;
  }

  // A tap toggles selection.
  if (selectedHand === d.index) {
    selectedHand = -1;
    sound.play('tap');
  } else {
    if (d.entry.card.cost > game.player.mana) {
      sound.play('deny');
      haptic([6, 30, 6]);
      toast(`This card needs ${d.entry.card.cost} aether. You have ${game.player.mana}.`);
      return;
    }
    if (!game.player.board.some(u => !u)) {
      sound.play('deny');
      toast('Every lane is occupied. Attack to clear space.');
      return;
    }
    selectedHand = d.index;
    sound.play('select');
    haptic(5);
  }
  renderHand();
  highlightSelectedLanes();
  updateTurnUI();
}

function highlightSelectedLanes() {
  clearLaneHighlights();
  if (selectedHand < 0 || !game) return;
  const entry = game.player.hand[selectedHand];
  if (!entry || entry.card.cost > game.player.mana) return;
  $$('#board-player .lane').forEach((laneEl, i) => {
    if (!game.player.board[i]) laneEl.classList.add('is-target');
  });
}

function clearLaneHighlights() {
  $$('.lane.is-target').forEach(el => el.classList.remove('is-target'));
}

function selectionClear() {
  selectedHand = -1;
}

// ---------------------------------------------------------------------------
// Play / attack
// ---------------------------------------------------------------------------
function playFromHand(index, lane) {
  if (!game || actionLock || game.over) return;
  if (game.state.phase !== 'player') { toast('Wait for your turn.'); return; }
  const entry = game.player.hand[index];
  if (!entry) return;
  if (game.player.board[lane]) { sound.play('deny'); toast('That lane is occupied.'); return; }
  if (entry.card.cost > game.player.mana) { sound.play('deny'); toast('Not enough aether.'); return; }

  actionLock = true;
  const cardEls = $$('#hand .hand-card');
  const sourceRect = cardEls[index]?.getBoundingClientRect() || null;
  const targetLaneRect = $(`#board-player .lane[data-lane="${lane}"]`)?.getBoundingClientRect() || null;
  const res = game.playCard('player', index, lane);
  if (!res.ok) {
    actionLock = false;
    sound.play('deny');
    toast(res.reason || 'That card cannot be played.');
    return;
  }
  selectedHand = -1;
  sound.play('play');
  haptic([5, 20, 5]);
  renderAll();
  animateSummon(res.unit.uid, sourceRect, 'player');
  feed(game.feed[game.feed.length - 1]?.text || '');
  if (res.blast) {
    const target = res.blast.target === 'unit'
      ? $(`#board-ai .unit[data-uid="${res.blast.uid}"]`)
      : $('#battle-ai-avatar');
    later(280, () => {
      if (!target) return;
      const r = target.getBoundingClientRect();
      floatDamage(r.left + r.width / 2, r.top + 8, `-${res.blast.damage}`, 'damage');
      burstSparks(r.left + r.width / 2, r.top + r.height / 2, '#ffd36e', 12);
      if (res.blast.died) shakeElement(target, 'is-dying');
      haptic(12);
    });
  }
  later(640, () => {
    actionLock = false;
    renderAll();
    if (game.over) maybeFinish();
  });
}

function animateSummon(uid, fromRect, side) {
  const unitEl = $(`#board-${side} .unit[data-uid="${uid}"]`);
  if (!unitEl) return;
  if (!fromRect || reducedMotion) return;
  const to = unitEl.getBoundingClientRect();
  const dx = fromRect.left - to.left;
  const dy = fromRect.top - to.top;
  unitEl.animate([
    { transform: `translate(${dx}px, ${dy}px) scale(.55)`, opacity: .25, filter: 'brightness(1.8)' },
    { transform: 'translate(0,0) scale(1)', opacity: 1, filter: 'brightness(1)' }
  ], { duration: 340, easing: 'cubic-bezier(.18,.8,.25,1)' });
  burstSparks(to.left + to.width / 2, to.top + to.height / 2, '#ffe0a8', 7);
}

function attackLane(side, lane) {
  if (!game || actionLock || game.over) return;
  const unit = game.side(side).board[lane];
  if (!unit || !unit.canAttack) return;
  actionLock = true;
  const attackerEl = $(`#board-${side} .unit[data-uid="${unit.uid}"]`);
  const other = side === 'player' ? 'ai' : 'player';
  const defender = game.side(other).board[lane];
  const defenderEl = defender ? $(`#board-${other} .unit[data-uid="${defender.uid}"]`) : null;
  const heroEl = side === 'player' ? $('#battle-ai-avatar') : $('#battle-player-avatar');

  const res = game.attack(side, lane);
  if (!res.ok) {
    actionLock = false;
    sound.play('deny');
    toast(res.reason || 'That unit cannot attack.');
    return;
  }

  sound.play('attack');
  haptic(side === 'player' ? [8, 18, 8] : 6);
  if (attackerEl) {
    attackerEl.style.setProperty('--lunge-y', side === 'player' ? '-22px' : '22px');
    attackerEl.classList.add('is-attacking');
  }

  later(180, () => {
    if (res.kind === 'hero') {
      const r = heroEl.getBoundingClientRect();
      floatDamage(r.left + r.width / 2, r.top + r.height / 2, `-${res.heroDamage}`, 'damage');
      burstSparks(r.left + r.width / 2, r.top + r.height / 2, side === 'player' ? '#ff9c6e' : '#ff5a6e', 11);
      if (side === 'ai') {
        flashScreen();
        shakeElement($('.hero-mini'), 'is-hit');
        haptic(20);
      }
      sound.play('hit');
    } else if (defenderEl) {
      const r = defenderEl.getBoundingClientRect();
      if (res.wardDefender) {
        floatDamage(r.left + r.width / 2, r.top + 10, 'WARD', 'heal');
        burstSparks(r.left + r.width / 2, r.top + r.height / 2, '#7ad7ff', 10);
      } else {
        floatDamage(r.left + r.width / 2, r.top + 8, `-${res.damageToDefender}`, 'damage');
        defenderEl.classList.add('is-hit');
        burstSparks(r.left + r.width / 2, r.top + r.height / 2, '#ffcf8a', 10);
      }
      if (res.defenderDied) defenderEl.classList.add('is-dying');
      if (res.cleave?.length) {
        res.cleave.forEach((c, i) => {
          const el = $(`#board-${other} .unit[data-uid="${c.uid}"]`);
          if (el) {
            const cr = el.getBoundingClientRect();
            later(120 + i * 80, () => {
              floatDamage(cr.left + cr.width / 2, cr.top + 8, `-${c.damage}`, 'damage');
              el.classList.add('is-hit');
            });
          }
        });
      }
      if (res.attackerDied && attackerEl) attackerEl.classList.add('is-dying');
      if (res.healed > 0) {
        const healer = side === 'player' ? $('#battle-player-avatar') : $('#battle-ai-avatar');
        const pr = healer.getBoundingClientRect();
        floatDamage(pr.left + pr.width / 2, pr.top + pr.height / 2, `+${res.healed}`, 'heal');
      }
      sound.play('hit');
    }
  });

  later(660, () => {
    actionLock = false;
    renderAll();
    feed(game.feed[game.feed.length - 1]?.text || '');
    if (game.over) maybeFinish();
  });
}

// ---------------------------------------------------------------------------
// Turn flow / AI
// ---------------------------------------------------------------------------
function endTurn() {
  if (!game || actionLock || game.over) return;
  if (game.state.phase !== 'player') return;
  actionLock = true;
  selectedHand = -1;
  sound.play('tap');
  haptic(8);
  game.endTurn('player');
  renderAll();
  if (game.over) { maybeFinish(); return; }
  showTurnBanner('Enemy Turn', true);
  sound.play('turn');
  later(950, () => {
    actionLock = false;
    updateTurnUI();
    runAI();
  });
}

function chooseAiPlay() {
  if (!game || game.state.phase !== 'ai') return null;
  const plays = game.playableHand('ai').filter(p => p.lanes.length);
  if (!plays.length) return null;
  let best = null;
  for (const p of plays) {
    for (const lane of p.lanes) {
      const foe = game.player.board[lane];
      let score = p.card.cost * 1.6 + p.card.atk * 0.7 + p.card.hp * 0.55 + (p.card.keywords?.length || 0) * 2.2;
      if (foe) {
        score += 2 + Math.min(foe.atk, 6) * 0.5;
        if (p.card.keywords.includes('ward')) score += 2.2;
        if (p.card.keywords.includes('blast') && foe.hp <= 2) score += 6;
        if (p.card.keywords.includes('rush') && p.card.atk >= foe.hp) score += 3;
        if (p.card.hp <= foe.atk && p.card.atk < foe.hp) score -= 4;
        if (p.card.atk >= foe.hp) score += 1.5;
      } else {
        score += p.card.keywords.includes('rush') ? 4 : 0.5;
        // Prefer pressuring the hero when the opponent's board is thin.
        if (game.player.board.filter(Boolean).length < 2) score += 1.5;
      }
      score += Math.random() * 2.4;
      if (!best || score > best.score) best = { ...p, lane, score };
    }
  }
  return best;
}

function shouldAiAttack(lane) {
  const unit = game.ai.board[lane];
  if (!unit) return false;
  const foe = game.player.board[lane];
  if (!foe) return true;
  const kills = unit.atk >= foe.hp;
  const dies = foe.atk >= unit.hp;
  if (kills && !dies) return true;
  if (kills && dies) {
    if (game.player.hp <= 8) return true;
    return (foe.card.cost || 0) >= (unit.card.cost || 0);
  }
  if (!kills && dies) return false;
  if (foe.hp - unit.atk <= 2) return true;
  if (unit.keywords.includes('lifesteal') && unit.atk >= 2) return true;
  return false;
}

function runAI() {
  if (!game || game.over) return;
  if (game.state.phase !== 'ai') return;
  const play = chooseAiPlay();
  if (play) {
    actionLock = true;
    later(420, () => {
      if (!game || game.over) return;
      const res = game.playCard('ai', play.index, play.lane);
      if (!res.ok) {
        actionLock = false;
        aiAttacks();
        return;
      }
      sound.play('play');
      renderAll();
      animateSummon(res.unit.uid, null, 'ai');
      feed(game.feed[game.feed.length - 1]?.text || '');
      if (res.blast) {
        const target = res.blast.target === 'unit'
          ? $(`#board-player .unit[data-uid="${res.blast.uid}"]`)
          : $('#battle-player-avatar');
        later(260, () => {
          if (!target) return;
          const r = target.getBoundingClientRect();
          floatDamage(r.left + r.width / 2, r.top + 8, `-${res.blast.damage}`, 'damage');
          burstSparks(r.left + r.width / 2, r.top + r.height / 2, '#ffd36e', 12);
          haptic(10);
        });
      }
      later(600, () => {
        actionLock = false;
        renderAll();
        if (game.over) maybeFinish();
        else runAI();
      });
    });
    return;
  }
  aiAttacks();
}

function aiAttacks() {
  if (!game || game.over || game.state.phase !== 'ai') return;
  const lanes = game.ai.board.map((u, i) => (u && u.canAttack ? i : -1)).filter(i => i >= 0);
  let idx = 0;
  const next = () => {
    if (!game || game.over) return;
    if (idx >= lanes.length) { finishAiTurn(); return; }
    const lane = lanes[idx++];
    const unit = game.ai.board[lane];
    if (!unit || !unit.canAttack || !shouldAiAttack(lane)) { next(); return; }
    later(420, () => {
      if (!game || game.over) { return; }
      attackLane('ai', lane);
      later(760, () => {
        if (!game || game.over) return;
        actionLock = false;
        next();
      });
    });
  };
  next();
}

function finishAiTurn() {
  if (!game || game.over) return;
  actionLock = true;
  later(350, () => {
    game.endTurn('ai');
    renderAll();
    if (game.over) { maybeFinish(); return; }
    showTurnBanner('Your Turn', false);
    sound.play('turn');
    feed('Your turn. The gate is yours to take.');
    later(650, () => {
      actionLock = false;
      updateTurnUI();
    });
  });
}

function maybeFinish() {
  if (!game || !game.over || resultShown) return;
  resultShown = true;
  actionLock = true;
  later(750, showResult);
}

function showResult() {
  if (!game) return;
  const won = game.state.winner === 'player';
  const draw = game.state.winner === 'draw';
  const profile = getProfile();
  recordResult(won);
  saveProfile();
  stats.turns = game.state.round;
  hooks.onResult?.({ won, draw });

  const overlay = $('#result-overlay');
  const card = $('#result-card');
  card.classList.toggle('lose', !won);
  $('#result-eyebrow').textContent = draw ? 'A hollow end' : won ? 'The gate yields' : 'The gate holds';
  $('#result-title').textContent = draw ? 'Draw' : won ? 'Victory' : 'Defeat';
  $('#result-copy').textContent = draw
    ? 'Both souls fall together. The gate keeps its secrets.'
    : won
      ? `${RIVAL.name} falls. Your name is carved into the ninth gate.`
      : `${RIVAL.name} takes the gate. The ash remembers your name — for now.`;
  $('#result-stats').innerHTML = `
    <div class="result-stat"><b>${stats.turns}</b><span>Rounds</span></div>
    <div class="result-stat"><b>${game.player.hp}</b><span>Life left</span></div>
    <div class="result-stat"><b>${game.player.deck.length}</b><span>Cards left</span></div>`;
  overlay.hidden = false;
  sound.play(won ? 'win' : 'lose');
  haptic(won ? [12, 40, 12, 40, 24] : [24, 60, 24]);
}

// ---------------------------------------------------------------------------
// Menus / sheets
// ---------------------------------------------------------------------------
function showBattleMenu() {
  if (!game) return;
  const profile = getProfile();
  openSheet(`
    ${sheetHead('Battle menu', `Round ${game.state.round} · ${activeDeckName()}`)}
    <div class="sheet-body">
      <div class="sheet-row">
        <div class="sheet-row-copy"><b>Sound</b><span>Combat impacts, summons and score.</span></div>
        <button class="switch" id="menu-sound" role="switch" aria-checked="${!!profile.settings.sound}"></button>
      </div>
      <div class="sheet-row">
        <div class="sheet-row-copy"><b>Tilt controls</b><span>Parallax the arena with device motion.</span></div>
        <button class="switch" id="menu-tilt" role="switch" aria-checked="${tiltEnabled()}"></button>
      </div>
      <div class="sheet-row">
        <div class="sheet-row-copy"><b>Combat rules</b><span>Lanes, keywords, aether and fatigue.</span></div>
        <button class="btn btn-ghost btn-sm" id="menu-rules">Open</button>
      </div>
      <div class="sheet-row">
        <div class="sheet-row-copy"><b>Leave duel</b><span>Conceding counts as a defeat.</span></div>
        <button class="btn btn-ghost btn-sm" id="menu-leave">Leave</button>
      </div>
      <button class="btn btn-primary" data-close style="margin-top:4px">Resume</button>
    </div>`, {
    onMount(sheet) {
      sheet.querySelector('#menu-sound').addEventListener('click', (e) => {
        profile.settings.sound = !profile.settings.sound;
        sound.enabled = profile.settings.sound;
        saveProfile();
        e.currentTarget.setAttribute('aria-checked', String(profile.settings.sound));
        sound.play('tap');
      });
      sheet.querySelector('#menu-tilt').addEventListener('click', async (e) => {
        const btn = e.currentTarget;
        btn.disabled = true;
        const result = await setTilt(!tiltEnabled());
        btn.disabled = false;
        btn.setAttribute('aria-checked', String(!!result.ok && result.enabled));
        if (result.ok) toast(result.enabled ? 'Tilt controls enabled.' : 'Tilt controls off.');
      });
      sheet.querySelector('#menu-rules').addEventListener('click', () => { closeSheet(); setTimeout(showBattleHelp, 220); });
      sheet.querySelector('#menu-leave').addEventListener('click', async () => {
        closeSheet();
        setTimeout(async () => {
          const ok = await confirmSheet({
            title: 'Concede and leave?',
            body: 'The duel will count as a defeat. Your deck and collection are safe.',
            confirm: 'Concede',
            danger: true
          });
          if (!ok) return;
          if (game) game.concede();
          recordResult(false);
          cleanupBattle();
          hooks.onExit?.('home');
          toast('You left the duel.');
        }, 220);
      });
    }
  });
}

function activeDeckName() {
  return deckRef?.name || 'Kombat Deck';
}

function showBattleHelp() {
  openSheet(`
    ${sheetHead('How to Kombat', 'Five lanes. One hero. No retreat.')}
    <div class="sheet-body rules-copy">
      <p><b>Summon.</b> Tap a card in your hand, then tap a glowing lane. Or drag the card straight into a lane. Each unit occupies one lane.</p>
      <p><b>Strike.</b> Tap one of your glowing units to attack the enemy directly opposite. If that lane is empty, the blow hits the enemy hero instead.</p>
      <p><b>Aether.</b> You gain one maximum aether each turn, up to ten. It refills at the start of your turn. Unspent aether is lost.</p>
      <p><b>Summoning sickness.</b> New units cannot attack until your next turn unless they have Rush.</p>
      <p><b>Fatigue.</b> Drawing from an empty deck deals growing damage to your hero. End the duel before the deck runs dry.</p>
      <div class="detail-kw-list" style="margin-top:2px">
        ${Object.entries(KEYWORDS).map(([id, kw]) => `
          <div class="detail-kw"><span class="kwi" style="color:${kw.color};background:rgba(255,255,255,.05)">${kw.icon}</span><span><b>${kw.name}</b><span>${kw.short}</span></span></div>`).join('')}
      </div>
      <button class="btn btn-primary" data-close style="margin-top:4px">Return to battle</button>
    </div>`);
}

async function concede() {
  if (!game) return;
  const ok = await confirmSheet({
    title: 'Concede the duel?',
    body: 'This counts as a defeat and ends the match immediately.',
    confirm: 'Concede',
    danger: true
  });
  if (!ok || !game) return;
  game.concede();
  renderAll();
  maybeFinish();
}

function showUnitCard(side, lane) {
  const unit = game.side(side).board[lane];
  if (!unit) return;
  const card = unit.card;
  const el = ELEMENTS[card.element];
  const rarity = RARITIES[card.rarity] || RARITIES.common;
  sound.play('tap');
  openSheet(`
    <div class="detail-wrap">
      <div class="detail-card">${cardHTML(card, { className: 'card--showcase', flavor: false })}</div>
      <div class="detail-copy">
        <div class="detail-title-row">
          <div><span class="detail-el" style="--el:${el.c1}">${el.name} · ${rarity.name}</span><h3>${esc(card.name)}</h3></div>
          <span class="owned-badge">Lane ${lane + 1}</span>
        </div>
        <div class="detail-stats">
          <div class="detail-stat"><b>${unit.atk}</b><span>Attack</span></div>
          <div class="detail-stat"><b>${unit.hp}/${unit.maxHp}</b><span>Health</span></div>
          <div class="detail-stat"><b>${unit.canAttack ? 'Ready' : 'Resting'}</b><span>Status</span></div>
        </div>
        ${unit.ward ? `<div class="detail-kw"><span class="kwi" style="color:#7ad7ff;background:rgba(255,255,255,.05)">◇</span><span><b>Ward active</b><span>Negates the next damage it takes.</span></span></div>` : ''}
        ${card.keywords?.length ? `<div class="detail-kw-list">${card.keywords.map(k => {
    const kw = KEYWORDS[k];
    return `<div class="detail-kw"><span class="kwi" style="color:${kw.color};background:rgba(255,255,255,.05)">${kw.icon}</span><span><b>${kw.name}</b><span>${kw.short}</span></span></div>`;
  }).join('')}</div>` : ''}
        ${card.flavor ? `<p class="detail-flavor">“${esc(card.flavor)}”</p>` : ''}
        <button class="btn btn-primary" data-close>Close</button>
      </div>
    </div>`);
}
