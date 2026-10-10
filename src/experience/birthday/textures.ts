import * as THREE from 'three';

/** Tiny seeded RNG so every texture is identical between visits. */
export function mulberry(seed: number) {
  return () => {
    seed += 0x6d2b79f5;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t ^= t + Math.imul(t ^ (t >>> 7), 61 | t);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function canvas(w: number, h: number) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d')!;
  return { c, ctx };
}

function finish(c: HTMLCanvasElement, srgb = true) {
  const tex = new THREE.CanvasTexture(c);
  if (srgb) tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

/** Soft round dot used for sparks, fireworks and bokeh. */
export function softDotTexture() {
  const { c, ctx } = canvas(64, 64);
  const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.25, 'rgba(255,255,255,0.85)');
  g.addColorStop(0.6, 'rgba(255,255,255,0.18)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 64, 64);
  return finish(c);
}

/** Warm halo drawn around flames. */
export function glowTexture() {
  const { c, ctx } = canvas(128, 128);
  const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
  g.addColorStop(0, 'rgba(255,230,170,1)');
  g.addColorStop(0.18, 'rgba(255,175,70,0.62)');
  g.addColorStop(0.5, 'rgba(255,110,40,0.16)');
  g.addColorStop(1, 'rgba(255,90,30,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 128, 128);
  return finish(c);
}

/** Billowy grey puff for smoke and breath. */
export function puffTexture() {
  const { c, ctx } = canvas(128, 128);
  const rand = mulberry(7);
  for (let i = 0; i < 26; i++) {
    const x = 64 + (rand() - 0.5) * 44;
    const y = 64 + (rand() - 0.5) * 44;
    const r = 18 + rand() * 26;
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, 'rgba(255,255,255,0.22)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 128, 128);
  }
  return finish(c);
}

/**
 * What you see on the face of a cut: golden sponge, cream and strawberry jam.
 * v = 0 is the plate, v = 1 is the top of the cake.
 */
export function cutFaceTexture() {
  const W = 256;
  const H = 512;
  const { c, ctx } = canvas(W, H);
  const rand = mulberry(11);

  // Layers from the top of the canvas (top of the cake) downwards, as fractions of the height.
  const layers: Array<[number, 'ganache' | 'sponge' | 'cream' | 'jam']> = [
    [0.045, 'ganache'],
    [0.19, 'sponge'],
    [0.05, 'cream'],
    [0.026, 'jam'],
    [0.19, 'sponge'],
    [0.05, 'cream'],
    [0.026, 'jam'],
    [0.19, 'sponge'],
    [0.05, 'cream'],
    [0.026, 'jam'],
    [0.131, 'sponge'],
  ];
  let y = 0;
  for (const [frac, kind] of layers) {
    const h = frac * H;
    const g = ctx.createLinearGradient(0, y, 0, y + h);
    if (kind === 'sponge') {
      g.addColorStop(0, '#f6dfa6');
      g.addColorStop(0.5, '#f1cf88');
      g.addColorStop(1, '#e9bf74');
    } else if (kind === 'cream') {
      g.addColorStop(0, '#fff6f1');
      g.addColorStop(1, '#ffe6e6');
    } else if (kind === 'jam') {
      g.addColorStop(0, '#e1405f');
      g.addColorStop(1, '#b8203f');
    } else {
      g.addColorStop(0, '#4a2418');
      g.addColorStop(1, '#2d130c');
    }
    ctx.fillStyle = g;
    ctx.fillRect(0, y, W, h + 1);

    if (kind === 'sponge') {
      // crumb pores
      for (let i = 0; i < 520; i++) {
        const px = rand() * W;
        const py = y + rand() * h;
        const r = 0.6 + rand() * 1.8;
        ctx.fillStyle = `rgba(${150 + rand() * 40},${95 + rand() * 30},${40 + rand() * 20},${0.1 + rand() * 0.22})`;
        ctx.beginPath();
        ctx.ellipse(px, py, r * 1.4, r, rand() * Math.PI, 0, Math.PI * 2);
        ctx.fill();
      }
      for (let i = 0; i < 160; i++) {
        ctx.fillStyle = `rgba(255,245,210,${0.1 + rand() * 0.2})`;
        ctx.fillRect(rand() * W, y + rand() * h, 1 + rand() * 2, 1);
      }
    } else if (kind === 'jam') {
      for (let i = 0; i < 90; i++) {
        ctx.fillStyle = `rgba(255,${120 + rand() * 80},${130 + rand() * 80},0.28)`;
        ctx.fillRect(rand() * W, y + rand() * h, 2 + rand() * 4, 1.5);
      }
    }
    y += h;
  }
  return finish(c);
}

/** Pink palette-knife frosting. Used as both colour map and bump map. */
export function frostingTexture() {
  const W = 1024;
  const H = 256;
  const { c, ctx } = canvas(W, H);
  const rand = mulberry(23);
  ctx.fillStyle = '#f5bccb';
  ctx.fillRect(0, 0, W, H);
  // long soft vertical swipes
  for (let i = 0; i < 520; i++) {
    const x = rand() * W;
    const w = 3 + rand() * 14;
    const light = rand() > 0.5;
    const g = ctx.createLinearGradient(x, 0, x + w, 0);
    g.addColorStop(0, 'rgba(255,255,255,0)');
    g.addColorStop(0.5, light ? 'rgba(255,238,242,0.34)' : 'rgba(222,120,150,0.2)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    const y0 = rand() * H * 0.4;
    ctx.fillRect(x, y0, w, H - y0 - rand() * H * 0.3);
  }
  // a few horizontal knife ridges
  for (let i = 0; i < 26; i++) {
    const y = rand() * H;
    ctx.fillStyle = `rgba(255,255,255,${0.05 + rand() * 0.09})`;
    ctx.fillRect(0, y, W, 1 + rand() * 2);
  }
  // seams repeat cleanly
  const tex = finish(c);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

/** Swirled pastel stripes for the candle. */
export function candleTexture() {
  const { c, ctx } = canvas(128, 256);
  ctx.fillStyle = '#fff4ec';
  ctx.fillRect(0, 0, 128, 256);
  ctx.fillStyle = '#ef7fa0';
  const band = 34;
  for (let i = -6; i < 14; i++) {
    ctx.beginPath();
    // diagonal bands that wrap around the cylinder
    ctx.moveTo(0, i * band);
    ctx.lineTo(128, i * band - 90);
    ctx.lineTo(128, i * band - 90 + band * 0.5);
    ctx.lineTo(0, i * band + band * 0.5);
    ctx.closePath();
    ctx.fill();
  }
  ctx.fillStyle = '#f3c85c';
  for (let i = -6; i < 14; i++) {
    ctx.beginPath();
    ctx.moveTo(0, i * band + band * 0.62);
    ctx.lineTo(128, i * band - 90 + band * 0.62);
    ctx.lineTo(128, i * band - 90 + band * 0.74);
    ctx.lineTo(0, i * band + band * 0.74);
    ctx.closePath();
    ctx.fill();
  }
  const tex = finish(c);
  tex.wrapS = THREE.RepeatWrapping;
  return tex;
}

/** Soft vertical fade for light beams: bright near the lamp, gone by the floor. */
export function beamTexture() {
  const { c, ctx } = canvas(8, 128);
  const g = ctx.createLinearGradient(0, 0, 0, 128);
  g.addColorStop(0, '#ffffff');
  g.addColorStop(0.35, '#6a6a6a');
  g.addColorStop(1, '#000000');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 8, 128);
  return finish(c, false);
}

/** A row of pennant cells: HAPPY BIRTHDAY, one letter per flag. */
export function buntingAtlas(letters: string[], palette: string[]) {
  const cell = 128;
  const { c, ctx } = canvas(cell * letters.length, cell);
  letters.forEach((ch, i) => {
    ctx.fillStyle = palette[i % palette.length];
    ctx.fillRect(i * cell, 0, cell, cell);
    const g = ctx.createLinearGradient(i * cell, 0, i * cell, cell);
    g.addColorStop(0, 'rgba(255,255,255,0.28)');
    g.addColorStop(1, 'rgba(0,0,0,0.12)');
    ctx.fillStyle = g;
    ctx.fillRect(i * cell, 0, cell, cell);
    ctx.fillStyle = '#fff8e6';
    ctx.font = 'bold 66px "Playfair Display", Georgia, serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(ch, i * cell + cell / 2, cell * 0.36);
  });
  return finish(c);
}

/** Subtle damask-like weave for the tablecloth. */
export function clothTexture() {
  const { c, ctx } = canvas(256, 256);
  ctx.fillStyle = '#f6ebe0';
  ctx.fillRect(0, 0, 256, 256);
  ctx.strokeStyle = 'rgba(214,170,120,0.35)';
  ctx.lineWidth = 1.2;
  for (let y = 0; y < 256; y += 64) {
    for (let x = 0; x < 256; x += 64) {
      ctx.beginPath();
      ctx.moveTo(x + 32, y + 8);
      ctx.bezierCurveTo(x + 52, y + 24, x + 52, y + 40, x + 32, y + 56);
      ctx.bezierCurveTo(x + 12, y + 40, x + 12, y + 24, x + 32, y + 8);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(x + 32, y + 32, 3.5, 0, Math.PI * 2);
      ctx.stroke();
    }
  }
  for (let i = 0; i < 2400; i++) {
    ctx.fillStyle = `rgba(120,80,60,${Math.random() * 0.05})`;
    ctx.fillRect(Math.random() * 256, Math.random() * 256, 1, 1);
  }
  const tex = finish(c);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

/** Dark radial blob that fakes contact shadow under objects (cheap on phones). */
export function shadowBlobTexture() {
  const { c, ctx } = canvas(128, 128);
  const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
  g.addColorStop(0, 'rgba(0,0,0,0.85)');
  g.addColorStop(0.55, 'rgba(0,0,0,0.4)');
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 128, 128);
  return finish(c);
}
