// The gallery building, its lighting, and the works installed in it.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { Reflector } from 'three/addons/objects/Reflector.js';
import * as TX from './textures.js';
import * as ART from './art.js';
import { WORKS, CHAPTERS } from './content.js';

export const D = { L: 15, W: 13, H: 5.6, T: 0.4, DW: 4.4, DH: 3.8, N: 7, Y0: 0.03 };
export const LAY = { x: 7, z: 9, depth: 0.45 };
const HW = D.W / 2;

export const roomZ = (i) => -(i + 0.5) * D.L;
const zFront = (i) => (i === 0 ? 0 : -i * D.L - D.T / 2);
const zBack = (i) => (i === D.N - 1 ? -D.N * D.L : -(i + 1) * D.L + D.T / 2);
export const roomOf = (z) => Math.max(0, Math.min(D.N - 1, Math.floor(-z / D.L)));

// ---------------------------------------------------------------------------------------------
// Baked laylight irradiance + analytic ambient occlusion, stored per vertex.
const NX = 6, NZ = 8;
const SAMPLES = [];
for (let r = 0; r < D.N; r++) {
  const s = [];
  for (let a = 0; a < NX; a++) for (let b = 0; b < NZ; b++)
    s.push([(a + 0.5) / NX * LAY.x - LAY.x / 2, D.H + LAY.depth, roomZ(r) + (b + 0.5) / NZ * LAY.z - LAY.z / 2]);
  SAMPLES.push(s);
}
const dA = (LAY.x * LAY.z) / (NX * NZ);

function irradiance(px, py, pz, nx, ny, nz, room) {
  let E = 0;
  for (let rr = room - 1; rr <= room + 1; rr++) {
    if (rr < 0 || rr >= D.N) continue;
    const S = SAMPLES[rr], zc = roomZ(rr);
    for (let k = 0; k < S.length; k++) {
      const s = S[k];
      let dx = s[0] - px, dy = s[1] - py, dz = s[2] - pz;
      const d2 = dx * dx + dy * dy + dz * dz;
      const d = Math.sqrt(d2);
      dx /= d; dy /= d; dz /= d;
      const cr = dx * nx + dy * ny + dz * nz;
      if (cr <= 0 || dy <= 0) continue;
      if (py < D.H - 0.005) {
        const t = (D.H - py) / (s[1] - py);
        const ix = px + (s[0] - px) * t, iz = pz + (s[2] - pz) * t;
        if (Math.abs(ix) > LAY.x / 2 || Math.abs(iz - zc) > LAY.z / 2) continue;
      }
      if (rr !== room) {
        const wz = rr > room ? -(room + 1) * D.L : -room * D.L;
        const t = (wz - pz) / (s[2] - pz);
        if (t > 0 && t < 1) {
          const ix = px + (s[0] - px) * t, iy = py + (s[1] - py) * t;
          if (Math.abs(ix) > D.DW / 2 || iy > D.DH) continue;
        }
      }
      E += (cr * dy / d2) * dA;
    }
  }
  return E;
}

function occlusion(px, py, pz, nx, ny, nz, room) {
  let a = 1;
  const occ = (d, k = 0.5, r = 0.5) => { if (d < -0.02) return; a *= 1 - k * Math.exp(-Math.max(0, d) / r); };
  if (Math.abs(ny) < 0.5) { occ(py, 0.5, 0.45); occ(D.H - py, 0.25, 0.4); }
  if (Math.abs(nx) < 0.5 && Math.abs(px) < HW + 0.01) { occ(HW - px); occ(px + HW); }
  if (Math.abs(nz) < 0.5) {
    const zf = zFront(room), zb = zBack(room);
    const inDoor = Math.abs(px) < D.DW / 2 && py < D.DH;
    if (pz <= zf + 0.01 && !(room > 0 && inDoor)) occ(zf - pz);
    if (pz >= zb - 0.01 && !(room < D.N - 1 && inDoor)) occ(pz - zb);
  }
  return a;
}

export const bakeUniforms = {
  uRoomLight: { value: new Float32Array(D.N).fill(1) },
  uBake: { value: new THREE.Color(1, 1, 1) },
  uBounce: { value: new THREE.Color(1, 1, 1) },
};

export function bakeify(mat) {
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.uRoomLight = bakeUniforms.uRoomLight;
    sh.uniforms.uBake = bakeUniforms.uBake;
    sh.uniforms.uBounce = bakeUniforms.uBounce;
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nattribute vec3 bakeData;\nvarying vec3 vBakeData;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvBakeData = bakeData;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform float uRoomLight[' + D.N + '];\nuniform vec3 uBake;\nuniform vec3 uBounce;\nvarying vec3 vBakeData;')
      .replace('#include <lights_fragment_end>', '{ int ri = int(vBakeData.z + 0.5); float rl = uRoomLight[ri];\n irradiance += (uBake * vBakeData.x + uBounce * vBakeData.y) * rl; }\n#include <lights_fragment_end>');
  };
  mat.customProgramCacheKey = () => 'baked-v1';
  return mat;
}

// Compute bakeData for any mesh already placed in the world.
const _v = new THREE.Vector3(), _n = new THREE.Vector3(), _m3 = new THREE.Matrix3();
export function bakeMesh(mesh, room, aoScale = 1) {
  mesh.updateWorldMatrix(true, false);
  const g = mesh.geometry;
  const pos = g.attributes.position, nrm = g.attributes.normal;
  _m3.getNormalMatrix(mesh.matrixWorld);
  const data = new Float32Array(pos.count * 3);
  for (let i = 0; i < pos.count; i++) {
    _v.fromBufferAttribute(pos, i).applyMatrix4(mesh.matrixWorld);
    _n.fromBufferAttribute(nrm, i).applyMatrix3(_m3).normalize();
    const r = room ?? roomOf(_v.z);
    const ao = 1 - (1 - occlusion(_v.x, _v.y, _v.z, _n.x, _n.y, _n.z, r)) * aoScale;
    const E = irradiance(_v.x, _v.y, _v.z, _n.x, _n.y, _n.z, r);
    data[i * 3] = E * ao; data[i * 3 + 1] = ao; data[i * 3 + 2] = r;
  }
  g.setAttribute('bakeData', new THREE.BufferAttribute(data, 3));
}

// Subdivided quads merged into one geometry per material.
class Builder {
  constructor() { this.pos = []; this.nrm = []; this.uv = []; this.bake = []; this.idx = []; }
  quad(o, u, v, n, room, uvFn, step = 0.4, aoMul = 1) {
    const lu = Math.hypot(...u), lv = Math.hypot(...v);
    const nu = Math.max(1, Math.ceil(lu / step)), nv = Math.max(1, Math.ceil(lv / step));
    const base = this.pos.length / 3;
    for (let j = 0; j <= nv; j++) for (let i = 0; i <= nu; i++) {
      const p = [o[0] + u[0] * i / nu + v[0] * j / nv, o[1] + u[1] * i / nu + v[1] * j / nv, o[2] + u[2] * i / nu + v[2] * j / nv];
      this.pos.push(...p); this.nrm.push(...n);
      this.uv.push(...uvFn(p));
      const ao = occlusion(p[0], p[1], p[2], n[0], n[1], n[2], room) * aoMul;
      const E = irradiance(p[0], p[1], p[2], n[0], n[1], n[2], room);
      this.bake.push(E * ao, ao, room);
    }
    const cx = u[1] * v[2] - u[2] * v[1], cy = u[2] * v[0] - u[0] * v[2], cz = u[0] * v[1] - u[1] * v[0];
    const flip = cx * n[0] + cy * n[1] + cz * n[2] < 0;
    for (let j = 0; j < nv; j++) for (let i = 0; i < nu; i++) {
      const a = base + j * (nu + 1) + i, b = a + 1, c = a + nu + 1, d = c + 1;
      if (!flip) this.idx.push(a, b, d, a, d, c); else this.idx.push(a, d, b, a, c, d);
    }
  }
  build() {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.nrm, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(this.uv, 2));
    g.setAttribute('bakeData', new THREE.Float32BufferAttribute(this.bake, 3));
    g.setIndex(this.idx);
    g.computeBoundingSphere();
    return g;
  }
}

function canvasTex(c, { srgb = true, repeat = false, aniso = 8 } = {}) {
  const t = new THREE.CanvasTexture(c);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; }
  t.anisotropy = aniso;
  return t;
}

// ---------------------------------------------------------------------------------------------
export async function buildWorld(scene, renderer, quality, onProgress = () => {}) {
  const aniso = renderer.capabilities.getMaxAnisotropy();
  const hi = quality.tier === 'high';
  const refs = { spots: [], lenses: [], laylights: [], stopObjects: [], art: {}, mirrors: [] };
  const step = async (label) => { onProgress(label); await new Promise((r) => setTimeout(r, 16)); };

  // ----- materials
  await step('Pouring the floor');
  const conc = TX.concreteFloor(hi ? 2048 : 1024);
  const floorMat = bakeify(new THREE.MeshStandardMaterial({
    map: canvasTex(conc.map, { repeat: true, aniso }),
    roughnessMap: canvasTex(conc.roughness, { srgb: false, repeat: true, aniso }),
    normalMap: canvasTex(conc.normal, { srgb: false, repeat: true, aniso }),
    normalScale: new THREE.Vector2(0.35, 0.35),
    roughness: 1, metalness: 0,
  }));
  const plasterN = canvasTex(TX.plaster(512), { srgb: false, repeat: true, aniso });
  const wallMat = bakeify(new THREE.MeshStandardMaterial({ color: 0xf3f1ee, roughness: 0.94, normalMap: plasterN, normalScale: new THREE.Vector2(0.12, 0.12) }));
  const ceilMat = bakeify(new THREE.MeshStandardMaterial({ color: 0xeeece9, roughness: 0.96 }));
  const revealMat = bakeify(new THREE.MeshStandardMaterial({ color: 0x2c2829, roughness: 0.9 }));

  // ----- architecture
  await step('Raising the walls');
  const floorB = new Builder(), wallB = new Builder(), ceilB = new Builder(), revB = new Builder();
  const fuv = (p) => [p[0] / 3 + 0.5, -p[2] / 3];
  const wuvX = (p) => [p[2] / 2, p[1] / 2];
  const wuvZ = (p) => [p[0] / 2, p[1] / 2];
  const Y0 = D.Y0;
  for (let i = 0; i < D.N; i++) {
    const z0 = -i * D.L, z1 = -(i + 1) * D.L, zc = roomZ(i);
    // floor
    floorB.quad([-HW, 0, z0], [D.W, 0, 0], [0, 0, z1 - z0], [0, 1, 0], i, fuv, 0.33);
    // side walls (+ shadow-gap reveal)
    wallB.quad([-HW, Y0, z0], [0, 0, z1 - z0], [0, D.H - Y0, 0], [1, 0, 0], i, wuvX, 0.4);
    wallB.quad([HW, Y0, z0], [0, 0, z1 - z0], [0, D.H - Y0, 0], [-1, 0, 0], i, wuvX, 0.4);
    revB.quad([-HW + 0.012, 0, z0], [0, 0, z1 - z0], [0, Y0, 0], [1, 0, 0], i, wuvX, 2);
    revB.quad([HW - 0.012, 0, z0], [0, 0, z1 - z0], [0, Y0, 0], [-1, 0, 0], i, wuvX, 2);
    // ceiling with a laylight coffer opening
    const hx = LAY.x / 2, hz = LAY.z / 2;
    const cq = (x0, x1, za, zb) => ceilB.quad([x0, D.H, za], [x1 - x0, 0, 0], [0, 0, zb - za], [0, -1, 0], i, wuvZ, 0.6);
    cq(-HW, -hx, z0, z1); cq(hx, HW, z0, z1);
    cq(-hx, hx, z0, zc + hz); cq(-hx, hx, zc - hz, z1);
    // coffer sides
    ceilB.quad([-hx, D.H, zc + hz], [2 * hx, 0, 0], [0, LAY.depth, 0], [0, 0, -1], i, wuvZ, 0.3);
    ceilB.quad([-hx, D.H, zc - hz], [2 * hx, 0, 0], [0, LAY.depth, 0], [0, 0, 1], i, wuvZ, 0.3);
    ceilB.quad([-hx, D.H, zc - hz], [0, 0, 2 * hz], [0, LAY.depth, 0], [1, 0, 0], i, wuvX, 0.3);
    ceilB.quad([hx, D.H, zc - hz], [0, 0, 2 * hz], [0, LAY.depth, 0], [-1, 0, 0], i, wuvX, 0.3);
  }
  // front and end walls
  wallB.quad([-HW, Y0, 0], [D.W, 0, 0], [0, D.H - Y0, 0], [0, 0, -1], 0, wuvZ, 0.4);
  revB.quad([-HW, 0, -0.012], [D.W, 0, 0], [0, Y0, 0], [0, 0, -1], 0, wuvZ, 2);
  const zEnd = -D.N * D.L;
  wallB.quad([-HW, Y0, zEnd], [D.W, 0, 0], [0, D.H - Y0, 0], [0, 0, 1], D.N - 1, wuvZ, 0.4);
  revB.quad([-HW, 0, zEnd + 0.012], [D.W, 0, 0], [0, Y0, 0], [0, 0, 1], D.N - 1, wuvZ, 2);
  // partitions with doorways
  const dw = D.DW / 2;
  for (let k = 1; k < D.N; k++) {
    for (const side of [1, -1]) {
      const z = -k * D.L + side * D.T / 2;
      const room = side > 0 ? k - 1 : k;
      const n = [0, 0, side];
      wallB.quad([-HW, Y0, z], [HW - dw, 0, 0], [0, D.H - Y0, 0], n, room, wuvZ, 0.35);
      wallB.quad([dw, Y0, z], [HW - dw, 0, 0], [0, D.H - Y0, 0], n, room, wuvZ, 0.35);
      wallB.quad([-dw, D.DH, z], [2 * dw, 0, 0], [0, D.H - D.DH, 0], n, room, wuvZ, 0.35);
      revB.quad([-HW, 0, z - side * 0.012], [HW - dw, 0, 0], [0, Y0, 0], n, room, wuvZ, 2);
      revB.quad([dw, 0, z - side * 0.012], [HW - dw, 0, 0], [0, Y0, 0], n, room, wuvZ, 2);
    }
    const za = -k * D.L + D.T / 2;
    wallB.quad([-dw, 0, za], [0, 0, -D.T], [0, D.DH, 0], [1, 0, 0], k, wuvX, 0.3, 0.8);
    wallB.quad([dw, 0, za], [0, 0, -D.T], [0, D.DH, 0], [-1, 0, 0], k, wuvX, 0.3, 0.8);
    wallB.quad([-dw, D.DH, za], [2 * dw, 0, 0], [0, 0, -D.T], [0, -1, 0], k, wuvZ, 0.3, 0.42);
  }
  const floor = new THREE.Mesh(floorB.build(), floorMat); floor.receiveShadow = true;
  const walls = new THREE.Mesh(wallB.build(), wallMat); walls.receiveShadow = true;
  const ceil = new THREE.Mesh(ceilB.build(), ceilMat);
  const reveal = new THREE.Mesh(revB.build(), revealMat);
  scene.add(floor, walls, ceil, reveal);
  refs.floorMat = floorMat;

  // ----- floor reflection (blurred, fresnel-weighted, additive over the concrete)
  if (quality.reflections) {
    const refl = new Reflector(new THREE.PlaneGeometry(D.W, D.N * D.L), {
      textureWidth: quality.reflW, textureHeight: quality.reflH, clipBias: 0.003, multisample: 0,
      shader: {
        name: 'FloorReflection',
        uniforms: { color: { value: null }, tDiffuse: { value: null }, textureMatrix: { value: null }, uNoise: { value: null }, uStrength: { value: 0.3 }, uBlur: { value: 0.012 } },
        vertexShader: `uniform mat4 textureMatrix; varying vec4 vUv; varying vec3 vWorld;
          void main(){ vUv = textureMatrix * vec4(position,1.0); vec4 wp = modelMatrix * vec4(position,1.0); vWorld = wp.xyz; gl_Position = projectionMatrix * viewMatrix * wp; }`,
        fragmentShader: `uniform sampler2D tDiffuse; uniform sampler2D uNoise; uniform float uStrength; uniform float uBlur; varying vec4 vUv; varying vec3 vWorld;
          void main(){
            vec2 uv = vUv.xy / vUv.w;
            vec3 nz = texture2D(uNoise, vec2(vWorld.x / 3.0 + 0.5, -vWorld.z / 3.0)).xyz * 2.0 - 1.0;
            uv += nz.xy * 0.006;
            vec3 acc = vec3(0.0); float ws = 0.0;
            for (int i = 0; i < 16; i++) {
              float a = float(i) * 2.39996; float r = sqrt(float(i) + 0.5) / 4.0;
              vec2 o = vec2(cos(a), sin(a)) * r * uBlur;
              float w = 1.0 - r * 0.6;
              acc += texture2D(tDiffuse, uv + o).rgb * w; ws += w;
            }
            vec3 c = acc / ws;
            vec3 V = normalize(cameraPosition - vWorld);
            float fres = 0.04 + 0.96 * pow(1.0 - clamp(V.y, 0.0, 1.0), 5.0);
            gl_FragColor = vec4(c * uStrength * (0.25 + fres * 1.6), 1.0);
          }`,
      },
    });
    refl.material.uniforms.uNoise.value = floorMat.normalMap;
    refl.material.transparent = true;
    refl.material.blending = THREE.AdditiveBlending;
    refl.material.depthWrite = false;
    refl.rotation.x = -Math.PI / 2;
    refl.position.set(0, 0.0015, -D.N * D.L / 2);
    refl.renderOrder = 1;
    scene.add(refl);
    refs.reflector = refl;
  }

  // ----- laylights
  const layTex = canvasTex(TX.laylightPanel(7, 9), { aniso });
  for (let i = 0; i < D.N; i++) {
    const m = new THREE.MeshBasicMaterial({ map: layTex, color: new THREE.Color(1, 0.985, 0.97) });
    const p = new THREE.Mesh(new THREE.PlaneGeometry(LAY.x, LAY.z), m);
    p.rotation.x = Math.PI / 2;
    p.position.set(0, D.H + LAY.depth, roomZ(i));
    scene.add(p);
    refs.laylights.push(m);
  }

  // ----- track rails, fixtures, spots
  const black = new THREE.MeshStandardMaterial({ color: 0x1b1a1a, roughness: 0.45, metalness: 0.3 });
  const railX = HW - 1.95;
  for (let i = 0; i < D.N; i++) {
    for (const sx of [-1, 1]) {
      const rail = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.03, D.L - 3), black);
      rail.position.set(sx * railX, D.H - 0.015, roomZ(i));
      scene.add(rail);
    }
  }
  const lensGeo = new THREE.CircleGeometry(0.036, 24);
  const bodyGeo = new THREE.CylinderGeometry(0.045, 0.04, 0.17, 20, 1, true);
  const capGeo = new THREE.CircleGeometry(0.045, 20);
  const stemGeo = new THREE.CylinderGeometry(0.012, 0.012, 0.09, 8);
  const yoke = new THREE.Vector3();
  function addSpot(stop, pos, target, { cd = 90, angle = 0.4, penumbra = 0.75, shadow = false, color = 0xfff1e2 } = {}) {
    const L = new THREE.SpotLight(color, 0, 0, angle, penumbra, 2);
    L.position.copy(pos);
    L.target.position.copy(target);
    scene.add(L, L.target);
    if (shadow) {
      L.castShadow = true;
      L.shadow.mapSize.set(quality.shadowSize, quality.shadowSize);
      L.shadow.bias = -0.0004; L.shadow.normalBias = 0.02;
      L.shadow.radius = 4;
      L.shadow.camera.near = 0.5; L.shadow.camera.far = 14;
    }
    // fixture
    const g = new THREE.Group();
    const stem = new THREE.Mesh(stemGeo, black); stem.position.set(0, -0.045, 0);
    const pivot = new THREE.Group(); pivot.position.set(0, -0.1, 0);
    const body = new THREE.Mesh(bodyGeo, black); body.rotation.x = Math.PI / 2; body.position.z = 0.085 - 0.04;
    const cap = new THREE.Mesh(capGeo, black); cap.position.z = -0.04; cap.rotation.y = Math.PI;
    const lensMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(0, 0, 0) });
    const lens = new THREE.Mesh(lensGeo, lensMat); lens.position.z = 0.125;
    pivot.add(body, cap, lens);
    g.add(stem, pivot);
    g.position.set(pos.x, D.H - 0.03, pos.z);
    scene.add(g);
    g.updateMatrixWorld();
    yoke.copy(target);
    pivot.lookAt(yoke);
    L.position.set(pos.x, D.H - 0.13, pos.z);
    refs.spots.push({ light: L, cd, stop, lens: lensMat });
    return L;
  }

  // helpers for hanging
  const spotFor = (stop, C, N, w, h, opts = {}) => {
    // fixture ~30 degrees off vertical, on the rail nearest the wall
    const drop = D.H - 0.13 - C.y;
    const out = drop * Math.tan(THREE.MathUtils.degToRad(30));
    const pos = C.clone().addScaledVector(N, out); pos.y = D.H - 0.13;
    if (Math.abs(N.x) > 0.5) pos.x = -Math.sign(N.x) * railX;
    const dist = pos.distanceTo(C);
    const angle = Math.atan((Math.max(w, h) * 0.62) / dist);
    return addSpot(stop, pos, C.clone().add(new THREE.Vector3(0, -0.08, 0)), { angle, ...opts });
  };

  const shadowTex = canvasTex(TX.softRectShadow(256, 256, 22, 0.62), { aniso });
  const contactTex = canvasTex(TX.softRectShadow(256, 256, 30, 0.75), { aniso });
  const art = refs.art;

  function orient(obj, N) {
    obj.rotation.y = Math.atan2(N.x, N.z);
  }
  function hangCanvas(stop, room, C, N, w, h, piece, { depth = 0.045, rough = 0.62, nScale = 0.6, sideHex } = {}) {
    const g = new THREE.Group();
    const front = new THREE.MeshStandardMaterial({ map: canvasTex(piece.map, { aniso }), roughness: rough, metalness: 0 });
    if (piece.normal) { front.normalMap = canvasTex(piece.normal, { srgb: false, aniso }); front.normalScale = new THREE.Vector2(nScale, nScale); }
    const side = new THREE.MeshStandardMaterial({ color: new THREE.Color(sideHex || piece.side), roughness: 0.85 });
    bakeify(front); bakeify(side);
    const box = new THREE.Mesh(new THREE.BoxGeometry(w, h, depth), [side, side, side, side, front, side]);
    box.position.z = depth / 2 + 0.03;
    box.castShadow = false;
    const sh = new THREE.Mesh(new THREE.PlaneGeometry(w + 0.16, h + 0.2), new THREE.MeshBasicMaterial({ color: 0x000000, map: shadowTex, transparent: true, depthWrite: false, opacity: 0.55 }));
    sh.position.set(0, -0.045, 0.004);
    g.add(sh, box);
    g.position.copy(C);
    orient(g, N);
    scene.add(g);
    bakeMesh(box, room, 0.6);
    return g;
  }
  function label(stop, room, P, N, work) {
    const mat = bakeify(new THREE.MeshStandardMaterial({ map: canvasTex(TX.wallLabel(work), { aniso }), roughness: 0.7 }));
    const m = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.16, 0.004), mat);
    m.position.copy(P).addScaledVector(N, 0.003);
    orient(m, N);
    scene.add(m);
    bakeMesh(m, room, 0.3);
    return m;
  }

  // Preserve the original 3D architecture and canvas mounting; display Sarah's actual paintings.
  const photoFiles = [
    '01-hooded-portrait.webp', '02-crowned-figure.webp',
    '03-checkered-vase-flowers.webp', '04-bread-and-fish.webp',
    '05-walker-with-sheep.webp', '06-landscape-winding-path.webp',
    '07-blue-yellow-florals.webp', '08-floral-portrait-green.webp',
    '09-red-floral-abstract.webp', '10-purple-flowers.webp'
  ];
  const photographs = await Promise.all(photoFiles.map(file => new Promise(resolve => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => { console.warn('Unable to load gallery painting:', file); resolve(null); };
    img.src = '/artworks/' + file;
  })));
  function photo(index, w = 900, h = 1100) {
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#f2eeea'; ctx.fillRect(0, 0, w, h);
    const img = photographs[index];
    if (img) {
      // Fit the entire original painting; neutral mount prevents destructive cropping.
      const scale = Math.min((w - 18) / img.width, (h - 18) / img.height);
      const iw = img.width * scale, ih = img.height * scale;
      ctx.drawImage(img, (w - iw) / 2, (h - ih) / 2, iw, ih);
    } else {
      ctx.fillStyle = '#746a67'; ctx.font = '28px sans-serif';
      ctx.textAlign = 'center'; ctx.fillText('Artwork unavailable', w / 2, h / 2);
    }
    return { map: c, side: '#dfd7cf' };
  }

  // ----- works
  await step('Hanging the works');
  const W0 = new THREE.Vector3(1, 0, 0), WX = new THREE.Vector3(-1, 0, 0), WZ = new THREE.Vector3(0, 0, 1);

  // A real painting in the foyer, while retaining the original centerpiece sculpture.
  {
    const C = new THREE.Vector3(HW, 2.0, roomZ(0) - 1.1);
    hangCanvas(0, 0, C, WX, 1.75, 2.2, photo(0), { nScale: 0.08 });
    spotFor(0, C.clone().setX(HW - 0.05), WX, 2, 2.4, { cd: 80 });
  }
  // Stop 1: painting (left wall)
  {
    const C = new THREE.Vector3(-HW, 2.0, roomZ(1));
    hangCanvas(1, 1, C, W0, 2.0, 2.5, photo(1), { nScale: 0.08 });
    spotFor(1, C.clone().setX(-HW + 0.05), W0, 2.2, 2.6, { cd: 110 });
    label(1, 1, new THREE.Vector3(-HW, 1.45, roomZ(1) - 1.8 - 0.35), W0, WORKS[1]);
    art[1] = { center: C.clone().setX(-HW + 0.07), normal: W0.clone(), w: 2.0, h: 2.5 };
  }
  // Stop 2: Five Holdings (right wall)
  {
    const cx = roomZ(2), C = new THREE.Vector3(HW, 1.95, cx);
    const pw = 1.42, ph = 1.85, gap = 0.48, tot = 3 * pw + 2 * gap;
    for (let i = 0; i < 3; i++) {
      const pc = photo(i + 2);
      // on the right wall, moving along -z goes to the viewer's right; order panels left-to-right as seen
      const z = cx - tot / 2 + pw / 2 + i * (pw + gap);
      hangCanvas(2, 2, new THREE.Vector3(HW, 1.95, z), WX, pw, ph, pc, { nScale: 0.22, depth: 0.04 });
    }
    spotFor(2, new THREE.Vector3(HW - 0.05, 1.95, cx + 1.7), WX, 3.2, 1.6, { cd: 95 });
    spotFor(2, new THREE.Vector3(HW - 0.05, 1.95, cx - 1.7), WX, 3.2, 1.6, { cd: 95 });
    label(2, 2, new THREE.Vector3(HW, 1.45, cx + tot / 2 + 0.4), WX, WORKS[2]);
    art[2] = { center: C.clone().setX(HW - 0.07), normal: WX.clone(), w: tot, h: ph };
  }
  // Stop 3: Signal / Noise I-III (left wall, framed and glazed)
  {
    const cz = roomZ(3);
    const fw = 1.45, fh = 1.85, gap = 0.55, tot = 2 * fw + gap;
    const frameMat = bakeify(new THREE.MeshStandardMaterial({ color: 0xf6f4f0, roughness: 0.6 }));
    const matMat = bakeify(new THREE.MeshStandardMaterial({ color: 0xfbfaf7, roughness: 0.92 }));
    const glassMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.03, metalness: 0, transparent: true, opacity: 0.05, envMapIntensity: 1.4, depthWrite: false });
    for (let i = 0; i < 2; i++) {
      const z = cz + tot / 2 - fw / 2 - i * (fw + gap);
      const g = new THREE.Group();
      const fd = 0.045, fb = 0.03;
      const parts = [
        [fw, fb, 0, fh / 2 - fb / 2], [fw, fb, 0, -fh / 2 + fb / 2],
        [fb, fh - 2 * fb, -fw / 2 + fb / 2, 0], [fb, fh - 2 * fb, fw / 2 - fb / 2, 0],
      ];
      const meshes = [];
      for (const [pw, ph, px, py] of parts) {
        const m = new THREE.Mesh(new THREE.BoxGeometry(pw, ph, fd), frameMat);
        m.position.set(px, py, fd / 2 + 0.02); g.add(m); meshes.push(m);
      }
      const back = new THREE.Mesh(new THREE.PlaneGeometry(fw - 2 * fb, fh - 2 * fb), matMat);
      back.position.z = 0.026; g.add(back); meshes.push(back);
      const pr = photo(i + 5);
      const printMat = bakeify(new THREE.MeshStandardMaterial({ map: canvasTex(pr.map, { aniso }), roughness: 0.9 }));
      const iw = fw - 2 * fb - 0.16, ih = (fh - 2 * fb - 0.16);
      const print = new THREE.Mesh(new THREE.PlaneGeometry(iw, ih), printMat);
      print.position.set(0, 0.012, 0.0275); g.add(print); meshes.push(print);
      // mat bevel shadow
      const glass = new THREE.Mesh(new THREE.PlaneGeometry(fw - 2 * fb, fh - 2 * fb), glassMat);
      glass.position.z = 0.058; g.add(glass);
      const sh = new THREE.Mesh(new THREE.PlaneGeometry(fw + 0.14, fh + 0.18), new THREE.MeshBasicMaterial({ color: 0, map: shadowTex, transparent: true, depthWrite: false, opacity: 0.5 }));
      sh.position.set(0, -0.04, 0.004); g.add(sh);
      g.position.set(-HW, 1.72, z);
      orient(g, W0);
      scene.add(g);
      for (const m of meshes) bakeMesh(m, 3, 0.4);
    }
    spotFor(3, new THREE.Vector3(-HW + 0.05, 1.72, cz - 1.2), W0, 2.6, 1.5, { cd: 85 });
    spotFor(3, new THREE.Vector3(-HW + 0.05, 1.72, cz + 1.2), W0, 2.6, 1.5, { cd: 85 });
    label(3, 3, new THREE.Vector3(-HW, 1.45, cz - tot / 2 - 0.4), W0, WORKS[3]);
    art[3] = { center: new THREE.Vector3(-HW + 0.07, 1.72, cz), normal: W0.clone(), w: tot, h: fh };
  }
  // Stop 5: Line of Conduct (right wall)
  {
    const C = new THREE.Vector3(HW, 2.0, roomZ(5));
    hangCanvas(5, 5, C, WX, 1.85, 2.48, photo(8), { nScale: 0.08 });
    spotFor(5, new THREE.Vector3(HW - 0.05, 2.0, roomZ(5) + 1.0), WX, 2.6, 2.2, { cd: 85 });
    spotFor(5, new THREE.Vector3(HW - 0.05, 2.0, roomZ(5) - 1.0), WX, 2.6, 2.2, { cd: 85 });
    label(5, 5, new THREE.Vector3(HW, 1.45, roomZ(5) + 2.0 + 0.35), WX, WORKS[5]);
    art[5] = { center: C.clone().setX(HW - 0.07), normal: WX.clone(), w: 1.85, h: 2.48 };
  }
  // Stop 6: Open Door (end wall)
  {
    const C = new THREE.Vector3(0, 2.05, zEnd);
    hangCanvas(6, 6, C, WZ, 2.18, 2.66, photo(9), { nScale: 0.08, depth: 0.05 });
    spotFor(6, new THREE.Vector3(-1.1, 2.05, zEnd + 0.05), WZ, 2.6, 2.8, { cd: 95 });
    spotFor(6, new THREE.Vector3(1.1, 2.05, zEnd + 0.05), WZ, 2.6, 2.8, { cd: 95 });
    label(6, 6, new THREE.Vector3(2.1 + 0.4, 1.45, zEnd), WZ, WORKS[6]);
    art[6] = { center: new THREE.Vector3(0, 2.05, zEnd + 0.08), normal: WZ.clone(), w: 2.18, h: 2.66 };
    // cross rail for end-wall fixtures
    const rail = new THREE.Mesh(new THREE.BoxGeometry(D.W - 4, 0.03, 0.035), black);
    rail.position.set(0, D.H - 0.015, zEnd + (D.H - 0.13 - 2.05) * Math.tan(THREE.MathUtils.degToRad(30)));
    scene.add(rail);
  }

  // ----- sculpture: Foundation (stop 0)
  await step('Setting the stone');
  {
    const trav = bakeify(new THREE.MeshStandardMaterial({ map: canvasTex(TX.marble(hi ? 1024 : 512, 12), { aniso }), roughness: 0.32 }));
    const bronze = bakeify(new THREE.MeshStandardMaterial({ color: 0x4a3a2c, roughness: 0.42, metalness: 1 }));
    const plinthMat = bakeify(new THREE.MeshStandardMaterial({ color: 0xf4f2ef, roughness: 0.85 }));
    const P = new THREE.Vector3(2.7, 0, -10.2);
    const g = new THREE.Group(); g.position.copy(P); scene.add(g);
    const plinth = new THREE.Mesh(new RoundedBoxGeometry(0.66, 0.78, 0.66, 2, 0.006), plinthMat);
    plinth.position.y = 0.39; plinth.castShadow = true; plinth.receiveShadow = true; g.add(plinth);
    let y = 0.78;
    const stack = [[0.62, 0.21, 0.48, 0.05, trav], [0.5, 0.27, 0.4, -0.2, trav], [0.42, 0.028, 0.42, 0.12, bronze], [0.55, 0.17, 0.36, 0.32, trav], [0.3, 0.3, 0.3, -0.05, trav], [0.2, 0.09, 0.2, 0.5, trav]];
    const parts = [plinth];
    for (const [w, h, d, rot, mat] of stack) {
      const m = new THREE.Mesh(new RoundedBoxGeometry(w, h, d, 3, Math.min(0.006, h / 4)), mat);
      m.position.set(0, y + h / 2, 0); m.rotation.y = rot;
      m.castShadow = true; m.receiveShadow = true;
      g.add(m); parts.push(m); y += h;
    }
    for (const m of parts) bakeMesh(m, 0, 0.6);
    const cs = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 1.2), new THREE.MeshBasicMaterial({ color: 0, map: contactTex, transparent: true, depthWrite: false, opacity: 0.6 }));
    cs.rotation.x = -Math.PI / 2; cs.position.set(P.x, 0.003, P.z); scene.add(cs);
    const top = new THREE.Vector3(P.x, 1.25, P.z);
    addSpot(0, new THREE.Vector3(railX, 0, P.z + 1.9), top, { cd: 70, angle: 0.3, penumbra: 0.8, shadow: quality.shadows });
    art[0] = { center: new THREE.Vector3(P.x, 1.3, P.z), plinthTop: 0.78, w: 0.7, h: 1.85 };
    // vinyl label on the plinth face
    const lm = bakeify(new THREE.MeshStandardMaterial({ map: canvasTex(TX.wallLabel(WORKS[0]), { aniso }), roughness: 0.7 }));
    const l = new THREE.Mesh(new THREE.PlaneGeometry(0.12, 0.16), lm);
    l.position.set(P.x - 0.18, 0.62, P.z + 0.331); scene.add(l); bakeMesh(l, 0, 0.3);
  }

  // ----- sculpture: Compound (stop 4)
  {
    const P = new THREE.Vector3(-1.0, 0, roomZ(4));
    const stone = bakeify(new THREE.MeshStandardMaterial({ color: 0x9e9a96, roughness: 0.55 }));
    const base = new THREE.Mesh(new RoundedBoxGeometry(1.5, 0.14, 1.5, 2, 0.01), stone);
    base.position.set(P.x, 0.07, P.z); base.receiveShadow = true; base.castShadow = true; scene.add(base); bakeMesh(base, 4, 0.6);
    const knotGeo = new THREE.TorusKnotGeometry(0.58, 0.16, hi ? 420 : 240, hi ? 56 : 32, 2, 3);
    knotGeo.scale(1, 1.22, 0.95);
    knotGeo.computeBoundingBox();
    const steel = new THREE.MeshStandardMaterial({ color: 0xf2f2f4, metalness: 1, roughness: 0.07 });
    const knot = new THREE.Mesh(knotGeo, steel);
    knot.position.set(P.x, 0.14 - knotGeo.boundingBox.min.y - 0.02, P.z);
    knot.rotation.y = 0.5;
    knot.castShadow = true;
    scene.add(knot);
    refs.mirrors.push({ mesh: knot, at: new THREE.Vector3(P.x, 1.2, P.z) });
    const cs = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 2.2), new THREE.MeshBasicMaterial({ color: 0, map: contactTex, transparent: true, depthWrite: false, opacity: 0.45 }));
    cs.rotation.x = -Math.PI / 2; cs.position.set(P.x, 0.003, P.z); scene.add(cs);
    const c = new THREE.Vector3(P.x, 1.05, P.z);
    addSpot(4, new THREE.Vector3(railX, 0, P.z + 2.2), c, { cd: 75, angle: 0.38, penumbra: 0.85, shadow: quality.shadows });
    addSpot(4, new THREE.Vector3(-railX, 0, P.z - 1.8), c, { cd: 60, angle: 0.4, penumbra: 0.85 });
    art[4] = { center: new THREE.Vector3(P.x, 1.2, P.z), w: 1.6, h: 2.1 };
    // lectern with label
    const lect = new THREE.Mesh(new RoundedBoxGeometry(0.34, 1.0, 0.22, 2, 0.004), bakeify(new THREE.MeshStandardMaterial({ color: 0xf4f2ef, roughness: 0.85 })));
    lect.position.set(P.x - 1.75, 0.5, P.z + 1.3); lect.rotation.y = 0.5; scene.add(lect); bakeMesh(lect, 4, 0.6);
    const lm = bakeify(new THREE.MeshStandardMaterial({ map: canvasTex(TX.wallLabel(WORKS[4]), { aniso }), roughness: 0.7 }));
    const l = new THREE.Mesh(new THREE.PlaneGeometry(0.12, 0.16), lm);
    l.position.set(P.x - 1.75, 1.003, P.z + 1.3); l.rotation.set(-Math.PI / 2, 0, 0.5); scene.add(l); bakeMesh(l, 4, 0.3);
  }

  // Gallery room IV painting, beside the existing sculpture.
  {
    const C = new THREE.Vector3(HW, 2.05, roomZ(4) - 1.0);
    hangCanvas(4, 4, C, WX, 1.8, 2.3, photo(7), { nScale: 0.08 });
    spotFor(4, C.clone().setX(HW - 0.05), WX, 2.0, 2.4, { cd: 84 });
  }

  // ----- benches
  {
    const oak = bakeify(new THREE.MeshStandardMaterial({ map: canvasTex(TX.whiteOak(), { aniso }), roughness: 0.55 }));
    const benches = [[1.6, roomZ(1), Math.PI / 2, 1], [-0.0, -D.N * D.L + 4.4, 0, 6], [-2.2, roomZ(5), Math.PI / 2, 5]];
    for (const [x, z, ry, room] of benches) {
      const bg = new THREE.Group(); bg.position.set(x, 0, z); bg.rotation.y = ry; scene.add(bg);
      const top = new THREE.Mesh(new RoundedBoxGeometry(1.9, 0.07, 0.46, 3, 0.01), oak); top.position.y = 0.415;
      const l1 = new THREE.Mesh(new RoundedBoxGeometry(0.07, 0.38, 0.42, 2, 0.006), oak); l1.position.set(-0.78, 0.19, 0);
      const l2 = l1.clone(); l2.position.x = 0.78;
      for (const m of [top, l1, l2]) { m.castShadow = true; bg.add(m); }
      for (const m of [top, l1, l2]) bakeMesh(m, room, 0.7);
      const cs = new THREE.Mesh(new THREE.PlaneGeometry(2.3, 0.8), new THREE.MeshBasicMaterial({ color: 0, map: contactTex, transparent: true, depthWrite: false, opacity: 0.6 }));
      cs.rotation.x = -Math.PI / 2; cs.rotation.z = ry; cs.position.set(x, 0.003, z); scene.add(cs);
    }
  }

  // ----- wall vinyl: wordmark over the first portal, foyer statement, room numbers
  await step('Applying the wall text');
  {
    const wm = TX.wallText([
      { text: 'SARAH NORRIS/GYENING', size: 240, tracking: 46, y: 470, color: '#de625d', weight: 600, fit: 0.94 },
      { text: 'ORIGINAL ART  ·  A COLLECTION IN SEVEN ROOMS', size: 64, tracking: 20, y: 690, color: '#3a3233', weight: 500 },
    ], { width: 4096, height: 1024 });
    const mat = bakeify(new THREE.MeshStandardMaterial({ map: canvasTex(wm, { aniso }), transparent: true, roughness: 0.92, depthWrite: false }));
    const m = new THREE.Mesh(new THREE.PlaneGeometry(7.2, 1.8), mat);
    m.position.set(0, 4.62, -D.L + D.T / 2 + 0.002);
    scene.add(m); bakeMesh(m, 0, 0);
    refs.wordmark = m;
    addSpot(0, new THREE.Vector3(0, 0, -D.L + D.T / 2 + 2.2), new THREE.Vector3(0, 4.3, -D.L + D.T / 2), { cd: 14, angle: 0.85, penumbra: 1 });
    refs.wordmarkSpot = refs.spots[refs.spots.length - 1];
    refs.wordmarkSpot.stop = 'wordmark';
    const rail = new THREE.Mesh(new THREE.BoxGeometry(4, 0.03, 0.035), black);
    rail.position.set(0, D.H - 0.015, -D.L + D.T / 2 + 2.2); scene.add(rail);
  }
  {
    const lines = [
      { text: 'ORIGINAL ARTWORK', size: 92, tracking: 18, y: 150, align: 'left', x: 0, weight: 600, color: '#2b2526' },
    ];
    const para = 'An exhibition of original paintings by Sarah Norris Gyening. Move through seven connected rooms to explore portraits, nature, color and storytelling. For details or availability, send Sarah an artwork inquiry.';
    const c = TX.wallText([], { width: 2048, height: 1400 });
    const ctx = c.getContext('2d');
    for (const ln of lines) {
      ctx.fillStyle = ln.color; ctx.font = `600 ${ln.size}px "Archivo", Helvetica, Arial, sans-serif`;
      let x = 0; for (const ch of ln.text) { ctx.fillText(ch, x, ln.y); x += ctx.measureText(ch).width + ln.tracking; }
    }
    ctx.font = '400 54px "Archivo", Helvetica, Arial, sans-serif'; ctx.fillStyle = '#3a3233';
    let y = 300;
    for (const l of TX.wrapText(ctx, para, 1900)) { ctx.fillText(l, 0, y); y += 80; }
    ctx.fillStyle = '#de625d'; ctx.fillRect(0, y + 30, 160, 10);
    const mat = bakeify(new THREE.MeshStandardMaterial({ map: canvasTex(c, { aniso }), transparent: true, roughness: 0.92, depthWrite: false }));
    const m = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 2.6 * 1400 / 2048), mat);
    m.position.set(-HW + 0.002, 1.75, -7.4); m.rotation.y = Math.PI / 2;
    scene.add(m); bakeMesh(m, 0, 0);
  }
  for (let k = 1; k < D.N; k++) {
    const ch = CHAPTERS[k];
    const c = TX.wallText([
      { text: ch.num, size: 260, tracking: 6, y: 300, align: 'left', x: 10, color: '#de625d', weight: 300 },
      { text: ch.short.toUpperCase(), size: 74, tracking: 14, y: 430, align: 'left', x: 14, color: '#2b2526', weight: 600 },
    ], { width: 1024, height: 512 });
    const mat = bakeify(new THREE.MeshStandardMaterial({ map: canvasTex(c, { aniso }), transparent: true, roughness: 0.92, depthWrite: false }));
    const m = new THREE.Mesh(new THREE.PlaneGeometry(1.0, 0.5), mat);
    m.position.set(D.DW / 2 + 0.55 + 0.5, 2.15, -k * D.L + D.T / 2 + 0.002);
    scene.add(m); bakeMesh(m, k - 1, 0);
  }

  refs.railX = railX;
  return refs;
}
