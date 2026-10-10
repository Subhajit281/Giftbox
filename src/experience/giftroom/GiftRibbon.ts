import * as THREE from 'three';

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
const ease = (x: number) => x * x * (3 - 2 * x);

interface StripData {
  mesh: THREE.Mesh;
  base: Float32Array;
  sample: number; // samples along the path
  cols: number; // vertices across the width
  t: Float32Array; // 0 = top centre, 1 = back at the top after going round the bottom
  out: THREE.Vector3[]; // outward direction (in the strap's plane) per sample
  phase: number;
}

/**
 * Builds a flat cloth-like strip along a curve. `sides` gives the width direction at each sample; the
 * strip bulges gently across its width and ripples along its length so it reads as satin, not a plank.
 */
function buildStrip(pts: THREE.Vector3[], sides: THREE.Vector3[], widths: number[], closed: boolean, bulge: number, wave: number, freq: number, cols = 6) {
  const N = pts.length;
  const pos = new Float32Array(N * cols * 3);
  const tan = new THREE.Vector3();
  const face = new THREE.Vector3();
  for (let i = 0; i < N; i++) {
    const a = pts[closed ? (i + 1) % N : Math.min(N - 1, i + 1)];
    const b = pts[closed ? (i - 1 + N) % N : Math.max(0, i - 1)];
    tan.subVectors(a, b).normalize();
    face.crossVectors(tan, sides[i]).normalize();
    for (let j = 0; j < cols; j++) {
      const s = j / (cols - 1);
      const across = (s - 0.5) * widths[i];
      const lift = bulge * (1 - Math.pow(2 * s - 1, 2)) + wave * Math.sin(i * freq + s * 2.2);
      const o = (i * cols + j) * 3;
      pos[o] = pts[i].x + sides[i].x * across + face.x * lift;
      pos[o + 1] = pts[i].y + sides[i].y * across + face.y * lift;
      pos[o + 2] = pts[i].z + sides[i].z * across + face.z * lift;
    }
  }
  const idx: number[] = [];
  const lim = closed ? N : N - 1;
  for (let i = 0; i < lim; i++) {
    const n = (i + 1) % N;
    for (let j = 0; j < cols - 1; j++) {
      const a = i * cols + j;
      const b = n * cols + j;
      idx.push(a, b, a + 1, b, n * cols + j + 1, a + 1);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3).setUsage(THREE.DynamicDrawUsage));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

/**
 * Satin gift ribbon: two straps wrapping the whole box (over the lid, down the sides, under the base) plus a
 * soft bow. `update(q)` peels the straps off from the top and lets them fall and fade like loosened cloth.
 */
export class GiftRibbon {
  readonly mat: THREE.MeshPhysicalMaterial;
  private readonly straps: StripData[] = [];

  constructor(size: number, height: number, bow: THREE.Group, bands: THREE.Group) {
    this.mat = new THREE.MeshPhysicalMaterial({
      color: 0xe6b445,
      roughness: 0.34,
      metalness: 0.3,
      sheen: 1,
      sheenColor: new THREE.Color(0xfff0b8),
      sheenRoughness: 0.35,
      side: THREE.DoubleSide,
      transparent: true,
    });

    // ── wrap path: a rounded rectangle in profile that clears the box, lid and gold trim ──
    const half = size / 2 + 0.1;
    const top = height / 2 + 0.38;
    const bottom = -height / 2 - 0.05;
    const r = 0.16;
    const N = 168;
    const outline: Array<{ p: THREE.Vector2; n: THREE.Vector2 }> = [];
    // walk: top centre → right side → bottom → left side → top (clockwise), arc-length parametrised
    const corners = [
      { c: new THREE.Vector2(half - r, top - r), a0: Math.PI / 2, a1: 0 },
      { c: new THREE.Vector2(half - r, bottom + r), a0: 0, a1: -Math.PI / 2 },
      { c: new THREE.Vector2(-half + r, bottom + r), a0: -Math.PI / 2, a1: -Math.PI },
      { c: new THREE.Vector2(-half + r, top - r), a0: Math.PI, a1: Math.PI / 2 },
    ];
    const segs: Array<(u: number) => { p: THREE.Vector2; n: THREE.Vector2 }> = [];
    const lens: number[] = [];
    const line = (a: THREE.Vector2, b: THREE.Vector2, n: THREE.Vector2) => {
      segs.push((u) => ({ p: a.clone().lerp(b, u), n }));
      lens.push(a.distanceTo(b));
    };
    const arc = (c: THREE.Vector2, a0: number, a1: number) => {
      segs.push((u) => {
        const a = a0 + (a1 - a0) * u;
        const n = new THREE.Vector2(Math.cos(a), Math.sin(a));
        return { p: c.clone().addScaledVector(n, r), n };
      });
      lens.push(Math.abs(a1 - a0) * r);
    };
    line(new THREE.Vector2(0, top), new THREE.Vector2(half - r, top), new THREE.Vector2(0, 1));
    arc(corners[0].c, corners[0].a0, corners[0].a1);
    line(new THREE.Vector2(half, top - r), new THREE.Vector2(half, bottom + r), new THREE.Vector2(1, 0));
    arc(corners[1].c, corners[1].a0, corners[1].a1);
    line(new THREE.Vector2(half - r, bottom), new THREE.Vector2(-half + r, bottom), new THREE.Vector2(0, -1));
    arc(corners[2].c, corners[2].a0, corners[2].a1);
    line(new THREE.Vector2(-half, bottom + r), new THREE.Vector2(-half, top - r), new THREE.Vector2(-1, 0));
    arc(corners[3].c, corners[3].a0, corners[3].a1);
    line(new THREE.Vector2(-half + r, top), new THREE.Vector2(0, top), new THREE.Vector2(0, 1));
    const total = lens.reduce((a, b) => a + b, 0);
    for (let i = 0; i < N; i++) {
      let d = (i / N) * total;
      let k = 0;
      while (k < segs.length - 1 && d > lens[k]) { d -= lens[k]; k++; }
      outline.push(segs[k](clamp01(d / lens[k])));
    }

    const width = 0.34;
    const make = (alongX: boolean, lift: number, seed: number) => {
      const pts: THREE.Vector3[] = [];
      const sides: THREE.Vector3[] = [];
      const out: THREE.Vector3[] = [];
      const t = new Float32Array(N * 6);
      outline.forEach(({ p, n }, i) => {
        const o = alongX ? V(p.x + n.x * lift, p.y + n.y * lift, 0) : V(0, p.y + n.y * lift, p.x + n.x * lift);
        pts.push(o);
        sides.push(alongX ? V(0, 0, 1) : V(1, 0, 0));
        out.push(alongX ? V(n.x, n.y, 0) : V(0, n.y, n.x));
        for (let j = 0; j < 6; j++) t[i * 6 + j] = i / N;
      });
      const geo = buildStrip(pts, sides, new Array(N).fill(width), true, 0.016, 0.006, 0.42 + seed * 0.05);
      const mesh = new THREE.Mesh(geo, this.mat);
      mesh.castShadow = true;
      bands.add(mesh);
      this.straps.push({
        mesh,
        base: (geo.attributes.position.array as Float32Array).slice(),
        sample: N,
        cols: 6,
        t,
        out,
        phase: seed,
      });
    };
    make(true, 0, 0);
    make(false, 0.014, 1.7);

    // ── soft bow: belt-like loops standing on the lid, a knot and two wavy tails ──
    const loop = (rx: number, ry: number, tilt: number, rotY: number, w: number) => {
      const M = 56;
      const pts: THREE.Vector3[] = [];
      const sides: THREE.Vector3[] = [];
      for (let i = 0; i < M; i++) {
        const th = (i / M) * Math.PI * 2;
        const x = rx * 0.5 * (1 - Math.cos(th));
        const y = ry * Math.sin(th) * Math.sin(th / 2) * 1.35;
        pts.push(V(x, y, 0));
        sides.push(V(0, 0, 1));
      }
      const g = buildStrip(pts, sides, new Array(M).fill(w), true, 0.02, 0.008, 0.5, 5);
      const m = new THREE.Mesh(g, this.mat);
      m.rotation.set(0, rotY, tilt);
      m.position.y = 0.04;
      m.castShadow = true;
      bow.add(m);
    };
    loop(0.62, 0.3, 0.22, 0, 0.3);
    loop(0.62, 0.3, 0.22, Math.PI, 0.3);
    loop(0.44, 0.22, 0.42, Math.PI / 2, 0.26);
    loop(0.44, 0.22, 0.42, -Math.PI / 2, 0.26);
    const knot = new THREE.Mesh(new THREE.SphereGeometry(0.15, 20, 14), this.mat);
    knot.scale.set(1.15, 0.85, 1);
    knot.position.y = 0.07;
    bow.add(knot);
    for (const sgn of [-1, 1]) {
      const M = 28;
      const pts: THREE.Vector3[] = [];
      const sides: THREE.Vector3[] = [];
      const ws: number[] = [];
      for (let i = 0; i < M; i++) {
        const u = i / (M - 1);
        pts.push(V(sgn * (0.1 + u * 0.55), 0.05 - u * u * 0.3, 0.1 + Math.sin(u * 5) * 0.05 * sgn));
        sides.push(V(0, 0.3, 1).normalize());
        ws.push(0.2 * (1 - u * 0.3));
      }
      const g = buildStrip(pts, sides, ws, false, 0.012, 0.008, 0.8, 4);
      const m = new THREE.Mesh(g, this.mat);
      m.castShadow = true;
      bow.add(m);
    }

    this.update(0);
  }

  /** q: 0 = tied tight, 1 = fallen and gone. */
  update(q: number) {
    const floorY = -0.65; // just above the inner floor of the box group
    for (const s of this.straps) {
      const pos = s.mesh.geometry.attributes.position as THREE.BufferAttribute;
      const arr = pos.array as Float32Array;
      for (let i = 0; i < s.sample; i++) {
        const t = s.t[i * s.cols];
        const fromTop = Math.min(t, 1 - t) * 2; // 0 at the top centre → 1 at the bottom
        const r = ease(clamp01((q - fromTop * 0.42) / 0.58));
        const n = s.out[i];
        const sway = 0.3 + 0.35 * Math.sin(i * 0.23 + s.phase);
        for (let j = 0; j < s.cols; j++) {
          const o = (i * s.cols + j) * 3;
          const bx = s.base[o];
          const by = s.base[o + 1];
          const bz = s.base[o + 2];
          const fall = ease(clamp01(r * 1.15));
          const ripple = Math.sin(i * 0.5 + j * 0.8 + s.phase) * 0.05 * r;
          arr[o] = bx + n.x * r * sway + ripple * n.z;
          arr[o + 1] = THREE.MathUtils.lerp(by, floorY + 0.03 + 0.02 * Math.sin(i * 0.9 + j), fall) + Math.sin(r * Math.PI) * 0.12;
          arr[o + 2] = bz + n.z * r * sway + ripple * n.x;
        }
      }
      pos.needsUpdate = true;
      s.mesh.geometry.computeVertexNormals();
    }
    this.mat.opacity = 1 - ease(clamp01((q - 0.72) / 0.28));
  }
}
