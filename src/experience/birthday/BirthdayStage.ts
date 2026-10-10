import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { soundManager } from '../../audio/SoundManager';
import { DoorBadge } from '../decor/DoorBadge';
import { dir, dripDepth, dripTips, makeGanacheBand, makeKissGeometry, makeSector, makeStrawberryGeometry, wrap } from './cakeGeometry';
import {
  Confetti, DustPuff, Fireworks, LightBeams, RisingBalloons, SparkFountain, Streamers,
} from './effects';
import type { FloorField } from './effects';
import {
  buntingAtlas, candleTexture, clothTexture, cutFaceTexture, frostingTexture, glowTexture,
  mulberry, puffTexture, shadowBlobTexture, softDotTexture,
} from './textures';

const TAU = Math.PI * 2;
const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);

/* ── layout (stage-local; the stage sits inside the birthday room group) ── */
export const FLOOR_Y = -1.15;
const TABLE_TOP = -0.12;
const TABLE_R = 2.15;
const STAND_H = 0.315;
const STAND_Y = TABLE_TOP + STAND_H + 0.008; // y of the cake base
const CAKE_R = 0.82;
const CAKE_H = 0.78;
const SLICE_MID = Math.PI / 4; // the slice leaves towards the front-right
const SLICE_HALF = 0.3;
const PLATE_X = 1.2;
const PLATE_Z = 1.2;
const PLATE_TOP = TABLE_TOP + 0.008;
const CANDLE_H = 0.62;
const BLADE_L = 0.96; // blade tip distance from the knife origin
const EXIT_DOOR_Z = -5.5;

const easeInOut = (p: number) => (p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2);
const easeOut = (p: number) => 1 - Math.pow(1 - p, 3);
const easeIn = (p: number) => p * p * p;
const easeBack = (p: number) => {
  const c1 = 1.5;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(p - 1, 3) + c1 * Math.pow(p - 1, 2);
};
const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
const seg = (p: number, a: number, b: number) => clamp01((p - a) / (b - a));
const lerp = THREE.MathUtils.lerp;

export interface CameraShot {
  pos: THREE.Vector3;
  look: THREE.Vector3;
}

interface Job {
  t: number;
  dur: number;
  fn: (p: number) => void;
  done: () => void;
}

interface Puff {
  sprite: THREE.Sprite;
  age: number;
  life: number;
  from: THREE.Vector3;
  to: THREE.Vector3;
  s0: number;
  s1: number;
  peak: number;
  delay: number;
}

/**
 * Everything that happens in the birthday room: a laid table, a tiered-looking layer cake with
 * a real candle, a real knife, the cut, the celebration and the way out.
 * All of it is geometry, lights and particles: no overlays, no sprites pretending to be a cake.
 */
export class BirthdayStage {
  readonly group = new THREE.Group();
  /** Camera pose in stage-local space; the scene copies it each frame while `cameraActive`. */
  readonly camera = { pos: V(0, 1.7, 6), look: V(0, 0.6, 0) };
  cameraActive = false;
  /** Scene-wide ambient level the room wants (the stage dims the world for the candle). */
  ambient = 0.6;

  private readonly isMobile: boolean;
  private readonly envMap: THREE.Texture;
  private readonly rand = mulberry(5);
  private readonly field: FloorField = { floorY: FLOOR_Y, tableY: TABLE_TOP, tableR: TABLE_R - 0.05 };

  // scheduler
  private jobs: Job[] = [];
  private time = 0;
  private disposed = false;

  // camera rig
  private vfov = (45 * Math.PI) / 180;
  private aspect = 16 / 9;
  private camFrom: CameraShot = { pos: V(), look: V() };
  private camTo: CameraShot = { pos: V(), look: V() };
  private camT = 1;
  private camDur = 1;
  private drift = 1;

  // lights
  private keyLight!: THREE.SpotLight;
  private candleLight!: THREE.PointLight;
  private partyA!: THREE.PointLight;
  private partyB!: THREE.PointLight;
  private keyBase = 0;

  // cake
  private cake = new THREE.Group();
  private restGroup = new THREE.Group();
  private sliceGroup = new THREE.Group();
  private cutMarks = new THREE.Group();
  private grooves: Array<{ top: THREE.Mesh; seam: THREE.Mesh }> = [];
  private sliceShift = new THREE.Vector3();

  // candle
  private candle = new THREE.Group();
  private flame = new THREE.Group();
  private flameGlow!: THREE.Sprite;
  private flameMats: THREE.MeshBasicMaterial[] = [];
  private ember!: THREE.Sprite;
  private flameLit = false;
  private flameIgnite = 0;
  private flameLean = 0;
  private flameFade = 1;
  private wickTop = V();
  private puffs: Puff[] = [];
  private puffTex!: THREE.Texture;
  private tealights: Array<{ flame: THREE.Mesh; glow: THREE.Sprite; seed: number }> = [];

  // knife
  private knife = new THREE.Group();
  private readonly knifeRestP = V(-1.35, TABLE_TOP + 0.03, 1.15);
  private knifeRestQ = new THREE.Quaternion();

  // ambience
  private dust!: THREE.Points;
  private dustSeed: Float32Array = new Float32Array(0);
  private bunting!: THREE.Mesh;

  // celebration
  private confetti!: Confetti;
  private streamers!: Streamers;
  private fireworks!: Fireworks;
  private fountainL!: SparkFountain;
  private fountainR!: SparkFountain;
  private balloons!: RisingBalloons;
  private beams!: LightBeams;
  private dustPuff!: DustPuff;

  // exit door
  private exitDoor = new THREE.Group();
  private exitBadge!: DoorBadge;
  private exitPanel = new THREE.Group();
  private exitKnob!: THREE.Mesh;
  private exitLight!: THREE.PointLight;
  private exitSpill!: THREE.Mesh;
  private exitBack!: THREE.Mesh;
  private doorSparks!: SparkFountain;

  constructor(renderer: THREE.WebGLRenderer, isMobile: boolean) {
    this.isMobile = isMobile;

    const pmrem = new THREE.PMREMGenerator(renderer);
    this.envMap = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    pmrem.dispose();

    this.puffTex = puffTexture();
    this.buildLights();
    this.buildTable();
    this.buildCake();
    this.buildCandle();
    this.buildKnife();
    this.buildExtras();
    this.buildEffects();
    this.buildExitDoor();
    this.group.add(this.cake, this.knife);
    this.reset();
  }

  /* ════════════════════════ construction ════════════════════════ */

  private metal(color: number, rough = 0.28, intensity = 1.1) {
    return new THREE.MeshStandardMaterial({ color, metalness: 1, roughness: rough, envMap: this.envMap, envMapIntensity: intensity });
  }

  private buildLights() {
    this.keyLight = new THREE.SpotLight(0xffe0bd, 0, 22, 0.62, 0.75, 2);
    this.keyLight.position.set(1.6, 5.8, 3.6);
    this.keyLight.target.position.set(0, 0.3, 0.2);
    this.keyLight.castShadow = !this.isMobile;
    this.keyLight.shadow.mapSize.set(1024, 1024);
    this.keyLight.shadow.camera.near = 2;
    this.keyLight.shadow.camera.far = 14;
    this.keyLight.shadow.bias = -0.0004;
    this.keyLight.shadow.radius = 4;
    this.keyBase = 78;
    this.group.add(this.keyLight, this.keyLight.target);

    this.candleLight = new THREE.PointLight(0xffa24a, 0, 9, 2);
    this.group.add(this.candleLight);

    this.partyA = new THREE.PointLight(0xff4f9a, 0, 12, 2);
    this.partyA.position.set(-2.6, 2.4, 1.8);
    this.partyB = new THREE.PointLight(0xffc24a, 0, 12, 2);
    this.partyB.position.set(2.6, 2.4, 1.8);
    this.group.add(this.partyA, this.partyB);
  }

  private buildTable() {
    const clothMap = clothTexture();
    clothMap.repeat.set(5, 5);
    const cloth = new THREE.MeshStandardMaterial({ map: clothMap, roughness: 0.9, metalness: 0, side: THREE.DoubleSide });

    const top = new THREE.Mesh(new THREE.CircleGeometry(TABLE_R, 72), cloth);
    top.rotation.x = -Math.PI / 2;
    top.position.y = TABLE_TOP;
    top.receiveShadow = true;
    this.group.add(top);

    // The drape: flares out, falls in soft folds and ends in a scalloped hem.
    const rings = 26;
    const around = 160;
    const pos: number[] = [];
    const uv: number[] = [];
    const idx: number[] = [];
    const bottom = FLOOR_Y + 0.05;
    for (let j = 0; j <= rings; j++) {
      const t = j / rings;
      for (let i = 0; i <= around; i++) {
        const a = (i / around) * TAU;
        const flare = 0.32 * t * t;
        const folds = (0.05 * Math.sin(a * 16 + t * 1.2) + 0.025 * Math.sin(a * 29 - t * 2)) * Math.pow(t, 0.8);
        const r = TABLE_R + flare + folds;
        const y = TABLE_TOP - t * (TABLE_TOP - bottom) + Math.pow(t, 3) * 0.07 * (0.5 + 0.5 * Math.sin(a * 10));
        pos.push(Math.cos(a) * r, y, Math.sin(a) * r);
        uv.push((a / TAU) * 9, t * 2);
      }
    }
    for (let j = 0; j < rings; j++) {
      for (let i = 0; i < around; i++) {
        const a = j * (around + 1) + i;
        const b = a + around + 1;
        idx.push(a, b, a + 1, a + 1, b, b + 1);
      }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    geo.setIndex(idx);
    geo.computeVertexNormals();
    const drape = new THREE.Mesh(geo, cloth);
    drape.receiveShadow = true;
    this.group.add(drape);

    // gold piping where the cloth turns over the edge
    const trim = new THREE.Mesh(new THREE.TorusGeometry(TABLE_R - 0.02, 0.011, 8, 96), this.metal(0xd9b25a, 0.3));
    trim.rotation.x = Math.PI / 2;
    trim.position.y = TABLE_TOP + 0.004;
    this.group.add(trim);

    // cake stand: gold foot and stem, porcelain top
    const prof = [
      [0, 0], [0.55, 0], [0.565, 0.016], [0.5, 0.032], [0.13, 0.062], [0.078, 0.1], [0.095, 0.145],
      [0.072, 0.185], [0.085, 0.225], [0.3, 0.255], [0.9, 0.282], [1.045, 0.292], [1.065, 0.307], [1.04, 0.318], [0, 0.318],
    ].map(([x, y]) => new THREE.Vector2(x, y));
    const stand = new THREE.Mesh(new THREE.LatheGeometry(prof, 72), this.metal(0xe3bd68, 0.24, 1.2));
    stand.position.y = TABLE_TOP;
    stand.castShadow = true;
    stand.receiveShadow = true;
    this.group.add(stand);
    const porcelain = new THREE.Mesh(
      new THREE.CylinderGeometry(0.985, 0.985, 0.012, 72),
      new THREE.MeshStandardMaterial({ color: 0xfff7ef, roughness: 0.2, envMap: this.envMap, envMapIntensity: 0.5 }),
    );
    porcelain.position.y = TABLE_TOP + STAND_H - 0.002;
    porcelain.receiveShadow = true;
    this.group.add(porcelain);

    // dessert plate for the first slice
    const plateMat = new THREE.MeshStandardMaterial({ color: 0xfffaf4, roughness: 0.16, envMap: this.envMap, envMapIntensity: 0.6 });
    const plateProf = [
      [0, 0], [0.28, 0.004], [0.41, 0.014], [0.51, 0.03], [0.585, 0.052], [0.6, 0.05], [0.59, 0.042], [0.5, 0.022], [0.3, 0.008], [0, 0.008],
    ].map(([x, y]) => new THREE.Vector2(x, y));
    const plate = new THREE.Mesh(new THREE.LatheGeometry(plateProf, 56), plateMat);
    plate.position.set(PLATE_X, TABLE_TOP, PLATE_Z);
    plate.receiveShadow = true;
    plate.castShadow = true;
    this.group.add(plate);
    const rim = new THREE.Mesh(new THREE.TorusGeometry(0.592, 0.006, 8, 56), this.metal(0xe3bd68, 0.25));
    rim.rotation.x = Math.PI / 2;
    rim.position.set(PLATE_X, TABLE_TOP + 0.05, PLATE_Z);
    this.group.add(rim);

    // soft contact shadows keep everything grounded, with or without shadow maps
    const blob = new THREE.MeshBasicMaterial({ map: shadowBlobTexture(), transparent: true, opacity: 0.55, depthWrite: false });
    const mk = (r: number, x: number, z: number, o: number) => {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(r * 2, r * 2), blob.clone());
      (m.material as THREE.MeshBasicMaterial).opacity = o;
      m.rotation.x = -Math.PI / 2;
      m.position.set(x, TABLE_TOP + 0.003, z);
      this.group.add(m);
    };
    mk(1.45, 0, 0, 0.5);
    mk(0.8, PLATE_X, PLATE_Z, 0.45);
    // the table itself on the floor
    const floorBlob = new THREE.Mesh(new THREE.PlaneGeometry(7.5, 7.5), blob.clone());
    (floorBlob.material as THREE.MeshBasicMaterial).opacity = 0.65;
    floorBlob.rotation.x = -Math.PI / 2;
    floorBlob.position.y = FLOOR_Y + 0.004;
    this.group.add(floorBlob);
  }

  private buildCake() {
    const s0 = SLICE_MID - SLICE_HALF;
    const s1 = SLICE_MID + SLICE_HALF;
    const frost = frostingTexture();
    frost.repeat.set(1, 1);
    const wall = new THREE.MeshStandardMaterial({
      map: frost, bumpMap: frost, bumpScale: 1.6, roughness: 0.55, envMap: this.envMap, envMapIntensity: 0.35,
    });
    const ganache = new THREE.MeshStandardMaterial({ color: 0x2b110a, roughness: 0.16, envMap: this.envMap, envMapIntensity: 1.25 });
    const cut = new THREE.MeshStandardMaterial({ map: cutFaceTexture(), roughness: 0.82, side: THREE.DoubleSide });
    const under = new THREE.MeshStandardMaterial({ color: 0xe9c07a, roughness: 0.9 });
    const mats = [ganache, wall, cut, under];

    this.cake.position.set(0, STAND_Y, 0);
    this.cake.add(this.restGroup, this.sliceGroup);

    const rest = new THREE.Mesh(makeSector(CAKE_R, CAKE_H, s1, s0 + TAU), mats);
    const slice = new THREE.Mesh(makeSector(CAKE_R, CAKE_H, s0, s1), mats);
    for (const m of [rest, slice]) {
      m.castShadow = true;
      m.receiveShadow = true;
    }
    this.restGroup.add(rest);
    this.sliceGroup.add(slice);

    const bandRest = new THREE.Mesh(makeGanacheBand(CAKE_R, CAKE_H, s1, s0 + TAU), ganache);
    const bandSlice = new THREE.Mesh(makeGanacheBand(CAKE_R, CAKE_H, s0, s1), ganache);
    bandRest.material.side = THREE.DoubleSide;
    this.restGroup.add(bandRest);
    this.sliceGroup.add(bandSlice);

    const owner = (x: number, z: number) => {
      const a = wrap(Math.atan2(z, x));
      return a >= s0 && a <= s1 ? this.sliceGroup : this.restGroup;
    };

    // droplets resting at the tip of each ganache drip
    const dropGeo = new THREE.SphereGeometry(0.03, 12, 10);
    dropGeo.scale(1, 1.25, 1);
    for (const a of dripTips()) {
      const r = CAKE_R + 0.016;
      const x = Math.cos(a) * r;
      const z = Math.sin(a) * r;
      const m = new THREE.Mesh(dropGeo, ganache);
      m.position.set(x, CAKE_H - dripDepth(a) + 0.012, z);
      owner(x, z).add(m);
    }

    // piped cream kisses around the rim
    const kiss = makeKissGeometry();
    const cream = new THREE.MeshStandardMaterial({ color: 0xfff6f0, roughness: 0.45, envMap: this.envMap, envMapIntensity: 0.3 });
    const kissItems: Array<{ x: number; y: number; z: number; ry: number; s: number }> = [];
    const kissN = 30;
    for (let i = 0; i < kissN; i++) {
      const a = (i / kissN) * TAU + 0.03;
      const r = CAKE_R - 0.095;
      kissItems.push({ x: Math.cos(a) * r, y: CAKE_H, z: Math.sin(a) * r, ry: this.rand() * TAU, s: 1 });
    }
    this.scatter(kiss, cream, kissItems, owner, true);

    // gold pearls around the base
    const pearl = new THREE.SphereGeometry(0.028, 12, 10);
    const pearlItems: Array<{ x: number; y: number; z: number; ry: number; s: number }> = [];
    const pearlN = 76;
    for (let i = 0; i < pearlN; i++) {
      const a = (i / pearlN) * TAU;
      const r = CAKE_R + 0.026;
      pearlItems.push({ x: Math.cos(a) * r, y: 0.026, z: Math.sin(a) * r, ry: 0, s: 1 });
    }
    this.scatter(pearl, this.metal(0xe6bf6a, 0.22, 1.2), pearlItems, owner, false);

    // strawberries lying on their sides, leaves outward
    const berryGeo = makeStrawberryGeometry();
    const berryMat = new THREE.MeshStandardMaterial({ color: 0xcf0f2c, roughness: 0.22, envMap: this.envMap, envMapIntensity: 0.9 });
    const leafMat = new THREE.MeshStandardMaterial({ color: 0x3f8f3a, roughness: 0.55 });
    const leafGeo = new THREE.SphereGeometry(0.02, 8, 6);
    leafGeo.scale(1.9, 0.28, 0.75);
    const berryN = 6;
    for (let i = 0; i < berryN; i++) {
      const a = (i / berryN) * TAU + 0.52;
      const g = new THREE.Group();
      const body = new THREE.Mesh(berryGeo, berryMat);
      g.add(body);
      for (let l = 0; l < 5; l++) {
        const leaf = new THREE.Mesh(leafGeo, leafMat);
        const la = (l / 5) * TAU;
        leaf.position.set(Math.cos(la) * 0.045, 0.004, Math.sin(la) * 0.045);
        leaf.rotation.y = -la;
        leaf.rotation.z = -0.25;
        g.add(leaf);
      }
      const holder = new THREE.Group();
      holder.add(g);
      g.rotation.z = Math.PI / 2 - 0.36; // tip towards the centre, calyx outward
      g.position.set(0, 0.075, 0);
      const r = 0.56;
      holder.position.set(Math.cos(a) * r, CAKE_H + 0.004, Math.sin(a) * r);
      holder.rotation.y = -a;
      holder.traverse((o) => {
        if ((o as THREE.Mesh).isMesh) o.castShadow = true;
      });
      owner(holder.position.x, holder.position.z).add(holder);
    }

    // edible gold leaf flecks
    const flake = new THREE.PlaneGeometry(0.05, 0.035);
    flake.rotateX(-Math.PI / 2);
    const flakeItems: Array<{ x: number; y: number; z: number; ry: number; s: number }> = [];
    for (let i = 0; i < 26; i++) {
      const a = this.rand() * TAU;
      const r = 0.12 + this.rand() * 0.52;
      flakeItems.push({ x: Math.cos(a) * r, y: CAKE_H + 0.009, z: Math.sin(a) * r, ry: this.rand() * TAU, s: 0.5 + this.rand() * 0.9 });
    }
    const flakeMat = this.metal(0xf0c867, 0.2, 1.3);
    flakeMat.side = THREE.DoubleSide;
    this.scatter(flake, flakeMat, flakeItems, owner, false);

    // the cut: hairline marks that the knife leaves behind
    const markMat = () => new THREE.MeshBasicMaterial({ color: 0x1d0806, transparent: true, opacity: 0, depthWrite: false });
    for (const a of [s0, s1]) {
      // strip on the surface, running outward from the centre along the cut line
      const topMark = new THREE.Mesh(new THREE.PlaneGeometry(1, 0.016), markMat());
      topMark.geometry.translate(0.5, 0, 0);
      topMark.rotation.order = 'YXZ';
      topMark.rotation.set(-Math.PI / 2, -a, 0);
      topMark.position.y = CAKE_H + 0.013;
      // strip down the side, growing downward from the rim
      const seam = new THREE.Mesh(new THREE.PlaneGeometry(0.014, 1), markMat());
      seam.geometry.translate(0, -0.5, 0);
      const d = dir(a);
      seam.position.set(d.x * (CAKE_R + 0.02), CAKE_H, d.z * (CAKE_R + 0.02));
      seam.rotation.y = Math.PI / 2 - a;
      this.cutMarks.add(topMark, seam);
      this.grooves.push({ top: topMark, seam });
    }
    this.cake.add(this.cutMarks);
  }

  /** Place many copies of one mesh, splitting them between the cake and the slice by angle. */
  private scatter(
    geo: THREE.BufferGeometry,
    mat: THREE.Material,
    items: Array<{ x: number; y: number; z: number; ry: number; s: number }>,
    owner: (x: number, z: number) => THREE.Group,
    shadows: boolean,
  ) {
    const buckets = new Map<THREE.Group, typeof items>();
    for (const it of items) {
      const g = owner(it.x, it.z);
      if (!buckets.has(g)) buckets.set(g, []);
      buckets.get(g)!.push(it);
    }
    const o = new THREE.Object3D();
    buckets.forEach((list, parent) => {
      const mesh = new THREE.InstancedMesh(geo, mat, list.length);
      list.forEach((it, i) => {
        o.position.set(it.x, it.y, it.z);
        o.rotation.set(0, it.ry, 0);
        o.scale.setScalar(it.s);
        o.updateMatrix();
        mesh.setMatrixAt(i, o.matrix);
      });
      mesh.castShadow = shadows;
      mesh.receiveShadow = true;
      parent.add(mesh);
    });
  }

  private buildCandle() {
    const tex = candleTexture();
    tex.repeat.set(2, 1);
    const body = new THREE.Mesh(
      new THREE.CylinderGeometry(0.046, 0.05, CANDLE_H, 28),
      new THREE.MeshStandardMaterial({ map: tex, roughness: 0.42, envMap: this.envMap, envMapIntensity: 0.25 }),
    );
    body.position.y = CANDLE_H / 2;
    body.castShadow = true;
    this.candle.add(body);

    const pool = new THREE.Mesh(
      new THREE.CylinderGeometry(0.044, 0.044, 0.012, 24),
      new THREE.MeshStandardMaterial({ color: 0xfff1d6, roughness: 0.3, emissive: 0x55300c, emissiveIntensity: 0.3 }),
    );
    pool.position.y = CANDLE_H + 0.001;
    this.candle.add(pool);

    // wax collar at the foot
    const collar = new THREE.Mesh(
      new THREE.TorusGeometry(0.05, 0.016, 10, 28),
      new THREE.MeshStandardMaterial({ color: 0xffe9d9, roughness: 0.5 }),
    );
    collar.rotation.x = Math.PI / 2;
    collar.position.y = 0.012;
    this.candle.add(collar);

    const wick = new THREE.Mesh(new THREE.CylinderGeometry(0.0045, 0.0055, 0.09, 6), new THREE.MeshStandardMaterial({ color: 0x1a0d09, roughness: 0.9 }));
    wick.position.y = CANDLE_H + 0.045;
    this.candle.add(wick);
    this.wickTop.set(0, CAKE_H + CANDLE_H + 0.09, 0);

    this.candle.position.y = CAKE_H;
    this.restGroup.add(this.candle);

    // the flame: a teardrop inside a teardrop, plus halo
    const profile = (s: number) =>
      [[0, 0], [0.034, 0.016], [0.05, 0.06], [0.046, 0.12], [0.03, 0.19], [0.012, 0.25], [0, 0.3]].map(([x, y]) => new THREE.Vector2(x * s, y * s));
    const outer = new THREE.MeshBasicMaterial({ color: 0xff8f2a, transparent: true, opacity: 0.88, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false });
    const inner = new THREE.MeshBasicMaterial({ color: 0xfff0b4, transparent: true, opacity: 0.96, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false });
    const blue = new THREE.MeshBasicMaterial({ color: 0x5f8cff, transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false });
    this.flameMats = [outer, inner, blue];
    this.flame.add(new THREE.Mesh(new THREE.LatheGeometry(profile(1), 16), outer));
    const core = new THREE.Mesh(new THREE.LatheGeometry(profile(0.62), 14), inner);
    core.position.y = 0.012;
    this.flame.add(core);
    const bead = new THREE.Mesh(new THREE.SphereGeometry(0.019, 10, 8), blue);
    bead.position.y = 0.02;
    this.flame.add(bead);
    this.flameGlow = new THREE.Sprite(
      new THREE.SpriteMaterial({ map: glowTexture(), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, toneMapped: false }),
    );
    this.flameGlow.position.y = 0.13;
    this.flame.add(this.flameGlow);
    this.flame.position.copy(this.wickTop);
    this.cake.add(this.flame);
    this.candleLight.position.set(0, STAND_Y + this.wickTop.y + 0.18, 0);

    // ember at the wick once the flame is out
    this.ember = new THREE.Sprite(
      new THREE.SpriteMaterial({ map: glowTexture(), color: 0xff5a22, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0, toneMapped: false }),
    );
    this.ember.scale.setScalar(0.12);
    this.ember.position.copy(this.wickTop);
    this.cake.add(this.ember);
  }

  private buildKnife() {
    const shape = new THREE.Shape();
    shape.moveTo(0, -0.085);
    shape.lineTo(0.8, -0.085);
    shape.quadraticCurveTo(0.96, -0.07, 0.97, 0.015);
    shape.quadraticCurveTo(0.96, 0.06, 0.86, 0.085);
    shape.lineTo(0, 0.085);
    shape.closePath();
    const bladeGeo = new THREE.ExtrudeGeometry(shape, { depth: 0.008, bevelEnabled: true, bevelSize: 0.0025, bevelThickness: 0.0025, bevelSegments: 1, curveSegments: 14 });
    bladeGeo.translate(0, 0, -0.004);
    const steel = new THREE.MeshStandardMaterial({ color: 0xf2f4f8, metalness: 1, roughness: 0.12, envMap: this.envMap, envMapIntensity: 1.6 });
    const blade = new THREE.Mesh(bladeGeo, steel);
    blade.castShadow = true;
    this.knife.add(blade);

    const gold = this.metal(0xe3bd68, 0.22, 1.3);
    const bolster = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.1, 0.03), gold);
    bolster.position.set(-0.01, 0, 0);
    this.knife.add(bolster);

    const wood = new THREE.MeshStandardMaterial({ color: 0x3a1c12, roughness: 0.38, envMap: this.envMap, envMapIntensity: 0.5 });
    const handle = new THREE.Mesh(new THREE.CapsuleGeometry(0.036, 0.3, 6, 16), wood);
    handle.rotation.z = Math.PI / 2;
    handle.scale.set(1, 1, 0.82);
    handle.position.set(-0.22, 0, 0);
    handle.castShadow = true;
    this.knife.add(handle);
    for (const x of [-0.12, -0.22, -0.32]) {
      const rivet = new THREE.Mesh(new THREE.CylinderGeometry(0.009, 0.009, 0.07, 10), gold);
      rivet.rotation.x = Math.PI / 2;
      rivet.position.set(x, 0, 0);
      this.knife.add(rivet);
    }
    const pommel = new THREE.Mesh(new THREE.SphereGeometry(0.04, 16, 12), gold);
    pommel.position.set(-0.41, 0, 0);
    this.knife.add(pommel);

    // rests flat on a folded napkin, handle towards the diner
    const yaw = new THREE.Quaternion().setFromAxisAngle(V(0, 1, 0), 0.38);
    const flat = new THREE.Quaternion().setFromAxisAngle(V(1, 0, 0), Math.PI / 2);
    this.knifeRestQ.copy(yaw).multiply(flat);
    const napkin = new THREE.Mesh(
      new THREE.BoxGeometry(0.9, 0.012, 0.42),
      new THREE.MeshStandardMaterial({ color: 0x7e1f3f, roughness: 0.92 }),
    );
    napkin.position.set(-1.0, TABLE_TOP + 0.007, 1.18);
    napkin.rotation.y = -0.34;
    napkin.receiveShadow = true;
    this.group.add(napkin);
  }

  private buildExtras() {
    // tealights
    const glassMat = new THREE.MeshStandardMaterial({ color: 0xffe7cc, roughness: 0.08, transparent: true, opacity: 0.5, envMap: this.envMap, envMapIntensity: 1 });
    const glowMap = glowTexture();
    const flameGeo = new THREE.LatheGeometry(
      [[0, 0], [0.034, 0.016], [0.05, 0.06], [0.046, 0.12], [0.03, 0.19], [0.012, 0.25], [0, 0.3]].map(([x, y]) => new THREE.Vector2(x * 0.45, y * 0.45)),
      10,
    );
    const mat = new THREE.MeshBasicMaterial({ color: 0xffb04a, transparent: true, opacity: 0.95, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false });
    [[-1.6, -0.6], [1.62, -0.55], [-0.95, -1.5]].forEach(([x, z], i) => {
      const cup = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.062, 0.075, 18), glassMat);
      cup.position.set(x, TABLE_TOP + 0.038, z);
      this.group.add(cup);
      const wax = new THREE.Mesh(new THREE.CylinderGeometry(0.058, 0.058, 0.03, 16), new THREE.MeshStandardMaterial({ color: 0xfff3dd, roughness: 0.4 }));
      wax.position.set(x, TABLE_TOP + 0.05, z);
      this.group.add(wax);
      const flame = new THREE.Mesh(flameGeo, mat);
      flame.position.set(x, TABLE_TOP + 0.07, z);
      this.group.add(flame);
      const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowMap, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0.8, toneMapped: false }));
      glow.scale.setScalar(0.55);
      glow.position.set(x, TABLE_TOP + 0.12, z);
      this.group.add(glow);
      this.tealights.push({ flame, glow, seed: i * 2.3 });
    });

    // scattered rose petals
    const petalGeo = new THREE.CircleGeometry(0.052, 12);
    petalGeo.scale(1, 1.35, 1);
    petalGeo.rotateX(-Math.PI / 2);
    const petalMat = new THREE.MeshStandardMaterial({ color: 0xb3173f, roughness: 0.6, side: THREE.DoubleSide });
    const petals = new THREE.InstancedMesh(petalGeo, petalMat, 34);
    const o = new THREE.Object3D();
    const c = new THREE.Color();
    for (let i = 0; i < 34; i++) {
      let x = 0;
      let z = 0;
      for (let t = 0; t < 12; t++) {
        const a = this.rand() * TAU;
        const r = 1.2 + this.rand() * 0.85;
        x = Math.cos(a) * r;
        z = Math.sin(a) * r;
        if (Math.hypot(x - PLATE_X, z - PLATE_Z) > 0.75 && Math.hypot(x + 1.0, z - 1.18) > 0.7) break;
      }
      o.position.set(x, TABLE_TOP + 0.006, z);
      o.rotation.set((this.rand() - 0.5) * 0.25, this.rand() * TAU, (this.rand() - 0.5) * 0.25);
      o.scale.setScalar(0.8 + this.rand() * 0.6);
      o.updateMatrix();
      petals.setMatrixAt(i, o.matrix);
      c.setHex(this.rand() > 0.4 ? 0xb3173f : 0xe4668c);
      petals.setColorAt(i, c);
    }
    petals.receiveShadow = true;
    this.group.add(petals);

    // bunting: HAPPY BIRTHDAY, one pennant per letter
    const letters = 'HAPPYBIRTHDAY'.split('');
    const palette = ['#c4284f', '#e0a43a', '#7b2d8b', '#d9547a', '#2f8f83', '#e2763f'];
    const atlas = buntingAtlas(letters, palette);
    const n = letters.length;
    const pos: number[] = [];
    const uv: number[] = [];
    const stringPts: THREE.Vector3[] = [];
    const topY = 5.0;
    const sag = 0.85;
    const half = 4.9;
    const curve = (u: number) => V((u - 0.5) * 2 * half, topY - sag * (1 - Math.pow(2 * u - 1, 2)), -5.42);
    for (let i = 0; i < n; i++) {
      const u0 = i / n;
      const u1 = (i + 1) / n;
      const a = curve(u0 + 0.004);
      const b = curve(u1 - 0.004);
      const m = curve((u0 + u1) / 2);
      pos.push(a.x, a.y, a.z, b.x, b.y, b.z, m.x, m.y - 0.7, m.z);
      uv.push(i / n, 1, (i + 1) / n, 1, (i + 0.5) / n, 0);
    }
    for (let k = 0; k <= 40; k++) stringPts.push(curve(k / 40));
    const bGeo = new THREE.BufferGeometry();
    bGeo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    bGeo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    this.bunting = new THREE.Mesh(bGeo, new THREE.MeshBasicMaterial({ map: atlas, side: THREE.DoubleSide }));
    this.group.add(this.bunting);
    this.group.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(stringPts), new THREE.LineBasicMaterial({ color: 0xe3bd68 })));

    // drifting motes caught in the candlelight
    const count = this.isMobile ? 70 : 120;
    const p = new Float32Array(count * 3);
    this.dustSeed = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      p[i * 3] = (this.rand() - 0.5) * 9;
      p[i * 3 + 1] = -0.6 + this.rand() * 4.4;
      p[i * 3 + 2] = -3.5 + this.rand() * 7;
      this.dustSeed[i] = this.rand() * TAU;
    }
    const dg = new THREE.BufferGeometry();
    dg.setAttribute('position', new THREE.BufferAttribute(p, 3).setUsage(THREE.DynamicDrawUsage));
    this.dust = new THREE.Points(
      dg,
      new THREE.PointsMaterial({
        size: 0.075, map: softDotTexture(), color: 0xffd9a0, transparent: true, opacity: 0.55,
        blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false,
      }),
    );
    this.dust.frustumCulled = false;
    this.group.add(this.dust);
  }

  private buildEffects() {
    const dot = softDotTexture();
    this.confetti = new Confetti(this.isMobile ? 260 : 560, this.field);
    this.streamers = new Streamers(this.isMobile ? 10 : 18, 24, this.field);
    this.fireworks = new Fireworks(this.isMobile ? 800 : 1500, this.isMobile ? 0.28 : 0.22, dot, FLOOR_Y);
    this.fireworks.onBang = () => soundManager.playFireworkBang();
    const fcount = this.isMobile ? 150 : 280;
    this.fountainL = new SparkFountain(fcount, 0.07, dot);
    this.fountainR = new SparkFountain(fcount, 0.07, dot);
    this.fountainL.origin.set(-1.62, TABLE_TOP + 0.05, 0.2);
    this.fountainR.origin.set(1.62, TABLE_TOP + 0.05, 0.2);
    this.dustPuff = new DustPuff(160, 0.06, dot);
    this.doorSparks = new SparkFountain(this.isMobile ? 120 : 200, 0.09, dot);
    this.balloons = new RisingBalloons(this.isMobile ? 10 : 16, FLOOR_Y, this.envMap);
    this.beams = new LightBeams([0xff5ca0, 0xffc24a, 0xa87bff, 0x5fd8ff, 0xff8a5c], 6.6, 4.2, -2.4);
    this.group.add(
      this.confetti.mesh, this.streamers.mesh, this.fireworks.points,
      this.fountainL.points, this.fountainR.points, this.dustPuff.points, this.doorSparks.points,
      this.balloons.group, this.beams.group,
    );
  }

  private buildExitDoor() {
    const g = this.exitDoor;
    g.position.set(0, FLOOR_Y, EXIT_DOOR_Z);
    const H = 3.3;
    const W = 1.86;
    const gold = this.metal(0xe3bd68, 0.3, 1.1);

    // a border, not a slab: two jambs and a head
    for (const sx of [-1, 1]) {
      const jamb = new THREE.Mesh(new THREE.BoxGeometry(0.2, H + 0.12, 0.16), gold);
      jamb.position.set(sx * (W / 2 + 0.1), (H + 0.12) / 2, 0);
      g.add(jamb);
    }
    const head = new THREE.Mesh(new THREE.BoxGeometry(W + 0.4, 0.2, 0.16), gold);
    head.position.set(0, H + 0.02, 0);
    g.add(head);
    const lintel = new THREE.Mesh(new THREE.BoxGeometry(W + 0.7, 0.16, 0.2), gold);
    lintel.position.set(0, H + 0.2, 0.03);
    g.add(lintel);
    const heart = new THREE.Shape();
    heart.moveTo(0, -0.1);
    heart.bezierCurveTo(-0.2, 0.06, -0.12, 0.2, 0, 0.1);
    heart.bezierCurveTo(0.12, 0.2, 0.2, 0.06, 0, -0.1);
    const crest = new THREE.Mesh(new THREE.ExtrudeGeometry(heart, { depth: 0.05, bevelEnabled: false }), new THREE.MeshStandardMaterial({ color: 0xc4284f, roughness: 0.3, emissive: 0x3a0714, emissiveIntensity: 0.5 }));
    crest.position.set(0, H + 0.22, 0.14);
    crest.scale.setScalar(1.3);
    g.add(crest);

    // what lies beyond: warm light
    this.exitBack = new THREE.Mesh(new THREE.PlaneGeometry(W, H), new THREE.MeshBasicMaterial({ color: 0xffd9a2, toneMapped: false }));
    this.exitBack.position.set(0, H / 2, -0.07);
    g.add(this.exitBack);

    // hinged panel, hinge on the left
    this.exitPanel.position.set(-W / 2, 0, 0.0);
    const woodMat = new THREE.MeshStandardMaterial({ color: 0x7a1e45, roughness: 0.4, metalness: 0.1, envMap: this.envMap, envMapIntensity: 0.5 });
    const panel = new THREE.Mesh(new THREE.BoxGeometry(W, H, 0.09), woodMat);
    panel.position.set(W / 2, H / 2, 0.02);
    panel.castShadow = true;
    panel.userData = { isDoor: true };
    this.exitPanel.add(panel);
    const insetMat = new THREE.MeshStandardMaterial({ color: 0x912654, roughness: 0.38 });
    for (const [px, py, w, h] of [[W / 2, H * 0.74, W * 0.66, H * 0.3], [W / 2, H * 0.31, W * 0.66, H * 0.42]]) {
      const inset = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.03), insetMat);
      inset.position.set(px, py, 0.075);
      inset.userData = { isDoor: true };
      this.exitPanel.add(inset);
      const edge = new THREE.Mesh(new THREE.BoxGeometry(w + 0.06, h + 0.06, 0.02), gold);
      edge.position.set(px, py, 0.062);
      edge.userData = { isDoor: true };
      this.exitPanel.add(edge);
    }
    this.exitKnob = new THREE.Mesh(new THREE.SphereGeometry(0.085, 18, 14), this.metal(0xf1cc77, 0.16, 1.5));
    this.exitKnob.position.set(W - 0.2, H * 0.48, 0.15);
    this.exitKnob.userData = { isDoor: true };
    this.exitPanel.add(this.exitKnob);
    g.add(this.exitPanel);

    // "Entering the 20's" medallion on the panel + flower garlands over the lintel and down the jambs
    this.exitBadge = new DoorBadge(1.5);
    this.exitBadge.badge.position.set(W / 2, H * 0.62, 0.1);
    this.exitPanel.add(this.exitBadge.badge);
    const garlandTop = DoorBadge.garland(W + 1.1, 0.5, 0, 5);
    garlandTop.position.set(0, H + 0.2, 0.17);
    g.add(garlandTop);
    for (const sx of [-1, 1]) {
      const side = DoorBadge.garland(H + 0.2, 0.46, Math.PI / 2, 9 + sx);
      side.position.set(sx * (W / 2 + 0.1), (H + 0.12) / 2, 0.12);
      g.add(side);
    }

    this.exitLight = new THREE.PointLight(0xffd9a2, 0, 11, 2);
    this.exitLight.position.set(0, 1.7, 1.2);
    g.add(this.exitLight);

    // light spilling across the floor when the door opens
    this.exitSpill = new THREE.Mesh(
      new THREE.PlaneGeometry(3.4, 5.2),
      new THREE.MeshBasicMaterial({ map: glowTexture(), transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }),
    );
    this.exitSpill.rotation.x = -Math.PI / 2;
    this.exitSpill.position.set(0, 0.012, 2.6);
    g.add(this.exitSpill);
    g.position.y = FLOOR_Y - H - 1;
    g.visible = false;
    this.group.add(g);
    this.doorSparks.origin.set(0, FLOOR_Y + 0.05, EXIT_DOOR_Z + 0.5);
  }

  /* ════════════════════════ scheduler & camera ════════════════════════ */

  private run(dur: number, fn: (p: number) => void): Promise<void> {
    return new Promise((resolve) => {
      this.jobs.push({ t: 0, dur: Math.max(0.0001, dur), fn, done: resolve });
    });
  }

  private wait(dur: number) {
    return this.run(dur, () => {});
  }

  setViewport(vfovDeg: number, aspect: number) {
    this.vfov = (vfovDeg * Math.PI) / 180;
    this.aspect = aspect;
  }

  /** A shot that keeps `width` x `height` metres of the world in view, whatever the screen shape. */
  private frame(look: THREE.Vector3, width: number, height: number, az = 0, el = 0.1): CameraShot {
    const tv = Math.tan(this.vfov / 2);
    const th = tv * this.aspect;
    const dist = Math.max(width / 2 / th, height / 2 / tv);
    const pos = V(Math.sin(az) * Math.cos(el), Math.sin(el), Math.cos(az) * Math.cos(el)).multiplyScalar(dist).add(look);
    return { pos, look: look.clone() };
  }

  private moveCamera(shot: CameraShot, dur: number) {
    this.camFrom.pos.copy(this.camera.pos);
    this.camFrom.look.copy(this.camera.look);
    this.camTo.pos.copy(shot.pos);
    this.camTo.look.copy(shot.look);
    this.camT = 0;
    this.camDur = Math.max(0.0001, dur);
  }

  private snapCamera(shot: CameraShot) {
    this.camera.pos.copy(shot.pos);
    this.camera.look.copy(shot.look);
    this.camFrom.pos.copy(shot.pos);
    this.camFrom.look.copy(shot.look);
    this.camTo.pos.copy(shot.pos);
    this.camTo.look.copy(shot.look);
    this.camT = 1;
  }

  /* ════════════════════════ story API ════════════════════════ */

  /** Put the room back to how she first sees it: dark, candle unlit, cake whole, wide shot. */
  reset() {
    this.jobs = [];
    this.flameLit = false;
    this.flameIgnite = 0;
    this.flameLean = 0;
    this.flameFade = 1;
    this.candleLight.intensity = 0;
    this.ember.material.opacity = 0;
    this.puffs.forEach((p) => p.sprite.removeFromParent());
    this.puffs = [];
    this.sliceGroup.position.set(0, 0, 0);
    this.sliceShift.set(0, 0, 0);
    this.cutMarks.visible = true;
    this.grooves.forEach((g) => {
      (g.top.material as THREE.MeshBasicMaterial).opacity = 0;
      (g.seam.material as THREE.MeshBasicMaterial).opacity = 0;
    });
    this.knife.position.copy(this.knifeRestP);
    this.knife.quaternion.copy(this.knifeRestQ);
    this.confetti.clear();
    this.streamers.hide();
    this.fireworks.clear();
    this.fountainL.clear();
    this.fountainR.clear();
    this.dustPuff.clear();
    this.doorSparks.clear();
    this.balloons.clear();
    this.beams.intensity = 0;
    this.partyA.intensity = 0;
    this.partyB.intensity = 0;
    this.exitPanel.rotation.y = 0;
    this.exitLight.intensity = 0;
    (this.exitSpill.material as THREE.MeshBasicMaterial).opacity = 0;
    this.exitDoor.visible = false;
    this.keyLight.intensity = this.keyBase * 0.32;
    this.ambient = 0.42;
    this.drift = 1;
  }

  /** First frame inside the room. */
  enter() {
    this.reset();
    this.cameraActive = true;
    this.snapCamera(this.frame(V(0, 0.55, 0), 5.2, 3.7, 0, 0.16));
  }

  leave() {
    this.cameraActive = false;
    this.reset();
  }

  /** The candle catches, the room warms, and the camera starts creeping in on the cake. */
  async beginCountdown(seconds: number) {
    this.flameLit = true;
    void this.run(1.1, (p) => {
      this.flameIgnite = easeOut(p);
      this.ambient = lerp(0.42, 0.5, p);
      this.keyLight.intensity = this.keyBase * lerp(0.32, 0.55, p);
    });
    this.moveCamera(this.frame(V(0, 0.95, 0), 2.7, 3.0, 0.06, 0.13), seconds);
  }

  /** Breath, bending flame, a last gasp, smoke. */
  async blowOut() {
    this.moveCamera(this.frame(V(0, 1.38, 0), 1.9, 2.0, 0.1, 0.08), 1.0);
    soundManager.playBlow();

    // the breath: a rush of soft puffs from the viewer's side to the flame
    const target = V(0, STAND_Y + this.wickTop.y + 0.1, 0);
    for (let i = 0; i < 18; i++) {
      const from = V((this.rand() - 0.5) * 0.4 + 0.15, target.y - 0.25 + (this.rand() - 0.5) * 0.25, 2.6 + this.rand() * 0.4);
      const to = V((this.rand() - 0.5) * 0.12, target.y + (this.rand() - 0.5) * 0.12, 0.3 + this.rand() * 0.25);
      this.spawnPuff(from, to, 0.18, 0.7, 0.42, 0.55 + this.rand() * 0.2, i * 0.04 + 0.15, 0xffffff);
    }

    await this.run(2.5, (p) => {
      // lean away from the breath, flicker harder, then go out
      const gust = seg(p, 0.1, 0.45);
      this.flameLean = easeOut(gust);
      const dying = seg(p, 0.42, 0.72);
      this.flameFade = 1 - easeIn(dying);
      if (p > 0.72 && this.flameLit) {
        this.flameLit = false;
        this.flameFade = 0;
        this.ember.material.opacity = 1;
        this.spawnSmoke();
      }
      const dim = seg(p, 0.45, 1);
      this.ambient = lerp(0.5, 0.36, easeInOut(dim));
      this.keyLight.intensity = this.keyBase * lerp(0.55, 0.3, easeInOut(dim));
      this.ember.material.opacity = p > 0.72 ? Math.max(0, 1 - seg(p, 0.72, 1.0)) : 0;
    });
  }

  private spawnPuff(from: THREE.Vector3, to: THREE.Vector3, s0: number, s1: number, peak: number, life: number, delay: number, color: number) {
    const mat = new THREE.SpriteMaterial({
      map: this.puffTex, color, transparent: true, opacity: 0, depthWrite: false, toneMapped: false,
      blending: color === 0xffffff ? THREE.AdditiveBlending : THREE.NormalBlending,
    });
    const sprite = new THREE.Sprite(mat);
    sprite.position.copy(from);
    sprite.scale.setScalar(s0);
    sprite.visible = false;
    this.group.add(sprite);
    this.puffs.push({ sprite, age: 0, life, from, to, s0, s1, peak, delay });
  }

  private spawnSmoke() {
    const base = V(0, STAND_Y + this.wickTop.y + 0.06, 0);
    for (let i = 0; i < 14; i++) {
      const to = V(Math.sin(i * 0.9) * 0.16 + (this.rand() - 0.5) * 0.06, base.y + 0.55 + i * 0.03, -0.12 + Math.cos(i * 0.7) * 0.1);
      this.spawnPuff(base.clone(), to, 0.04, 0.34, 0.3, 2.3, i * 0.07, 0x8a8a92);
    }
  }

  /** Knife lifts off the napkin, cuts twice, slides under the slice and serves it. */
  async cutCake() {
    const a0 = SLICE_MID - SLICE_HALF;
    const a1 = SLICE_MID + SLICE_HALF;
    const yAxis = V(0, 1, 0);
    const qYaw = (t: number) => new THREE.Quaternion().setFromAxisAngle(yAxis, t);
    const qZ = (t: number) => new THREE.Quaternion().setFromAxisAngle(V(0, 0, 1), t);
    const qCut = (a: number) => qYaw(Math.PI - a); // blade upright, tip towards the centre
    const qFlat = (a: number) => qYaw(Math.PI - a).multiply(new THREE.Quaternion().setFromAxisAngle(V(1, 0, 0), Math.PI / 2));
    const tipOrigin = (a: number, y: number, rTip = 0.05) => {
      const d = dir(a);
      return V(d.x * (rTip + BLADE_L), y, d.z * (rTip + BLADE_L));
    };

    const hoverY = STAND_Y + CAKE_H + 0.4;
    const bottomY = STAND_Y + 0.1;

    const moveKnife = (p: THREE.Vector3, q: THREE.Quaternion, dur: number, lift = 0) => {
      const p0 = this.knife.position.clone();
      const q0 = this.knife.quaternion.clone();
      return this.run(dur, (u) => {
        const e = easeInOut(u);
        this.knife.position.lerpVectors(p0, p, e);
        this.knife.position.y += Math.sin(u * Math.PI) * lift;
        this.knife.quaternion.slerpQuaternions(q0, q, e);
      });
    };

    const plunge = async (index: number, a: number, dur: number) => {
      const g = this.grooves[index];
      const topMat = g.top.material as THREE.MeshBasicMaterial;
      const seamMat = g.seam.material as THREE.MeshBasicMaterial;
      const base = qCut(a);
      const tilt0 = -0.38;
      const d = dir(a);
      soundManager.playKnifeSlice();
      let burst = false;
      await this.run(dur, (u) => {
        const e = easeInOut(u);
        const rock = Math.sin(u * Math.PI * 5) * 0.035 * Math.sin(u * Math.PI);
        this.knife.position.set(d.x * (0.05 + BLADE_L), lerp(hoverY, bottomY, e), d.z * (0.05 + BLADE_L));
        this.knife.quaternion.copy(base).multiply(qZ(tilt0 * (1 - easeOut(Math.min(1, u * 1.4))) + rock));
        // the cut shows on the surface as soon as the blade is in
        const into = seg(u, 0.18, 0.5);
        topMat.opacity = 0.85 * into;
        g.top.scale.x = Math.max(0.001, (CAKE_R - 0.04) * into);
        seamMat.opacity = 0.7 * seg(u, 0.3, 0.45);
        g.seam.scale.y = Math.max(0.001, CAKE_H * seg(u, 0.3, 0.95));
        if (!burst && u > 0.2) {
          burst = true;
          this.dustPuff.puff(d.x * 0.45, STAND_Y + CAKE_H + 0.02, d.z * 0.45, 26, 0.8, 0xffe7b8);
        }
      });
      this.dustPuff.puff(d.x * 0.5, STAND_Y + 0.08, d.z * 0.5, 14, 0.5, 0xffd9a0);
    };

    // 1. lift off the napkin, over to the first cut
    this.moveCamera(this.frame(V(0.35, 0.6, 0.35), 3.4, 2.8, 0.42, 0.4), 2.0);
    await moveKnife(tipOrigin(a0, hoverY), qCut(a0).multiply(qZ(-0.38)), 1.3, 0.55);

    // 2. first cut
    await plunge(0, a0, 1.15);
    await this.wait(0.12);

    // 3. out, across, second cut
    const outQ = qCut(a1).multiply(qZ(-0.38));
    await moveKnife(tipOrigin(a1, hoverY), outQ, 0.85, 0.1);
    await plunge(1, a1, 1.15);
    await this.wait(0.12);

    // 4. withdraw, turn the blade flat and go round to the rim
    const mid = SLICE_MID;
    const dm = dir(mid);
    const flatQ = qFlat(mid);
    const rOutside = 0.05 + BLADE_L + 0.95;
    this.moveCamera(this.frame(V(0.55, 0.3, 0.55), 3.0, 2.2, 0.5, 0.34), 2.4);
    await moveKnife(V(dm.x * rOutside, STAND_Y + 0.22, dm.z * rOutside), flatQ, 1.0, 0.45);

    // 5. slide under the slice
    const yBlade = STAND_Y + 0.008;
    const rIn = 0.05 + BLADE_L;
    await this.run(0.75, (u) => {
      const e = easeInOut(u);
      const r = lerp(rOutside, rIn, e);
      this.knife.position.set(dm.x * r, lerp(STAND_Y + 0.22, yBlade, easeOut(seg(u, 0, 0.45))), dm.z * r);
      this.knife.quaternion.copy(flatQ);
      this.sliceGroup.position.y = 0.013 * seg(u, 0.55, 1);
    });
    this.cutMarks.visible = false;

    // 6. carry the slice to the plate
    const platePos = V(PLATE_X, 0, PLATE_Z);
    const dPlate = platePos.length(); // distance from cake centre to plate centre
    const dEnd = dPlate - CAKE_R / 2; // where the slice's tip must end up
    const plateRelY = PLATE_TOP - STAND_Y + 0.0145; // slice base while still on the blade
    this.moveCamera(this.frame(V(0.75, 0.15, 0.75), 4.4, 3.1, 0.55, 0.32), 2.0);
    await this.run(2.1, (u) => {
      const e = easeInOut(u);
      const D = e * dEnd;
      const yRel = u < 0.5 ? 0.013 + 0.045 * easeOut(seg(u, 0, 0.22)) : lerp(0.058, plateRelY, easeInOut(seg(u, 0.52, 1)));
      this.sliceGroup.position.set(dm.x * D, yRel, dm.z * D);
      this.knife.position.set(dm.x * (D + rIn), STAND_Y + yRel - 0.0085, dm.z * (D + rIn));
      this.knife.quaternion.copy(flatQ);
    });
    this.dustPuff.puff(dm.x * (dEnd + 0.4), PLATE_TOP + 0.05, dm.z * (dEnd + 0.4), 22, 0.5, 0xffe2ad);

    // 7. slice settles as the blade slips out
    const kStart = this.knife.position.clone();
    const sliceY0 = this.sliceGroup.position.y;
    await this.run(1.0, (u) => {
      const e = easeInOut(u);
      this.knife.position.set(kStart.x + dm.x * e * 1.1, kStart.y + e * 0.04, kStart.z + dm.z * e * 1.1);
      const settle = seg(u, 0.1, 0.5);
      this.sliceGroup.position.y = lerp(sliceY0, sliceY0 - 0.0125, easeOut(settle)) + Math.sin(settle * Math.PI) * 0.004;
    });

    // 8. knife returns to its napkin
    this.moveCamera(this.frame(V(0, 0.55, 0.3), 4.6, 3.2, 0.2, 0.22), 1.6);
    await moveKnife(this.knifeRestP.clone(), this.knifeRestQ.clone(), 1.5, 0.5);
    this.knife.position.copy(this.knifeRestP);
  }

  /** Cannons, streamers, sparks, fireworks, balloons, colour. About eight seconds. */
  async celebrate() {
    const vw = this.aspect * Math.tan(this.vfov / 2); // half-width per metre of distance
    const wide = this.frame(V(0, 1.45, -0.6), Math.min(7.4, 3.2 + this.aspect * 4), 5.4, 0, 0.04);
    this.moveCamera(wide, 1.8);
    // lights rise, beams sweep in
    void this.run(1.2, (p) => {
      this.ambient = lerp(0.36, 0.95, easeInOut(p));
      this.keyLight.intensity = this.keyBase * lerp(0.3, 0.95, easeInOut(p));
      this.beams.intensity = easeInOut(p);
    });

    const camDist = wide.pos.distanceTo(wide.look);
    const halfW = Math.max(1.6, Math.min(4.6, vw * (camDist + 3)));
    soundManager.playPartyPop();
    soundManager.playBirthdayChime();

    // two cannons at the sides of the table
    const aimL = V(0.9, 1.2, 0.1);
    const aimR = V(-0.9, 1.2, 0.1);
    const cL = V(-halfW + 0.2, FLOOR_Y + 0.1, 1.2);
    const cR = V(halfW - 0.2, FLOOR_Y + 0.1, 1.2);
    const fire = (n: number, speed: number) => {
      this.confetti.burst(cL, aimL, n, speed);
      this.confetti.burst(cR, aimR, n, speed);
    };
    fire(this.isMobile ? 70 : 140, 9);
    this.streamers.launch(cL, aimL, this.time, 8.5);
    this.balloons.launch(halfW);
    void this.wait(0.55).then(() => {
      soundManager.playPartyPop();
      fire(this.isMobile ? 60 : 120, 8);
      this.streamers.launch(cR, aimR, this.time, 8);
    });
    void this.wait(1.7).then(() => this.confetti.rain(this.isMobile ? 50 : 110, halfW, 5.2, 2.5));
    void this.wait(3.2).then(() => {
      soundManager.playPartyPop();
      fire(this.isMobile ? 50 : 100, 8.5);
    });
    void this.wait(4.2).then(() => this.confetti.rain(this.isMobile ? 40 : 90, halfW, 5.2, 2.5));

    // cold-spark fountains on the table
    this.fountainL.rate = this.isMobile ? 70 : 130;
    this.fountainR.rate = this.isMobile ? 70 : 130;
    void this.wait(5.6).then(() => {
      this.fountainL.rate = 0;
      this.fountainR.rate = 0;
    });

    // fireworks above the back of the room, kept inside what the screen can see
    const fx = (k: number) => k * Math.min(1, halfW / 3.6) * 3.0;
    const show: Array<[number, number, number, number, 'peony' | 'ring' | 'willow' | 'heart', number?]> = [
      [0.9, -0.9, -3.3, 3.4, 'peony'],
      [1.5, 0.9, -3.5, 4.0, 'ring'],
      [2.2, 0, -3.8, 4.4, 'willow', 0xffc94a],
      [3.0, -1.0, -3.0, 3.2, 'peony'],
      [3.5, 1.0, -3.0, 3.6, 'ring'],
      [4.3, 0, -3.5, 3.9, 'heart', 0xff4f87],
      [5.2, -0.8, -3.7, 4.6, 'willow', 0xffffff],
      [5.6, 0.8, -3.7, 4.2, 'peony'],
      [6.2, 0, -3.6, 4.5, 'heart', 0xff86b6],
    ];
    for (const [t, x, z, apex, kind, color] of show) {
      this.fireworks.schedule(t, fx(x), z, apex, kind, color);
    }

    await this.run(8.2, (p) => {
      const t = p * 8.2;
      // colour pulses
      const beat = 0.5 + 0.5 * Math.sin(t * 5.2);
      const fadeOut = 1 - seg(p, 0.86, 1);
      this.partyA.intensity = 22 * beat * fadeOut;
      this.partyB.intensity = 22 * (1 - beat) * fadeOut;
      this.beams.intensity = Math.min(1, easeInOut(seg(p, 0, 0.15))) * fadeOut;
      if (p > 0.86) {
        this.ambient = lerp(0.95, 0.7, seg(p, 0.86, 1));
        this.keyLight.intensity = this.keyBase * lerp(0.95, 0.75, seg(p, 0.86, 1));
      }
    });
    this.partyA.intensity = 0;
    this.partyB.intensity = 0;
    this.beams.intensity = 0;
  }

  /** A door rises out of the floor at the back of the room. */
  async presentExitDoor(): Promise<void> {
    this.exitDoor.visible = true;
    this.moveCamera(this.frame(V(0, 1.3, EXIT_DOOR_Z), 4.2, 4.6, 0, 0.36), 2.2);
    const startY = FLOOR_Y - 3.3 - 1;
    this.doorSparks.rate = 140;
    await this.run(1.7, (u) => {
      this.exitDoor.position.y = lerp(startY, FLOOR_Y, easeBack(u));
      this.exitLight.intensity = 3.2 * seg(u, 0.4, 1);
      this.ambient = lerp(0.7, 0.72, u);
    });
    this.doorSparks.rate = 0;
  }

  /** Swing the door open and let the light out. */
  async openExitDoor(): Promise<void> {
    soundManager.playDoorOpen();
    await this.run(1.35, (u) => {
      const e = easeInOut(u);
      this.exitPanel.rotation.y = e * (Math.PI / 2) * 0.92;
      this.exitKnob.rotation.z = -Math.sin(seg(u, 0, 0.25) * Math.PI) * 0.6;
      this.exitLight.intensity = lerp(3.2, 12, e);
      (this.exitSpill.material as THREE.MeshBasicMaterial).opacity = 0.9 * e;
      this.exitBack.scale.setScalar(1 + e * 0.04);
    });
  }

  /* ════════════════════════ per-frame ════════════════════════ */

  update(dt: number, elapsed: number) {
    if (this.disposed) return;
    this.time += dt;

    // jobs
    if (this.jobs.length) {
      const current = this.jobs;
      const stillRunning: Job[] = [];
      const finished: Job[] = [];
      for (const j of current) {
        j.t += dt;
        const p = Math.min(1, j.t / j.dur);
        j.fn(p);
        (p >= 1 ? finished : stillRunning).push(j);
      }
      // jobs started by callbacks above were pushed onto `this.jobs`, keep them
      const added = this.jobs.filter((j) => !current.includes(j));
      this.jobs = stillRunning.concat(added);
      finished.forEach((j) => j.done());
    }

    // camera
    if (this.camT < 1) this.camT = Math.min(1, this.camT + dt / this.camDur);
    const e = easeInOut(this.camT);
    this.camera.pos.lerpVectors(this.camFrom.pos, this.camTo.pos, e);
    this.camera.look.lerpVectors(this.camFrom.look, this.camTo.look, e);
    if (this.cameraActive) {
      // breathing handheld drift, never enough to break a composition
      this.camera.pos.x += Math.sin(elapsed * 0.31) * 0.05 * this.drift;
      this.camera.pos.y += Math.sin(elapsed * 0.43) * 0.025 * this.drift;
    }

    this.updateFlame(elapsed);
    this.updatePuffs(dt);
    this.updateAmbience(elapsed);

    // effects
    this.confetti.update(dt, this.time);
    this.streamers.update(this.time);
    this.fireworks.update(dt);
    this.fountainL.update(dt);
    this.fountainR.update(dt);
    this.dustPuff.update(dt);
    this.doorSparks.update(dt);
    if (this.exitDoor.visible) this.exitBadge.update(elapsed);
    this.balloons.update(dt);
    this.beams.update(this.time);
  }

  private updateFlame(t: number) {
    const lit = this.flameLit ? this.flameIgnite : 0;
    const gust = this.flameLean;
    const live = lit * this.flameFade;
    const flick = gust > 0 ? 2.4 : 1;
    const sx = 1 + (0.06 * Math.sin(t * 21 * flick) + 0.04 * Math.sin(t * 13.7 * flick)) * (1 + gust * 2);
    const sy = (1 + 0.14 * Math.sin(t * 17.3 * flick) + 0.09 * Math.sin(t * 29.1)) * (1 - gust * 0.45);
    const vis = live > 0.01;
    this.flame.visible = vis;
    this.flame.scale.set(sx * live, Math.max(0.0001, sy * live), sx * live);
    // leaning flame bends away from the viewer (towards -z) and sideways a little
    this.flame.rotation.x = -gust * 1.15 + 0.03 * Math.sin(t * 7);
    this.flame.rotation.z = 0.06 * Math.sin(t * 9.1) + 0.03 * Math.sin(t * 23) + gust * 0.25;
    this.flameGlow.material.opacity = 0.9 * live;
    const gs = 0.85 * (1 + 0.08 * Math.sin(t * 15)) * Math.max(0.2, live);
    this.flameGlow.scale.setScalar(gs);
    this.candleLight.intensity = 9 * (0.82 + 0.18 * Math.sin(t * 19) + 0.1 * Math.sin(t * 31)) * live;
    this.flameMats.forEach((m, i) => (m.opacity = [0.88, 0.96, 0.55][i] * Math.min(1, live * 1.6)));
    this.ember.visible = this.ember.material.opacity > 0.01;
    if (this.ember.visible) this.ember.scale.setScalar(0.1 + 0.03 * Math.sin(t * 11));

    this.tealights.forEach((tl) => {
      const k = 1 + 0.12 * Math.sin(t * 14 + tl.seed) + 0.08 * Math.sin(t * 23 + tl.seed * 2);
      tl.flame.scale.set(1 / Math.sqrt(k), k, 1 / Math.sqrt(k));
      tl.glow.material.opacity = 0.55 + 0.2 * Math.sin(t * 11 + tl.seed);
    });
  }

  private updatePuffs(dt: number) {
    for (let i = this.puffs.length - 1; i >= 0; i--) {
      const p = this.puffs[i];
      p.age += dt;
      const u = (p.age - p.delay) / p.life;
      if (u < 0) continue;
      if (u >= 1) {
        p.sprite.removeFromParent();
        p.sprite.material.dispose();
        this.puffs.splice(i, 1);
        continue;
      }
      p.sprite.visible = true;
      const k = easeOut(u);
      p.sprite.position.lerpVectors(p.from, p.to, k);
      p.sprite.scale.setScalar(lerp(p.s0, p.s1, k));
      // fade in fast, out slowly
      p.sprite.material.opacity = p.peak * Math.sin(Math.PI * Math.pow(u, 0.7));
      p.sprite.material.rotation = u * 1.4;
    }
  }

  private updateAmbience(t: number) {
    const pos = this.dust.geometry.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < pos.count; i++) {
      const s = this.dustSeed[i];
      pos.setY(i, pos.getY(i) + Math.sin(t * 0.4 + s) * 0.0016);
      pos.setX(i, pos.getX(i) + Math.cos(t * 0.3 + s * 2) * 0.0012);
    }
    pos.needsUpdate = true;
    this.bunting.rotation.z = Math.sin(t * 0.7) * 0.0025;
  }

  dispose() {
    this.disposed = true;
    this.jobs = [];
    const seen = new Set<THREE.Material | THREE.BufferGeometry | THREE.Texture>();
    this.group.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.geometry && !seen.has(m.geometry)) {
        seen.add(m.geometry);
        m.geometry.dispose();
      }
      const mats = Array.isArray(m.material) ? m.material : m.material ? [m.material] : [];
      for (const mat of mats) {
        if (seen.has(mat)) continue;
        seen.add(mat);
        for (const v of Object.values(mat)) if ((v as THREE.Texture)?.isTexture) (v as THREE.Texture).dispose();
        mat.dispose();
      }
    });
    this.envMap.dispose();
    this.puffTex.dispose();
  }
}