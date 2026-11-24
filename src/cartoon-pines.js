import * as T from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';

// Chunky low-poly pines and rounded boulders that match the illustrated
// backdrop: flat-shaded tiers with puffy snow caps instead of flat cut-outs.

const GREENS = [0x4b9a63, 0x3b8756];
const SNOWS = [0xf6fcff, 0xe1f1ff];
const TRUNK = 0x8a6a49;
const ROCKS = [0xafc3d4, 0x9cb2c6];

function seeded(seed) {
  return () => ((seed = Math.imul(seed, 1664525) + 1013904223 | 0) >>> 0) / 4294967296;
}

function paint(source, color) {
  // Merging needs a consistent index state, so every part is flattened here.
  const geometry = source.index ? source.toNonIndexed() : source;
  if (geometry !== source) source.dispose();
  const c = new T.Color(color);
  const count = geometry.attributes.position.count;
  const colors = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    colors[i * 3] = c.r;
    colors[i * 3 + 1] = c.g;
    colors[i * 3 + 2] = c.b;
  }
  geometry.setAttribute('color', new T.BufferAttribute(colors, 3));
  return geometry;
}

// [baseY, height, radius] stacked from the bottom tier up. Unit height overall.
const TIERS = {
  4: [[.15, .37, .38], [.36, .33, .30], [.56, .30, .21], [.74, .32, .11]],
  3: [[.15, .43, .40], [.39, .41, .30], [.62, .44, .17]],
};

export function pineGeometry(tiers, rng) {
  const parts = [];
  const trunk = new T.CylinderGeometry(.032, .062, .38, 7);
  trunk.translate(0, .19, 0);
  parts.push(paint(trunk, TRUNK));
  for (const [y, h, r] of TIERS[tiers]) {
    const skirt = new T.ConeGeometry(r, h, 9, 1);
    skirt.translate(0, y + h / 2, 0);
    parts.push(paint(skirt, GREENS[rng() > .5 ? 0 : 1]));

    // The snow cap is a squat cone so each tier reads as a rounded white pad
    // with only a thin green frill showing underneath.
    const capHeight = h * .52, capRadius = r * .94;
    const cap = new T.ConeGeometry(capRadius, capHeight, 9, 1);
    cap.translate(0, y + h * .46 + capHeight / 2, 0);
    parts.push(paint(cap, SNOWS[rng() > .5 ? 0 : 1]));

    // Rounded snow blobs hugging the tier rim give the illustrated silhouette.
    for (let blob = 0; blob < 2; blob++) {
      const angle = rng() * Math.PI * 2;
      const puff = new T.IcosahedronGeometry(r * (.16 + rng() * .07), 0);
      puff.scale(1.25, .5, 1.25);
      puff.translate(Math.cos(angle) * r * .78, y + h * .22 + rng() * .08, Math.sin(angle) * r * .78);
      parts.push(paint(puff, SNOWS[0]));
    }
  }
  const merged = mergeGeometries(parts, false);
  parts.forEach(part => part.dispose());
  merged.scale(1, 1 / 1.06, 1);
  return merged;
}

export function rockGeometry(seed) {
  const rng = seeded(seed);
  const parts = [];
  const body = new T.IcosahedronGeometry(1, 0);
  body.scale(.63, .5, .55);
  body.translate(0, .5, 0);
  parts.push(paint(body, ROCKS[0]));

  const lump = new T.IcosahedronGeometry(.62, 0);
  lump.scale(.85, .62, .95);
  lump.rotateY(rng() * 3.1);
  lump.translate(.26, .46, -.08);
  parts.push(paint(lump, ROCKS[1]));

  const cap = new T.IcosahedronGeometry(.66, 0);
  cap.scale(1, .42, .92);
  cap.translate(.02, .74, .02);
  parts.push(paint(cap, 0xf7fdff));

  const merged = mergeGeometries(parts, false);
  parts.forEach(part => part.dispose());
  return merged;
}

// Dense roadside forest and boulders replacing the old flat billboards and the
// hazy empty flanks. Everything rides a wrapping ring so the trail is endless.
export function createSideForest(scene) {
  const rng = seeded(9137);
  const geometries = [pineGeometry(4, rng), pineGeometry(3, rng), rockGeometry(11), rockGeometry(29)];
  const material = new T.MeshStandardMaterial({vertexColors: true, flatShading: true, roughness: .72, metalness: 0});
  const span = 210;
  const items = [[], [], [], []];
  const dummy = new T.Object3D();

  function add(index, x, z, sx, sy, sz, shade) {
    dummy.position.set(x, 0, z);
    dummy.rotation.set(0, rng() * Math.PI * 2, 0);
    dummy.scale.set(sx, sy, sz);
    dummy.updateMatrix();
    items[index].push({matrix: dummy.matrix.clone(), z, shade});
  }

  for (const side of [-1, 1]) {
    // Front rank of chunky pines right behind the trail edge.
    for (let i = 0; i < 46; i++) {
      const height = 4.2 + Math.pow(rng(), .8) * 4.6;
      add(i % 6 === 0 ? 1 : 0, side * (11.8 + Math.pow(rng(), .7) * 13), -rng() * span,
        height * (.62 + rng() * .16), height, height * (.62 + rng() * .16), .88 + rng() * .2);
    }
    // Taller back rank that closes off the horizon where the haze used to sit.
    for (let i = 0; i < 96; i++) {
      const height = 7 + rng() * 8;
      add(0, side * (23 + rng() * 38), -rng() * span,
        height * (.56 + rng() * .2), height, height * (.56 + rng() * .2), .74 + rng() * .18);
    }
    // Snowy boulders tucked between the pines and along the trail edge.
    for (let i = 0; i < 34; i++) {
      const width = 1.6 + rng() * 2.6;
      add(2 + (i % 2), side * (10.6 + Math.pow(rng(), .7) * 22), -rng() * span,
        width, width * (.55 + rng() * .35), width * (.8 + rng() * .3), .9 + rng() * .16);
    }
  }

  const meshes = geometries.map((geometry, index) => {
    const mesh = new T.InstancedMesh(geometry, material, items[index].length);
    mesh.frustumCulled = false;
    mesh.instanceMatrix.setUsage(T.DynamicDrawUsage);
    items[index].forEach(({matrix, shade}, i) => {
      mesh.setMatrixAt(i, matrix);
      mesh.setColorAt(i, new T.Color(shade, shade, shade));
    });
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    scene.add(mesh);
    return mesh;
  });

  function advance(traveled) {
    items.forEach((list, index) => {
      const mesh = meshes[index];
      list.forEach((item, i) => {
        const wrap = ((15 - item.z - traveled) % span + span) % span;
        item.matrix.elements[14] = 15 - wrap;
        mesh.setMatrixAt(i, item.matrix);
      });
      mesh.instanceMatrix.needsUpdate = true;
    });
  }

  advance(0);
  return {
    advance,
    dispose() {
      meshes.forEach(mesh => {
        scene.remove(mesh);
        mesh.dispose();
      });
      geometries.forEach(geometry => geometry.dispose());
      material.dispose();
    },
  };
}
