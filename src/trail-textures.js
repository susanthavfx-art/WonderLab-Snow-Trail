import * as T from 'three';

// Small canvas-drawn textures for the trail props: crowd faces, cheer banners
// and the sparkle sprite used for the falling-snow effect.

function canvasTexture(width, height, draw, {colorSpace = true, repeat = false} = {}) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  draw(canvas.getContext('2d'), width, height);
  const texture = new T.CanvasTexture(canvas);
  if (colorSpace) texture.colorSpace = T.SRGBColorSpace;
  if (repeat) texture.wrapS = texture.wrapT = T.RepeatWrapping;
  texture.needsUpdate = true;
  return texture;
}

const SKIN = ['#ffd7b0', '#f2b98c', '#c78a5c', '#8f5a37'];
const COATS = ['#2f7bff', '#ef3b45', '#ffcf4e', '#41c98a', '#a86bff', '#ff8a3d'];
const HAIR = ['#3a2418', '#5b3a22', '#1d1a17', '#8a5a2b'];

// One row of cheering spectators: bodies, heads, hats and lifted arms.
export function crowdTexture(seed = 1) {
  let state = seed;
  const rnd = () => ((state = Math.imul(state, 1664525) + 1013904223 | 0) >>> 0) / 4294967296;
  return canvasTexture(512, 256, (ctx, w, h) => {
    ctx.clearRect(0, 0, w, h);
    const people = 7;
    for (let i = 0; i < people; i++) {
      const x = (i + .5) * (w / people) + (rnd() - .5) * 12;
      const baseY = h * (.62 + rnd() * .12);
      const scale = .82 + rnd() * .3;
      const coat = COATS[Math.floor(rnd() * COATS.length)];
      const skin = SKIN[Math.floor(rnd() * SKIN.length)];
      const hair = HAIR[Math.floor(rnd() * HAIR.length)];

      // arms up (cheering), drawn behind the body
      ctx.strokeStyle = coat;
      ctx.lineWidth = 13 * scale;
      ctx.lineCap = 'round';
      for (const side of [-1, 1]) {
        ctx.beginPath();
        ctx.moveTo(x + side * 20 * scale, baseY - 58 * scale);
        ctx.lineTo(x + side * (34 + rnd() * 8) * scale, baseY - (96 + rnd() * 16) * scale);
        ctx.stroke();
      }
      // body
      ctx.fillStyle = coat;
      ctx.beginPath();
      ctx.roundRect(x - 27 * scale, baseY - 66 * scale, 54 * scale, 74 * scale, 16 * scale);
      ctx.fill();
      // head
      ctx.fillStyle = skin;
      ctx.beginPath();
      ctx.arc(x, baseY - 88 * scale, 19 * scale, 0, Math.PI * 2);
      ctx.fill();
      // hat / hair
      ctx.fillStyle = rnd() > .35 ? coat : hair;
      ctx.beginPath();
      ctx.arc(x, baseY - 94 * scale, 19 * scale, Math.PI * 1.05, Math.PI * 1.95);
      ctx.fill();
      ctx.beginPath();
      ctx.roundRect(x - 20 * scale, baseY - 98 * scale, 40 * scale, 9 * scale, 4 * scale);
      ctx.fill();
      // eyes + smile
      ctx.fillStyle = '#25313f';
      ctx.beginPath(); ctx.arc(x - 7 * scale, baseY - 88 * scale, 2.4 * scale, 0, 7); ctx.fill();
      ctx.beginPath(); ctx.arc(x + 7 * scale, baseY - 88 * scale, 2.4 * scale, 0, 7); ctx.fill();
      ctx.strokeStyle = '#25313f';
      ctx.lineWidth = 2.4 * scale;
      ctx.beginPath(); ctx.arc(x, baseY - 82 * scale, 7 * scale, .25, Math.PI - .25); ctx.stroke();
    }
  });
}

// "WONDERLAB WINTER RACE" mini banner the crowd waves.
export function cheerTexture(accent = '#2f7bff') {
  return canvasTexture(512, 256, (ctx, w, h) => {
    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, accent);
    g.addColorStop(1, '#06203c');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#ffffff';
    const sq = 16;
    for (let i = 0; i < w / sq; i++) for (const row of [0, h - sq]) {
      if (i % 2 === 0) ctx.fillRect(i * sq, row, sq, sq);
    }
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 54px Inter, system-ui, sans-serif';
    ctx.fillText('WONDERLAB', w / 2, h / 2 - 6);
    ctx.fillStyle = '#ffd35e';
    ctx.font = 'bold 40px Inter, system-ui, sans-serif';
    ctx.fillText('WINTER RACE', w / 2, h / 2 + 44);
  });
}

// Soft round sprite for snowfall; drawn with a radial falloff.
export function snowflakeTexture() {
  return canvasTexture(64, 64, (ctx, w) => {
    const g = ctx.createRadialGradient(w / 2, w / 2, 0, w / 2, w / 2, w / 2);
    g.addColorStop(0, 'rgba(255,255,255,1)');
    g.addColorStop(.45, 'rgba(255,255,255,.85)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, w);
  }, {colorSpace: false});
}
