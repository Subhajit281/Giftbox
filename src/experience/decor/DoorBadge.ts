import * as THREE from 'three';

function canvas(w: number, h: number) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return { c, ctx: c.getContext('2d')! };
}

/** A restrained 20th-birthday medallion for the room doors. */
export function badgeTexture() {
  const S = 640;
  const m = S / 2;
  const { c, ctx } = canvas(S, S);

  const ring = ctx.createLinearGradient(0, 0, S, S);
  ring.addColorStop(0, '#e8d09b');
  ring.addColorStop(0.5, '#9e7845');
  ring.addColorStop(1, '#e8d09b');
  ctx.fillStyle = ring;
  ctx.beginPath();
  ctx.arc(m, m, 250, 0, Math.PI * 2);
  ctx.fill();
  const face = ctx.createRadialGradient(m, m - 40, 20, m, m, 232);
  face.addColorStop(0, '#673447');
  face.addColorStop(1, '#2d1420');
  ctx.fillStyle = face;
  ctx.beginPath();
  ctx.arc(m, m, 232, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = 'rgba(232,208,155,0.62)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(m, m, 208, 0, Math.PI * 2);
  ctx.stroke();

  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#e8d09b';
  ctx.font = '600 30px "Bodoni Moda", Georgia, serif';
  ctx.fillText('A DAY TO CELEBRATE', m, m - 86);
  const gold = ctx.createLinearGradient(0, m - 90, 0, m + 90);
  gold.addColorStop(0, '#f4e5bf');
  gold.addColorStop(0.5, '#d8b879');
  gold.addColorStop(1, '#a37a42');
  ctx.font = '500 184px "Bodoni Moda", Georgia, serif';
  ctx.fillStyle = gold;
  ctx.fillText('20', m, m + 20);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

/** Door dressing for the understated birthday plaque. */
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

  update(t: number) {
    this.badge.rotation.z = Math.sin(t * 0.9) * 0.03;
    (this.glow.material as THREE.MeshBasicMaterial).opacity = 0.15 + 0.07 * Math.sin(t * 1.8);
  }
}
