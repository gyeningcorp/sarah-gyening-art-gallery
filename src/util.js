// Small math, noise and canvas helpers shared by the texture and art generators.

export function rng(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
export const lerp = (a, b, t) => a + (b - a) * t;
export function smoothstep(a, b, x) { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); }
export function smootherstep(a, b, x) { const t = clamp((x - a) / (b - a), 0, 1); return t * t * t * (t * (t * 6 - 15) + 10); }

// Periodic value noise on a 256 lattice. noise(x, y, period) wraps every `period` cells.
export function makeNoise(seed) {
  const r = rng(seed);
  const N = 256;
  const v = new Float32Array(N * N);
  for (let i = 0; i < v.length; i++) v[i] = r();
  return function (x, y, period = 256) {
    const xi = Math.floor(x), yi = Math.floor(y);
    const xf = x - xi, yf = y - yi;
    const p = Math.max(1, Math.min(period | 0, 256));
    const x0 = ((xi % p) + p) % p, y0 = ((yi % p) + p) % p;
    const x1 = (x0 + 1) % p, y1 = (y0 + 1) % p;
    const u = xf * xf * (3 - 2 * xf), w = yf * yf * (3 - 2 * yf);
    const a = v[y0 * N + x0], b = v[y0 * N + x1], c = v[y1 * N + x0], d = v[y1 * N + x1];
    return (a + (b - a) * u) * (1 - w) + (c + (d - c) * u) * w;
  };
}

export function fbm(noise, x, y, oct = 5, period = 256, gain = 0.5) {
  let amp = 0.5, f = 1, s = 0, n = 0;
  for (let i = 0; i < oct; i++) {
    s += amp * noise(x * f, y * f, period * f);
    n += amp; amp *= gain; f *= 2;
  }
  return s / n;
}

export function makeCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return c;
}

export function hexToRgb(hex) {
  const h = hex.replace('#', '');
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}

export function rgba(rgb, a = 1) { return `rgba(${rgb[0] | 0},${rgb[1] | 0},${rgb[2] | 0},${a})`; }

export function jitterRgb(rgb, r, amt) {
  const k = 1 + (r() - 0.5) * 2 * amt;
  const t = (r() - 0.5) * amt * 40;
  return [clamp(rgb[0] * k + t, 0, 255), clamp(rgb[1] * k + t * 0.8, 0, 255), clamp(rgb[2] * k + t * 0.7, 0, 255)];
}

export function mixRgb(a, b, t) { return [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)]; }

// Height canvas (grayscale) -> tangent-space normal map canvas.
export function heightToNormal(src, strength = 2, outW = src.width, outH = src.height) {
  let hc = src;
  if (outW !== src.width || outH !== src.height) {
    hc = makeCanvas(outW, outH);
    hc.getContext('2d').drawImage(src, 0, 0, outW, outH);
  }
  const w = hc.width, h = hc.height;
  const hd = hc.getContext('2d').getImageData(0, 0, w, h).data;
  const out = makeCanvas(w, h);
  const octx = out.getContext('2d');
  const img = octx.createImageData(w, h);
  const o = img.data;
  const H = (x, y) => hd[(((y + h) % h) * w + ((x + w) % w)) * 4] / 255;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const dx = (H(x + 1, y - 1) + 2 * H(x + 1, y) + H(x + 1, y + 1)) - (H(x - 1, y - 1) + 2 * H(x - 1, y) + H(x - 1, y + 1));
      const dy = (H(x - 1, y + 1) + 2 * H(x, y + 1) + H(x + 1, y + 1)) - (H(x - 1, y - 1) + 2 * H(x, y - 1) + H(x + 1, y - 1));
      let nx = -dx * strength, ny = dy * strength, nz = 1;
      const l = Math.hypot(nx, ny, nz);
      nx /= l; ny /= l; nz /= l;
      const i = (y * w + x) * 4;
      o[i] = (nx * 0.5 + 0.5) * 255;
      o[i + 1] = (ny * 0.5 + 0.5) * 255;
      o[i + 2] = (nz * 0.5 + 0.5) * 255;
      o[i + 3] = 255;
    }
  }
  octx.putImageData(img, 0, 0);
  return out;
}

// Sample n points along a cubic bezier.
export function bezierPts(p0, p1, p2, p3, n) {
  const pts = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n, it = 1 - t;
    const a = it * it * it, b = 3 * it * it * t, c = 3 * it * t * t, d = t * t * t;
    pts.push([a * p0[0] + b * p1[0] + c * p2[0] + d * p3[0], a * p0[1] + b * p1[1] + c * p2[1] + d * p3[1]]);
  }
  return pts;
}

// A dry-brush bristle stroke: K parallel polylines with per-bristle colour, alpha and run-out.
// ctx: colour canvas; hctx: optional height canvas (accumulates impasto ridges).
export function bristleStroke(ctx, hctx, pts, width, rgb, r, opt = {}) {
  const K = opt.bristles || Math.max(6, Math.min(26, Math.round(width / 3)));
  const alpha = opt.alpha ?? 0.8;
  const jit = opt.jitter ?? 0.07;
  const dry = opt.dry ?? 0.25;           // how much bristles run out before the end
  const taper = opt.taper ?? 0.12;
  const height = opt.height ?? 0.22;
  const n = pts.length;
  // normals
  const nrm = [];
  for (let i = 0; i < n; i++) {
    const a = pts[Math.max(0, i - 1)], b = pts[Math.min(n - 1, i + 1)];
    let dx = b[0] - a[0], dy = b[1] - a[1];
    const l = Math.hypot(dx, dy) || 1;
    nrm.push([-dy / l, dx / l]);
  }
  const lw = Math.max(0.6, (width / K) * 1.7);
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  if (hctx) { hctx.lineCap = 'round'; hctx.lineJoin = 'round'; }
  for (let k = 0; k < K; k++) {
    const off = ((k + 0.5) / K - 0.5) * width + (r() - 0.5) * (width / K);
    const end = Math.floor(n * (1 - r() * dry));
    const start = Math.floor(r() * n * 0.04);
    const col = jitterRgb(rgb, r, jit);
    const a = alpha * (0.55 + r() * 0.45);
    const wob = (r() - 0.5) * 0.6;
    ctx.strokeStyle = rgba(col, a);
    ctx.lineWidth = lw * (0.6 + r() * 0.8);
    ctx.beginPath();
    for (let i = start; i < end; i++) {
      const t = i / (n - 1);
      const tp = Math.min(1, t / taper, (1 - t) / (taper * 0.6) + 0.35);
      const o = off * (0.55 + 0.45 * tp) + wob * Math.sin(t * 9 + k);
      const x = pts[i][0] + nrm[i][0] * o, y = pts[i][1] + nrm[i][1] * o;
      if (i === start) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.stroke();
    if (hctx) {
      hctx.strokeStyle = `rgba(255,255,255,${height * (0.4 + r() * 0.6)})`;
      hctx.lineWidth = ctx.lineWidth * 0.8;
      hctx.beginPath();
      for (let i = start; i < end; i++) {
        const t = i / (n - 1);
        const tp = Math.min(1, t / taper, (1 - t) / (taper * 0.6) + 0.35);
        const o = off * (0.55 + 0.45 * tp) + wob * Math.sin(t * 9 + k);
        const x = pts[i][0] + nrm[i][0] * o, y = pts[i][1] + nrm[i][1] * o;
        if (i === start) hctx.moveTo(x, y); else hctx.lineTo(x, y);
      }
      hctx.stroke();
    }
  }
}

// Fine linen / cotton duck weave, drawn over a painting as a multiply layer and into height.
export function weave(ctx, hctx, w, h, r, opt = {}) {
  const pitch = opt.pitch || 3;
  const amt = opt.amount ?? 0.06;
  ctx.save();
  ctx.globalCompositeOperation = 'multiply';
  for (let y = 0; y < h; y += pitch) {
    ctx.fillStyle = `rgba(90,70,60,${amt * (0.5 + r() * 0.7)})`;
    ctx.fillRect(0, y, w, 1);
  }
  for (let x = 0; x < w; x += pitch) {
    ctx.fillStyle = `rgba(90,70,60,${amt * 0.7 * (0.5 + r() * 0.7)})`;
    ctx.fillRect(x, 0, 1, h);
  }
  ctx.restore();
  if (hctx) {
    hctx.save();
    for (let y = 0; y < h; y += pitch) { hctx.fillStyle = `rgba(0,0,0,${0.12 + r() * 0.06})`; hctx.fillRect(0, y, w, 1); }
    for (let x = 0; x < w; x += pitch) { hctx.fillStyle = `rgba(0,0,0,${0.09 + r() * 0.05})`; hctx.fillRect(x, 0, 1, h); }
    hctx.restore();
  }
}
