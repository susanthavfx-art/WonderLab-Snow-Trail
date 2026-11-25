import * as T from 'three';
import horizon from '../public/winter-horizon.jpg?url';

// A wrapped cylinder behind the treeline: sunny winter mountains and sky as a
// single horizon image. Mirrored wrapping keeps the repeats seamless, and the
// repeat count must stay even or the mirror boundary shows as a hard seam.
export function createHorizon(scene) {
  const texture = new T.TextureLoader().load(horizon, loaded => {
    loaded.colorSpace = T.SRGBColorSpace;
    loaded.wrapS = T.MirroredRepeatWrapping;
    loaded.wrapT = T.ClampToEdgeWrapping;
    loaded.repeat.set(2, 1);
    // Shifting the pattern moves the mirror planes off the centre of the view.
    loaded.offset.set(.25, 0);
    loaded.needsUpdate = true;
  });
  texture.colorSpace = T.SRGBColorSpace;
  texture.wrapS = T.MirroredRepeatWrapping;
  texture.wrapT = T.ClampToEdgeWrapping;
  texture.repeat.set(2, 1);
  texture.offset.set(.25, 0);

  const radius = 240;
  const height = 150;
  const geometry = new T.CylinderGeometry(radius, radius, height, 48, 1, true);
  const material = new T.MeshBasicMaterial({
    map: texture,
    side: T.BackSide,
    fog: false,
    depthWrite: false,
    toneMapped: false,
  });
  const mesh = new T.Mesh(geometry, material);
  // The image's mountain bases sit on the horizon line, so the cylinder is
  // raised until its lower edge meets the trail at eye level.
  mesh.position.y = height / 2 - 6;
  mesh.renderOrder = -10;
  scene.add(mesh);

  return {
    mesh,
    dispose() {
      scene.remove(mesh);
      geometry.dispose();
      material.dispose();
      texture.dispose();
    },
  };
}
