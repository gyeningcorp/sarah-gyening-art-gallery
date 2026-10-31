// Original artworks, painted procedurally at load. Each returns colour + impasto normal canvases.
import { rng, makeNoise, fbm, makeCanvas, heightToNormal, hexToRgb, rgba, jitterRgb, bristleStroke, bezierPts, weave, clamp } from './util.js';

const C = {
  ground: hexToRgb('#f0e7e1'),
  white: hexToRgb('#f7f2ee'),
  blush: hexToRgb('#eeb3ab'),
  pale: hexToRgb('#f5d6cf'),
  light: hexToRgb('#e2716b'),
  red: hexToRgb('#cd4a45'),
  deep: hexToRgb('#a6312e'),
  char: hexToRgb('#2b2526'),
  grey: hexToRgb('#9b8f8b'),
};

function surface(w, h, groundHex) {
  const c = makeCanvas(w, h), ctx = c.getContext('2d');
  const hc = makeCanvas(w, h), hctx = hc.getContext('2d');
  ctx.fillStyle = groundHex; ctx.fillRect(0, 0, w, h);
  hctx.fillStyle = '#3a3a3a'; hctx.fillRect(0, 0, w, h);
  return { c, ctx, hc, hctx };
}

function linePts(x0, y0, x1, y1, n, r, wob = 2) {
  const pts = [];
  const ph = r() * 6.28, f = 1 + r() * 3;
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    pts.push([x0 + (x1 - x0) * t + Math.sin(t * f * 3.1 + ph) * wob * 0.3, y0 + (y1 - y0) * t + Math.sin(t * f * 6.28 + ph) * wob]);
  }
  return pts;
}

function groundStrokes(ctx, hctx, w, h, r, cols, count, wMin, wMax, alpha, vertical = false) {
  for (let i = 0; i < count; i++) {
    const len = (0.25 + r() * 0.5) * (vertical ? h : w);
    const x = r() * w, y = r() * h;
    const a = vertical ? Math.PI / 2 + (r() - 0.5) * 0.4 : (r() - 0.5) * 0.35;
    const pts = linePts(x - Math.cos(a) * len / 2, y - Math.sin(a) * len / 2, x + Math.cos(a) * len / 2, y + Math.sin(a) * len / 2, 40, r, 3);
    bristleStroke(ctx, hctx, pts, wMin + r() * (wMax - wMin), cols[(r() * cols.length) | 0], r, { alpha, dry: 0.4, height: 0.12 });
  }
}

function finish(s, normalStrength = 2.2, side) {
  return { map: s.c, normal: heightToNormal(s.hc, normalStrength, s.c.width >> 1, s.c.height >> 1), side };
}

// 1. Colour field: "Horizon, Held"
export function horizonHeld(w = 1800, h = 1200) {
  const r = rng(101);
  const s = surface(w, h, '#efe5df');
  groundStrokes(s.ctx, s.hctx, w, h, r, [C.white, hexToRgb('#e9ddd6')], 70, 50, 120, 0.3);
  const field = (y0, y1, x0, x1, col, passes, alpha, step = 12) => {
    for (let p = 0; p < passes; p++) {
      for (let y = y0 * h; y < y1 * h; y += step * (0.7 + r() * 0.6)) {
        const xs = x0 * w + (r() - 0.5) * w * 0.014, xe = x1 * w + (r() - 0.5) * w * 0.014;
        const pts = linePts(xs, y, xe, y + (r() - 0.5) * 6, 48, r, 2.5);
        bristleStroke(s.ctx, s.hctx, pts, 16 + r() * 18, jitterRgb(col, r, 0.04), r, { alpha, dry: 0.3, jitter: 0.05, height: 0.16 });
      }
    }
  };
  field(0.065, 0.505, 0.055, 0.945, C.blush, 3, 0.32);
  field(0.12, 0.45, 0.12, 0.88, hexToRgb('#f3c3bb'), 1, 0.18, 16);
  field(0.535, 0.586, 0.06, 0.94, hexToRgb('#b63e39'), 3, 0.45, 8);
  field(0.615, 0.935, 0.055, 0.945, hexToRgb('#df6f69'), 3, 0.34);
  field(0.66, 0.89, 0.10, 0.90, hexToRgb('#e88a83'), 1, 0.16, 16);
  weave(s.ctx, s.hctx, w, h, r, { pitch: 3, amount: 0.05 });
  return finish(s, 1.0, '#efe5df');
}

// 2. Polyptych panels: "Five Holdings"
function jitterPath(points, r, amt) {
  const p = new Path2D();
  points.forEach(([x, y], i) => {
    const jx = x + (r() - 0.5) * amt, jy = y + (r() - 0.5) * amt;
    if (i === 0) p.moveTo(jx, jy); else p.lineTo(jx, jy);
  });
  p.closePath();
  return p;
}
function rectPts(x0, y0, x1, y1, step = 6) {
  const pts = [];
  for (let x = x0; x < x1; x += step) pts.push([x, y0]);
  for (let y = y0; y < y1; y += step) pts.push([x1, y]);
  for (let x = x1; x > x0; x -= step) pts.push([x, y1]);
  for (let y = y1; y > y0; y -= step) pts.push([x0, y]);
  return pts;
}
function circlePts(cx, cy, rad, n = 360) {
  const pts = [];
  for (let i = 0; i < n; i++) { const a = i / n * Math.PI * 2; pts.push([cx + Math.cos(a) * rad, cy + Math.sin(a) * rad]); }
  return pts;
}
function paintShape(s, path, col, r, w, h, dir = 0) {
  const { ctx, hctx } = s;
  ctx.save(); ctx.clip(path);
  hctx.save(); hctx.clip(path);
  ctx.fillStyle = rgba(col, 0.92); ctx.fillRect(0, 0, w, h);
  const n = 90;
  for (let i = 0; i < n; i++) {
    const t = i / n;
    const pts = dir === 0
      ? linePts(-20, t * h + (r() - 0.5) * 8, w + 20, t * h + (r() - 0.5) * 8, 40, r, 1.5)
      : linePts(t * w + (r() - 0.5) * 8, -20, t * w + (r() - 0.5) * 8, h + 20, 40, r, 1.5);
    bristleStroke(ctx, hctx, pts, 18 + r() * 14, jitterRgb(col, r, 0.05), r, { alpha: 0.35, dry: 0.2, height: 0.2 });
  }
  ctx.restore(); hctx.restore();
  hctx.save(); hctx.strokeStyle = 'rgba(255,255,255,0.35)'; hctx.lineWidth = 3; hctx.stroke(path); hctx.restore();
}
export function fiveHoldings(i, w = 1000, h = 1300) {
  const r = rng(300 + i * 17);
  const s = surface(w, h, '#f2ece6');
  groundStrokes(s.ctx, s.hctx, w, h, r, [C.white, hexToRgb('#ebe4dd')], 46, 40, 90, 0.35, i % 2 === 1);
  const J = 2.2;
  if (i === 0) {
    const base = 0.82 * h, bh = 0.12 * h;
    [[0.70, C.char], [0.50, C.char], [0.30, C.light]].forEach(([fw, col], k) => {
      const x0 = (1 - fw) / 2 * w, y1 = base - k * bh;
      paintShape(s, jitterPath(rectPts(x0, y1 - bh + 6, x0 + fw * w, y1), r, J), col, r, w, h);
    });
  } else if (i === 1) {
    paintShape(s, jitterPath(circlePts(0.5 * w, 0.42 * h, 0.30 * w), r, J), C.light, r, w, h, 1);
    paintShape(s, jitterPath(rectPts(0.15 * w, 0.765 * h, 0.85 * w, 0.80 * h), r, J), C.char, r, w, h);
  } else if (i === 2) {
    paintShape(s, jitterPath(rectPts(0.18 * w, 0.14 * h, 0.62 * w, 0.86 * h), r, J), C.blush, r, w, h, 1);
    paintShape(s, jitterPath(rectPts(0.62 * w, 0.56 * h, 0.80 * w, 0.70 * h), r, J), C.deep, r, w, h);
  } else if (i === 3) {
    const cols = 4, rows = 5, sz = 0.13 * w, gap = 0.055 * w;
    const gw = cols * sz + (cols - 1) * gap, gh = rows * sz + (rows - 1) * gap;
    const ox = (w - gw) / 2, oy = (h - gh) / 2;
    const picks = [C.pale, C.pale, C.pale, C.char, C.light, C.pale, C.grey];
    for (let a = 0; a < cols; a++) for (let b = 0; b < rows; b++) {
      const x = ox + a * (sz + gap), y = oy + b * (sz + gap);
      const col = (a === 2 && b === 1) || (a === 1 && b === 3) ? C.light : (a === 0 && b === 4) || (a === 3 && b === 0) ? C.char : picks[(r() * picks.length) | 0];
      paintShape(s, jitterPath(rectPts(x, y, x + sz, y + sz, 4), r, 1.6), col, r, w, h, (a + b) % 2);
    }
  } else {
    const cx = 0.5 * w, top = 0.40 * h, rad = 0.25 * w;
    const pts = [];
    for (let k = 0; k <= 180; k++) { const a = Math.PI + k / 180 * Math.PI; pts.push([cx + Math.cos(a) * rad, top + Math.sin(a) * rad]); }
    pts.push([cx + rad, 0.84 * h]); pts.push([cx - rad, 0.84 * h]);
    paintShape(s, jitterPath(pts, r, J), C.blush, r, w, h, 1);
    paintShape(s, jitterPath(rectPts(0.18 * w, 0.865 * h, 0.82 * w, 0.89 * h), r, J), C.deep, r, w, h);
  }
  weave(s.ctx, s.hctx, w, h, r, { pitch: 4, amount: 0.035 });
  return finish(s, 1.0, '#f2ece6');
}

// 3. Archival pigment prints: "Signal / Noise I-III" (flow fields on cotton rag)
export function signalNoise(v, w = 1100, h = 1450) {
  const r = rng(500 + v * 31);
  const noise = makeNoise(77 + v * 13);
  const c = makeCanvas(w, h), ctx = c.getContext('2d');
  ctx.fillStyle = '#f7f4ef'; ctx.fillRect(0, 0, w, h);
  for (let i = 0; i < 26000; i++) { ctx.fillStyle = `rgba(120,110,100,${r() * 0.06})`; ctx.fillRect(r() * w, r() * h, 1.2, 1.2); }
  const m = 70, iw = w - m * 2, ih = h - m * 2 - 30;
  const sc = [0.0016, 0.0024, 0.0019][v];
  const off = [0, 1.6, 3.1][v];
  ctx.lineCap = 'round';
  const N = 1900;
  for (let k = 0; k < N; k++) {
    let x = m + r() * iw, y = m + r() * ih;
    if (v === 1) { const dx = x - w / 2, dy = y - (m + ih * 0.45); if (dx * dx + dy * dy < (iw * 0.22) ** 2) continue; }
    const red = r() < (v === 2 ? 0.09 : 0.045);
    ctx.strokeStyle = red ? 'rgba(212,86,80,0.8)' : `rgba(34,28,29,${0.2 + r() * 0.22})`;
    ctx.lineWidth = red ? 2.2 : 1.0 + r() * 0.9;
    ctx.beginPath(); ctx.moveTo(x, y);
    const steps = 80 + r() * 120;
    for (let s = 0; s < steps; s++) {
      let a = (fbm(noise, x * sc, y * sc, 3) - 0.5) * Math.PI * 4 + off;
      if (v === 2) a = a * 0.35;
      x += Math.cos(a) * 2.4; y += Math.sin(a) * 2.4;
      if (x < m || x > m + iw || y < m || y > m + ih) break;
      if (v === 1) { const dx = x - w / 2, dy = y - (m + ih * 0.45); if (dx * dx + dy * dy < (iw * 0.22) ** 2) break; }
      ctx.lineTo(x, y);
    }
    ctx.stroke();
  }
  // edition + signature in pencil
  ctx.fillStyle = 'rgba(60,55,55,0.55)';
  ctx.font = 'italic 18px Georgia, serif';
  ctx.fillText(`${['I', 'II', 'III'][v]}   8/12`, m, h - m + 18);
  ctx.fillText('K. Renmark  2025', w - m - 170, h - m + 18);
  return { map: c, normal: null, side: '#f7f4ef' };
}

// 5. "Line of Conduct": one hand-pulled red line on a broad white field.
export function lineOfConduct(w = 1800, h = 990) {
  const r = rng(707);
  const s = surface(w, h, '#f1ede8');
  groundStrokes(s.ctx, s.hctx, w, h, r, [C.white, hexToRgb('#ece6e0'), hexToRgb('#f5f1ed')], 120, 60, 140, 0.32);
  const y = 0.56 * h;
  s.ctx.strokeStyle = 'rgba(70,64,64,0.22)'; s.ctx.lineWidth = 1.3;
  for (const dy of [-34, 34]) {
    let x = 0.05 * w;
    while (x < 0.95 * w) {
      const len = 80 + r() * 300;
      s.ctx.beginPath(); s.ctx.moveTo(x, y + dy + (r() - 0.5) * 1.5); s.ctx.lineTo(Math.min(0.95 * w, x + len), y + dy + (r() - 0.5) * 1.5); s.ctx.stroke();
      x += len + 10 + r() * 60;
    }
  }
  const pts = linePts(0.07 * w, y, 0.93 * w, y + 2, 160, r, 1.6);
  bristleStroke(s.ctx, s.hctx, pts, 24, hexToRgb('#d6534e'), r, { alpha: 0.95, dry: 0.06, bristles: 14, height: 0.5, taper: 0.03 });
  bristleStroke(s.ctx, s.hctx, pts, 12, hexToRgb('#b9403b'), r, { alpha: 0.35, dry: 0.1, bristles: 8, height: 0.2, taper: 0.03 });
  // a single drip
  const dx = 0.705 * w;
  for (let k = 0; k < 3; k++) {
    s.ctx.strokeStyle = `rgba(200,74,70,${0.75 - k * 0.2})`;
    s.ctx.lineWidth = 4.5 - k * 1.2;
    s.ctx.beginPath(); s.ctx.moveTo(dx + k * 0.6, y + 8); s.ctx.lineTo(dx + k * 0.6 + 1, y + 70 + k * 6); s.ctx.stroke();
  }
  s.ctx.fillStyle = 'rgba(198,72,68,0.9)';
  s.ctx.beginPath(); s.ctx.ellipse(dx + 1, y + 76, 4, 5.5, 0, 0, 6.283); s.ctx.fill();
  weave(s.ctx, s.hctx, w, h, r, { pitch: 3, amount: 0.045 });
  return finish(s, 1.1, '#f1ede8');
}

// 6. "Open Door": gestural oil and cold wax.
export function openDoor(w = 1800, h = 1200) {
  const r = rng(909);
  const s = surface(w, h, '#efe6e0');
  const bez = (x0, y0, x1, y1, bend) => {
    const mx = (x0 + x1) / 2, my = (y0 + y1) / 2;
    const nx = -(y1 - y0), ny = x1 - x0;
    return bezierPts([x0, y0], [mx + nx * bend * (r() - 0.2), my + ny * bend * (r() - 0.2)], [mx + nx * bend * (r() - 0.8), my + ny * bend * (r() - 0.8)], [x1, y1], 70);
  };
  // underlayer
  for (let i = 0; i < 34; i++) {
    const x = r() * w, y = r() * h, a = (r() - 0.5) * 1.2, len = 400 + r() * 900;
    const col = [C.pale, C.white, hexToRgb('#ead2c9'), C.blush][(r() * 4) | 0];
    bristleStroke(s.ctx, s.hctx, bez(x - Math.cos(a) * len / 2, y - Math.sin(a) * len / 2, x + Math.cos(a) * len / 2, y + Math.sin(a) * len / 2, 0.15), 120 + r() * 120, col, r, { alpha: 0.5, dry: 0.35, height: 0.15 });
  }
  // the door: a tall loose vertical form
  for (let i = 0; i < 26; i++) {
    const x = (0.37 + r() * 0.2) * w;
    bristleStroke(s.ctx, s.hctx, bez(x + (r() - 0.5) * 30, (0.12 + r() * 0.06) * h, x + (r() - 0.5) * 50, (0.86 + r() * 0.08) * h, 0.04), 50 + r() * 50, jitterRgb(C.light, r, 0.06), r, { alpha: 0.62, dry: 0.3, height: 0.3 });
  }
  for (let i = 0; i < 8; i++) {
    const x = (0.355 + r() * 0.02) * w;
    bristleStroke(s.ctx, s.hctx, bez(x, 0.13 * h, x + (r() - 0.5) * 20, 0.9 * h, 0.03), 14 + r() * 14, C.deep, r, { alpha: 0.7, dry: 0.35, height: 0.35 });
  }
  // light through the door
  for (let i = 0; i < 9; i++) {
    const x = (0.47 + r() * 0.08) * w;
    bristleStroke(s.ctx, s.hctx, bez(x, 0.2 * h + r() * 60, x + (r() - 0.5) * 30, 0.8 * h, 0.05), 20 + r() * 30, C.white, r, { alpha: 0.55, dry: 0.5, height: 0.45 });
  }
  // sweeping gestures
  const sweep = [C.light, C.red, C.deep, C.blush, C.white, C.char];
  const wts = [5, 4, 2, 4, 3, 0.6];
  const pick = () => { let t = r() * wts.reduce((a, b) => a + b, 0); for (let i = 0; i < wts.length; i++) { t -= wts[i]; if (t < 0) return sweep[i]; } return sweep[0]; };
  for (let i = 0; i < 38; i++) {
    const x = r() * w, y = r() * h, a = -0.5 + (r() - 0.5) * 1.6, len = 200 + r() * 700;
    const col = pick();
    const wid = col === C.char ? 8 + r() * 14 : 28 + r() * 70;
    bristleStroke(s.ctx, s.hctx, bez(x - Math.cos(a) * len / 2, y - Math.sin(a) * len / 2, x + Math.cos(a) * len / 2, y + Math.sin(a) * len / 2, 0.25), wid, col, r, { alpha: col === C.char ? 0.8 : 0.55, dry: 0.45, height: 0.35 });
  }
  // small marks and scratches into the wax
  for (let i = 0; i < 22; i++) {
    const x = r() * w, y = r() * h, a = r() * 6.28, len = 30 + r() * 140;
    bristleStroke(s.ctx, s.hctx, bez(x, y, x + Math.cos(a) * len, y + Math.sin(a) * len, 0.3), 4 + r() * 10, r() < 0.4 ? C.char : C.deep, r, { alpha: 0.7, dry: 0.3, height: 0.25, bristles: 4 });
  }
  s.hctx.strokeStyle = 'rgba(0,0,0,0.6)'; s.hctx.lineWidth = 1.5;
  for (let i = 0; i < 40; i++) {
    const x = r() * w, y = r() * h, a = r() * 6.28, len = 40 + r() * 160;
    s.hctx.beginPath(); s.hctx.moveTo(x, y); s.hctx.lineTo(x + Math.cos(a) * len, y + Math.sin(a) * len); s.hctx.stroke();
    s.ctx.strokeStyle = 'rgba(250,244,240,0.5)'; s.ctx.lineWidth = 1.2;
    s.ctx.beginPath(); s.ctx.moveTo(x, y); s.ctx.lineTo(x + Math.cos(a) * len, y + Math.sin(a) * len); s.ctx.stroke();
  }
  weave(s.ctx, s.hctx, w, h, r, { pitch: 4, amount: 0.04 });
  return finish(s, 1.3, '#ecdcd4');
}

