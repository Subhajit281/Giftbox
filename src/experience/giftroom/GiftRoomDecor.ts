import * as THREE from 'three';
import { glowTexture, mulberry, shadowBlobTexture, softDotTexture } from '../birthday/textures';

const FLOOR = -1.15;
const PALETTE = [0xe0527a, 0xf2cf77, 0xfff0e2, 0xf7a8c4, 0x8e2250, 0xffb48a, 0xc9a0ff];
const PAPER = ['#e0527a', '#f2cf77', '#fff0e2', '#f7a8c4', '#b02a5c', '#ffb48a'];
const rnd = (r: () => number, a: number, b: number) => a + r() * (b - a);

function canvas(w: number, h: number) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return { c, ctx: c.getContext('2d')! };
}

/** Half-circle paper fan with pleats and a scalloped edge. */
function fanTexture(base: string, accent: string) {
  const { c, ctx } = canvas(512, 280);
  const cx = 256;
  const cy = 270;
  const R = 250;
  const n = 18;
  for (let i = 0; i < n; i++) {
    const a0 = Math.PI + (i / n) * Math.PI;
    const a1 = Math.PI + ((i + 1) / n) * Math.PI;
    const g = ctx.createRadialGradient(cx, cy, 10, cx, cy, R);
    const light = i % 2 === 0;
    g.addColorStop(0, light ? base : accent);
    g.addColorStop(1, light ? accent : base);
    ctx.fillStyle = g;
    ctx.globalAlpha = light ? 1 : 0.82;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.arc(cx, cy, R, a0, a1);
    ctx.closePath();
    ctx.fill();
  }
  ctx.globalAlpha = 1;
  ctx.strokeStyle = 'rgba(255,255,255,0.45)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(cx, cy, R * 0.62, Math.PI, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = '#f2cf77';
  for (let i = 0; i <= n; i++) {
    const a = Math.PI + (i / n) * Math.PI;
    ctx.beginPath();
    ctx.arc(cx + Math.cos(a) * (R - 8), cy + Math.sin(a) * (R - 8), 5, 0, 7);
    ctx.fill();
  }
  ctx.fillStyle = '#f2cf77';
  ctx.beginPath();
  ctx.arc(cx, cy, 22, Math.PI, Math.PI * 2);
  ctx.fill();
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/** A soft rose-and-gold rug that rings the pedestal. */
function rugTexture() {
  const S = 1024;
  const { c, ctx } = canvas(S, S);
  const m = S / 2;
  const fade = ctx.createRadialGradient(m, m, 0, m, m, m);
  fade.addColorStop(0, 'rgba(110,26,64,1)');
  fade.addColorStop(0.8, 'rgba(90,20,52,0.95)');
  fade.addColorStop(1, 'rgba(90,20,52,0)');
  ctx.fillStyle = fade;
  ctx.fillRect(0, 0, S, S);
  ctx.strokeStyle = 'rgba(242,207,119,0.85)';
  for (const [r, w] of [[0.9, 3], [0.8, 6], [0.68, 2], [0.6, 3]] as const) {
    ctx.lineWidth = w;
    ctx.beginPath();
    ctx.arc(m, m, m * r, 0, 7);
    ctx.stroke();
  }
  for (let i = 0; i < 36; i++) {
    const a = (i / 36) * Math.PI * 2;
    ctx.save();
    ctx.translate(m + Math.cos(a) * m * 0.74, m + Math.sin(a) * m * 0.74);
    ctx.rotate(a);
    ctx.fillStyle = i % 2 ? 'rgba(247,168,196,0.75)' : 'rgba(242,207,119,0.75)';
    ctx.beginPath();
    ctx.ellipse(0, 0, 20, 8, 0, 0, 7);
    ctx.fill();
    ctx.restore();
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

interface Cluster {
  weight: THREE.Vector3;
  balloons: Array<{ mesh: THREE.Mesh; off: THREE.Vector3; ph: number }>;
}

/**
 * Party dressing for the gift room: balloon clusters, balloons resting on the floor, paper bunting,
 * paper fans, lanterns, pom-poms, confetti, a rug and fairy lights. Purely decorative and cheap.
 */
export class GiftRoomDecor {
  readonly group = new THREE.Group();
  private readonly clusters: Cluster[] = [];
  private readonly stringPos: Float32Array;
  private readonly strings: THREE.LineSegments;
  private readonly sways: Array<{ obj: THREE.Object3D; amp: number; speed: number; ph: number }> = [];
  private readonly fairy: THREE.Points;
  private readonly lanternGlows: THREE.Sprite[] = [];

  constructor(mobile: boolean) {
    const rng = mulberry(2020);
    const gold = new THREE.MeshStandardMaterial({ color: 0xf2cf77, metalness: 0.9, roughness: 0.25 });

    // balloon geometry (teardrop-ish) and materials
    const body = new THREE.SphereGeometry(0.34, 22, 16);
    const bp = body.attributes.position;
    for (let i = 0; i < bp.count; i++) {
      const y = bp.getY(i);
      const taper = y < 0 ? 1 + y * 0.55 : 1;
      bp.setXYZ(i, bp.getX(i) * 0.9 * taper, y * 1.14, bp.getZ(i) * 0.9 * taper);
    }
    body.computeVertexNormals();
    const knotGeo = new THREE.ConeGeometry(0.04, 0.08, 8);
    knotGeo.translate(0, -0.04, 0);
    const mats = PALETTE.map((c) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.2, metalness: 0.12 }));
    const makeBalloon = (i: number, scale = 1) => {
      const mat = mats[i % mats.length];
      const m = new THREE.Mesh(body, mat);
      const knot = new THREE.Mesh(knotGeo, mat);
      knot.position.y = -0.39;
      m.add(knot);
      m.scale.setScalar(scale);
      return m;
    };

    // ── rug ──
    const rug = new THREE.Mesh(
      new THREE.CircleGeometry(6.2, 64),
      new THREE.MeshBasicMaterial({ map: rugTexture(), transparent: true, depthWrite: false, toneMapped: false, opacity: 0.8 }),
    );
    rug.rotation.x = -Math.PI / 2;
    rug.position.y = FLOOR + 0.006;
    this.group.add(rug);

    // ── balloon clusters tied to weights ──
    const spots: Array<[number, number]> = [[-5.2, -4.6], [5.2, -4.6], [-4.6, -1.6], [4.7, -1.8], [-2.5, -3.7], [2.6, -3.9]];
    const per = mobile ? 4 : 6;
    spots.forEach(([x, z], ci) => {
      const weight = new THREE.Vector3(x, FLOOR + 0.1, z);
      const w = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.2, 0.2, 16), gold);
      w.position.copy(weight);
      this.group.add(w);
      const cl: Cluster = { weight, balloons: [] };
      for (let i = 0; i < per; i++) {
        const m = makeBalloon(ci * 3 + i, rnd(rng, 0.9, 1.25));
        const off = new THREE.Vector3(rnd(rng, -0.55, 0.55), rnd(rng, 1.7, 3.3), rnd(rng, -0.4, 0.4));
        this.group.add(m);
        cl.balloons.push({ mesh: m, off, ph: rnd(rng, 0, 6.28) });
      }
      this.clusters.push(cl);
    });
    const total = this.clusters.reduce((n, c) => n + c.balloons.length, 0);
    this.stringPos = new Float32Array(total * 4 * 3);
    const sg = new THREE.BufferGeometry();
    sg.setAttribute('position', new THREE.BufferAttribute(this.stringPos, 3).setUsage(THREE.DynamicDrawUsage));
    this.strings = new THREE.LineSegments(sg, new THREE.LineBasicMaterial({ color: 0xf6e7c8, transparent: true, opacity: 0.75 }));
    this.strings.frustumCulled = false;
    this.group.add(this.strings);

    // ── balloons resting on the floor ──
    const floorSpots: Array<[number, number, number]> = [
      [-4.2, 1.2, 0.3], [-3.6, 2.6, 1.1], [-5.3, -0.6, 2.0], [-3.9, -2.3, 0.7], [-1.6, -4.1, 1.5],
      [1.3, -4.6, 0.4], [4.8, -2.0, 2.4], [5.7, -3.0, 0.9], [4.5, 2.5, 1.8], [3.6, -3.4, 2.9], [-2.3, -2.9, 3.6],
    ];
    const shadow = shadowBlobTexture();
    floorSpots.slice(0, mobile ? 8 : floorSpots.length).forEach(([x, z, yaw], i) => {
      const b = makeBalloon(i + 2, 1.15);
      b.rotation.set(0, yaw, Math.PI / 2 + rnd(rng, -0.25, 0.25), 'YXZ');
      b.position.set(x, FLOOR + 0.31 * 1.15, z);
      this.group.add(b);
      const blob = new THREE.Mesh(
        new THREE.PlaneGeometry(1.2, 1.2),
        new THREE.MeshBasicMaterial({ map: shadow, transparent: true, opacity: 0.55, depthWrite: false, toneMapped: false }),
      );
      blob.rotation.x = -Math.PI / 2;
      blob.position.set(x, FLOOR + 0.012, z);
      this.group.add(blob);
    });

    // ── poles, garlands, fairy lights ──
    const poleSpots: Array<[number, number]> = [[-5.2, -4.6], [5.2, -4.6], [-4.6, -1.6], [4.7, -1.8]];
    const poleH = 5.2;
    const poleGeo = new THREE.CylinderGeometry(0.035, 0.05, poleH, 10);
    poleGeo.translate(0, poleH / 2, 0);
    const finial = new THREE.SphereGeometry(0.1, 14, 10);
    for (const [x, z] of poleSpots) {
      const pole = new THREE.Mesh(poleGeo, gold);
      pole.position.set(x, FLOOR, z);
      const top = new THREE.Mesh(finial, gold);
      top.position.y = poleH;
      pole.add(top);
      this.group.add(pole);
    }
    const top = (x: number, z: number) => new THREE.Vector3(x, FLOOR + poleH - 0.15, z);
    const garlands: Array<[THREE.Vector3, THREE.Vector3, number]> = [
      [top(-5.2, -4.6), top(5.2, -4.6), 1.3],
      [top(-5.2, -4.6).add(new THREE.Vector3(0, -1.0, 0.25)), top(5.2, -4.6).add(new THREE.Vector3(0, -1.0, 0.25)), 0.8],
      [top(-5.2, -4.6), top(-4.6, -1.6), 0.5],
      [top(5.2, -4.6), top(4.7, -1.8), 0.5],
    ];
    const tri = new THREE.BufferGeometry();
    tri.setAttribute('position', new THREE.BufferAttribute(new Float32Array([-0.17, 0, 0, 0.17, 0, 0, 0, -0.44, 0]), 3));
    tri.computeVertexNormals();
    const pennantMat = new THREE.MeshStandardMaterial({ color: 0xffffff, side: THREE.DoubleSide, roughness: 0.88 });
    const pennantCount = garlands.length * (mobile ? 14 : 22);
    const pennants = new THREE.InstancedMesh(tri, pennantMat, pennantCount);
    const dummy = new THREE.Object3D();
    const col = new THREE.Color();
    const bulbs: number[] = [];
    let pi = 0;
    const perG = pennantCount / garlands.length;
    for (const [A, B, sag] of garlands) {
      const yaw = Math.atan2(-(B.z - A.z), B.x - A.x);
      const at = (u: number, out: THREE.Vector3) => out.lerpVectors(A, B, u).setY(THREE.MathUtils.lerp(A.y, B.y, u) - sag * 4 * u * (1 - u));
      const p = new THREE.Vector3();
      const steps = 40;
      const line: number[] = [];
      for (let s = 0; s < steps; s++) {
        at(s / steps, p);
        line.push(p.x, p.y, p.z);
        at((s + 1) / steps, p);
        line.push(p.x, p.y, p.z);
      }
      const lg = new THREE.BufferGeometry();
      lg.setAttribute('position', new THREE.BufferAttribute(new Float32Array(line), 3));
      this.group.add(new THREE.LineSegments(lg, new THREE.LineBasicMaterial({ color: 0xf2cf77 })));
      for (let k = 0; k < perG; k++) {
        const u = (k + 0.5) / perG;
        at(u, p);
        dummy.position.copy(p);
        dummy.rotation.set(0, yaw, 0);
        dummy.updateMatrix();
        pennants.setMatrixAt(pi, dummy.matrix);
        pennants.setColorAt(pi, col.set(PAPER[(pi + Math.floor(rng() * 2)) % PAPER.length]));
        pi++;
      }
      for (let k = 0; k <= 16; k++) {
        at(k / 16, p);
        bulbs.push(p.x, p.y + 0.06, p.z);
      }
    }
    this.group.add(pennants);
    const bg = new THREE.BufferGeometry();
    bg.setAttribute('position', new THREE.BufferAttribute(new Float32Array(bulbs), 3));
    this.fairy = new THREE.Points(
      bg,
      new THREE.PointsMaterial({ map: softDotTexture(), color: 0xffdca0, size: 0.34, transparent: true, opacity: 0.95, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }),
    );
    this.group.add(this.fairy);

    // ── paper fans ──
    const fanSpecs: Array<[number, number, number, number, string, string]> = [
      [-5.2, -4.45, 3.5, 1.5, '#e0527a', '#f7a8c4'], [5.2, -4.45, 3.5, 1.5, '#e0527a', '#f7a8c4'],
      [-1.9, -5.3, 2.4, 2.4, '#f2cf77', '#fff0e2'], [0, -5.4, 2.7, 3.0, '#b02a5c', '#e0527a'], [1.9, -5.3, 2.4, 2.4, '#f2cf77', '#fff0e2'],
    ];
    for (const [x, z, y, size, a, b] of fanSpecs) {
      const fan = new THREE.Mesh(
        new THREE.PlaneGeometry(size, size * (280 / 512)),
        new THREE.MeshBasicMaterial({ map: fanTexture(a, b), transparent: true, side: THREE.DoubleSide, alphaTest: 0.05 }),
      );
      fan.position.set(x, y, z);
      this.group.add(fan);
      this.sways.push({ obj: fan, amp: 0.06, speed: 0.9, ph: x });
    }

    // ── lanterns and pom-poms on strings ──
    const lanternGeo = new THREE.CylinderGeometry(0.3, 0.3, 0.6, 14, 1, true);
    const pomGeo = new THREE.IcosahedronGeometry(0.34, 1);
    const hang = (x: number, z: number, drop: number, kind: 'lantern' | 'pom', color: number) => {
      const pivot = new THREE.Group();
      pivot.position.set(x, FLOOR + 6.4, z);
      const str = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, drop, 4), new THREE.MeshBasicMaterial({ color: 0xf2cf77 }));
      str.position.y = -drop / 2;
      pivot.add(str);
      if (kind === 'lantern') {
        const l = new THREE.Mesh(lanternGeo, new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.65, side: THREE.DoubleSide, roughness: 0.7 }));
        l.position.y = -drop - 0.3;
        pivot.add(l);
        const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(), color, transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }));
        glow.scale.setScalar(1.7);
        glow.position.y = -drop - 0.3;
        pivot.add(glow);
        this.lanternGlows.push(glow);
      } else {
        const pm = new THREE.Mesh(pomGeo, new THREE.MeshStandardMaterial({ color, flatShading: true, roughness: 0.95 }));
        pm.position.y = -drop - 0.34;
        pivot.add(pm);
      }
      this.group.add(pivot);
      this.sways.push({ obj: pivot, amp: 0.05, speed: rnd(rng, 0.7, 1.2), ph: rnd(rng, 0, 6) });
    };
    const lanternXs = mobile ? [-3.6, -1.2, 1.2, 3.6] : [-4.4, -2.9, -1.4, 0, 1.4, 2.9, 4.4];
    lanternXs.forEach((x, i) => hang(x, -3.2 - (i % 2) * 0.6, 2.6 + (i % 3) * 0.5, 'lantern', i % 2 ? 0xffc27a : 0xf7a8c4));
    [-3.4, -0.7, 2.2, 4.0].forEach((x, i) => hang(x, -2.4, 3.0 + (i % 2) * 0.7, 'pom', [0xf7a8c4, 0xfff0e2, 0xf2cf77, 0xe0527a][i]));

    // ── paper confetti on the floor ──
    const nConf = mobile ? 90 : 190;
    const conf = new THREE.InstancedMesh(
      new THREE.PlaneGeometry(0.12, 0.07),
      new THREE.MeshStandardMaterial({ color: 0xffffff, side: THREE.DoubleSide, roughness: 0.8 }),
      nConf,
    );
    for (let i = 0; i < nConf; i++) {
      const a = rnd(rng, 0, 6.283);
      const r = rnd(rng, 3.4, 7.5);
      dummy.position.set(Math.cos(a) * r, FLOOR + 0.012, Math.sin(a) * r * 0.85 - 0.5);
      dummy.rotation.set(-Math.PI / 2, 0, rnd(rng, 0, 6.28));
      dummy.updateMatrix();
      conf.setMatrixAt(i, dummy.matrix);
      conf.setColorAt(i, col.set(PAPER[i % PAPER.length]));
    }
    this.group.add(conf);
  }

  update(_dt: number, t: number) {
    // balloons bob; strings follow
    let s = 0;
    const a = new THREE.Vector3();
    const b = new THREE.Vector3();
    const mid = new THREE.Vector3();
    for (const cl of this.clusters) {
      for (const bl of cl.balloons) {
        const ph = bl.ph;
        bl.mesh.position.set(
          cl.weight.x + bl.off.x + Math.sin(t * 0.7 + ph) * 0.12,
          cl.weight.y + bl.off.y + Math.sin(t * 1.1 + ph) * 0.09,
          cl.weight.z + bl.off.z + Math.cos(t * 0.6 + ph) * 0.1,
        );
        bl.mesh.rotation.z = Math.sin(t * 0.8 + ph) * 0.08;
        a.set(cl.weight.x, cl.weight.y + 0.1, cl.weight.z);
        b.copy(bl.mesh.position);
        b.y -= 0.4 * bl.mesh.scale.y;
        mid.lerpVectors(a, b, 0.5);
        mid.x += Math.sin(t * 0.9 + ph) * 0.1;
        const o = s * 12;
        const P = this.stringPos;
        P[o] = a.x; P[o + 1] = a.y; P[o + 2] = a.z;
        P[o + 3] = mid.x; P[o + 4] = mid.y; P[o + 5] = mid.z;
        P[o + 6] = mid.x; P[o + 7] = mid.y; P[o + 8] = mid.z;
        P[o + 9] = b.x; P[o + 10] = b.y; P[o + 11] = b.z;
        s++;
      }
    }
    this.strings.geometry.attributes.position.needsUpdate = true;
    for (const w of this.sways) w.obj.rotation.z = Math.sin(t * w.speed + w.ph) * w.amp;
    (this.fairy.material as THREE.PointsMaterial).opacity = 0.75 + 0.2 * Math.sin(t * 2.4);
    this.lanternGlows.forEach((g, i) => (g.material.opacity = 0.45 + 0.12 * Math.sin(t * 1.6 + i)));
  }
}
