import * as THREE from 'three';
import { beamTexture, softDotTexture } from './textures';

const rnd = (a: number, b: number) => a + Math.random() * (b - a);
const pick = <T,>(arr: T[]) => arr[Math.floor(Math.random() * arr.length)];

export interface FloorField {
  floorY: number;
  tableY: number;
  tableR: number;
}

/** Height of whatever a falling piece of paper would land on. */
const landingHeight = (x: number, z: number, f: FloorField) =>
  Math.hypot(x, z) < f.tableR ? f.tableY + 0.004 : f.floorY + 0.004;

/* ───────────────────────────── Confetti ───────────────────────────── */

const CONFETTI_COLORS = [0xff5d8f, 0xffc857, 0xffffff, 0xff8fb8, 0xb28dff, 0x6fe0d0, 0xf0e68c, 0xff7a59];

export class Confetti {
  readonly mesh: THREE.InstancedMesh;
  private readonly n: number;
  private readonly pos: Float32Array;
  private readonly vel: Float32Array;
  private readonly rot: Float32Array;
  private readonly spin: Float32Array;
  private readonly phase: Float32Array;
  private readonly age: Float32Array;
  private readonly state: Uint8Array; // 0 idle, 1 flying, 2 landed
  private readonly dummy = new THREE.Object3D();
  private cursor = 0;

  private readonly field: FloorField;

  constructor(count: number, field: FloorField) {
    this.field = field;
    this.n = count;
    const geo = new THREE.PlaneGeometry(0.08, 0.045);
    const mat = new THREE.MeshBasicMaterial({ side: THREE.DoubleSide, toneMapped: false });
    this.mesh = new THREE.InstancedMesh(geo, mat, count);
    this.mesh.frustumCulled = false;
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    const c = new THREE.Color();
    for (let i = 0; i < count; i++) {
      c.setHex(pick(CONFETTI_COLORS)).multiplyScalar(0.8 + Math.random() * 0.4);
      this.mesh.setColorAt(i, c);
    }
    this.pos = new Float32Array(count * 3);
    this.vel = new Float32Array(count * 3);
    this.rot = new Float32Array(count * 3);
    this.spin = new Float32Array(count * 3);
    this.phase = new Float32Array(count);
    this.age = new Float32Array(count);
    this.state = new Uint8Array(count);
    this.dummy.scale.setScalar(0);
    this.dummy.updateMatrix();
    for (let i = 0; i < count; i++) this.mesh.setMatrixAt(i, this.dummy.matrix);
  }

  private spawn(x: number, y: number, z: number, vx: number, vy: number, vz: number) {
    const i = this.cursor;
    this.cursor = (this.cursor + 1) % this.n;
    this.pos.set([x, y, z], i * 3);
    this.vel.set([vx, vy, vz], i * 3);
    this.rot.set([rnd(0, 6.28), rnd(0, 6.28), rnd(0, 6.28)], i * 3);
    this.spin.set([rnd(-9, 9), rnd(-9, 9), rnd(-9, 9)], i * 3);
    this.phase[i] = rnd(0, 6.28);
    this.age[i] = 0;
    this.state[i] = 1;
  }

  /** A party-cannon blast: a fan of paper thrown up and across the room. */
  burst(origin: THREE.Vector3, aim: THREE.Vector3, count: number, speed = 8.5) {
    const d = aim.clone().normalize();
    for (let k = 0; k < count; k++) {
      const spread = 0.42;
      const v = new THREE.Vector3(
        d.x + rnd(-spread, spread),
        d.y + rnd(-spread * 0.6, spread * 0.6),
        d.z + rnd(-spread, spread),
      )
        .normalize()
        .multiplyScalar(speed * rnd(0.45, 1.1));
      this.spawn(origin.x + rnd(-0.1, 0.1), origin.y + rnd(0, 0.15), origin.z + rnd(-0.1, 0.1), v.x, v.y, v.z);
    }
  }

  /** Gentle shower from above. */
  rain(count: number, halfWidth: number, y: number, depth: number) {
    for (let k = 0; k < count; k++) {
      this.spawn(rnd(-halfWidth, halfWidth), y + rnd(0, 1.2), rnd(-depth, depth * 0.6), rnd(-0.3, 0.3), rnd(-0.6, 0), rnd(-0.3, 0.3));
    }
  }

  update(dt: number, time: number) {
    const f = this.field;
    const dragH = Math.exp(-1.5 * dt);
    const dragV = Math.exp(-1.15 * dt);
    let dirty = false;
    for (let i = 0; i < this.n; i++) {
      const st = this.state[i];
      if (st === 0) continue;
      dirty = true;
      const p = i * 3;
      if (st === 1) {
        this.age[i] += dt;
        this.vel[p] *= dragH;
        this.vel[p + 2] *= dragH;
        this.vel[p + 1] = (this.vel[p + 1] - 2.8 * dt) * dragV;
        const ph = this.phase[i];
        this.pos[p] += (this.vel[p] + Math.sin(time * 6.5 + ph) * 0.38) * dt;
        this.pos[p + 1] += this.vel[p + 1] * dt;
        this.pos[p + 2] += (this.vel[p + 2] + Math.cos(time * 5.5 + ph) * 0.32) * dt;
        this.rot[p] += this.spin[p] * dt;
        this.rot[p + 1] += this.spin[p + 1] * dt;
        this.rot[p + 2] += this.spin[p + 2] * dt;
        const ground = landingHeight(this.pos[p], this.pos[p + 2], f);
        if (this.pos[p + 1] <= ground && this.vel[p + 1] < 0) {
          this.pos[p + 1] = ground;
          this.state[i] = 2;
          this.rot[p] = -Math.PI / 2;
          this.rot[p + 1] = 0;
        }
      }
      this.dummy.position.set(this.pos[p], this.pos[p + 1], this.pos[p + 2]);
      if (this.state[i] === 1) {
        this.dummy.rotation.set(this.rot[p], this.rot[p + 1], this.rot[p + 2]);
        // tumbling paper flashes edge-on as it spins
        this.dummy.scale.set(1, 0.2 + 0.8 * Math.abs(Math.cos(time * 9 + this.phase[i])), 1);
      } else {
        this.dummy.rotation.set(-Math.PI / 2, 0, this.rot[p + 2]);
        this.dummy.scale.set(1, 1, 1);
      }
      this.dummy.updateMatrix();
      this.mesh.setMatrixAt(i, this.dummy.matrix);
    }
    if (dirty) this.mesh.instanceMatrix.needsUpdate = true;
  }

  clear() {
    this.state.fill(0);
    this.dummy.scale.setScalar(0);
    this.dummy.updateMatrix();
    for (let i = 0; i < this.n; i++) this.mesh.setMatrixAt(i, this.dummy.matrix);
    this.mesh.instanceMatrix.needsUpdate = true;
  }
}

/* ───────────────────────────── Streamers ───────────────────────────── */

const STREAMER_COLORS = [0xff4f87, 0xffc94a, 0xffffff, 0xa07cff, 0x5fe0cf, 0xff8a5c];

/** Curling paper ribbons that unspool from the party poppers. */
export class Streamers {
  readonly mesh: THREE.Mesh;
  private readonly count: number;
  private readonly segs: number;
  private readonly positions: Float32Array;
  private readonly p0: Float32Array;
  private readonly v0: Float32Array;
  private readonly t0: Float32Array;
  private readonly seed: Float32Array;
  private readonly lag = 0.05;

  private readonly field: FloorField;

  constructor(count: number, segs: number, field: FloorField) {
    this.field = field;
    this.count = count;
    this.segs = segs;
    const verts = count * (segs + 1) * 2;
    this.positions = new Float32Array(verts * 3);
    const colors = new Float32Array(verts * 3);
    const index: number[] = [];
    const c = new THREE.Color();
    for (let s = 0; s < count; s++) {
      c.setHex(pick(STREAMER_COLORS));
      for (let i = 0; i <= segs; i++) {
        const v = (s * (segs + 1) + i) * 2;
        const shade = 0.82 + 0.18 * Math.sin(i * 0.8);
        colors.set([c.r * shade, c.g * shade, c.b * shade, c.r * shade, c.g * shade, c.b * shade], v * 3);
        if (i < segs) index.push(v, v + 1, v + 2, v + 1, v + 3, v + 2);
      }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(this.positions, 3).setUsage(THREE.DynamicDrawUsage));
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geo.setIndex(index);
    const mat = new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide, toneMapped: false });
    this.mesh = new THREE.Mesh(geo, mat);
    this.mesh.frustumCulled = false;
    this.mesh.visible = false;
    this.p0 = new Float32Array(count * 3);
    this.v0 = new Float32Array(count * 3);
    this.t0 = new Float32Array(count).fill(1e9);
    this.seed = new Float32Array(count);
  }

  launch(origin: THREE.Vector3, aim: THREE.Vector3, now: number, speed = 8) {
    for (let s = 0; s < this.count; s++) {
      const v = new THREE.Vector3(aim.x + rnd(-0.4, 0.4), aim.y + rnd(-0.25, 0.3), aim.z + rnd(-0.45, 0.45))
        .normalize()
        .multiplyScalar(speed * rnd(0.55, 1.05));
      this.p0.set([origin.x, origin.y, origin.z], s * 3);
      this.v0.set([v.x, v.y, v.z], s * 3);
      this.t0[s] = now + rnd(0, 0.18);
      this.seed[s] = rnd(0, 6.28);
    }
    this.mesh.visible = true;
  }

  update(time: number) {
    if (!this.mesh.visible) return;
    const k = 1.35;
    const g = -3.1;
    const f = this.field;
    const P = this.positions;
    for (let s = 0; s < this.count; s++) {
      const tau = time - this.t0[s];
      const px = this.p0[s * 3];
      const py = this.p0[s * 3 + 1];
      const pz = this.p0[s * 3 + 2];
      const vx = this.v0[s * 3];
      const vy = this.v0[s * 3 + 1];
      const vz = this.v0[s * 3 + 2];
      for (let i = 0; i <= this.segs; i++) {
        const s0 = Math.max(0, tau - i * this.lag);
        const e = 1 - Math.exp(-k * s0);
        const wig = (i / this.segs) * Math.min(1, s0 * 1.4);
        const ph = this.seed[s] + i * 0.55 - time * 5;
        let x = px + (vx * e) / k + Math.sin(ph) * 0.09 * wig;
        let y = py + ((vy - g / k) * e) / k + (g / k) * s0 + Math.cos(ph * 0.8) * 0.05 * wig;
        let z = pz + (vz * e) / k + Math.cos(ph) * 0.09 * wig;
        const ground = landingHeight(x, z, f);
        if (y < ground) y = ground;
        const tw = this.seed[s] + i * 0.5;
        const wx = Math.cos(tw) * 0.028;
        const wz = Math.sin(tw) * 0.028;
        const hidden = tau < 0;
        const vi = (s * (this.segs + 1) + i) * 2;
        if (hidden) {
          x = px;
          y = py;
          z = pz;
        }
        P[vi * 3] = x - wx;
        P[vi * 3 + 1] = y;
        P[vi * 3 + 2] = z - wz;
        P[(vi + 1) * 3] = x + wx;
        P[(vi + 1) * 3 + 1] = y;
        P[(vi + 1) * 3 + 2] = z + wz;
      }
    }
    (this.mesh.geometry.attributes.position as THREE.BufferAttribute).needsUpdate = true;
  }

  hide() {
    this.mesh.visible = false;
    this.t0.fill(1e9);
  }
}

/* ───────────────────────────── Point particle pool ───────────────────────────── */

/** A pool of glowing points with per-particle life. Colour fades to black (additive) as a particle dies. */
class SparkPool {
  readonly points: THREE.Points;
  protected readonly n: number;
  protected readonly pos: Float32Array;
  protected readonly vel: Float32Array;
  protected readonly col: Float32Array;
  protected readonly base: Float32Array;
  protected readonly life: Float32Array;
  protected readonly maxLife: Float32Array;
  protected readonly gravity: Float32Array;
  protected readonly drag: Float32Array;
  private cursor = 0;

  constructor(count: number, size: number, map: THREE.Texture) {
    this.n = count;
    this.pos = new Float32Array(count * 3).fill(0);
    this.vel = new Float32Array(count * 3);
    this.col = new Float32Array(count * 3);
    this.base = new Float32Array(count * 3);
    this.life = new Float32Array(count);
    this.maxLife = new Float32Array(count).fill(1);
    this.gravity = new Float32Array(count);
    this.drag = new Float32Array(count);
    for (let i = 0; i < count; i++) this.pos[i * 3 + 1] = -50;
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage));
    geo.setAttribute('color', new THREE.BufferAttribute(this.col, 3).setUsage(THREE.DynamicDrawUsage));
    const mat = new THREE.PointsMaterial({
      size,
      map,
      vertexColors: true,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      sizeAttenuation: true,
      toneMapped: false,
    });
    this.points = new THREE.Points(geo, mat);
    this.points.frustumCulled = false;
  }

  protected emit(
    x: number, y: number, z: number,
    vx: number, vy: number, vz: number,
    color: THREE.Color, life: number, gravity: number, drag: number,
  ) {
    const i = this.cursor;
    this.cursor = (this.cursor + 1) % this.n;
    this.pos.set([x, y, z], i * 3);
    this.vel.set([vx, vy, vz], i * 3);
    this.base.set([color.r, color.g, color.b], i * 3);
    this.life[i] = life;
    this.maxLife[i] = life;
    this.gravity[i] = gravity;
    this.drag[i] = drag;
  }

  protected step(dt: number) {
    for (let i = 0; i < this.n; i++) {
      const p = i * 3;
      if (this.life[i] <= 0) {
        if (this.col[p] !== 0 || this.col[p + 1] !== 0 || this.col[p + 2] !== 0) {
          this.col[p] = this.col[p + 1] = this.col[p + 2] = 0;
        }
        continue;
      }
      this.life[i] -= dt;
      const d = Math.exp(-this.drag[i] * dt);
      this.vel[p] *= d;
      this.vel[p + 1] = (this.vel[p + 1] + this.gravity[i] * dt) * d;
      this.vel[p + 2] *= d;
      this.pos[p] += this.vel[p] * dt;
      this.pos[p + 1] += this.vel[p + 1] * dt;
      this.pos[p + 2] += this.vel[p + 2] * dt;
      const k = Math.max(0, this.life[i] / this.maxLife[i]);
      const fade = k * k * (0.55 + 0.45 * Math.sin(this.life[i] * 40 + i)); // glitter
      this.col[p] = this.base[p] * fade;
      this.col[p + 1] = this.base[p + 1] * fade;
      this.col[p + 2] = this.base[p + 2] * fade;
    }
    (this.points.geometry.attributes.position as THREE.BufferAttribute).needsUpdate = true;
    (this.points.geometry.attributes.color as THREE.BufferAttribute).needsUpdate = true;
  }

  reset() {
    this.life.fill(0);
    this.col.fill(0);
    for (let i = 0; i < this.n; i++) this.pos[i * 3 + 1] = -50;
  }
}

/* ───────────────────────────── Dust puffs ───────────────────────────── */

/** Short-lived glitter thrown off wherever something happens: the knife biting in, the slice landing. */
export class DustPuff extends SparkPool {
  constructor(count: number, size: number, map: THREE.Texture) {
    super(count, size, map);
  }

  puff(x: number, y: number, z: number, count: number, spread: number, color: number) {
    const c = new THREE.Color(color);
    for (let i = 0; i < count; i++) {
      const a = rnd(0, 6.28);
      const s = rnd(0.2, 1) * spread;
      this.emit(x + rnd(-0.03, 0.03), y, z + rnd(-0.03, 0.03), Math.cos(a) * s, rnd(0.6, 1.9) * spread, Math.sin(a) * s, c, rnd(0.6, 1.2), -3.2, 0.8);
    }
  }

  update(dt: number) {
    this.step(dt);
  }

  clear() {
    this.reset();
  }
}

/* ───────────────────────────── Fireworks ───────────────────────────── */

type Burst = 'peony' | 'ring' | 'willow' | 'heart';

interface Rocket {
  pos: THREE.Vector3;
  vel: THREE.Vector3;
  apex: number;
  color: THREE.Color;
  kind: Burst;
  alive: boolean;
}

const FIREWORK_COLORS = [0xff4f87, 0xffc94a, 0x8fd3ff, 0xc08bff, 0xff8a5c, 0xffffff, 0x7dffb2];

export class Fireworks extends SparkPool {
  private rockets: Rocket[] = [];
  private pending: Array<{ at: number; x: number; z: number; apex: number; kind: Burst; color: THREE.Color }> = [];
  private clock = 0;
  onBang?: () => void;

  private readonly floorY: number;

  constructor(count: number, size: number, map: THREE.Texture, floorY: number) {
    super(count, size, map);
    this.floorY = floorY;
  }

  schedule(delay: number, x: number, z: number, apex: number, kind: Burst, color?: number) {
    this.pending.push({
      at: this.clock + delay,
      x, z, apex, kind,
      color: new THREE.Color(color ?? pick(FIREWORK_COLORS)),
    });
  }

  private burst(r: Rocket) {
    const m = r.kind === 'heart' ? 110 : r.kind === 'ring' ? 70 : r.kind === 'willow' ? 90 : 100;
    const c = r.color;
    const alt = new THREE.Color().copy(c).lerp(new THREE.Color(0xffffff), 0.55);
    const axisTilt = new THREE.Euler(rnd(0, 3.14), rnd(0, 3.14), 0);
    for (let k = 0; k < m; k++) {
      let v = new THREE.Vector3();
      let life = rnd(1.5, 2.3);
      let g = -1.1;
      let drag = 1.35;
      if (r.kind === 'peony') {
        v.setFromSphericalCoords(rnd(2.4, 3.6), Math.acos(rnd(-1, 1)), rnd(0, 6.28));
      } else if (r.kind === 'ring') {
        const a = (k / m) * 6.283;
        v.set(Math.cos(a) * 3.4, Math.sin(a) * 3.4, 0).applyEuler(axisTilt);
      } else if (r.kind === 'willow') {
        v.setFromSphericalCoords(rnd(1.8, 3.2), Math.acos(rnd(-1, 1)), rnd(0, 6.28));
        life = rnd(2.4, 3.4);
        g = -1.8;
        drag = 1.0;
      } else {
        const t = (k / m) * 6.283;
        const hx = 16 * Math.pow(Math.sin(t), 3);
        const hy = 13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t);
        v.set(hx * 0.2, hy * 0.2 + 0.4, rnd(-0.12, 0.12));
        life = rnd(2.0, 2.6);
        g = -0.55;
      }
      const col = k % 3 === 0 ? alt : c;
      this.emit(r.pos.x, r.pos.y, r.pos.z, v.x, v.y, v.z, col, life, g, drag);
    }
    this.onBang?.();
  }

  update(dt: number) {
    this.clock += dt;
    // launch scheduled rockets
    for (let i = this.pending.length - 1; i >= 0; i--) {
      const p = this.pending[i];
      if (this.clock >= p.at) {
        this.pending.splice(i, 1);
        const rise = p.apex - this.floorY;
        this.rockets.push({
          pos: new THREE.Vector3(p.x, this.floorY + 0.4, p.z),
          vel: new THREE.Vector3(rnd(-0.15, 0.15), Math.sqrt(2 * 3.4 * rise) * 0.9, 0),
          apex: p.apex,
          color: p.color,
          kind: p.kind,
          alive: true,
        });
      }
    }
    // rockets
    for (const r of this.rockets) {
      if (!r.alive) continue;
      r.vel.y -= 3.4 * dt * 0.6;
      r.pos.addScaledVector(r.vel, dt);
      for (let t = 0; t < 2; t++) {
        this.emit(r.pos.x + rnd(-0.02, 0.02), r.pos.y, r.pos.z, rnd(-0.15, 0.15), rnd(-0.6, -0.2), rnd(-0.15, 0.15), new THREE.Color(0xffd9a0), 0.45, -0.5, 1.0);
      }
      if (r.pos.y >= r.apex || r.vel.y <= 0.2) {
        r.alive = false;
        this.burst(r);
      }
    }
    this.rockets = this.rockets.filter((r) => r.alive);
    this.step(dt);
  }

  clear() {
    this.pending.length = 0;
    this.rockets.length = 0;
    this.reset();
  }
}

/* ───────────────────────────── Spark fountains ───────────────────────────── */

export class SparkFountain extends SparkPool {
  private carry = 0;
  rate = 0; // particles per second
  readonly origin = new THREE.Vector3();
  private readonly gold = new THREE.Color(0xffc861);
  private readonly white = new THREE.Color(0xfff1c8);

  constructor(count: number, size: number, map: THREE.Texture) {
    super(count, size, map);
  }

  update(dt: number) {
    this.carry += this.rate * dt;
    while (this.carry >= 1) {
      this.carry -= 1;
      const a = rnd(0, 6.28);
      const out = rnd(0.1, 0.9);
      this.emit(
        this.origin.x, this.origin.y, this.origin.z,
        Math.cos(a) * out, rnd(3.0, 4.6), Math.sin(a) * out,
        Math.random() > 0.35 ? this.gold : this.white,
        rnd(0.8, 1.5), -5.2, 0.35,
      );
    }
    this.step(dt);
  }

  clear() {
    this.rate = 0;
    this.carry = 0;
    this.reset();
  }
}

/* ───────────────────────────── Floating balloons ───────────────────────────── */

const BALLOON_COLORS = [0xe84b72, 0xf5c15c, 0xffb0c8, 0xb78ce3, 0xfff1dc, 0xff7a8a, 0x7fd8c9];

interface BalloonState {
  mesh: THREE.Mesh;
  speed: number;
  phase: number;
  sway: number;
  x: number;
  z: number;
  delay: number;
  y: number;
  spin: number;
}

export class RisingBalloons {
  readonly group = new THREE.Group();
  private readonly balloons: BalloonState[] = [];
  private readonly strings: THREE.LineSegments;
  private readonly stringPos: Float32Array;
  private time = 0;
  private active = false;

  private readonly floorY: number;

  constructor(count: number, floorY: number, envMap: THREE.Texture | null) {
    this.floorY = floorY;
    const body = new THREE.SphereGeometry(0.34, 22, 16);
    const p = body.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const y = p.getY(i);
      const taper = y < 0 ? 1 + y * 0.55 : 1;
      p.setXYZ(i, p.getX(i) * 0.9 * taper, y * 1.14, p.getZ(i) * 0.9 * taper);
    }
    body.computeVertexNormals();
    const knotGeo = new THREE.ConeGeometry(0.04, 0.08, 8);
    knotGeo.translate(0, -0.04, 0);
    const mats = BALLOON_COLORS.map(
      (c) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.22, metalness: 0.1, envMap, envMapIntensity: 0.9 }),
    );
    for (let i = 0; i < count; i++) {
      const mat = mats[i % mats.length];
      const m = new THREE.Mesh(body, mat);
      const knot = new THREE.Mesh(knotGeo, mat);
      knot.position.y = -0.39;
      m.add(knot);
      m.visible = false;
      this.group.add(m);
      this.balloons.push({ mesh: m, speed: 1, phase: 0, sway: 0, x: 0, z: 0, delay: 0, y: floorY, spin: 0 });
    }
    this.stringPos = new Float32Array(count * 3 * 2 * 3); // 3 segments per balloon, 2 verts each
    const sg = new THREE.BufferGeometry();
    sg.setAttribute('position', new THREE.BufferAttribute(this.stringPos, 3).setUsage(THREE.DynamicDrawUsage));
    this.strings = new THREE.LineSegments(sg, new THREE.LineBasicMaterial({ color: 0xf6e7c8, transparent: true, opacity: 0.7 }));
    this.strings.frustumCulled = false;
    this.group.add(this.strings);
  }

  /** Release the bunch. Avoids the centre-front so the cake always stays in view. */
  launch(halfWidth: number) {
    this.balloons.forEach((b, i) => {
      let x = 0;
      let z = 0;
      for (let tries = 0; tries < 8; tries++) {
        x = rnd(-halfWidth, halfWidth);
        z = rnd(-3.6, 1.8);
        if (!(z > -1.2 && Math.abs(x) < 1.7)) break;
      }
      b.x = x;
      b.z = z;
      b.y = this.floorY - 0.5;
      b.speed = rnd(0.95, 1.6);
      b.phase = rnd(0, 6.28);
      b.sway = rnd(0.12, 0.3);
      b.delay = i * 0.1 + rnd(0, 0.35);
      b.spin = rnd(-0.6, 0.6);
      b.mesh.visible = false;
      b.mesh.scale.setScalar(rnd(0.9, 1.25));
    });
    this.time = 0;
    this.active = true;
  }

  update(dt: number) {
    if (!this.active) return;
    this.time += dt;
    const S = this.stringPos;
    this.balloons.forEach((b, i) => {
      const o = i * 18;
      if (this.time < b.delay) {
        S.fill(0, o, o + 18);
        return;
      }
      b.mesh.visible = true;
      b.y += b.speed * dt;
      const t = this.time;
      const x = b.x + Math.sin(t * 0.9 + b.phase) * b.sway;
      const z = b.z + Math.cos(t * 0.7 + b.phase) * b.sway * 0.6;
      b.mesh.position.set(x, b.y, z);
      b.mesh.rotation.y += b.spin * dt;
      b.mesh.rotation.z = Math.sin(t * 1.3 + b.phase) * 0.08;
      // string: a lazy curve trailing below the knot
      const len = 1.5;
      const bottom = b.y - 0.42 * b.mesh.scale.y;
      let px = x;
      let py = bottom;
      let pz = z;
      for (let s = 0; s < 3; s++) {
        const u = (s + 1) / 3;
        const nx = x + Math.sin(t * 1.8 + b.phase + u * 3) * 0.06 * u;
        const ny = bottom - len * u;
        const nz = z + Math.cos(t * 1.5 + b.phase + u * 3) * 0.05 * u;
        const k = o + s * 6;
        S[k] = px; S[k + 1] = py; S[k + 2] = pz;
        S[k + 3] = nx; S[k + 4] = ny; S[k + 5] = nz;
        px = nx; py = ny; pz = nz;
      }
    });
    (this.strings.geometry.attributes.position as THREE.BufferAttribute).needsUpdate = true;
  }

  clear() {
    this.active = false;
    this.balloons.forEach((b) => (b.mesh.visible = false));
    this.stringPos.fill(0);
    (this.strings.geometry.attributes.position as THREE.BufferAttribute).needsUpdate = true;
  }
}

/* ───────────────────────────── Stage light beams ───────────────────────────── */

export class LightBeams {
  readonly group = new THREE.Group();
  private readonly beams: Array<{ pivot: THREE.Group; mat: THREE.MeshBasicMaterial; phase: number; speed: number }> = [];
  intensity = 0;

  constructor(colors: number[], apexY: number, spreadX: number, z: number) {
    const alpha = beamTexture();
    const geo = new THREE.ConeGeometry(0.85, 9, 28, 1, true);
    geo.translate(0, -4.5, 0); // apex at the pivot, opening downwards
    colors.forEach((c, i) => {
      const mat = new THREE.MeshBasicMaterial({
        color: c,
        transparent: true,
        opacity: 0,
        alphaMap: alpha,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        side: THREE.DoubleSide,
        toneMapped: false,
      });
      const pivot = new THREE.Group();
      const x = (i / Math.max(1, colors.length - 1) - 0.5) * 2 * spreadX;
      pivot.position.set(x, apexY, z);
      pivot.add(new THREE.Mesh(geo, mat));
      pivot.visible = false;
      this.group.add(pivot);
      this.beams.push({ pivot, mat, phase: i * 1.7, speed: 0.55 + i * 0.13 });
    });
  }

  update(time: number) {
    this.beams.forEach((b, i) => {
      b.pivot.visible = this.intensity > 0.01;
      if (!b.pivot.visible) return;
      const sweep = Math.sin(time * b.speed + b.phase);
      b.pivot.rotation.z = sweep * 0.5 + (i % 2 ? 0.14 : -0.14);
      b.pivot.rotation.x = Math.cos(time * b.speed * 0.8 + b.phase) * 0.28;
      b.mat.opacity = this.intensity * (0.2 + 0.07 * Math.sin(time * 3 + b.phase));
    });
  }
}

export { softDotTexture };
