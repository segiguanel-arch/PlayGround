// Shared UI helpers: icons, cards, sheets, toasts, sound, haptics, ambient, tilt.

import { ELEMENTS, KEYWORDS, RARITIES } from './data.js';
import { generateCardArt, elementSigil } from './art.js';
import { getProfile, saveProfile, customArtFor } from './store.js';

export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
export const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));
export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export function icon(name, cls = 'ic') {
  return `<svg class="${cls}" aria-hidden="true"><use href="#i-${name}"/></svg>`;
}

export const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// ---------------------------------------------------------------------------
// Cards
// ---------------------------------------------------------------------------
export function artFor(card) {
  return customArtFor(card.id) || generateCardArt(card);
}

export function cardHTML(card, opts = {}) {
  const el = ELEMENTS[card.element] || ELEMENTS.ember;
  const rarity = RARITIES[card.rarity] || RARITIES.common;
  const variant = opts.variant ? ` card--${opts.variant}` : '';
  const keywords = (card.keywords || []).filter(k => KEYWORDS[k]);
  const kwHtml = keywords.length ? `
    <div class="card-keywords">
      ${keywords.map(k => {
    const kw = KEYWORDS[k];
    return `<span class="card-kw" style="--kwc:${kw.color}"><span class="kwi">${esc(kw.icon)}</span><span class="kwlabel">${esc(kw.name)}</span></span>`;
  }).join('')}
    </div>` : '';
  const flavor = opts.flavor && card.flavor ? `<p class="card-flavor">${esc(card.flavor)}</p>` : '';
  const art = opts.art || artFor(card);
  return `
  <article class="card${variant}${opts.className ? ' ' + opts.className : ''}"
    data-el="${card.element}" data-rarity="${card.rarity || 'common'}"
    style="--el:${el.c1};--el2:${el.c2};--deep:${el.deep};--glow:${el.glow}"
    aria-label="${esc(card.name)}, ${el.name} ${rarity.name}, ${card.cost} aether, ${card.atk} attack, ${card.hp} health">
    <img class="card-art" src="${art}" alt="" draggable="false" decoding="async">
    <div class="card-glow"></div>
    <div class="card-tint"></div>
    <div class="card-sheen"></div>
    <div class="card-cost">${card.cost}</div>
    <span class="card-rarity-gem" style="--rarity:${rarity.color}" title="${rarity.name}"></span>
    <div class="card-nameplate">
      <div class="card-name">${esc(card.name)}</div>
      <div class="card-type">${icon(el.icon)}<span>${el.name} · ${rarity.name}</span></div>
    </div>
    ${kwHtml}
    ${flavor}
    <div class="card-bottom">
      <div class="stat-hex atk">
        <span class="stat-ic">${icon('sword')}</span>
        <span class="stat-num">${card.atk}</span>
      </div>
      <div class="card-bottom-mid">
        <span class="card-element-emblem">${icon(el.icon)}</span>
      </div>
      <div class="stat-hex hp">
        <span class="stat-ic stat-heart">♥</span>
        <span class="stat-num">${card.hp}</span>
      </div>
    </div>
  </article>`;
}

export function cardEl(card, opts = {}) {
  const wrap = document.createElement('div');
  wrap.innerHTML = cardHTML(card, opts).trim();
  const el = wrap.firstElementChild;
  if (opts.tilt) mountTilt3d(el);
  return el;
}

export function mountTilt3d(el, max = 9) {
  let raf = 0;
  const move = (e) => {
    if (e.pointerType === 'touch') return;
    const r = el.getBoundingClientRect();
    const px = (e.clientX - r.left) / r.width - 0.5;
    const py = (e.clientY - r.top) / r.height - 0.5;
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(() => {
      el.style.transform = `perspective(800px) rotateX(${(-py * max).toFixed(2)}deg) rotateY(${(px * max).toFixed(2)}deg) translateY(-2px)`;
      el.style.setProperty('--mx', `${(px * 100 + 50).toFixed(1)}%`);
    });
  };
  const leave = () => {
    cancelAnimationFrame(raf);
    el.style.transform = '';
  };
  el.addEventListener('pointermove', move);
  el.addEventListener('pointerleave', leave);
  el.addEventListener('pointercancel', leave);
}

export function keywordChipHTML(id) {
  const kw = KEYWORDS[id];
  if (!kw) return '';
  return `<span class="card-kw" style="--kwc:${kw.color}"><span class="kwi">${esc(kw.icon)}</span><span class="kwlabel">${esc(kw.name)}</span></span>`;
}

// ---------------------------------------------------------------------------
// Toasts
// ---------------------------------------------------------------------------
export function toast(message, ms = 2300) {
  const root = $('#toast-root');
  if (!root) return;
  const node = document.createElement('div');
  node.className = 'toast';
  node.textContent = message;
  root.appendChild(node);
  while (root.children.length > 3) root.firstElementChild.remove();
  setTimeout(() => {
    node.classList.add('is-out');
    setTimeout(() => node.remove(), 250);
  }, ms);
}

// ---------------------------------------------------------------------------
// Sheets
// ---------------------------------------------------------------------------
let sheetCloseTimer = 0;
let lastFocus = null;

export function openSheet(html, { onMount, className = '' } = {}) {
  const backdrop = $('#sheet-backdrop');
  const sheet = $('#sheet');
  if (!backdrop || !sheet) return;
  clearTimeout(sheetCloseTimer);
  lastFocus = document.activeElement;
  backdrop.hidden = false;
  backdrop.classList.remove('is-closing');
  sheet.className = 'sheet' + (className ? ' ' + className : '');
  sheet.innerHTML = html;
  $$('[data-close]', sheet).forEach(btn => btn.addEventListener('click', closeSheet));
  if (onMount) onMount(sheet);
  backdrop.onclick = (e) => { if (e.target === backdrop) closeSheet(); };
  setTimeout(() => {
    const focusable = sheet.querySelector('input, button, [tabindex]');
    if (focusable && window.matchMedia('(hover: hover)').matches) focusable.focus({ preventScroll: true });
  }, 60);
  return sheet;
}

export function closeSheet() {
  const backdrop = $('#sheet-backdrop');
  if (!backdrop || backdrop.hidden) return;
  backdrop.classList.add('is-closing');
  clearTimeout(sheetCloseTimer);
  sheetCloseTimer = setTimeout(() => {
    backdrop.hidden = true;
    backdrop.classList.remove('is-closing');
    if (lastFocus && lastFocus.focus) lastFocus.focus({ preventScroll: true });
  }, 200);
}

export function sheetHead(title, sub = '') {
  return `<div class="sheet-head"><div><h3>${esc(title)}</h3>${sub ? `<p>${esc(sub)}</p>` : ''}</div>
    <button class="icon-btn" data-close aria-label="Close">${icon('close')}</button></div>`;
}

export function confirmSheet({ title, body, confirm = 'Confirm', cancel = 'Cancel', danger = false }) {
  return new Promise(resolve => {
    let settled = false;
    const finish = (value) => {
      if (settled) return;
      settled = true;
      closeSheet();
      resolve(value);
    };
    openSheet(`
      ${sheetHead(title)}
      <div class="sheet-body"><p style="font-size:12px;line-height:1.6;color:var(--muted)">${body}</p></div>
      <div class="sheet-actions">
        <button class="btn btn-ghost" data-cancel>${esc(cancel)}</button>
        <button class="btn ${danger ? 'btn-danger' : 'btn-primary'}" data-ok>${esc(confirm)}</button>
      </div>`, {
      onMount(sheet) {
        sheet.querySelector('[data-cancel]').addEventListener('click', () => finish(false));
        sheet.querySelector('[data-ok]').addEventListener('click', () => finish(true));
        $$('[data-close]', sheet).forEach(b => b.addEventListener('click', () => resolve(false)));
      }
    });
  });
}

export function promptSheet({ title, label, value = '', placeholder = '', confirm = 'Save', maxlength = 24 }) {
  return new Promise(resolve => {
    let settled = false;
    const finish = (v) => {
      if (settled) return;
      settled = true;
      closeSheet();
      resolve(v);
    };
    openSheet(`
      ${sheetHead(title)}
      <form class="sheet-body" id="prompt-form">
        <div class="field">
          <div class="field-label"><label for="prompt-input">${esc(label)}</label></div>
          <input class="text-input" id="prompt-input" maxlength="${maxlength}" value="${esc(value)}" placeholder="${esc(placeholder)}" autocomplete="off">
        </div>
        <div class="sheet-actions" style="margin-top:2px">
          <button type="button" class="btn btn-ghost" data-cancel>Cancel</button>
          <button type="submit" class="btn btn-primary">${esc(confirm)}</button>
        </div>
      </form>`, {
      onMount(sheet) {
        const form = sheet.querySelector('#prompt-form');
        const input = sheet.querySelector('#prompt-input');
        form.addEventListener('submit', (e) => { e.preventDefault(); finish(input.value.trim()); });
        sheet.querySelector('[data-cancel]').addEventListener('click', () => finish(null));
        $$('[data-close]', sheet).forEach(b => b.addEventListener('click', () => resolve(null)));
      }
    });
  });
}

// ---------------------------------------------------------------------------
// Sound — tiny synthesized score, no assets
// ---------------------------------------------------------------------------
class SoundKit {
  constructor() {
    this.ctx = null;
    this.noise = null;
    this.enabled = true;
  }
  unlock() {
    if (!this.ctx) {
      try {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return;
        this.ctx = new AC();
        const len = this.ctx.sampleRate * 0.4;
        const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
        const d = buf.getChannelData(0);
        for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
        this.noise = buf;
      } catch { /* audio unavailable */ }
    }
    if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume();
  }
  tone(freq, dur = 0.12, type = 'sine', gain = 0.05, slideTo = null, delay = 0) {
    if (!this.enabled || !this.ctx) return;
    const t0 = this.ctx.currentTime + delay;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t0 + dur);
    g.gain.setValueAtTime(0, t0);
    g.gain.linearRampToValueAtTime(gain, t0 + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(g).connect(this.ctx.destination);
    osc.start(t0);
    osc.stop(t0 + dur + 0.02);
  }
  noiseBurst(dur = 0.18, gain = 0.07, freq = 1200, delay = 0) {
    if (!this.enabled || !this.ctx || !this.noise) return;
    const t0 = this.ctx.currentTime + delay;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noise;
    const filt = this.ctx.createBiquadFilter();
    filt.type = 'bandpass';
    filt.frequency.setValueAtTime(freq, t0);
    filt.Q.value = 0.9;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(gain, t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.connect(filt).connect(g).connect(this.ctx.destination);
    src.start(t0);
    src.stop(t0 + dur);
  }
  play(name) {
    if (!this.enabled) return;
    this.unlock();
    switch (name) {
      case 'tap': this.tone(520, 0.05, 'sine', 0.025, 640); break;
      case 'select': this.tone(440, 0.08, 'triangle', 0.035, 660); break;
      case 'play': this.tone(392, 0.18, 'triangle', 0.055, 587); this.tone(784, 0.22, 'sine', 0.03, 988, 0.04); this.noiseBurst(0.15, 0.02, 1800); break;
      case 'attack': this.noiseBurst(0.16, 0.075, 900); this.tone(120, 0.22, 'sawtooth', 0.045, 55); break;
      case 'hit': this.tone(90, 0.16, 'square', 0.04, 48); this.noiseBurst(0.12, 0.05, 500); break;
      case 'heal': this.tone(523, 0.2, 'sine', 0.035, 784); this.tone(784, 0.25, 'sine', 0.025, 1046, 0.07); break;
      case 'draw': this.tone(700, 0.06, 'sine', 0.02, 900); break;
      case 'deny': this.tone(150, 0.15, 'square', 0.035, 110); break;
      case 'turn': this.tone(330, 0.24, 'triangle', 0.03, 392); this.tone(494, 0.3, 'sine', 0.022, 587, 0.09); break;
      case 'win': [523, 659, 784, 1046].forEach((f, i) => this.tone(f, 0.55, 'triangle', 0.045, null, i * 0.1)); break;
      case 'lose': [392, 330, 262, 196].forEach((f, i) => this.tone(f, 0.6, 'sine', 0.04, null, i * 0.12)); break;
      case 'shuffle': for (let i = 0; i < 5; i++) this.noiseBurst(0.06, 0.02, 1200 + i * 300, i * 0.055); break;
      default: this.tone(440, 0.08, 'sine', 0.03);
    }
  }
}

export const sound = new SoundKit();

export function haptic(pattern = 8) {
  const p = getProfile();
  if (!p.settings.haptics) return;
  try { navigator.vibrate?.(pattern); } catch { /* unsupported */ }
}

export function syncSoundSetting() {
  sound.enabled = !!getProfile().settings.sound;
}

// ---------------------------------------------------------------------------
// Ambient particles
// ---------------------------------------------------------------------------
export function initAmbient(canvas) {
  const ctx = canvas.getContext('2d');
  let w = 0, h = 0, dpr = 1;
  let particles = [];
  let raf = 0;
  let tiltX = 0, tiltY = 0;

  const make = () => {
    const count = Math.min(64, Math.round((w * h) / 26000));
    particles = Array.from({ length: count }, () => ({
      x: Math.random() * w,
      y: Math.random() * h,
      r: Math.random() * 1.7 + 0.3,
      vy: -(Math.random() * 0.22 + 0.05),
      vx: (Math.random() - 0.5) * 0.12,
      a: Math.random() * 0.45 + 0.08,
      hue: Math.random() > 0.7 ? '150,190,255' : '255,176,96',
      tw: Math.random() * Math.PI * 2
    }));
  };

  const resize = () => {
    dpr = Math.min(2, window.devicePixelRatio || 1);
    w = window.innerWidth;
    h = window.innerHeight;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    canvas.style.width = w + 'px';
    canvas.style.height = h + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    make();
  };
  resize();
  window.addEventListener('resize', resize, { passive: true });

  const draw = (t) => {
    ctx.clearRect(0, 0, w, h);
    ctx.globalCompositeOperation = 'lighter';
    for (const p of particles) {
      p.y += p.vy;
      p.x += p.vx + tiltX * 0.22;
      p.tw += 0.015;
      if (p.y < -8) { p.y = h + 8; p.x = Math.random() * w; }
      if (p.x < -8) p.x = w + 8;
      if (p.x > w + 8) p.x = -8;
      const twinkle = 0.65 + Math.sin(p.tw) * 0.35;
      ctx.fillStyle = `rgba(${p.hue},${p.a * twinkle})`;
      ctx.beginPath();
      ctx.arc(p.x + tiltX * (p.r * 2), p.y + tiltY * (p.r * 2), p.r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalCompositeOperation = 'source-over';
    raf = requestAnimationFrame(draw);
  };

  if (!reducedMotion) raf = requestAnimationFrame(draw);
  return {
    setTilt(x, y) { tiltX = x; tiltY = y; },
    destroy() { cancelAnimationFrame(raf); window.removeEventListener('resize', resize); }
  };
}

// ---------------------------------------------------------------------------
// Tilt / motion
// ---------------------------------------------------------------------------
const motion = {
  enabled: false,
  granted: false,
  x: 0,
  y: 0,
  supported: typeof window !== 'undefined' && 'DeviceOrientationEvent' in window,
  handlers: new Set(),
  shakeHandler: null,
  lastShake: 0,
  attached: false
};

function emitMotion() {
  for (const fn of motion.handlers) {
    try { fn({ x: motion.x, y: motion.y, enabled: motion.enabled }); } catch { /* noop */ }
  }
}

function onOrientation(e) {
  if (!motion.enabled) return;
  const gamma = clamp((e.gamma || 0) / 32, -1.5, 1.5);
  const beta = clamp(((e.beta || 0) - 38) / 32, -1.5, 1.5);
  motion.x += (gamma - motion.x) * 0.12;
  motion.y += (beta - motion.y) * 0.12;
  document.documentElement.style.setProperty('--tilt-x', motion.x.toFixed(3));
  document.documentElement.style.setProperty('--tilt-y', motion.y.toFixed(3));
  emitMotion();
}

function onMotion(e) {
  if (!motion.enabled || !motion.shakeHandler) return;
  const a = e.accelerationIncludingGravity;
  if (!a) return;
  const mag = Math.sqrt((a.x || 0) ** 2 + (a.y || 0) ** 2 + (a.z || 0) ** 2);
  const now = Date.now();
  if (mag > 26 && now - motion.lastShake > 1600) {
    motion.lastShake = now;
    motion.shakeHandler();
  }
}

function attachMotion() {
  if (motion.attached) return;
  window.addEventListener('deviceorientation', onOrientation, true);
  window.addEventListener('devicemotion', onMotion, true);
  motion.attached = true;
}

export function motionIsIOS() {
  return /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
}

export async function setTilt(enabled) {
  const p = getProfile();
  if (!enabled) {
    motion.enabled = false;
    p.settings.tilt = false;
    saveProfile();
    document.body.classList.remove('tilt-on');
    document.documentElement.style.setProperty('--tilt-x', '0');
    document.documentElement.style.setProperty('--tilt-y', '0');
    emitMotion();
    return { ok: true, enabled: false };
  }
  if (!motion.supported) {
    toast('Motion sensors are not available on this device.');
    return { ok: false, reason: 'unsupported' };
  }
  try {
    if (typeof DeviceOrientationEvent !== 'undefined' && typeof DeviceOrientationEvent.requestPermission === 'function') {
      const result = await DeviceOrientationEvent.requestPermission();
      if (result !== 'granted') {
        toast('Motion access was not granted. You can enable it in Settings.');
        return { ok: false, reason: 'denied' };
      }
      motion.granted = true;
    }
    if (typeof DeviceMotionEvent !== 'undefined' && typeof DeviceMotionEvent.requestPermission === 'function') {
      try { await DeviceMotionEvent.requestPermission(); } catch { /* optional */ }
    }
    attachMotion();
    motion.enabled = true;
    p.settings.tilt = true;
    saveProfile();
    document.body.classList.add('tilt-on');
    emitMotion();
    return { ok: true, enabled: true };
  } catch (err) {
    toast('Motion access is unavailable here.');
    return { ok: false, reason: String(err) };
  }
}

export function onTilt(fn) {
  motion.handlers.add(fn);
  fn({ x: motion.x, y: motion.y, enabled: motion.enabled });
  return () => motion.handlers.delete(fn);
}

export function onShake(fn) {
  motion.shakeHandler = fn;
}

export function restoreTilt() {
  const p = getProfile();
  if (!p.settings.tilt) return;
  if (motionIsIOS() && typeof DeviceOrientationEvent?.requestPermission === 'function') {
    // iOS needs a gesture; attach on first touch and let the permission sheet handle denial.
    const once = () => {
      window.removeEventListener('pointerdown', once);
      setTilt(true).then(r => { if (!r.ok) document.body.classList.remove('tilt-on'); });
    };
    window.addEventListener('pointerdown', once, { once: true });
    return;
  }
  if (motion.supported) {
    attachMotion();
    motion.enabled = true;
    document.body.classList.add('tilt-on');
    emitMotion();
  }
}

export function tiltEnabled() {
  return motion.enabled;
}

// ---------------------------------------------------------------------------
// Profile avatar
// ---------------------------------------------------------------------------
export function playerAvatar(size = 120) {
  const p = getProfile();
  return elementSigil(p.settings.avatarElement || 'radiant', size);
}

export function aiAvatar(size = 120) {
  return elementSigil('umbra', size);
}

// ---------------------------------------------------------------------------
// Screen flash + numerics
// ---------------------------------------------------------------------------
export function flashScreen() {
  const el = $('#screen-flash');
  if (!el) return;
  el.classList.add('is-on');
  setTimeout(() => el.classList.remove('is-on'), 90);
}

export function floatDamage(x, y, text, kind = 'damage') {
  const root = $('#fx-root');
  if (!root) return;
  const node = document.createElement('div');
  node.className = 'damage-float' + (kind === 'heal' ? ' heal' : '');
  node.textContent = text;
  node.style.left = x + 'px';
  node.style.top = y + 'px';
  root.appendChild(node);
  setTimeout(() => node.remove(), 1050);
}

export function burstSparks(x, y, color = '#ffd897', count = 9) {
  const root = $('#fx-root');
  if (!root) return;
  for (let i = 0; i < count; i++) {
    const s = document.createElement('span');
    s.className = 'spark';
    const angle = Math.random() * Math.PI * 2;
    const dist = 18 + Math.random() * 42;
    s.style.left = x + 'px';
    s.style.top = y + 'px';
    s.style.background = color;
    s.style.setProperty('--dx', `${Math.cos(angle) * dist}px`);
    s.style.setProperty('--dy', `${Math.sin(angle) * dist}px`);
    root.appendChild(s);
    setTimeout(() => s.remove(), 750);
  }
}

export function shakeElement(el, cls = 'is-hit') {
  if (!el) return;
  el.classList.remove(cls);
  void el.offsetWidth;
  el.classList.add(cls);
  setTimeout(() => el.classList.remove(cls), 500);
}
