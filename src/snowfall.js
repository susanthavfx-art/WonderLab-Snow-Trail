import * as T from 'three';
import {snowflakeTexture} from './trail-textures.js';

// Three layers of drifting snow: light always-on flurries plus a denser flurry
// burst whenever the rider lands or passes a gate, which sells the speed
// without costing frames (two textured point clouds, no per-flake meshes).

export function createSnowfall(scene) {
  const texture = snowflakeTexture();
  const layers = [];

  function makeLayer({count, size, spread, height, speed, opacity}) {
    const positions = new Float32Array(count * 3);
    const seeds = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      positions[i * 3] = (Math.random() - .5) * spread;
      positions[i * 3 + 1] = Math.random() * height;
      positions[i * 3 + 2] = -Math.random() * 90 + 8;
      seeds[i] = Math.random() * Math.PI * 2;
    }
    const geometry = new T.BufferGeometry();
    geometry.setAttribute('position', new T.BufferAttribute(positions, 3));
    const material = new T.PointsMaterial({
      map: texture, size, transparent: true, opacity, depthWrite: false,
      sizeAttenuation: true, color: 0xffffff, blending: T.NormalBlending,
    });
    const points = new T.Points(geometry, material);
    points.frustumCulled = false;
    scene.add(points);
    layers.push({points, positions, seeds, spread, height, speed, baseOpacity: opacity});
  }

  makeLayer({count: 420, size: .16, spread: 46, height: 16, speed: 1.6, opacity: .55});
  makeLayer({count: 260, size: .3, spread: 34, height: 12, speed: 2.6, opacity: .8});

  let burst = 0;      // 0..1 strength of the current flurry burst
  let burstUntil = 0;

  function advance(dt, time, riderSpeed, trailSpeed) {
    if (burstUntil > time) burst = Math.max(burst, .35);
    burst = Math.max(0, burst - dt * 1.1);

    for (const layer of layers) {
      const {positions, seeds, spread, height, points} = layer;
      const fall = (layer.speed + trailSpeed * .22) * dt;
      const drift = burst * 5 * dt;
      for (let i = 0; i < seeds.length; i++) {
        const i3 = i * 3;
        positions[i3 + 1] -= fall * (1 + (i % 7) * .08);
        positions[i3] += Math.sin(time * .0011 + seeds[i]) * drift * .55 + riderSpeed * 0;
        positions[i3 + 2] += trailSpeed * dt * .35;
        if (positions[i3 + 1] < -.4) {
          positions[i3 + 1] = height;
          positions[i3] = (Math.random() - .5) * spread;
        }
        if (positions[i3 + 2] > 12) positions[i3 + 2] -= 100;
        if (Math.abs(positions[i3]) > spread / 2) positions[i3] *= -.92;
      }
      points.geometry.attributes.position.needsUpdate = true;
      points.material.opacity = layer.baseOpacity + burst * .35;
      points.material.size = layer.size * (1 + burst * .45);
    }
  }

  function flurry(strength = 1) {
    burst = Math.min(1.6, burst + strength);
    burstUntil = performance.now() + 700;
  }

  return {
    advance,
    flurry,
    dispose() {
      for (const layer of layers) {
        scene.remove(layer.points);
        layer.points.geometry.dispose();
        layer.points.material.dispose();
      }
      texture.dispose();
    },
  };
}
