import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { buildWorld, bakeUniforms, D, roomZ } from './world.js';
import { layoutFor, computeStops, buildPath, evalPath, filmKeys, filmCamera, filmLights, FILM_LEN, CUES } from './journey.js';
import { WORKS, CHAPTERS, DIVISIONS, ARTWORKS } from './content.js';
import { clamp, smoothstep } from './util.js';

const TEST = /[?&]test/.test(location.search);
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
const coarse = matchMedia('(pointer: coarse)').matches;
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const html = document.documentElement;
const N = CHAPTERS.length;

// Lighting calibration (linear units; tone mapped at the end).
const LIGHT = { bake: 3.6, bounce: 0.62, lay: 2.4, spot: 0.72, env: 0.3, exposure: 1.04 };

// ---------------------------------------------------------------------------------------------
// Static UI: route, divisions, placards, form options, floor plan.
const routeEl = $('.route');
CHAPTERS.forEach((c, k) => {
  const b = document.createElement('button');
  b.type = 'button'; b.dataset.go = k;
  b.innerHTML = `<b>${c.num}</b><span>${c.short}</span>`;
  b.setAttribute('aria-label', `${c.num} ${c.short}`);
  routeEl.appendChild(b);
});
$('#divs').innerHTML = DIVISIONS.map((d) => `<li><span>${d.name}</span><small>${d.what}</small></li>`).join('');
$$('.work').forEach((el) => {
  const w = WORKS[+el.dataset.work];
  const st = w.status === 'Reserved' ? 'reserved' : '';
  el.innerHTML = `<div class="work-top"><span>In this room · ${w.code}</span><span class="status ${st}"><i></i>${w.status}</span></div>
    <h3>${w.title}</h3><p class="by">${w.artist}</p>
    <p class="meta">${w.medium}<br>${w.dims}</p>
    <div class="buy"><span class="price">${w.price}${w.note ? `<small>${w.note}</small>` : ''}</span>
    <button class="btn ghost" type="button" data-inquire="${w.code}">Ask about the artwork</button></div>`;
});
// One card per painting in mobile detail sheets; preserve all desktop placards.
$$('.chapter').forEach((section, room) => {
  const works = ARTWORKS.filter((w) => w.room === room);
  const list = document.createElement('div');
  list.className = 'mobile-artworks';
  list.innerHTML = works.map((w) =>
    `<article class="mobile-artwork">
       <img src="/artworks/${w.file}" alt="${w.title}, a painting by Sarah Norris Gyening" loading="lazy" decoding="async">
       <div class="mobile-artwork-copy">
         <span class="mobile-artwork-code">${w.code} · Original painting</span>
         <h3>${w.title}</h3>
         <p>Sarah Norris Gyening</p>
         <strong class="mobile-artwork-price">${w.price}</strong>
         <button class="btn ghost" type="button" data-inquire="${w.code}">Inquire about this artwork</button>
       </div>
     </article>`).join('');
  section.appendChild(list);
});
const sel = $('#f-re');
sel.innerHTML = [['general', 'General inquiry'], ['commission', 'Commission request']].map(([v, t]) => `<option value="${v}">${t}</option>`).join('')
  + `<optgroup label="Works on view">` + ARTWORKS.map((w) => `<option value="${w.code}">${w.title} · ${w.code}</option>`).join('') + `</optgroup>`;
// floor plan: rooms left to right, entrance on the left
const planSvg = $('#planSvg');
{
  const rw = 31, x0 = 6, y0 = 4, h = 30;
  let s = '';
  for (let k = 0; k < N; k++) s += `<rect class="rm" data-go="${k}" x="${x0 + k * rw}" y="${y0}" width="${rw}" height="${h}"><title>${CHAPTERS[k].room} · ${CHAPTERS[k].short}</title></rect>`;
  for (let k = 1; k < N; k++) s += `<rect x="${x0 + k * rw - 1.5}" y="${y0 + h / 2 - 5}" width="3" height="10" fill="#fcf9f8"/>`;
  s += `<circle id="planDot" r="3.4" cx="${x0 + 6}" cy="${y0 + h / 2}" fill="#e0625d" stroke="#fff" stroke-width="1.5"/>`;
  planSvg.innerHTML = s;
}
const planDot = $('#planDot');
const planRooms = $$('.rm', planSvg);

// ---------------------------------------------------------------------------------------------
// Renderer
const canvas = $('#stage');
let renderer, composer, bloom, grade, scene, camera, refs, stops, path, keys, L, quality;
let gl = true;
const lbar = $('#lbar'), lstep = $('#lstep');
let loadN = 0;
const progress = (label) => { loadN++; lbar.style.width = Math.min(100, loadN * 13) + '%'; lstep.textContent = label; };

function pickQuality(renderer) {
  // Use a sensible render budget before starting the cinematic tour.
  let gpu = '';
  try {
    const ctx = renderer.getContext();
    const ext = ctx.getExtension('WEBGL_debug_renderer_info');
    if (ext) gpu = String(ctx.getParameter(ext.UNMASKED_RENDERER_WEBGL) || '');
  } catch (_) { /* private GPU info */ }
  const integrated = /intel|uhd graphics|iris|mali|adreno|radeon\(tm\) graphics/i.test(gpu);
  const small = Math.min(innerWidth, innerHeight) < 760;
  const restricted = (navigator.deviceMemory > 0 && navigator.deviceMemory <= 4) ||
    (navigator.hardwareConcurrency > 0 && navigator.hardwareConcurrency <= 4);
  const high = !(coarse || small || integrated || restricted);
  return {
    tier: high ? 'high' : 'low', reflections: high, shadows: high,
    shadowSize: high ? 512 : 256,
    dpr: Math.min(window.devicePixelRatio || 1, high ? 1.15 : 0.95),
    msaa: 0, reflW: 512, reflH: 512
  };
}

async function fontsReady() {
  try {
    await Promise.race([
      Promise.all(['600 64px "Archivo"', '400 24px "Archivo"', 'italic 500 36px "Bodoni Moda"', '500 36px "Bodoni Moda"'].map((f) => document.fonts.load(f))),
      new Promise((r) => setTimeout(r, 2500)),
    ]);
  } catch (e) { /* fonts are optional */ }
}

const gradeShader = {
  uniforms: { tDiffuse: { value: null }, uTime: { value: 0 }, uRes: { value: new THREE.Vector2(1, 1) }, uVig: { value: 0.24 }, uGrain: { value: 0.022 } },
  vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
  fragmentShader: `uniform sampler2D tDiffuse; uniform float uTime; uniform vec2 uRes; uniform float uVig; uniform float uGrain; varying vec2 vUv;
    float hash(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
    void main(){
      vec3 c = texture2D(tDiffuse, vUv).rgb;
      vec2 q = vUv - 0.5; q.x *= uRes.x / uRes.y;
      float v = smoothstep(1.05, 0.28, length(q));
      c *= mix(1.0 - uVig, 1.0, v);
      float g = hash(floor(vUv * uRes) + fract(uTime * 7.0) * 113.0) - 0.5;
      c += g * uGrain;
      gl_FragColor = vec4(c, 1.0);
    }`,
};

async function init() {
  L = layoutFor(innerWidth, innerHeight);
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance', preserveDrawingBuffer: TEST });
  } catch (e) {
    gl = false;
  }
  if (!gl || !renderer.capabilities.isWebGL2) { failGL(); return; }
  quality = pickQuality(renderer);
  renderer.setPixelRatio(quality.dpr);
  renderer.setSize(innerWidth, innerHeight, false);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.NeutralToneMapping;
  renderer.toneMappingExposure = LIGHT.exposure;
  renderer.shadowMap.enabled = quality.shadows;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  quality.reflW = Math.min(768, Math.round(innerWidth * quality.dpr * 0.35));
  quality.reflH = Math.min(512, Math.round(innerHeight * quality.dpr * 0.35));

  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x050404);
  camera = new THREE.PerspectiveCamera(L.fov, L.aspect, 0.05, 220);

  await fontsReady();
  progress('Pouring the floor');
  refs = await buildWorld(scene, renderer, quality, progress);
  progress('Focusing the lights');
  await new Promise((r) => setTimeout(r, 16));

  bakeUniforms.uBake.value.setRGB(1.0, 0.985, 0.965).multiplyScalar(LIGHT.bake);
  bakeUniforms.uBounce.value.setRGB(1.0, 0.975, 0.96).multiplyScalar(LIGHT.bounce);

  // post
  const rt = new THREE.WebGLRenderTarget(innerWidth * quality.dpr, innerHeight * quality.dpr, { type: THREE.HalfFloatType, samples: quality.msaa });
  composer = new EffectComposer(renderer, rt);
  composer.setPixelRatio(quality.dpr);
  composer.setSize(innerWidth, innerHeight);
  composer.addPass(new RenderPass(scene, camera));
  bloom = new UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), 0.16, 0.6, 1.45);
  if (quality.tier === 'high') composer.addPass(bloom);
  composer.addPass(new OutputPass());
  grade = new ShaderPass(gradeShader);
  composer.addPass(grade);

  layout();
  // environment from the gallery itself, with every light on
  applyLights(fullLights());
  captureEnv();
  progress('Opening the doors');
  renderer.compile(scene, camera);

  initUI();
  const hashK = CHAPTERS.findIndex((c) => '#' + c.id === location.hash);
  if (hashK >= 0) enterSite(hashK, true);
  else if (reduce) enterSite(0, true);
  else startFilm();
  $('#loader').classList.add('out');
  if (!TEST) requestAnimationFrame(tick);
  window.__tg = { seek: (t) => { filmT = t; frame(0); }, setP: (p) => { P = targetP = p; frame(0); }, site: (k) => enterSite(k, true), frame, state: () => ({ mode, P, filmT }), stats: () => renderer.info.render };
  window.__tgReady = true;
}

function failGL() {
  html.classList.add('fallback');
  $('#loader').classList.add('out');
  layout();
  initUI();
  enterSite(Math.max(0, CHAPTERS.findIndex((c) => '#' + c.id === location.hash)), true);
  const loop = () => { uiFrame(1 / 60); requestAnimationFrame(loop); };
  requestAnimationFrame(loop);
}

function fullLights() {
  return { room: new Array(D.N).fill(1), spot: () => 1, env: 1 };
}

function applyLights(Lv) {
  const R = bakeUniforms.uRoomLight.value;
  for (let i = 0; i < D.N; i++) {
    R[i] = Lv.room[i];
    refs.laylights[i].color.setRGB(1, 0.985, 0.968).multiplyScalar(LIGHT.lay * Lv.room[i]);
  }
  for (const s of refs.spots) {
    const lv = Lv.spot(s.stop);
    s.light.intensity = s.cd * LIGHT.spot * lv;
    s.light.visible = lv > 0.001;
    s.lens.color.setRGB(1, 0.94, 0.86).multiplyScalar(lv * 7);
  }
  scene.environmentIntensity = LIGHT.env * Lv.env;
}

function captureEnv() {
  if (refs.reflector) refs.reflector.visible = false;
  const pm = new THREE.PMREMGenerator(renderer);
  const cubeRT = new THREE.WebGLCubeRenderTarget(quality.tier === 'high' ? 256 : 128, { type: THREE.HalfFloatType });
  const cc = new THREE.CubeCamera(0.1, 200, cubeRT);
  cc.position.set(0, 2.2, roomZ(2));
  scene.add(cc);
  cc.update(renderer, scene);
  scene.environment = pm.fromCubemap(cubeRT.texture).texture;
  for (const m of refs.mirrors) {
    m.mesh.visible = false;
    const mrt = new THREE.WebGLCubeRenderTarget(quality.tier === 'high' ? 256 : 128, { type: THREE.HalfFloatType });
    const mc = new THREE.CubeCamera(0.05, 200, mrt);
    mc.position.copy(m.at);
    scene.add(mc);
    mc.update(renderer, scene);
    mrt.texture.needsPMREMUpdate = true;
    m.mesh.material.envMap = mrt.texture;
    m.mesh.material.envMapIntensity = 1;
    m.mesh.material.needsUpdate = true;
    m.mesh.visible = true;
  }
  if (refs.reflector) refs.reflector.visible = true;
}

// ---------------------------------------------------------------------------------------------
// Layout, scroll track
let segH = 1;
function layout() {
  L = layoutFor(innerWidth, innerHeight);
  segH = Math.round(innerHeight * 1.1);
  $('#track').style.height = (segH * (N - 1) + innerHeight) + 'px';
  if (!gl) return;
  camera.fov = L.fov; camera.aspect = L.aspect; camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight, false);
  composer.setSize(innerWidth, innerHeight);
  grade.uniforms.uRes.value.set(innerWidth * quality.dpr, innerHeight * quality.dpr);
  if (refs.reflector) refs.reflector.getRenderTarget().setSize(Math.round(innerWidth * quality.dpr * 0.5), Math.round(innerHeight * quality.dpr * 0.5));
  stops = computeStops(L, refs.art);
  path = buildPath(stops, L);
  keys = filmKeys(stops[0]);
}
let resizeT;
addEventListener('resize', () => { clearTimeout(resizeT); resizeT = setTimeout(() => {
  layout();
  if (mode === 'site') {
    html.classList.toggle('mobile-gallery', isMobileView());
    if (isMobileView()) { mobileRoomIndex = Math.round(P); window.scrollTo(0, 0); }
    else window.scrollTo(0, P * segH);
  }
}, 120); });

// ---------------------------------------------------------------------------------------------
// Film
let mode = 'load', filmT = 0, siteT = 0, filmStartedAt = 0;
const film = $('#film'), cueEl = $('#cue'), tcEl = $('#tc'), fprog = $('#fprog'), fade = $('#fade');
const barT = $('.bar-t'), barB = $('.bar-b');
let cueIdx = -2, cueSpans = [];

function startFilm() {
  setMobileInfo(false);
  mode = 'film'; filmT = 0; filmStartedAt = performance.now(); cueIdx = -2;
  html.classList.remove('mobile-gallery');
  html.classList.add('locked');
  document.body.classList.remove('site');
  film.classList.remove('off');
  window.scrollTo(0, 0);
  P = targetP = 0; tween = null;
  $$('.chapter').forEach((el) => { el.classList.remove('on'); el.style.opacity = 0; });
  setTimeout(() => $('#skip').focus({ preventScroll: true }), 50);
}

function enterSite(k = 0, instant = false) {
  mode = 'site'; siteT = instant ? 10 : 0;
  film.classList.add('off');
  html.classList.remove('locked');
  document.body.classList.add('site');
  html.classList.toggle('mobile-gallery', isMobileView());
  if (gl) applyLights(fullLights());
  requestAnimationFrame(() => {
    if (isMobileView()) {
      mobileRoomIndex = k;
      window.scrollTo(0, 0);
    } else {
      window.scrollTo(0, k * segH);
    }
    P = targetP = k;
  });
}

function skipFilm() {
  if (mode !== 'film') return;
  fade.classList.remove('white');
  fade.classList.add('on');
  mode = 'skipping';
  setTimeout(() => { enterSite(0, false); filmT = FILM_LEN; setTimeout(() => fade.classList.remove('on'), 60); }, 380);
}

function buildCue(c) {
  cueEl.className = 'cue' + (c.small ? ' small' : '');
  cueEl.innerHTML = '';
  cueSpans = [];
  const lines = c.text.split('|');
  lines.forEach((ln, li) => {
    const units = c.small ? [...ln] : ln.split(' ');
    units.forEach((u, i) => {
      const s = document.createElement('span');
      s.textContent = c.small ? u : u + (i < units.length - 1 ? ' ' : '');
      cueEl.appendChild(s); cueSpans.push(s);
    });
    if (li < lines.length - 1) cueEl.appendChild(document.createElement('br'));
  });
}

function filmUI(t) {
  const i = CUES.findIndex((c) => t >= c.t0 && t < c.t1);
  if (i !== cueIdx) { cueIdx = i; if (i >= 0) buildCue(CUES[i]); else { cueEl.innerHTML = ''; cueSpans = []; } }
  if (i >= 0) {
    const c = CUES[i], dur = c.t1 - c.t0, lt = t - c.t0;
    cueSpans.forEach((s, j) => {
      const delay = j * (c.small ? 0.022 : 0.12);
      const a = smoothstep(0, c.small ? 0.4 : 0.6, lt - delay);
      const o = smoothstep(dur - 0.5, dur, lt);
      s.style.opacity = (a * (1 - o)).toFixed(3);
      s.style.transform = `translateY(${((1 - a) * 0.5 - o * 0.12).toFixed(3)}em)`;
      s.style.filter = coarse || L.mobile ? 'none' : `blur(${((1 - a) * 9 + o * 7).toFixed(2)}px)`;
      if (c.weight) s.style.fontVariationSettings = `"wght" ${(400 + 460 * smoothstep(0.1, 0.85, lt / dur)).toFixed(0)}, "opsz" 96`;
      if (c.small) s.style.letterSpacing = `${(0.3 + (1 - a) * 0.6).toFixed(2)}em`;
    });
  }
  const sec = Math.floor(t), fr = Math.floor((t - sec) * 24);
  tcEl.textContent = `00:00:${String(sec).padStart(2, '0')}:${String(fr).padStart(2, '0')}`;
  fprog.style.width = (t / FILM_LEN * 100).toFixed(2) + '%';
  const open = smoothstep(11.0, 12.4, t);
  barT.style.transform = `translateY(${-open * 100}%)`;
  barB.style.transform = `translateY(${open * 100}%)`;
  $('.film-ui').style.opacity = 1 - open;
  $('.film-mark').style.opacity = 1 - open;
}

// ---------------------------------------------------------------------------------------------
// Scroll journey + UI
let P = 0, targetP = 0, tween = null, active = -1;
const chapters = $$('.chapter');
const compactLabel = $('.route-compact span');
const planLabel = $('#planLabel');
const hint = $('#hint');
const mobileRoom = $('#mobileRoom'), mobileInfo = $('#mobileInfo');
const mobilePrev = $('#mobilePrev'), mobileNext = $('#mobileNext');
const isMobileView = () => matchMedia('(max-width: 760px), (max-aspect-ratio: 85/100)').matches;
let mobileInfoOpen = false, mobileRoomIndex = 0;
function setMobileInfo(open) {
  mobileInfoOpen = !!open;
  if (mobileInfoOpen && isMobileView() && mode === 'site') {
    // Avoid any camera drift or UI switching while reading artwork details.
    P = targetP = mobileRoomIndex;
    tween = null;
  }
  document.body.classList.toggle('mobile-info-open', mobileInfoOpen);
  mobileInfo.textContent = mobileInfoOpen ? 'Close' : 'Details & Price';
  mobileInfo.setAttribute('aria-expanded', String(mobileInfoOpen));
  mobileInfo.setAttribute('aria-label', mobileInfoOpen ? 'Close artwork details and prices' : 'Show artwork details and prices');
}

function goTo(k, instant = false) {
  k = clamp(k, 0, N - 1);
  if (isMobileView()) {
    setMobileInfo(false);
    mobileRoomIndex = k;
    tween = null;
    if (instant || reduce) P = targetP = k;
    return;
  }
  const y = k * segH;
  if (instant || reduce) { window.scrollTo(0, y); return; }
  const y0 = window.scrollY;
  const rooms = Math.abs(y - y0) / segH;
  tween = { y0, y1: y, t0: performance.now(), dur: clamp(1000 + rooms * 700, 1000, 3800) };
}
const easeIO = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

function initUI() {
  document.addEventListener('click', (e) => {
    const go = e.target.closest('[data-go]');
    if (go && mode === 'site') { e.preventDefault(); goTo(+go.dataset.go); return; }
    const rel = e.target.closest('[data-rel]');
    if (rel && mode === 'site') { goTo((isMobileView() ? mobileRoomIndex : active) + +rel.dataset.rel); return; }
    if (e.target.closest('[data-replay]') || e.target.closest('#replayTop')) { if (gl) startFilm(); return; }
    const inq = e.target.closest('[data-inquire]');
    if (inq) {
      sel.value = inq.dataset.inquire;
      goTo(N - 1);
      if (isMobileView()) {
        P = targetP = N - 1;
        setMobileInfo(true);
        requestAnimationFrame(() => {
          const sheet = chapters[N - 1];
          if (sheet) sheet.scrollTop = Math.max(0, $('#contactForm').offsetTop - sheet.offsetTop - 22);
          $('#f-name').focus({ preventScroll: true });
        });
      } else {
        setTimeout(() => $('#f-name').focus({ preventScroll: true }), reduce ? 50 : 1600);
      }
    }
  });
  $('#skip').addEventListener('click', skipFilm);
  addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && mode === 'film') { skipFilm(); return; }
    if (mode !== 'site') return;
    if (e.target.closest('input, textarea, select')) return;
    if (['ArrowDown', 'PageDown'].includes(e.key) || (e.key === ' ' && !e.target.closest('button, a'))) { e.preventDefault(); goTo(active + 1); }
    else if (['ArrowUp', 'PageUp'].includes(e.key)) { e.preventDefault(); goTo(active - 1); }
    else if (e.key === 'Home') { e.preventDefault(); goTo(0); }
    else if (e.key === 'End') { e.preventDefault(); goTo(N - 1); }
  });
  const cancel = () => { tween = null; };
  addEventListener('wheel', cancel, { passive: true });
  addEventListener('touchstart', cancel, { passive: true });
  addEventListener('pointermove', (e) => { if (!coarse) { par.tx = e.clientX / innerWidth - 0.5; par.ty = e.clientY / innerHeight - 0.5; } lastMove = performance.now(); });

  // contact form
  // Tap Info to see details; horizontal swipe advances through the rooms.
  mobileInfo.addEventListener('click', () => setMobileInfo(!mobileInfoOpen));
  let touchStart = null;
  addEventListener('touchstart', (e) => {
    if (!isMobileView() || mode !== 'site' || mobileInfoOpen || e.touches.length !== 1) return;
    if (e.target.closest('button, a, input, select, textarea, .chapter, .mobile-controls')) return;
    touchStart = { x: e.touches[0].clientX, y: e.touches[0].clientY };
  }, { passive: true });
  addEventListener('touchend', (e) => {
    if (!touchStart || !isMobileView() || mode !== 'site') { touchStart = null; return; }
    const dx = e.changedTouches[0].clientX - touchStart.x;
    const dy = e.changedTouches[0].clientY - touchStart.y;
    touchStart = null;
    if (Math.abs(dx) > 55 && Math.abs(dx) > Math.abs(dy) * 1.3) {
      goTo(mobileRoomIndex + (dx < 0 ? 1 : -1));
    }
  }, { passive: true });
  addEventListener('touchcancel', () => { touchStart = null; }, { passive: true });

  const form = $('#contactForm'), err = $('#f-err');
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const name = $('#f-name').value.trim(), email = $('#f-email').value.trim(), msg = $('#f-msg').value.trim();
    if (!name) { err.textContent = 'Add your name so we know who to reply to.'; $('#f-name').focus(); return; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { err.textContent = 'Enter an email address like name@company.com.'; $('#f-email').focus(); return; }
    err.textContent = '';
    const re = sel.options[sel.selectedIndex].text;
    const subject = `Inquiry: ${re}`;
    const body = `Regarding: ${re}\nFrom: ${name} <${email}>\n\n${msg || '(no message)'}`;
    $('#readyText').textContent = `Subject: ${subject}\n${body}`;
    $('#mailLink').href = `mailto:inquiries@norrisgyening.com?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    $('#ready').classList.add('on');
  });
  $('#copyMsg').addEventListener('click', async () => {
    const t = $('#readyText').textContent;
    try { await navigator.clipboard.writeText(t); $('#copyMsg').textContent = 'Copied'; }
    catch (e) {
      const r = document.createRange(); r.selectNodeContents($('#readyText'));
      const s = getSelection(); s.removeAllRanges(); s.addRange(r);
      $('#copyMsg').textContent = 'Press Ctrl/Cmd + C';
    }
    setTimeout(() => { $('#copyMsg').textContent = 'Copy message'; }, 2200);
  });
}

let reduceShown = 0, reduceFading = false;
function uiFrame(dt) {
  if (mode !== 'site') return;
  if (tween) {
    const t = clamp((performance.now() - tween.t0) / tween.dur, 0, 1);
    window.scrollTo(0, tween.y0 + (tween.y1 - tween.y0) * easeIO(t));
    if (t >= 1) tween = null;
  }
  targetP = isMobileView() ? mobileRoomIndex : clamp(window.scrollY / segH, 0, N - 1);
  if (reduce) {
    const k = Math.round(targetP);
    if (k !== reduceShown && !reduceFading) {
      reduceFading = true; fade.classList.add('white', 'on');
      setTimeout(() => { P = k; reduceShown = k; fade.classList.remove('on'); setTimeout(() => { reduceFading = false; fade.classList.remove('white'); }, 120); }, 140);
    }
  } else {
    P += (targetP - P) * (1 - Math.exp(-dt * (tween ? 9 : 4.2)));
    if (Math.abs(targetP - P) < 1e-4) P = targetP;
  }
  const mob = isMobileView();
  chapters.forEach((el, k) => {
    const vis = mob ? (k === mobileRoomIndex ? 1 : 0)
      : 1 - smoothstep(0.08, 0.3, Math.abs(P - k));
    el.style.opacity = vis.toFixed(3);
    el.style.transform = mob ? `translateY(${((1 - vis) * 18).toFixed(1)}px)` : `translateY(calc(-50% + ${((1 - vis) * 18).toFixed(1)}px))`;
    const on = vis > 0.01;
    el.classList.toggle('on', on);
    el.inert = vis < 0.5;
  });
  const k = mob ? mobileRoomIndex : Math.round(P);
  if (k !== active) {
    active = k;
    mobileRoom.textContent = CHAPTERS[k].room + ' · ' + CHAPTERS[k].short;
    mobilePrev.disabled = k === 0;
    mobileNext.disabled = k === N - 1;
    $$('button', routeEl).forEach((b, i) => { if (i === k) b.setAttribute('aria-current', 'step'); else b.removeAttribute('aria-current'); });
    compactLabel.innerHTML = `<b>${CHAPTERS[k].num}</b>${CHAPTERS[k].short}`;
    planLabel.textContent = `${CHAPTERS[k].room} · ${CHAPTERS[k].short}`;
    planRooms.forEach((r, i) => r.classList.toggle('cur', i === k));
    if (siteT > 0.5) { try { history.replaceState(null, '', '#' + CHAPTERS[k].id); } catch (e) { /* sandboxed */ } }
  }
  hint.classList.toggle('show', P < 0.08 && siteT > 1.2);
  if (gl && camera) {
    const z = -camera.position.z, x = camera.position.x;
    planDot.setAttribute('cx', (6 + clamp(z / D.L, 0, N) * 31).toFixed(1));
    planDot.setAttribute('cy', (4 + 15 + clamp(x / (D.W / 2), -1, 1) * 13).toFixed(1));
  }
}

// ---------------------------------------------------------------------------------------------
// Frame loop
const par = { x: 0, y: 0, tx: 0, ty: 0 };
let last = performance.now(), lastMove = 0, frameNo = 0, sampleT = 0, sampleN = 0, lastAdjustment = 0;
const _p = new THREE.Vector3(), _t = new THREE.Vector3(), _q = new THREE.Quaternion();

function frame(dt) {
  if (mode === 'film') {
    filmT = TEST ? filmT + dt : Math.min(FILM_LEN, (performance.now() - filmStartedAt) / 1000);
    if (filmT >= FILM_LEN) { filmT = FILM_LEN; filmCamera(keys, filmT, _p, _t); camera.position.copy(_p); camera.lookAt(_t); filmUI(filmT); enterSite(0, false); }
    else {
      filmCamera(keys, filmT, _p, _t);
      camera.position.copy(_p); camera.lookAt(_t);
      applyLights(filmLights(filmT));
      filmUI(filmT);
    }
  } else if (mode === 'site' || mode === 'skipping') {
    siteT += dt;
    uiFrame(dt);
    evalPath(path, P, _p, _q);
    const amb = (reduce || isMobileView() || mobileInfoOpen) ? 0 : smoothstep(0, 3, siteT);
    const T = performance.now() / 1000;
    par.x += (par.tx - par.x) * (1 - Math.exp(-dt * 3));
    par.y += (par.ty - par.y) * (1 - Math.exp(-dt * 3));
    camera.position.copy(_p);
    camera.quaternion.copy(_q);
    if (amb > 0) {
      camera.translateX(Math.sin(T * 0.21) * 0.07 * amb);
      camera.translateY(Math.sin(T * 0.17 + 1.3) * 0.03 * amb);
      camera.translateZ(Math.sin(T * 0.13 + 0.4) * 0.09 * amb);
      camera.rotateY((Math.sin(T * 0.19 + 2.0) * 0.006 - par.x * 0.035) * amb);
      camera.rotateX((Math.sin(T * 0.15) * 0.004 - par.y * 0.02) * amb);
    }
  }
  if (gl) {
    grade.uniforms.uTime.value = performance.now() / 1000;
    composer.render(dt);
  }
}

function tick(now) {
  requestAnimationFrame(tick);
  const elapsed = Math.max(0, (now - last) / 1000);
  const dt = Math.min(0.05, elapsed);
  last = now;
  frameNo++;
  // idle at half rate once the walk has settled
  const idle = mode === 'site' && !tween && Math.abs(targetP - P) < 1e-3 && now - lastMove > 1500 && siteT > 4;
  if (idle && frameNo % 2) { uiFrame(dt); return; }
  frame(idle ? dt * 2 : dt);
  // React to sustained dropped frames without repeatedly rebuilding the scene.
  if (!idle && elapsed < 0.5) { sampleT += elapsed; sampleN++; }
  if (sampleN >= 24) {
    const avg = sampleT / sampleN;
    if (avg > 0.033 && now - lastAdjustment > 1600) {
      if (quality.dpr > 0.68) {
        quality.dpr = Math.max(0.65, quality.dpr - 0.13);
        renderer.setPixelRatio(quality.dpr);
        composer.setPixelRatio(quality.dpr);
        layout();
      } else if (refs.reflector && refs.reflector.visible) {
        refs.reflector.visible = false;
      }
      lastAdjustment = now;
    }
    sampleT = 0; sampleN = 0;
  }
}

init().catch((e) => { console.error(e); gl = false; failGL(); });
