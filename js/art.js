// Procedural card artwork — layered elemental scenes, arcane sigils and grain.
// Everything is generated locally so the game works fully offline.

import { ELEMENTS } from './data.js';

const ART_W = 480;
const ART_H = 600;
const cache = new Map();

function hashString(str) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

let grainPattern = null;
function getGrain(ctx) {
  if (!grainPattern) {
    const n = document.createElement('canvas');
    n.width = n.height = 96;
    const g = n.getContext('2d');
    const data = g.createImageData(96, 96);
    for (let i = 0; i < data.data.length; i += 4) {
      const v = 110 + Math.random() * 90;
      data.data[i] = data.data[i + 1] = data.data[i + 2] = v;
      data.data[i + 3] = 120;
    }
    g.putImageData(data, 0, 0);
    grainPattern = n;
  }
  return grainPattern;
}

function rgba(hex, a) {
  const h = hex.replace('#', '');
  const n = parseInt(h.length === 3 ? h.split('').map(c => c + c).join('') : h, 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}

function mix(a, b, t) {
  const pa = parseInt(a.slice(1), 16), pb = parseInt(b.slice(1), 16);
  const ar = (pa >> 16) & 255, ag = (pa >> 8) & 255, ab = pa & 255;
  const br = (pb >> 16) & 255, bg = (pb >> 8) & 255, bb = pb & 255;
  const r = Math.round(ar + (br - ar) * t);
  const g = Math.round(ag + (bg - ag) * t);
  const bl = Math.round(ab + (bb - ab) * t);
  return `#${((1 << 24) + (r << 16) + (g << 8) + bl).toString(16).slice(1)}`;
}

function starfield(ctx, rnd, count, color, maxY = 470) {
  for (let i = 0; i < count; i++) {
    const x = rnd() * ART_W;
    const y = rnd() * maxY;
    const r = rnd() * (rnd() > 0.94 ? 1.9 : 1.1) + 0.25;
    ctx.globalAlpha = 0.2 + rnd() * 0.6;
    ctx.fillStyle = rnd() > 0.72 ? color : '#fff7e6';
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

function ridge(ctx, rnd, baseY, amp, color, alpha = 1, steps = 9) {
  ctx.beginPath();
  ctx.moveTo(-20, ART_H + 20);
  ctx.lineTo(-20, baseY);
  let x = -20;
  const seg = (ART_W + 40) / steps;
  for (let i = 0; i <= steps; i++) {
    const y = baseY - (i === 0 ? 0 : rnd() * amp) + Math.sin(i * 0.9 + rnd()) * amp * 0.25;
    ctx.lineTo(x, y);
    x += seg * (0.7 + rnd() * 0.6);
  }
  ctx.lineTo(ART_W + 20, baseY);
  ctx.lineTo(ART_W + 20, ART_H + 20);
  ctx.closePath();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = color;
  ctx.fill();
  ctx.globalAlpha = 1;
}

function glowOrb(ctx, x, y, r, color, alpha = 0.8) {
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, rgba(color, alpha));
  g.addColorStop(0.35, rgba(color, alpha * 0.45));
  g.addColorStop(1, rgba(color, 0));
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
}

// ---------------------------------------------------------------------------
// Central rune motifs
// ---------------------------------------------------------------------------
function drawFlame(ctx, x, y, s) {
  ctx.save();
  ctx.translate(x, y);
  const grad = ctx.createLinearGradient(0, -s, 0, s);
  grad.addColorStop(0, '#fff3ce');
  grad.addColorStop(0.4, '#ffd070');
  grad.addColorStop(1, '#ff7a31');
  ctx.fillStyle = grad;
  ctx.shadowColor = 'rgba(255,153,70,.85)';
  ctx.shadowBlur = 34;
  ctx.beginPath();
  ctx.moveTo(0, -s);
  ctx.bezierCurveTo(s * 0.52, -s * 0.28, s * 0.72, s * 0.1, s * 0.42, s * 0.58);
  ctx.bezierCurveTo(s * 0.2, s * 0.94, -s * 0.34, s * 0.92, -s * 0.5, s * 0.5);
  ctx.bezierCurveTo(-s * 0.66, s * 0.08, -s * 0.34, -s * 0.3, -s * 0.16, -s * 0.55);
  ctx.bezierCurveTo(-s * 0.02, -s * 0.28, s * 0.1, -s * 0.22, s * 0.12, -s * 0.62);
  ctx.bezierCurveTo(s * 0.14, -s * 0.8, s * 0.06, -s * 0.92, 0, -s);
  ctx.closePath();
  ctx.fill();
  // inner dark flame
  ctx.shadowBlur = 0;
  ctx.globalCompositeOperation = 'destination-out';
  ctx.beginPath();
  ctx.moveTo(0, -s * 0.04);
  ctx.bezierCurveTo(s * 0.24, s * 0.28, s * 0.2, s * 0.55, 0, s * 0.7);
  ctx.bezierCurveTo(-s * 0.24, s * 0.55, -s * 0.22, s * 0.25, 0, -s * 0.04);
  ctx.fill();
  ctx.globalCompositeOperation = 'source-over';
  ctx.restore();
}

function drawWave(ctx, x, y, s) {
  ctx.save();
  ctx.translate(x, y);
  ctx.strokeStyle = '#bfe9ff';
  ctx.lineCap = 'round';
  ctx.shadowColor = 'rgba(90,210,255,.9)';
  ctx.shadowBlur = 30;
  for (let i = 0; i < 3; i++) {
    const k = 1 - i * 0.22;
    ctx.globalAlpha = 0.95 - i * 0.22;
    ctx.lineWidth = 7 - i * 1.6;
    ctx.beginPath();
    ctx.moveTo(-s * 0.72 * k, s * 0.34 + i * s * 0.18);
    ctx.bezierCurveTo(-s * 0.2 * k, -s * 0.5 - i * s * 0.1, s * 0.5 * k, s * 0.18, s * 0.3 * k, s * 0.58);
    ctx.bezierCurveTo(s * 0.18 * k, s * 0.82, -s * 0.18 * k, s * 0.82, -s * 0.24 * k, s * 0.56);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
  ctx.strokeStyle = 'rgba(255,255,255,.55)';
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  ctx.arc(0, 0, s * 0.82, -0.3, 2.2);
  ctx.stroke();
  ctx.restore();
}

function drawLeaf(ctx, x, y, s) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(-0.5);
  const grad = ctx.createLinearGradient(-s, 0, s, 0);
  grad.addColorStop(0, '#5fd88b');
  grad.addColorStop(0.5, '#d6ffad');
  grad.addColorStop(1, '#8cf06f');
  ctx.fillStyle = grad;
  ctx.shadowColor = 'rgba(130,240,130,.8)';
  ctx.shadowBlur = 28;
  ctx.beginPath();
  ctx.moveTo(-s * 0.7, s * 0.65);
  ctx.bezierCurveTo(-s * 0.55, -s * 0.55, s * 0.4, -s * 0.95, s * 0.9, -s * 0.7);
  ctx.bezierCurveTo(s * 0.85, s * 0.1, s * 0.2, s * 0.78, -s * 0.7, s * 0.65);
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.strokeStyle = 'rgba(20,60,36,.55)';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(-s * 0.56, s * 0.55);
  ctx.quadraticCurveTo(s * 0.16, s * 0.08, s * 0.75, -s * 0.6);
  ctx.stroke();
  ctx.lineWidth = 1.6;
  for (let i = 1; i <= 5; i++) {
    const t = i / 6;
    const px = -s * 0.56 + (s * 1.31) * t;
    const py = s * 0.55 - (s * 1.15) * t + Math.sin(t * 3) * 6;
    ctx.beginPath();
    ctx.moveTo(px, py);
    ctx.lineTo(px + s * 0.18, py - s * 0.22);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(px, py);
    ctx.lineTo(px - s * 0.04, py + s * 0.26);
    ctx.stroke();
  }
  ctx.restore();
}

function drawBolt(ctx, x, y, s) {
  ctx.save();
  ctx.translate(x, y);
  ctx.shadowColor = 'rgba(180,160,255,.95)';
  ctx.shadowBlur = 34;
  const pts = [
    [0.1, -1], [-0.5, 0.02], [-0.08, 0.04], [-0.38, 1],
    [0.6, -0.2], [0.18, -0.22], [0.52, -0.98]
  ];
  const grad = ctx.createLinearGradient(0, -s, 0, s);
  grad.addColorStop(0, '#f4ecff');
  grad.addColorStop(0.45, '#c9b2ff');
  grad.addColorStop(1, '#8a6bff');
  ctx.fillStyle = grad;
  ctx.beginPath();
  pts.forEach(([px, py], i) => {
    if (i === 0) ctx.moveTo(px * s, py * s); else ctx.lineTo(px * s, py * s);
  });
  ctx.closePath();
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.strokeStyle = 'rgba(255,255,255,.55)';
  ctx.lineWidth = 1.5;
  for (let i = 0; i < 3; i++) {
    ctx.globalAlpha = 0.5 - i * 0.12;
    ctx.beginPath();
    ctx.arc(0, 0, s * (0.9 + i * 0.28), -0.6 + i, 1.8 + i);
    ctx.stroke();
  }
  ctx.restore();
}

function drawEclipse(ctx, x, y, s) {
  ctx.save();
  ctx.translate(x, y);
  ctx.shadowColor = 'rgba(200,100,255,.9)';
  ctx.shadowBlur = 30;
  const g = ctx.createRadialGradient(-s * 0.2, -s * 0.2, 0, 0, 0, s);
  g.addColorStop(0, '#f3d9ff');
  g.addColorStop(0.55, '#c77bff');
  g.addColorStop(1, '#7b35d8');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(0, 0, s, 0, Math.PI * 2);
  ctx.fill();
  ctx.shadowBlur = 0;
  // bite out of the disc
  ctx.globalCompositeOperation = 'destination-out';
  ctx.beginPath();
  ctx.arc(s * 0.34, -s * 0.16, s * 0.88, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalCompositeOperation = 'source-over';
  // ring + rays
  ctx.strokeStyle = 'rgba(243,217,255,.75)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(0, 0, s * 1.24, 0, Math.PI * 2);
  ctx.stroke();
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2 + 0.2;
    const r1 = s * 1.34, r2 = s * (i % 2 ? 1.56 : 1.68);
    ctx.beginPath();
    ctx.moveTo(Math.cos(a) * r1, Math.sin(a) * r1);
    ctx.lineTo(Math.cos(a) * r2, Math.sin(a) * r2);
    ctx.stroke();
  }
  ctx.restore();
}

function drawSun(ctx, x, y, s) {
  ctx.save();
  ctx.translate(x, y);
  ctx.shadowColor = 'rgba(255,205,90,.95)';
  ctx.shadowBlur = 38;
  const g = ctx.createRadialGradient(-s * 0.2, -s * 0.25, s * 0.1, 0, 0, s);
  g.addColorStop(0, '#fffbe8');
  g.addColorStop(0.55, '#ffe49a');
  g.addColorStop(1, '#ffb233');
  ctx.fillStyle = g;
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2;
    const r1 = s * (i % 2 ? 1.18 : 1.42);
    const r2 = s * 1.78;
    ctx.beginPath();
    ctx.moveTo(Math.cos(a - 0.055) * s * 0.96, Math.sin(a - 0.055) * s * 0.96);
    ctx.lineTo(Math.cos(a) * r2, Math.sin(a) * r2);
    ctx.lineTo(Math.cos(a + 0.055) * s * 0.96, Math.sin(a + 0.055) * s * 0.96);
    ctx.closePath();
    ctx.globalAlpha = 0.75;
    ctx.fill();
  }
  ctx.globalAlpha = 1;
  ctx.beginPath();
  ctx.arc(0, 0, s * 0.9, 0, Math.PI * 2);
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.strokeStyle = 'rgba(120,73,12,.5)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(0, 0, s * 0.58, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

const MOTIFS = { flame: drawFlame, wave: drawWave, leaf: drawLeaf, bolt: drawBolt, eclipse: drawEclipse, sun: drawSun };

// ---------------------------------------------------------------------------
// Scene painting
// ---------------------------------------------------------------------------
function paintScene(ctx, card, seed) {
  const el = ELEMENTS[card.element] || ELEMENTS.ember;
  const rnd = mulberry32(seed);
  const mid = mix(el.c2, el.deep, 0.45);

  // Sky
  const sky = ctx.createLinearGradient(0, 0, 0, ART_H);
  sky.addColorStop(0, mix(el.deep, '#000000', 0.2));
  sky.addColorStop(0.42, el.deep);
  sky.addColorStop(0.7, mix(el.deep, el.c2, 0.45));
  sky.addColorStop(1, mix(el.deep, '#000000', 0.35));
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, ART_W, ART_H);

  // Aura
  const auraY = 250 + rnd() * 40;
  glowOrb(ctx, 240, auraY, 260, el.c1, 0.42);
  glowOrb(ctx, 240, auraY, 130, el.c2, 0.5);

  // Nebula wisps
  ctx.globalCompositeOperation = 'screen';
  for (let i = 0; i < 4; i++) {
    const x = 90 + rnd() * 300;
    const y = 80 + rnd() * 260;
    const r = 80 + rnd() * 150;
    glowOrb(ctx, x, y, r, i % 2 ? el.c1 : el.c2, 0.1 + rnd() * 0.1);
  }
  ctx.globalCompositeOperation = 'source-over';

  // Energy arcs
  for (let i = 0; i < 3; i++) {
    const y = 130 + rnd() * 240;
    const grad = ctx.createLinearGradient(0, y, ART_W, y + 60);
    grad.addColorStop(0, rgba(el.c1, 0));
    grad.addColorStop(0.5, rgba(el.c1, 0.35));
    grad.addColorStop(1, rgba(el.c2, 0));
    ctx.strokeStyle = grad;
    ctx.lineWidth = 1 + rnd() * 1.5;
    ctx.beginPath();
    ctx.moveTo(-30, y);
    ctx.bezierCurveTo(120, y - 80 - rnd() * 40, 300, y + 90, 510, y - 20);
    ctx.stroke();
  }

  starfield(ctx, rnd, 90, el.c1, 500);

  // Distant halo rings
  ctx.save();
  ctx.translate(240, 300);
  ctx.rotate(rnd() * Math.PI);
  ctx.strokeStyle = rgba(el.c1, 0.16);
  ctx.lineWidth = 1;
  for (let i = 0; i < 3; i++) {
    ctx.beginPath();
    ctx.ellipse(0, 0, 190 + i * 26, 26 + i * 8, 0, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.restore();

  // Horizon
  const base = 430;
  ridge(ctx, rnd, base - 60, 40, mix(el.deep, el.c2, 0.18), 0.75, 11);
  ridge(ctx, rnd, base - 25, 55, mix(el.deep, '#000000', 0.1), 0.9, 8);

  if (card.element === 'tide') {
    ctx.strokeStyle = rgba(el.c1, 0.3);
    ctx.lineWidth = 1.5;
    for (let i = 0; i < 7; i++) {
      const y = 400 + i * 24;
      ctx.beginPath();
      ctx.moveTo(0, y);
      for (let x = 0; x <= ART_W; x += 24) {
        ctx.lineTo(x, y + Math.sin(x * 0.05 + i * 0.8) * 4);
      }
      ctx.stroke();
    }
  }

  // Silhouette / backfigure
  drawBackfigure(ctx, card, rnd, el);

  // Emblem rings
  const cx = 240, cy = 286;
  const R = 116;
  ctx.save();
  ctx.translate(cx, cy);
  const ringGrad = ctx.createLinearGradient(-R, -R, R, R);
  ringGrad.addColorStop(0, 'rgba(255,240,200,.8)');
  ringGrad.addColorStop(0.5, 'rgba(230,190,120,.25)');
  ringGrad.addColorStop(1, 'rgba(255,240,200,.7)');
  ctx.strokeStyle = ringGrad;
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  ctx.arc(0, 0, R, 0, Math.PI * 2);
  ctx.stroke();
  ctx.lineWidth = 1;
  ctx.globalAlpha = 0.6;
  ctx.beginPath();
  ctx.arc(0, 0, R + 12, 0, Math.PI * 2);
  ctx.stroke();
  ctx.globalAlpha = 1;
  // Tick marks and runes
  for (let i = 0; i < 48; i++) {
    const a = (i / 48) * Math.PI * 2;
    const len = i % 4 === 0 ? 10 : 5;
    ctx.strokeStyle = i % 4 === 0 ? 'rgba(255,236,190,.85)' : 'rgba(230,195,130,.4)';
    ctx.lineWidth = i % 4 === 0 ? 1.8 : 1;
    ctx.beginPath();
    ctx.moveTo(Math.cos(a) * (R + 5), Math.sin(a) * (R + 5));
    ctx.lineTo(Math.cos(a) * (R + 5 + len), Math.sin(a) * (R + 5 + len));
    ctx.stroke();
  }
  // Alchemical marks
  ctx.strokeStyle = 'rgba(255,233,190,.55)';
  ctx.lineWidth = 1.3;
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2 + 0.26;
    const x = Math.cos(a) * (R + 27);
    const y = Math.sin(a) * (R + 27);
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(a);
    ctx.beginPath();
    if (i % 3 === 0) {
      ctx.moveTo(-4, 4); ctx.lineTo(0, -5); ctx.lineTo(4, 4); ctx.closePath();
    } else if (i % 3 === 1) {
      ctx.arc(0, 0, 4, 0, Math.PI * 2);
    } else {
      ctx.moveTo(-5, 0); ctx.lineTo(5, 0); ctx.moveTo(0, -5); ctx.lineTo(0, 5);
    }
    ctx.stroke();
    ctx.restore();
  }
  ctx.restore();

  // Motif glow behind
  glowOrb(ctx, cx, cy, 150, el.c1, 0.24);

  // Central rune
  const scale = 92;
  MOTIFS[el.rune](ctx, cx, cy, scale);

  // Small orbiting shards
  for (let i = 0; i < 7; i++) {
    const a = rnd() * Math.PI * 2;
    const d = 148 + rnd() * 46;
    const x = cx + Math.cos(a) * d;
    const y = cy + Math.sin(a) * d * 0.9;
    const s = 2 + rnd() * 4;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(a);
    ctx.fillStyle = rgba(el.c1, 0.4 + rnd() * 0.4);
    ctx.fillRect(-s / 2, -s * 1.6, s, s * 3.2);
    ctx.restore();
  }

  // Element particles
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  for (let i = 0; i < 48; i++) {
    const x = rnd() * ART_W;
    const y = 100 + rnd() * 420;
    const s = 0.6 + rnd() * 2.2;
    let color = el.c1;
    if (card.element === 'storm' && rnd() > 0.6) color = '#ffffff';
    ctx.fillStyle = rgba(color, 0.25 + rnd() * 0.55);
    ctx.beginPath();
    ctx.arc(x, y, s, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();

  // Light ray from top
  const ray = ctx.createLinearGradient(120, 0, 300, 420);
  ray.addColorStop(0, rgba(el.c1, 0.16));
  ray.addColorStop(1, rgba(el.c1, 0));
  ctx.fillStyle = ray;
  ctx.beginPath();
  ctx.moveTo(180, -10);
  ctx.lineTo(290, -10);
  ctx.lineTo(370, 460);
  ctx.lineTo(230, 460);
  ctx.closePath();
  ctx.fill();

  // Bottom fade for frame readability
  const fade = ctx.createLinearGradient(0, 330, 0, ART_H);
  fade.addColorStop(0, 'rgba(6,5,10,0)');
  fade.addColorStop(0.72, 'rgba(6,5,10,.55)');
  fade.addColorStop(1, 'rgba(6,5,10,.96)');
  ctx.fillStyle = fade;
  ctx.fillRect(0, 330, ART_W, ART_H - 330);

  const topFade = ctx.createLinearGradient(0, 0, 0, 150);
  topFade.addColorStop(0, 'rgba(4,4,8,.8)');
  topFade.addColorStop(1, 'rgba(4,4,8,0)');
  ctx.fillStyle = topFade;
  ctx.fillRect(0, 0, ART_W, 150);

  // Vignette
  const vig = ctx.createRadialGradient(240, 300, 160, 240, 300, 380);
  vig.addColorStop(0, 'rgba(0,0,0,0)');
  vig.addColorStop(0.72, 'rgba(0,0,0,.25)');
  vig.addColorStop(1, 'rgba(0,0,0,.72)');
  ctx.fillStyle = vig;
  ctx.fillRect(0, 0, ART_W, ART_H);

  // Grain
  ctx.globalCompositeOperation = 'overlay';
  ctx.globalAlpha = 0.14;
  ctx.fillStyle = ctx.createPattern(getGrain(ctx), 'repeat');
  ctx.fillRect(0, 0, ART_W, ART_H);
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = 'source-over';
}

function drawBackfigure(ctx, card, rnd, el) {
  const variants = card.element === 'verdant' ? ['beast', 'mage', 'winged']
    : card.element === 'umbra' ? ['mage', 'winged', 'knight']
    : card.element === 'radiant' ? ['knight', 'winged', 'mage']
    : ['knight', 'beast', 'mage'];
  const variant = variants[Math.floor(rnd() * variants.length)];
  const cx = 240;
  const baseY = 545;
  const scale = 2.1 + rnd() * 0.5;

  ctx.save();
  ctx.globalAlpha = 0.42;
  ctx.fillStyle = 'rgba(3,3,7,.95)';
  ctx.strokeStyle = rgba(el.c1, 0.5);
  ctx.lineWidth = 1.2;
  ctx.translate(cx, baseY);
  ctx.scale(scale, scale);

  if (variant === 'knight') {
    // cloak body
    ctx.beginPath();
    ctx.moveTo(-34, 0); ctx.lineTo(-24, -38); ctx.lineTo(-14, -52);
    ctx.lineTo(14, -52); ctx.lineTo(24, -38); ctx.lineTo(34, 0); ctx.closePath();
    ctx.fill(); ctx.stroke();
    // head
    ctx.beginPath();
    ctx.moveTo(-11, -54); ctx.lineTo(-9, -74); ctx.lineTo(0, -82); ctx.lineTo(9, -74);
    ctx.lineTo(11, -54); ctx.closePath(); ctx.fill(); ctx.stroke();
    // horns
    ctx.beginPath();
    ctx.moveTo(-9, -70); ctx.lineTo(-20, -86); ctx.lineTo(-8, -78);
    ctx.moveTo(9, -70); ctx.lineTo(20, -86); ctx.lineTo(8, -78);
    ctx.stroke();
    // sword
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(30, -4); ctx.lineTo(30, -76); ctx.lineTo(25, -64);
    ctx.moveTo(22, -10); ctx.lineTo(38, -10);
    ctx.stroke();
  } else if (variant === 'mage') {
    ctx.beginPath();
    ctx.moveTo(-30, 0); ctx.lineTo(-20, -52); ctx.lineTo(-10, -64);
    ctx.lineTo(10, -64); ctx.lineTo(20, -52); ctx.lineTo(30, 0); ctx.closePath();
    ctx.fill(); ctx.stroke();
    ctx.beginPath();
    ctx.arc(0, -70, 10, 0, Math.PI * 2);
    ctx.fill(); ctx.stroke();
    // staff + orb
    ctx.lineWidth = 1.7;
    ctx.beginPath();
    ctx.moveTo(-27, 0); ctx.lineTo(-32, -92);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(-32, -98, 4.5, 0, Math.PI * 2);
    ctx.fillStyle = rgba(el.c1, 0.8);
    ctx.fill();
  } else if (variant === 'beast') {
    ctx.beginPath();
    ctx.moveTo(-40, -8); ctx.lineTo(-30, -34); ctx.lineTo(-16, -40);
    ctx.lineTo(18, -40); ctx.lineTo(36, -28); ctx.lineTo(42, -10);
    ctx.lineTo(30, -2); ctx.lineTo(16, -8); ctx.lineTo(8, 0);
    ctx.lineTo(-6, 0); ctx.lineTo(-14, -8); ctx.lineTo(-28, 0);
    ctx.closePath(); ctx.fill(); ctx.stroke();
    // head + ears
    ctx.beginPath();
    ctx.moveTo(-8, -40); ctx.lineTo(-16, -58); ctx.lineTo(-6, -52);
    ctx.lineTo(0, -62); ctx.lineTo(8, -52); ctx.lineTo(18, -58); ctx.lineTo(12, -40);
    ctx.closePath(); ctx.fill(); ctx.stroke();
    // eye sparks
    ctx.fillStyle = rgba(el.c1, 0.85);
    ctx.beginPath(); ctx.arc(-3, -48, 1.6, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(7, -48, 1.6, 0, Math.PI * 2); ctx.fill();
  } else {
    // winged
    ctx.beginPath();
    ctx.moveTo(0, -30);
    ctx.bezierCurveTo(-28, -66, -66, -74, -92, -66);
    ctx.bezierCurveTo(-74, -52, -62, -34, -20, -10);
    ctx.bezierCurveTo(-38, -6, -50, 4, -42, 14);
    ctx.bezierCurveTo(-24, 4, -6, 2, 0, 6);
    ctx.bezierCurveTo(6, 2, 24, 4, 42, 14);
    ctx.bezierCurveTo(50, 4, 38, -6, 20, -10);
    ctx.bezierCurveTo(62, -34, 74, -52, 92, -66);
    ctx.bezierCurveTo(66, -74, 28, -66, 0, -30);
    ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.beginPath();
    ctx.arc(0, -16, 9, 0, Math.PI * 2);
    ctx.fill(); ctx.stroke();
  }
  ctx.restore();
}

export function generateCardArt(card) {
  const key = `art|${card.id}|${card.element}|${card.name}|${card.artVersion || 0}`;
  if (cache.has(key)) return cache.get(key);
  const canvas = document.createElement('canvas');
  canvas.width = ART_W;
  canvas.height = ART_H;
  const ctx = canvas.getContext('2d');
  paintScene(ctx, card, hashString(key));
  const url = canvas.toDataURL('image/webp', 0.86);
  cache.set(key, url);
  return url;
}

// Square hero / profile sigil ------------------------------------------------
const sigilCache = new Map();
export function elementSigil(element, size = 160) {
  const el = ELEMENTS[element] || ELEMENTS.ember;
  const key = `${element}|${size}`;
  if (sigilCache.has(key)) return sigilCache.get(key);
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const ctx = c.getContext('2d');
  const r = size / 2;

  const bg = ctx.createRadialGradient(r * 0.8, r * 0.7, 2, r, r, r);
  bg.addColorStop(0, mix(el.c2, el.deep, 0.25));
  bg.addColorStop(0.62, el.deep);
  bg.addColorStop(1, '#05050a');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, size, size);

  glowOrb(ctx, r, r, r * 0.85, el.c1, 0.45);

  // stars
  const rnd = mulberry32(hashString(element + size));
  for (let i = 0; i < 26; i++) {
    ctx.fillStyle = `rgba(255,245,220,${0.15 + rnd() * 0.5})`;
    ctx.beginPath();
    ctx.arc(rnd() * size, rnd() * size, rnd() * 1.2 + 0.3, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.save();
  ctx.translate(r, r);
  ctx.strokeStyle = 'rgba(240,214,159,.7)';
  ctx.lineWidth = Math.max(1, size / 110);
  ctx.beginPath();
  ctx.arc(0, 0, r * 0.9, 0, Math.PI * 2);
  ctx.stroke();
  ctx.globalAlpha = 0.5;
  ctx.beginPath();
  ctx.arc(0, 0, r * 0.79, 0, Math.PI * 2);
  ctx.stroke();
  ctx.globalAlpha = 1;
  const s = r * 0.5;
  MOTIFS[el.rune](ctx, 0, 0, s);
  ctx.restore();

  // rim vignette
  const vig = ctx.createRadialGradient(r, r, r * 0.6, r, r, r);
  vig.addColorStop(0, 'rgba(0,0,0,0)');
  vig.addColorStop(1, 'rgba(0,0,0,.6)');
  ctx.fillStyle = vig;
  ctx.fillRect(0, 0, size, size);

  const url = c.toDataURL('image/webp', 0.9);
  sigilCache.set(key, url);
  return url;
}

export function artForCard(card, customArt) {
  if (customArt) return customArt;
  return generateCardArt(card);
}

export function forgeSigilDataUrl(card) {
  return generateCardArt({ ...card, artVersion: Date.now() });
}
