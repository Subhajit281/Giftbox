import * as THREE from 'three';
import { mulberry } from '../birthday/textures';

function canvas(w: number, h: number) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return { c, ctx: c.getContext('2d')! };
}

const PETALS = ['#f7a8c4', '#fff0e2', '#ffb48a', '#e0527a', '#fbd0dd'];

function flower(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, color: string, rot: number) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rot);
  const n = 5;
  for (let i = 0; i < n; i++) {
    ctx.save();
    ctx.rotate((i / n) * Math.PI * 2);
    const g = ctx.createRadialGradient(0, -r * 0.6, 1, 0, -r * 0.6, r * 0.7);
    g.addColorStop(0, '#ffffff');
    g.addColorStop(0.35, color);
    g.addColorStop(1, color);
    ctx.fillStyle = g;
    ctx.strokeStyle = 'rgba(120,30,60,0.35)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.ellipse(0, -r * 0.58, r * 0.4, r * 0.62, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }
  ctx.fillStyle = '#f2cf77';
  ctx.beginPath();
  ctx.arc(0, 0, r * 0.22, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#b8872e';
  for (let i = 0; i < 5; i++) {
    ctx.beginPath();
    ctx.arc(Math.cos(i * 1.26) * r * 0.1, Math.sin(i * 1.26) * r * 0.1, r * 0.035, 0, 7);
    ctx.fill();
  }
  ctx.restore();
}

function leaf(ctx: CanvasRenderingContext2D, x: number, y: number, len: number, rot: number) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rot);
  ctx.fillStyle = '#4f8f5b';
  ctx.strokeStyle = '#2f6a3d';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.quadraticCurveTo(len * 0.5, -len * 0.32, len, 0);
  ctx.quadraticCurveTo(len * 0.5, len * 0.32, 0, 0);
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}

/** Round "ENTERING THE 20's" medallion ringed with a flower wreath. */
export function badgeTexture() {
  const S = 640;
  const m = S / 2;
  const { c, ctx } = canvas(S, S);
  const rng = mulberry(20);

  // medallion
  const ring = ctx.createLinearGradient(0, 0, S, S);
  ring.addColorStop(0, '#fff2b8');
  ring.addColorStop(0.5, '#d9a441');
  ring.addColorStop(1, '#fff2b8');
  ctx.fillStyle = ring;
  ctx.beginPath();
  ctx.arc(m, m, 236, 0, 7);
  ctx.fill();
  const face = ctx.createRadialGradient(m, m - 40, 20, m, m, 218);
  face.addColorStop(0, '#9c2c5c');
  face.addColorStop(1, '#4a0f2a');
  ctx.fillStyle = face;
  ctx.beginPath();
  ctx.arc(m, m, 218, 0, 7);
  ctx.fill();
  ctx.strokeStyle = 'rgba(242,207,119,0.9)';
  ctx.lineWidth = 3;
  ctx.setLineDash([2, 9]);
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.arc(m, m, 196, 0, 7);
  ctx.stroke();
  ctx.setLineDash([]);

  // text
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#ffe9b0';
  ctx.font = '700 34px Georgia, "Times New Roman", serif';
  ctx.fillText('E N T E R I N G   T H E', m, m - 112);
  const gold = ctx.createLinearGradient(0, m - 90, 0, m + 90);
  gold.addColorStop(0, '#fff6c8');
  gold.addColorStop(0.5, '#f2cf77');
  gold.addColorStop(1, '#c48a2c');
  ctx.font = '900 190px Georgia, "Times New Roman", serif';
  ctx.lineWidth = 8;
  ctx.strokeStyle = '#4a0f2a';
  ctx.strokeText("20's", m, m + 14);
  ctx.fillStyle = gold;
  ctx.fillText("20's", m, m + 14);
  ctx.fillStyle = '#f7a8c4';
  ctx.font = 'italic 600 30px Georgia, "Times New Roman", serif';
  ctx.fillText('a brand new chapter', m, m + 128);

  // flower wreath
  const R = 238;
  const N = 20;
  for (let i = 0; i < N * 2; i++) {
    const a = (i / (N * 2)) * Math.PI * 2;
    leaf(ctx, m + Math.cos(a) * (R - 6), m + Math.sin(a) * (R - 6), 56, a + (i % 2 ? 0.7 : -0.7) + Math.PI / 2);
  }
  for (let i = 0; i < N; i++) {
    const a = (i / N) * Math.PI * 2 + 0.1;
    const big = i % 3 === 0;
    flower(ctx, m + Math.cos(a) * R, m + Math.sin(a) * R, big ? 40 : 29, PETALS[Math.floor(rng() * PETALS.length)], rng() * 6);
  }
  for (let i = 0; i < N; i++) {
    const a = ((i + 0.5) / N) * Math.PI * 2 + 0.1;
    flower(ctx, m + Math.cos(a) * (R + 14), m + Math.sin(a) * (R + 14), 17, '#fff0e2', rng() * 6);
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

/** A trailing vine of blossoms, drawn horizontally (rotate the plane for jambs). */
export function garlandTexture(seed = 7) {
  const W = 1024;
  const H = 180;
  const { c, ctx } = canvas(W, H);
  const rng = mulberry(seed);
  ctx.strokeStyle = '#3f7a4c';
  ctx.lineWidth = 5;
  ctx.beginPath();
  for (let x = 0; x <= W; x += 8) {
    const y = H / 2 + Math.sin((x / W) * Math.PI * 6) * 14;
    if (x === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.stroke();
  for (let i = 0; i < 46; i++) {
    const x = (i / 46) * W + rng() * 10;
    const y = H / 2 + Math.sin((x / W) * Math.PI * 6) * 14 + (rng() - 0.5) * 36;
    leaf(ctx, x, y, 38 + rng() * 14, rng() * 6.28);
  }
  for (let i = 0; i < 17; i++) {
    const x = ((i + 0.5) / 17) * W;
    const y = H / 2 + Math.sin((x / W) * Math.PI * 6) * 14 + (rng() - 0.5) * 26;
    flower(ctx, x, y, 24 + rng() * 16, PETALS[i % PETALS.length], rng() * 6);
  }
  for (let i = 0; i < 24; i++) {
    flower(ctx, rng() * W, H / 2 + (rng() - 0.5) * 70, 9 + rng() * 5, '#fff0e2', rng() * 6);
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

/** Door dressing: the "20's" medallion plus an optional flower garland for the frame. */
export class DoorBadge {
  readonly badge: THREE.Mesh;
  private readonly glow: THREE.Mesh;

  constructor(size: number) {
    const tex = badgeTexture();
    this.badge = new THREE.Mesh(
      new THREE.PlaneGeometry(size, size),
      new THREE.MeshBasicMaterial({ map: tex, transparent: true, toneMapped: false, depthWrite: false }),
    );
    this.badge.userData = { isDoor: true };
    this.badge.renderOrder = 3;
    this.glow = new THREE.Mesh(
      new THREE.CircleGeometry(size * 0.62, 40),
      new THREE.MeshBasicMaterial({ color: 0xffd48a, transparent: true, opacity: 0.18, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }),
    );
    this.glow.userData = { isDoor: true };
    this.glow.position.z = -0.01;
    this.badge.add(this.glow);
  }

  /** Flower garland plane: width x height, rotation in radians (use PI/2 on door jambs). */
  static garland(width: number, height: number, rot = 0, seed = 7) {
    const m = new THREE.Mesh(
      new THREE.PlaneGeometry(width, height),
      new THREE.MeshBasicMaterial({ map: garlandTexture(seed), transparent: true, toneMapped: false, depthWrite: false }),
    );
    m.rotation.z = rot;
    m.renderOrder = 2;
    return m;
  }

  update(t: number) {
    this.badge.rotation.z = Math.sin(t * 0.9) * 0.03;
    (this.glow.material as THREE.MeshBasicMaterial).opacity = 0.15 + 0.07 * Math.sin(t * 1.8);
  }
}
