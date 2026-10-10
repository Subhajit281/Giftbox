import * as THREE from 'three';
import { DustPuff } from '../birthday/effects';
import { beamTexture, glowTexture, softDotTexture } from '../birthday/textures';

const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
const rnd = (a: number, b: number) => a + Math.random() * (b - a);

const FLOOR = -1.1;

/**
 * Atmosphere for the gift room: a spotlight over the box, god rays that bloom when it opens,
 * a pulsing floor glow, a shockwave and sparkle burst on unwrapping, and a halo on every gift.
 */
export class GiftRoomFX {
  readonly group = new THREE.Group();

  private readonly spotMat: THREE.MeshBasicMaterial;
  private readonly rays: Array<{ pivot: THREE.Group; mat: THREE.MeshBasicMaterial; speed: number; phase: number }> = [];
  private readonly floorGlow: THREE.Mesh;
  private readonly shock: THREE.Mesh;
  private readonly sparkles: DustPuff;
  private readonly halos: THREE.Sprite[] = [];
  private readonly glowTex = glowTexture();

  private open = 0; // 0 closed, 1 opened
  private openTarget = 0;
  private shockT = -1;
  private drizzle = 0;
  private readonly mobile: boolean;

  constructor(mobile: boolean) {
    this.mobile = mobile;
    const alpha = beamTexture();

    // spotlight cone from above
    const cone = new THREE.ConeGeometry(2.9, 9, 40, 1, true);
    cone.translate(0, -4.5, 0);
    this.spotMat = new THREE.MeshBasicMaterial({
      color: 0xffe2b0, transparent: true, opacity: 0.1, alphaMap: alpha, blending: THREE.AdditiveBlending,
      depthWrite: false, side: THREE.DoubleSide, toneMapped: false,
    });
    const spot = new THREE.Mesh(cone, this.spotMat);
    spot.position.set(0, 8, 0);
    this.group.add(spot);

    // god rays rising from the opened box
    const rayCount = mobile ? 7 : 11;
    const rayGeo = new THREE.PlaneGeometry(0.55, 7.5);
    rayGeo.translate(0, 3.75, 0);
    for (let i = 0; i < rayCount; i++) {
      const mat = new THREE.MeshBasicMaterial({
        color: i % 3 === 0 ? 0xffc6dc : 0xffe3a6, transparent: true, opacity: 0, alphaMap: alpha,
        blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, toneMapped: false,
      });
      const m = new THREE.Mesh(rayGeo, mat);
      m.scale.y = -1; // bright at the base, fading upward
      m.position.y = 7.5;
      const pivot = new THREE.Group();
      pivot.position.set(0, FLOOR + 0.2, 0);
      pivot.rotation.set((i % 2 ? 1 : -1) * rnd(0.12, 0.38), (i / rayCount) * Math.PI * 2, 0, 'YXZ');
      pivot.add(m);
      this.group.add(pivot);
      this.rays.push({ pivot, mat, speed: rnd(0.15, 0.4) * (i % 2 ? 1 : -1), phase: rnd(0, 6) });
    }

    // floor glow and shockwave
    this.floorGlow = new THREE.Mesh(
      new THREE.CircleGeometry(5.2, 64),
      new THREE.MeshBasicMaterial({ map: this.glowTex, color: 0xffc16a, transparent: true, opacity: 0.35, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }),
    );
    this.floorGlow.rotation.x = -Math.PI / 2;
    this.floorGlow.position.y = FLOOR + 0.02;
    this.group.add(this.floorGlow);

    this.shock = new THREE.Mesh(
      new THREE.RingGeometry(0.92, 1, 96),
      new THREE.MeshBasicMaterial({ color: 0xffe0a0, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, toneMapped: false }),
    );
    this.shock.rotation.x = -Math.PI / 2;
    this.shock.position.y = FLOOR + 0.05;
    this.shock.visible = false;
    this.group.add(this.shock);

    this.sparkles = new DustPuff(mobile ? 220 : 420, 0.085, softDotTexture());
    this.group.add(this.sparkles.points);
  }

  /** Give every gift a soft glowing halo that breathes. */
  attachHalos(gifts: Iterable<THREE.Object3D>) {
    for (const g of gifts) {
      const s = new THREE.Sprite(
        new THREE.SpriteMaterial({ map: this.glowTex, color: 0xffd48a, transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }),
      );
      s.scale.setScalar(1.5);
      s.position.y = 0.12;
      g.add(s);
      this.halos.push(s);
    }
  }

  /** The box opens: shockwave, sparkle fountain, rays bloom. */
  burst() {
    this.openTarget = 1;
    this.shockT = 0;
    this.shock.visible = true;
    const n = this.mobile ? 70 : 140;
    this.sparkles.puff(0, FLOOR + 0.4, 0, n, 2.6, 0xffe1a0);
    this.sparkles.puff(0, FLOOR + 0.5, 0, Math.floor(n * 0.6), 1.9, 0xffb7d0);
    this.sparkles.puff(0, FLOOR + 0.6, 0, Math.floor(n * 0.5), 3.2, 0xffffff);
  }

  /** Back to the closed-box look (replay). */
  reset() {
    this.open = 0;
    this.openTarget = 0;
    this.shockT = -1;
    this.shock.visible = false;
    this.sparkles.clear();
  }

  update(dt: number, t: number) {
    this.open += (this.openTarget - this.open) * (1 - Math.exp(-1.6 * dt));

    // spotlight: gentle breathing, brighter once opened
    this.spotMat.opacity = (0.075 + 0.02 * this.open) * (0.9 + 0.1 * Math.sin(t * 1.3));

    // rays
    for (const r of this.rays) {
      r.pivot.rotation.y += r.speed * dt;
      r.mat.opacity = this.open * (0.055 + 0.035 * Math.sin(t * 1.7 + r.phase));
    }

    // floor
    const pulse = 0.5 + 0.5 * Math.sin(t * 1.4);
    (this.floorGlow.material as THREE.MeshBasicMaterial).opacity = 0.18 + 0.1 * pulse + 0.18 * this.open;
    this.floorGlow.scale.setScalar(1 + 0.04 * pulse + 0.1 * this.open);

    // shockwave
    if (this.shockT >= 0) {
      this.shockT += dt;
      const p = clamp01(this.shockT / 1.4);
      this.shock.scale.setScalar(0.6 + p * 7);
      (this.shock.material as THREE.MeshBasicMaterial).opacity = 0.85 * (1 - p) * (1 - p);
      if (p >= 1) {
        this.shock.visible = false;
        this.shockT = -1;
      }
    }

    // halos breathe
    this.halos.forEach((h, i) => {
      h.material.opacity = 0.4 + 0.22 * Math.sin(t * 2.2 + i * 0.9);
      h.scale.setScalar(1.4 + 0.12 * Math.sin(t * 1.8 + i));
    });

    // a light, continuous drizzle of sparkles rising from the open box
    if (this.open > 0.6) {
      this.drizzle += dt;
      if (this.drizzle > 0.12) {
        this.drizzle = 0;
        const a = rnd(0, 6.28);
        const r = rnd(0.2, 2.2);
        this.sparkles.puff(Math.cos(a) * r, FLOOR + 0.3, Math.sin(a) * r, 2, 0.55, Math.random() > 0.5 ? 0xffe2a8 : 0xffc2d6);
      }
    }
    this.sparkles.update(dt);
  }
}
