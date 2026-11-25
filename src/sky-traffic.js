import * as T from 'three';

// Slow, decorative sky traffic: a gondola line whose cabins creep along the
// cable on their own clock, so it keeps moving even while the run is paused.

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
  // Gondola line running up the right flank of the trail. The hot air balloons
  // were dropped so the sky stays clean behind the new horizon backdrop.
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
    if (to === -82) {
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
      scene.remove(cable);
      resources.forEach(resource => resource.dispose());
    },
  };
}
