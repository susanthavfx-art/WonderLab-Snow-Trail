import * as T from 'three';

// Small canvas-drawn texture for the falling-snow sparkle sprite.

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
