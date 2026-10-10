import * as THREE from 'three';

const TAU = Math.PI * 2;

/** Angles are measured in the XZ plane: direction(a) = (cos a, 0, sin a). */
export const dir = (a: number, out = new THREE.Vector3()) => out.set(Math.cos(a), 0, Math.sin(a));

/** Wrap an angle into [0, TAU). */
export const wrap = (a: number) => ((a % TAU) + TAU) % TAU;

/**
 * A solid cake wedge (or the whole cake when the span is TAU).
 * Material groups: 0 = top, 1 = outer wall, 2 = cut faces, 3 = underside.
 * UVs on the wall use absolute angle so the frosting texture is continuous between
 * the slice and the rest of the cake.
 */
export function makeSector(radius: number, height: number, a0: number, a1: number): THREE.BufferGeometry {
  const span = a1 - a0;
  const full = span >= TAU - 1e-4;
  const segs = Math.max(2, Math.ceil((span / TAU) * 128));

  const pos: number[] = [];
  const nor: number[] = [];
  const uv: number[] = [];
  const idx: number[] = [];
  const groups: Array<{ start: number; count: number; mat: number }> = [];

  const push = (x: number, y: number, z: number, nx: number, ny: number, nz: number, u: number, v: number) => {
    pos.push(x, y, z);
    nor.push(nx, ny, nz);
    uv.push(u, v);
    return pos.length / 3 - 1;
  };
  const group = (mat: number, from: number) => {
    groups.push({ start: from, count: idx.length - from, mat });
  };

  // ── top ──
  let start = idx.length;
  const centreTop = push(0, height, 0, 0, 1, 0, 0.5, 0.5);
  const topRing: number[] = [];
  for (let i = 0; i <= segs; i++) {
    const a = a0 + (span * i) / segs;
    topRing.push(push(Math.cos(a) * radius, height, Math.sin(a) * radius, 0, 1, 0, 0.5 + Math.cos(a) * 0.5, 0.5 + Math.sin(a) * 0.5));
  }
  for (let i = 0; i < segs; i++) idx.push(centreTop, topRing[i + 1], topRing[i]);
  group(0, start);

  // ── outer wall ──
  start = idx.length;
  const wall: Array<[number, number]> = [];
  for (let i = 0; i <= segs; i++) {
    const a = a0 + (span * i) / segs;
    const c = Math.cos(a);
    const s = Math.sin(a);
    const u = (a / TAU) * 3; // texture wraps 3x around the cake
    const lo = push(c * radius, 0, s * radius, c, 0, s, u, 0);
    const hi = push(c * radius, height, s * radius, c, 0, s, u, 1);
    wall.push([lo, hi]);
  }
  for (let i = 0; i < segs; i++) {
    const [l0, h0] = wall[i];
    const [l1, h1] = wall[i + 1];
    idx.push(l0, h1, l1, l0, h0, h1);
  }
  group(1, start);

  // ── cut faces ──
  if (!full) {
    start = idx.length;
    const face = (a: number, flip: boolean) => {
      const c = Math.cos(a);
      const s = Math.sin(a);
      // outward normal of the face is -tangent at a0 and +tangent at a1
      const t = flip ? 1 : -1;
      const nx = -s * t;
      const nz = c * t;
      const i0 = push(0, 0, 0, nx, 0, nz, 0, 0);
      const i1 = push(c * radius, 0, s * radius, nx, 0, nz, 1, 0);
      const i2 = push(c * radius, height, s * radius, nx, 0, nz, 1, 1);
      const i3 = push(0, height, 0, nx, 0, nz, 0, 1);
      if (flip) idx.push(i0, i1, i2, i0, i2, i3);
      else idx.push(i0, i2, i1, i0, i3, i2);
    };
    face(a0, false);
    face(a1, true);
    group(2, start);
  }

  // ── underside ──
  start = idx.length;
  const centreBottom = push(0, 0, 0, 0, -1, 0, 0.5, 0.5);
  const botRing: number[] = [];
  for (let i = 0; i <= segs; i++) {
    const a = a0 + (span * i) / segs;
    botRing.push(push(Math.cos(a) * radius, 0, Math.sin(a) * radius, 0, -1, 0, 0.5 + Math.cos(a) * 0.5, 0.5 + Math.sin(a) * 0.5));
  }
  for (let i = 0; i < segs; i++) idx.push(centreBottom, botRing[i], botRing[i + 1]);
  group(3, start);

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geo.setIndex(idx);
  groups.forEach((g) => geo.addGroup(g.start, g.count, g.mat));
  return geo;
}

/** How far the ganache runs down the side of the cake at angle a (0.05 – ~0.3). */
export function dripDepth(a: number): number {
  const wave = Math.sin(a * 11 + 1.3 * Math.sin(a * 3)) * 0.5 + 0.5;
  const mod = 0.55 + 0.45 * Math.sin(a * 5 + 2);
  return 0.07 + 0.2 * Math.pow(wave, 2.6) * mod;
}

/** Angles where a drip reaches a local maximum, for placing the droplet at its tip. */
export function dripTips(): number[] {
  const tips: number[] = [];
  const n = 720;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * TAU;
    const d = dripDepth(a);
    if (d > 0.17 && d >= dripDepth(a - TAU / n) && d > dripDepth(a + TAU / n)) tips.push(a);
  }
  return tips;
}

/** The glossy chocolate skirt that runs over the rim of the cake, with an uneven drip edge. */
export function makeGanacheBand(radius: number, height: number, a0: number, a1: number): THREE.BufferGeometry {
  const span = a1 - a0;
  const segs = Math.max(2, Math.ceil((span / TAU) * 360));
  const pos: number[] = [];
  const nor: number[] = [];
  const idx: number[] = [];
  const r = radius + 0.012;
  for (let i = 0; i <= segs; i++) {
    const a = a0 + (span * i) / segs;
    const c = Math.cos(a);
    const s = Math.sin(a);
    pos.push(c * r, height + 0.006, s * r, c * r, height - dripDepth(a), s * r);
    nor.push(c, 0, s, c, 0, s);
  }
  for (let i = 0; i < segs; i++) {
    const t0 = i * 2;
    const b0 = t0 + 1;
    const t1 = t0 + 2;
    const b1 = t0 + 3;
    // wound so the front face looks away from the cake
    idx.push(b0, t1, b1, b0, t0, t1);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  geo.setIndex(idx);
  return geo;
}

/** Piped cream "kiss": a ridged cone, lathed. Base sits on y = 0. */
export function makeKissGeometry(): THREE.LatheGeometry {
  const pts = [
    [0.0, 0.0],
    [0.062, 0.0],
    [0.068, 0.012],
    [0.056, 0.026],
    [0.06, 0.038],
    [0.046, 0.05],
    [0.048, 0.062],
    [0.032, 0.074],
    [0.03, 0.084],
    [0.014, 0.096],
    [0.006, 0.108],
    [0.0, 0.118],
  ].map(([x, y]) => new THREE.Vector2(x, y));
  return new THREE.LatheGeometry(pts, 14);
}

/** Strawberry lathed with its tip up, base on y = 0. */
export function makeStrawberryGeometry(): THREE.LatheGeometry {
  const pts = [
    [0.0, 0.0],
    [0.03, 0.002],
    [0.062, 0.025],
    [0.08, 0.065],
    [0.078, 0.105],
    [0.06, 0.145],
    [0.036, 0.178],
    [0.012, 0.2],
    [0.0, 0.208],
  ].map(([x, y]) => new THREE.Vector2(x, y));
  return new THREE.LatheGeometry(pts, 16);
}
