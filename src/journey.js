// Camera stops, the scroll path between them, and the 15-second opening film.
import * as THREE from 'three';
import { D, roomZ } from './world.js';
import { smoothstep, smootherstep, clamp } from './util.js';

const UP = new THREE.Vector3(0, 1, 0);
const deg = THREE.MathUtils.degToRad;

export function layoutFor(w, h) {
  const aspect = w / h;
  const mobile = aspect < 0.85;
  const fov = mobile ? 60 : aspect < 1.25 ? 52 : 44;
  return { aspect, mobile, fov };
}

function quatLook(pos, target) {
  const m = new THREE.Matrix4().lookAt(pos, target, UP);
  return new THREE.Quaternion().setFromRotationMatrix(m);
}

// side: +1 = panel on the right (work sits left of centre), -1 = panel on the left.
export function computeStops(L, art) {
  const tv = Math.tan(deg(L.fov / 2)), th = tv * L.aspect;
  const stops = [];

  function wallStop(a, side, fill, maxD) {
    const N = a.normal, F = N.clone().negate();
    const R = new THREE.Vector3().crossVectors(F, UP).normalize();
    let d, pos, target;
    if (!L.mobile) {
      d = clamp(a.w / (fill * 2 * th), 3.4, maxD);
      const visW = 2 * d * th;
      pos = a.center.clone().addScaledVector(N, d).addScaledVector(R, side * d * 0.1);
      pos.y = 1.62;
      target = a.center.clone().addScaledVector(R, side * visW * 0.17);
      target.y = a.center.y - 0.12;
    } else {
      d = clamp(Math.max(a.w / (0.9 * 2 * th), a.h / (0.36 * 2 * tv)), 3.4, maxD);
      const visH = 2 * d * tv;
      pos = a.center.clone().addScaledVector(N, d);
      pos.y = 1.75;
      target = a.center.clone();
      target.y = a.center.y - visH * 0.2;
    }
    return { pos, target };
  }

  // 0 Arrival: the first portal with the wordmark above it; Foundation stands to the right.
  {
    const portal = new THREE.Vector3(0, 2.75, -D.L + D.T / 2);
    if (!L.mobile) {
      const pos = new THREE.Vector3(-0.6, 1.62, -1.7);
      const d = pos.distanceTo(portal);
      const target = portal.clone(); target.x -= 2 * d * th * 0.15;
      stops.push({ pos, target });
    } else {
      const pos = new THREE.Vector3(0.2, 1.6, -0.9);
      stops.push({ pos, target: new THREE.Vector3(0.35, 1.35, -14.8) });
    }
  }
  stops.push(wallStop(art[1], 1, 0.42, D.W - 1.2));
  stops.push(wallStop(art[2], -1, 0.62, D.W - 1.0));
  stops.push(wallStop(art[3], 1, 0.46, D.W - 1.2));
  // 4 Investments: Compound, a free-standing sculpture.
  {
    const S = art[4].center;
    if (!L.mobile) {
      const pos = new THREE.Vector3(S.x + 3.7, 1.7, S.z + 4.3);
      const F = S.clone().sub(pos).normalize();
      const R = new THREE.Vector3().crossVectors(F, UP).normalize();
      const d = pos.distanceTo(S);
      const target = S.clone().addScaledVector(R, -2 * d * th * 0.17); target.y = 1.05;
      stops.push({ pos, target });
    } else {
      const pos = new THREE.Vector3(S.x + 2.6, 1.95, S.z + 6.6);
      const target = S.clone(); target.y = -0.35;
      stops.push({ pos, target });
    }
  }
  stops.push(wallStop(art[5], -1, 0.5, D.W - 1.2));
  stops.push(wallStop(art[6], 1, 0.44, 12.5));

  for (const s of stops) s.q = quatLook(s.pos, s.target);
  return stops;
}

export function buildPath(stops, L) {
  const pts = [];
  const qs = [];
  const eye = L.mobile ? 1.7 : 1.65;
  for (let k = 0; k < stops.length; k++) {
    pts.push(stops[k].pos.clone()); qs.push(stops[k].q);
    if (k < stops.length - 1) {
      const door = new THREE.Vector3(0, eye, -(k + 1) * D.L);
      pts.push(door);
      qs.push(quatLook(door, new THREE.Vector3(0, eye - 0.05, door.z - 10)));
    }
  }
  const curve = new THREE.CatmullRomCurve3(pts, false, 'centripetal', 0.5);
  return { curve, qs, n: pts.length, segs: stops.length - 1 };
}

const _q = new THREE.Quaternion();
// P runs from 0 (arrival) to 6 (contact). Dwell near each stop, travel between.
export function evalPath(path, P, outPos, outQuat) {
  const S = path.segs;
  const p = clamp(P, 0, S);
  let k = Math.min(S - 1, Math.floor(p));
  const f = p - k;
  const u = smootherstep(0.16, 0.84, f);
  const t = (2 * k + 2 * u) / (path.n - 1);
  path.curve.getPoint(t, outPos);
  if (u < 0.5) {
    outQuat.copy(path.qs[2 * k]).slerp(path.qs[2 * k + 1], smoothstep(0, 1, u * 2));
  } else {
    outQuat.copy(path.qs[2 * k + 1]).slerp(path.qs[2 * k + 2], smoothstep(0, 1, (u - 0.5) * 2));
  }
  return u;
}

// ---------------------------------------------------------------------------------------------
// Opening film: Hermite-interpolated camera keys, light cues and type cues.
export const FILM_LEN = 15;

export function filmKeys(stop0) {
  const V = (x, y, z) => new THREE.Vector3(x, y, z);
  return [
    { t: 0.0, p: V(5.3, 0.72, -7.5), q: V(2.7, 0.95, -10.2) },
    { t: 1.4, p: V(4.0, 0.9, -6.7), q: V(2.7, 1.1, -10.2) },
    { t: 2.8, p: V(1.7, 1.15, -7.3), q: V(2.6, 1.3, -10.2) },
    { t: 4.3, p: V(0.95, 1.45, -9.0), q: V(0.3, 1.8, -40) },
    { t: 6.2, p: V(0.6, 1.65, -11.0), q: V(0.05, 1.85, -70) },
    { t: 8.1, p: V(0.3, 1.85, -12.9), q: V(0.0, 1.9, -104) },
    { t: 9.9, p: V(-0.75, 3.05, -11.9), q: V(-0.55, 4.62, -14.8) },
    { t: 11.7, p: V(-0.45, 2.45, -7.6), q: V(-0.3, 3.7, -14.8) },
    { t: FILM_LEN, p: stop0.pos.clone(), q: stop0.target.clone() },
  ];
}

function hermite(keys, field, t, out) {
  const n = keys.length;
  if (t <= keys[0].t) return out.copy(keys[0][field]);
  if (t >= keys[n - 1].t) return out.copy(keys[n - 1][field]);
  let i = 0;
  while (i < n - 2 && t > keys[i + 1].t) i++;
  const k0 = keys[i], k1 = keys[i + 1];
  const dt = k1.t - k0.t;
  const s = (t - k0.t) / dt;
  const tan = (j) => {
    if (j <= 0 || j >= n - 1) return new THREE.Vector3();
    return keys[j + 1][field].clone().sub(keys[j - 1][field]).divideScalar(keys[j + 1].t - keys[j - 1].t);
  };
  const m0 = tan(i), m1 = tan(i + 1);
  const s2 = s * s, s3 = s2 * s;
  const h00 = 2 * s3 - 3 * s2 + 1, h10 = s3 - 2 * s2 + s, h01 = -2 * s3 + 3 * s2, h11 = s3 - s2;
  out.set(0, 0, 0)
    .addScaledVector(k0[field], h00).addScaledVector(m0, h10 * dt)
    .addScaledVector(k1[field], h01).addScaledVector(m1, h11 * dt);
  return out;
}

export function filmCamera(keys, t, outPos, outTarget) {
  if (!keys[0].d) for (const k of keys) k.d = k.q.clone().sub(k.p).normalize();
  hermite(keys, 'p', t, outPos);
  hermite(keys, 'd', t, outTarget);
  outTarget.normalize().multiplyScalar(10).add(outPos);
}

// Light levels during the film. Returns {room:[7], spot(stop), wordmark, env}
export function filmLights(t) {
  const room = [];
  for (let k = 0; k < D.N; k++) {
    const t0 = 2.85 + 0.42 * k;
    room.push(smoothstep(t0, t0 + 0.3, t) * (1 + 0.12 * Math.exp(-Math.max(0, t - t0 - 0.3) * 6) * (t > t0 + 0.3 ? 1 : 0)));
  }
  const first = t < 0.32 ? 0 : t < 0.42 ? 0.7 : t < 0.5 ? 0.12 : t < 0.58 ? 0.9 : t < 0.63 ? 0.4 : 1;
  const spot = (stop) => {
    if (stop === 0) return first;
    if (stop === 'wordmark') return smoothstep(9.0, 10.3, t);
    const t0 = 2.85 + 0.42 * stop + 0.22;
    return smoothstep(t0, t0 + 0.12, t);
  };
  return { room, spot, env: smoothstep(2.9, 6.5, t) };
}

export const CUES = [
  { t0: 0.45, t1: 2.75, text: 'A world of color' },
  { t0: 3.0, t1: 5.5, text: 'told through original paintings' },
  { t0: 5.75, t1: 8.35, text: 'a collection of expression', weight: true },
  { t0: 8.6, t1: 11.1, text: 'Light. Texture.|Imagination.' },
  { t0: 11.4, t1: 14.6, text: 'Seven rooms · Ten paintings · One artist', small: true },
];
