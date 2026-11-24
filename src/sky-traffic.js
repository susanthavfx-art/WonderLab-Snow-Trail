import * as T from 'three';

// Slow, decorative sky traffic: hot air balloons drifting and a gondola line
// whose cabins creep along the cable. Both animate on their own clock, so they
// keep moving even while the run is paused.

const BALLOON_COLORS = [
  [0xe8443f, 0xffd166, 0x3d7dd8],
  [0x38b6df, 0xfff0b3, 0xf4735e],
  [0x9b5de5, 0xffd6f5, 0x2b9cff],
  [0xf9a03f, 0xffffff, 0x2ec4b6],
];

function paint(geometry, color) {
  const c = new T.Color(color);
  const colors = new Float32Array(geometry.attributes.position.count * 3);
  for (let i = 0; i < colors.length; i += 3) {
    colors[i] = c.r; colors[i + 1] = c.g; colors[i + 2] = c.b;
  }
  geometry.setAttribute('color', new T.BufferAttribute(colors, 3));
  return geometry;
}

function balloonMesh(palette) {
  const parts = [];
  const envelope = new T.SphereGeometry(1, 16, 14, 0, Math.PI * 2, 0, Math.PI * .62);
  envelope.scale(1, 1.22, 1);
  parts.push(paint(envelope, palette[0]));
  for (let stripe = 0; stripe < 4; stripe++) {
    const wedge = new T.SphereGeometry(1.004, 5, 12, stripe * Math.PI / 2 + .12, Math.PI / 4 - .24, 0, Math.PI * .6);
    wedge.scale(1, 1.22, 1);
    parts.push(paint(wedge, palette[1 + stripe % 2]));
  }
  const skirt = new T.ConeGeometry(.62, .42, 16, 1, true);
  skirt.rotateX(Math.PI);
  skirt.translate(0, -.42, 0);
  parts.push(paint(skirt, palette[2]));

  const group = new T.Group();
  const fabric = new T.Group();
  parts.forEach(part => fabric.add(new T.Mesh(part, new T.MeshStandardMaterial({
    vertexColors: true, roughness: .58, metalness: 0, side: T.DoubleSide,
  }))));
  group.add(fabric);

  const basket = new T.Mesh(new T.BoxGeometry(.34, .28, .34), new T.MeshStandardMaterial({color: 0x8a5a2b, roughness: .88}));
  basket.position.y = -1.42;
  const ropeMaterial = new T.MeshBasicMaterial({color: 0x6b4a2a});
  for (const [x, z] of [[.1, .1], [.1, -.1], [-.1, .1], [-.1, -.1]]) {
    const rope = new T.Mesh(new T.CylinderGeometry(.012, .012, .62, 4), ropeMaterial);
    rope.position.set(x, -1.09, z);
    group.add(rope);
  }
  group.add(basket);
  return group;
}

function cabinMesh() {
  const group = new T.Group();
  const body = new T.Mesh(new T.BoxGeometry(1.25, 1.0, 1.05), new T.MeshStandardMaterial({color: 0xe0483d, roughness: .45, metalness: .12}));
  body.position.y = -.85;
  group.add(body);
  const glass = new T.Mesh(new T.BoxGeometry(1.31, .52, 1.11), new T.MeshStandardMaterial({color: 0x9fe4ff, roughness: .18, metalness: .3}));
  glass.position.y = -.62;
  group.add(glass);
  const roof = new T.Mesh(new T.BoxGeometry(1.36, .16, 1.16), new T.MeshStandardMaterial({color: 0x39424f, roughness: .6}));
  roof.position.y = -.18;
  group.add(roof);
  const hanger = new T.Mesh(new T.CylinderGeometry(.06, .06, .42, 6), new T.MeshStandardMaterial({color: 0x556070, roughness: .5, metalness: .4}));
  hanger.position.y = .06;
  group.add(hanger);
  return group;
}

export function createSkyTraffic(scene) {
  const balloons = [];
  const rng = (() => { let seed = 4703; return () => ((seed = Math.imul(seed, 1664525) + 1013904223 | 0) >>> 0) / 4294967296; })();
  for (let i = 0; i < 3; i++) {
    const balloon = balloonMesh(BALLOON_COLORS[i]);
    const base = {
      x: -26 + rng() * 52,
      y: 16 + rng() * 12,
      z: -42 - rng() * 44,
      phase: rng() * Math.PI * 2,
      scale: 1.5 + rng() * .9,
    };
    balloon.position.set(base.x, base.y, base.z);
    balloon.scale.setScalar(base.scale);
    scene.add(balloon);
    balloons.push({mesh: balloon, base});
  }

  // Gondola line running up the right flank of the trail.
  const cable = new T.Group();
  cable.position.set(33, 0, -66);
  scene.add(cable);
  const towerMaterial = new T.MeshStandardMaterial({color: 0x7b8797, roughness: .6, metalness: .35});
  const cableMaterial = new T.MeshBasicMaterial({color: 0x39414d});
  const topY = 16;
  for (const z of [20, -14, -48]) {
    const tower = new T.Mesh(new T.CylinderGeometry(.2, .34, topY, 8), towerMaterial);
    tower.position.set(0, topY / 2, z);
    const arm = new T.Mesh(new T.BoxGeometry(5.4, .26, .5), towerMaterial);
    arm.position.set(0, topY, z);
    cable.add(tower, arm);
  }
  const spans = [[20, -14], [-14, -48], [-48, -82]];
  for (const [from, to] of spans) {
    for (const offset of [-2.6, 2.6]) {
      const wire = new T.Mesh(new T.BoxGeometry(.085, .085, Math.abs(to - from)), cableMaterial);
      wire.position.set(offset, topY, (from + to) / 2);
      cable.add(wire);
    }
    // A far tower keeps the line running past the last visible span.
    if (to === -88) {
      const tower = new T.Mesh(new T.CylinderGeometry(.2, .38, topY, 8), towerMaterial);
      tower.position.set(0, topY / 2, to);
      cable.add(tower);
    }
  }

  const cabins = [];
  for (let i = 0; i < 6; i++) {
    const cabin = cabinMesh();
    const offset = i % 2 ? 2.6 : -2.6;
    cabin.position.set(offset, topY, 0);
    cable.add(cabin);
    cabins.push({mesh: cabin, offset, phase: (i / 6) * 122});
  }

  const length = 122;
  function advance(time) {
    for (const {mesh, base} of balloons) {
      mesh.position.y = base.y + Math.sin(time * .21 + base.phase) * 1.7;
      mesh.position.x = base.x + Math.sin(time * .07 + base.phase) * 8;
      mesh.position.z = base.z + Math.cos(time * .05 + base.phase) * 5;
      mesh.rotation.y = time * .03 + base.phase;
      mesh.rotation.z = Math.sin(time * .17 + base.phase) * .05;
    }
    for (const {mesh, offset, phase} of cabins) {
      const travel = (time * 2.6 + phase) % (length * 2);
      const along = travel < length ? travel : length * 2 - travel;
      mesh.position.set(offset, topY, 20 - along);
      mesh.rotation.z = Math.sin(time * 1.1 + phase) * .045;
    }
  }

  return {
    advance,
    dispose() {
      const resources = new Set();
      cable.traverse(node => {
        if (!node.isMesh) return;
        resources.add(node.geometry);
        for (const material of [].concat(node.material)) resources.add(material);
      });
      balloons.forEach(({mesh}) => {
        mesh.traverse(node => {
          if (!node.isMesh) return;
          resources.add(node.geometry);
          for (const material of [].concat(node.material)) resources.add(material);
        });
        scene.remove(mesh);
      });
      scene.remove(cable);
      resources.forEach(resource => resource.dispose());
    },
  };
}
