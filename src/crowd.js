import * as T from 'three';
import {crowdTexture, cheerTexture} from './trail-textures.js';

// Spectator banks lining the trail. Each bank is a camera-facing billboard of
// cheering people; they scroll with the run and wrap, and they hop with a
// travelling ripple whenever the rider passes a flag gate.

const BANKS = 12;
const SPACING = 9.5;
const ACCENTS = ['#2f7bff', '#ef3b45', '#41c98a', '#ffcf4e'];

export function createCrowd(scene) {
  const banks = [];
  const root = new T.Group();
  scene.add(root);

  for (let i = 0; i < BANKS; i++) {
    for (const side of [-1, 1]) {
      const texture = crowdTexture(i * 13 + (side > 0 ? 7 : 3));
      const material = new T.SpriteMaterial({
        map: texture, transparent: true, depthWrite: false, alphaTest: .08, fog: false,
      });
      const sprite = new T.Sprite(material);
      sprite.scale.set(9.5, 4.6, 1);
      const baseZ = 4 - i * SPACING;
      sprite.position.set(side * 12.2, 2.3, baseZ);
      sprite.userData = {side, baseZ, phase: Math.random() * 6.283, cheer: 0};
      root.add(sprite);
      banks.push(sprite);
    }
  }

  // Big campaign flags behind the crowd so the banks read as race barriers.
  const banners = [];
  const bannerTexture = ['#2f7bff', '#ef3b45'].map(cheerTexture);
  for (let i = 0; i < 4; i++) {
    const side = i % 2 ? 1 : -1;
    const mesh = new T.Mesh(
      new T.PlaneGeometry(6.4, 3.2),
      new T.MeshBasicMaterial({map: bannerTexture[i % 2], transparent: true, side: T.DoubleSide, fog: false, depthWrite: false}),
    );
    mesh.position.set(side * 13.4, 3.9, 0 - i * SPACING * 3);
    mesh.rotation.y = -side * Math.PI / 2;
    root.add(mesh);
    banners.push(mesh);
  }

  const SPAN = BANKS * SPACING;
  let waveUntil = 0;

  function advance(traveled, time) {
    const cheering = time < waveUntil ? 1 : 0;
    for (const sprite of banks) {
      const {side, baseZ, phase} = sprite.userData;
      const wrapped = (((baseZ + traveled) % SPAN) + SPAN) % SPAN - SPAN + 8;
      sprite.position.z = wrapped;
      // Cheer harder the closer the rider is to the bank.
      const near = Math.max(0, 1 - Math.abs(wrapped) / 22);
      const bounce = Math.abs(Math.sin(time * .009 + phase)) * (.1 + .3 * near * cheering);
      sprite.position.y = 2.3 + bounce + Math.sin(time * .0014 + phase) * .04;
      sprite.position.x = side * (12.2 - bounce * .35);
      sprite.material.rotation = Math.sin(time * .0012 + phase) * .03;
      // Pop out of view well behind the camera instead of clipping through it.
      sprite.visible = wrapped < 10 && wrapped > -SPAN + 6;
    }
    for (const [i, mesh] of banners.entries()) {
      const wrapped = (((mesh.position.z + i * SPACING * 3 - SPAN + traveled) % (SPAN * 2)) + SPAN * 2) % (SPAN * 2) - SPAN + 8;
      mesh.position.z = wrapped;
      mesh.visible = wrapped < 8 && wrapped > -SPAN * 2 + 6;
    }
  }

  function cheer() {
    waveUntil = performance.now() + 2200;
  }

  return {
    advance,
    cheer,
    dispose() {
      scene.remove(root);
      root.traverse(node => {
        if (!node.isMesh && !node.isSprite) return;
        node.geometry?.dispose();
        if (node.material) {
          node.material.map?.dispose();
          node.material.dispose();
        }
      });
    },
  };
}
