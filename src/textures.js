// Procedural material textures for the building: polished concrete, travertine, white oak,
// laylight glass, soft shadow decals, vinyl wall text and wall labels.
import { rng, makeNoise, fbm, makeCanvas, heightToNormal, clamp } from './util.js';

// Polished concrete. One texture tile = one 3 m slab; saw-cut joints sit on the tile edge.
export function concreteFloor(size = 2048) {
  const r = rng(71);
  const noise = makeNoise(11);
  const noise2 = makeNoise(29);
  const L = 256; // low-res periodic fbm, upscaled
  const low = makeCanvas(L, L);
  const lctx = low.getContext('2d');
  const limg = lctx.createImageData(L, L);
  for (let y = 0; y < L; y++) for (let x = 0; x < L; x++) {
    const n = fbm(noise, x / 32, y / 32, 5, 8);
    const m = fbm(noise2, x / 16, y / 16, 4, 16);
    const i = (y * L + x) * 4;
    limg.data[i] = n * 255; limg.data[i + 1] = m * 255; limg.data[i + 2] = 0; limg.data[i + 3] = 255;
  }
  lctx.putImageData(limg, 0, 0);

  const c = makeCanvas(size, size);
  const ctx = c.getContext('2d');
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(low, 0, 0, size, size);
  const img = ctx.getImageData(0, 0, size, size);
  const d = img.data;
  const rough = new Uint8ClampedArray(size * size);
  const height = new Uint8ClampedArray(size * size);
  for (let i = 0, p = 0; p < size * size; p++, i += 4) {
    const n = d[i] / 255, m = d[i + 1] / 255;
    const g = (r() - 0.5);
    // warm light grey with cloudy mottling
    const base = 0.86 + (n - 0.5) * 0.16 + (m - 0.5) * 0.07 + g * 0.03;
    d[i] = clamp(196 * base + 3, 0, 255);
    d[i + 1] = clamp(192 * base + 1, 0, 255);
    d[i + 2] = clamp(186 * base, 0, 255);
    d[i + 3] = 255;
    rough[p] = clamp((0.30 + (m - 0.5) * 0.35 + Math.abs(g) * 0.1) * 255, 0, 255);
    height[p] = clamp(128 + (n - 0.5) * 40 + g * 10, 0, 255);
  }
  ctx.putImageData(img, 0, 0);

  // exposed fine aggregate ("salt and pepper" grind)
  for (let i = 0; i < size * size / 260; i++) {
    const x = r() * size, y = r() * size;
    const rad = 0.5 + Math.pow(r(), 3) * 3.2 * (size / 2048);
    const t = r();
    const v = t < 0.55 ? 120 + r() * 40 : t < 0.85 ? 205 + r() * 35 : 150 + r() * 30;
    ctx.fillStyle = `rgba(${v + 6},${v + 2},${v - 4},${0.25 + r() * 0.45})`;
    ctx.beginPath(); ctx.ellipse(x, y, rad, rad * (0.6 + r() * 0.4), r() * 3.14, 0, 6.283); ctx.fill();
  }
  // trowel / grinder swirl ghosts
  ctx.lineCap = 'round';
  for (let i = 0; i < 60; i++) {
    const cx = r() * size, cy = r() * size, rad = (60 + r() * 260) * size / 2048;
    const a0 = r() * 6.28, a1 = a0 + 0.6 + r() * 1.6;
    ctx.strokeStyle = r() < 0.5 ? `rgba(255,252,248,${0.035 + r() * 0.03})` : `rgba(80,74,68,${0.025 + r() * 0.02})`;
    ctx.lineWidth = (8 + r() * 30) * size / 2048;
    ctx.beginPath(); ctx.arc(cx, cy, rad, a0, a1); ctx.stroke();
  }
  // hairline cracks
  for (let k = 0; k < 2; k++) {
    let x = r() * size, y = r() * size, a = r() * 6.28;
    ctx.strokeStyle = 'rgba(70,64,58,0.28)'; ctx.lineWidth = 0.9 * size / 2048;
    ctx.beginPath(); ctx.moveTo(x, y);
    for (let s = 0; s < 70; s++) { a += (r() - 0.5) * 0.7; x += Math.cos(a) * 6; y += Math.sin(a) * 6; ctx.lineTo(x, y); }
    ctx.stroke();
  }
  // saw-cut control joints on two edges of the tile (they repeat into a 3 m grid)
  const jw = Math.max(3, Math.round(size / 600));
  ctx.fillStyle = 'rgba(64,60,56,0.85)';
  ctx.fillRect(0, 0, size, jw); ctx.fillRect(0, 0, jw, size);
  ctx.fillStyle = 'rgba(120,114,108,0.5)';
  ctx.fillRect(0, jw, size, 1); ctx.fillRect(jw, 0, 1, size);

  // roughness / height canvases
  const rc = makeCanvas(size, size);
  const rctx = rc.getContext('2d');
  const rimg = rctx.createImageData(size, size);
  const hc = makeCanvas(size, size);
  const hctx = hc.getContext('2d');
  const himg = hctx.createImageData(size, size);
  for (let p = 0, i = 0; p < size * size; p++, i += 4) {
    const x = p % size, y = (p / size) | 0;
    const joint = x < jw || y < jw;
    const rv = joint ? 230 : rough[p];
    rimg.data[i] = rv; rimg.data[i + 1] = rv; rimg.data[i + 2] = rv; rimg.data[i + 3] = 255;
    const hv = joint ? 30 : height[p];
    himg.data[i] = hv; himg.data[i + 1] = hv; himg.data[i + 2] = hv; himg.data[i + 3] = 255;
  }
  rctx.putImageData(rimg, 0, 0);
  hctx.putImageData(himg, 0, 0);
  const normal = heightToNormal(hc, 1.4, size / 2, size / 2);
  return { map: c, roughness: rc, normal };
}

// Travertine: warm beige, horizontal bedding, small open pores.
export function travertine(size = 1024, seed = 5) {
  const r = rng(seed);
  const noise = makeNoise(seed * 3 + 1);
  const c = makeCanvas(size, size);
  const ctx = c.getContext('2d');
  const img = ctx.createImageData(size, size);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const band = fbm(noise, x / 220, y / 18, 4) ;
    const n = fbm(noise, x / 40 + 50, y / 40, 4);
    const v = 0.9 + (band - 0.5) * 0.2 + (n - 0.5) * 0.07 + (r() - 0.5) * 0.04;
    const i = (y * size + x) * 4;
    img.data[i] = clamp(230 * v, 0, 255); img.data[i + 1] = clamp(222 * v, 0, 255); img.data[i + 2] = clamp(206 * v, 0, 255); img.data[i + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  const hc = makeCanvas(size, size);
  const hctx = hc.getContext('2d');
  hctx.fillStyle = '#888'; hctx.fillRect(0, 0, size, size);
  for (let i = 0; i < 520; i++) {
    const x = r() * size, y = r() * size;
    const w = 2 + Math.pow(r(), 2) * 22, h = 1 + r() * 3.5;
    ctx.fillStyle = `rgba(138,126,108,${0.4 + r() * 0.4})`;
    ctx.beginPath(); ctx.ellipse(x, y, w, h, (r() - 0.5) * 0.15, 0, 6.283); ctx.fill();
    hctx.fillStyle = 'rgba(0,0,0,0.8)';
    hctx.beginPath(); hctx.ellipse(x, y, w, h, 0, 0, 6.283); hctx.fill();
  }
  return { map: c, normal: heightToNormal(hc, 2.5, size / 2, size / 2) };
}

// Honed Carrara marble: warm white with soft grey veining.
export function marble(size = 1024, seed = 12) {
  const r = rng(seed);
  const noise = makeNoise(seed * 7 + 3);
  const c = makeCanvas(size, size);
  const ctx = c.getContext('2d');
  const img = ctx.createImageData(size, size);
  const k = 1024 / size;
  for (let y0 = 0; y0 < size; y0++) for (let x0 = 0; x0 < size; x0++) {
    const x = x0 * k, y = y0 * k;
    const n = fbm(noise, x / 160, y / 160, 6);
    const t = Math.abs(Math.sin((x * 0.0035 + y * 0.0022) * 6.283 + n * 10));
    const vein = Math.pow(1 - t, 22) * 0.5 + Math.pow(1 - t, 5) * 0.07;
    const cloud = (fbm(noise, x / 50 + 40, y / 50, 3) - 0.5) * 0.05;
    const v = 0.94 - vein + cloud + (r() - 0.5) * 0.02;
    const i = (y0 * size + x0) * 4;
    img.data[i] = clamp(238 * v, 0, 255); img.data[i + 1] = clamp(236 * v, 0, 255); img.data[i + 2] = clamp(233 * v + vein * 18, 0, 255); img.data[i + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  return c;
}

// Pale white oak with straight grain.
export function whiteOak(w = 1024, h = 512, seed = 9) {
  const r = rng(seed);
  const noise = makeNoise(seed + 4);
  const c = makeCanvas(w, h);
  const ctx = c.getContext('2d');
  const img = ctx.createImageData(w, h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const warp = fbm(noise, x / 300, y / 60, 3) * 26;
    const g = Math.sin((y + warp) * 0.42) * 0.5 + 0.5;
    const fine = fbm(noise, x / 6, y / 1.6 + 100, 2);
    const v = 0.88 + g * 0.07 - Math.pow(g, 8) * 0.12 + (fine - 0.5) * 0.08;
    const i = (y * w + x) * 4;
    img.data[i] = clamp(214 * v, 0, 255); img.data[i + 1] = clamp(184 * v, 0, 255); img.data[i + 2] = clamp(146 * v, 0, 255); img.data[i + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  // medullary ray flecks typical of quarter-sawn oak
  for (let i = 0; i < 300; i++) {
    ctx.fillStyle = `rgba(235,214,186,${0.25 + r() * 0.3})`;
    ctx.fillRect(r() * w, r() * h, 4 + r() * 18, 1 + r() * 1.5);
  }
  return c;
}

// Laylight: frosted glass panels in a slim mullion grid. 7 x 9 m panel, 7 x 9 lites.
export function laylightPanel(cols = 7, rows = 9) {
  const px = 64;
  const c = makeCanvas(cols * px, rows * px);
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, c.width, c.height);
  for (let i = 0; i < cols; i++) for (let j = 0; j < rows; j++) {
    const g = ctx.createRadialGradient(i * px + px / 2, j * px + px / 2, 4, i * px + px / 2, j * px + px / 2, px * 0.72);
    g.addColorStop(0, '#ffffff'); g.addColorStop(1, '#ebe9e6');
    ctx.fillStyle = g; ctx.fillRect(i * px, j * px, px, px);
  }
  ctx.fillStyle = '#8b8783';
  for (let i = 0; i <= cols; i++) ctx.fillRect(i * px - 1.5, 0, 3, c.height);
  for (let j = 0; j <= rows; j++) ctx.fillRect(0, j * px - 1.5, c.width, 3);
  return c;
}

// Soft rectangular shadow (for frames and paintings hung off the wall).
export function softRectShadow(wPx = 256, hPx = 256, blur = 24, alpha = 0.55) {
  const c = makeCanvas(wPx, hPx);
  const ctx = c.getContext('2d');
  ctx.filter = `blur(${blur}px)`;
  ctx.fillStyle = `rgba(0,0,0,${alpha})`;
  ctx.fillRect(blur * 1.6, blur * 1.6, wPx - blur * 3.2, hPx - blur * 3.2);
  ctx.filter = 'none';
  // fallback if canvas filter unsupported: radial-ish edge falloff
  const t = ctx.getImageData(wPx >> 1, hPx >> 1, 1, 1).data[3];
  if (t === 0) {
    const g = ctx.createRadialGradient(wPx / 2, hPx / 2, 0, wPx / 2, hPx / 2, wPx / 2);
    g.addColorStop(0, `rgba(0,0,0,${alpha})`); g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, wPx, hPx);
  }
  return c;
}

export function radialShadow(size = 256, alpha = 0.6, inner = 0.25) {
  const c = makeCanvas(size, size);
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(size / 2, size / 2, size * inner * 0.5, size / 2, size / 2, size / 2);
  g.addColorStop(0, `rgba(0,0,0,${alpha})`);
  g.addColorStop(0.5, `rgba(0,0,0,${alpha * 0.45})`);
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, size, size);
  return c;
}

const SANS = '"Archivo", "Helvetica Neue", Helvetica, Arial, sans-serif';
const SERIF = '"Bodoni Moda", "Didot", "Bodoni 72", Georgia, serif';

// Vinyl lettering applied to a wall. Returns canvas with transparent background.
export function wallText(lines, opt = {}) {
  const W = opt.width || 4096, H = opt.height || 1024;
  const c = makeCanvas(W, H);
  const ctx = c.getContext('2d');
  ctx.textBaseline = 'alphabetic';
  for (const ln of lines) {
    ctx.fillStyle = ln.color || '#2b2526';
    ctx.font = `${ln.weight || 500} ${ln.size}px ${ln.serif ? SERIF : SANS}`;
    const text = ln.text;
    let tracking = ln.tracking || 0; // px between letters
    const align = ln.align || opt.align || 'center';
    // measure with tracking
    let total = 0;
    const widths = [...text].map(ch => { const w = ctx.measureText(ch).width; total += w + tracking; return w; });
    total -= tracking;
    if (ln.fit && total > W * ln.fit) { const k = (W * ln.fit) / total; ctx.font = `${ln.weight || 500} ${ln.size * k}px ${ln.serif ? SERIF : SANS}`; tracking *= k; total = 0; [...text].forEach((ch, i) => { widths[i] = ctx.measureText(ch).width; total += widths[i] + tracking; }); total -= tracking; }
    let x = align === 'center' ? (W - total) / 2 : align === 'left' ? (ln.x || 0) : W - total - (ln.x || 0);
    [...text].forEach((ch, i) => { ctx.fillText(ch, x, ln.y); x += widths[i] + tracking; });
  }
  return c;
}

export function wrapText(ctx, text, maxW) {
  const words = text.split(' ');
  const out = []; let line = '';
  for (const w of words) {
    const t = line ? line + ' ' + w : w;
    if (ctx.measureText(t).width > maxW && line) { out.push(line); line = w; } else line = t;
  }
  if (line) out.push(line);
  return out;
}

// Museum wall label (tombstone). 12 x 16 cm at 5 px/mm.
export function wallLabel(work) {
  const W = 600, H = 800;
  const c = makeCanvas(W, H);
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#fbfaf8'; ctx.fillRect(0, 0, W, H);
  const pad = 52;
  let y = 96;
  ctx.fillStyle = '#231e1f';
  ctx.font = `700 34px ${SANS}`; ctx.fillText(work.artist, pad, y); y += 42;
  ctx.font = `400 24px ${SANS}`; ctx.fillStyle = '#5d5354'; ctx.fillText(work.born, pad, y); y += 70;
  ctx.fillStyle = '#231e1f';
  ctx.font = `italic 500 36px ${SERIF}`;
  for (const l of wrapText(ctx, work.title + ', ' + work.year, W - pad * 2)) { ctx.fillText(l, pad, y); y += 44; }
  y += 16;
  ctx.font = `400 24px ${SANS}`; ctx.fillStyle = '#4a4142';
  for (const l of wrapText(ctx, work.medium, W - pad * 2)) { ctx.fillText(l, pad, y); y += 32; }
  ctx.fillText(work.dims, pad, y); y += 70;
  ctx.font = `600 28px ${SANS}`; ctx.fillStyle = '#231e1f';
  ctx.fillText(work.price, pad, y);
  if (work.status !== 'Available') {
    ctx.fillStyle = work.status === 'Sold' ? '#c8322e' : '#d88a2b';
    ctx.beginPath(); ctx.arc(W - pad - 14, y - 10, 14, 0, 6.283); ctx.fill();
  }
  ctx.font = `400 20px ${SANS}`; ctx.fillStyle = '#8a7f80';
  ctx.fillText('Sarah Norris/Gyening · ' + work.code, pad, H - 50);
  return c;
}

// Dust-free subtle plaster grain for walls (very low contrast normal + tiny albedo variation).
export function plaster(size = 512) {
  const r = rng(3);
  const noise = makeNoise(17);
  const c = makeCanvas(size, size);
  const ctx = c.getContext('2d');
  const img = ctx.createImageData(size, size);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const n = fbm(noise, x / (size / 16), y / (size / 16), 4, 16);
    const v = 128 + (n - 0.5) * 70 + (r() - 0.5) * 30;
    const i = (y * size + x) * 4;
    img.data[i] = v; img.data[i + 1] = v; img.data[i + 2] = v; img.data[i + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  return heightToNormal(c, 0.6);
}
