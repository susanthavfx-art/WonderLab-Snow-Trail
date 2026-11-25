import * as T from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import boy from '../Models/Snow Boy.glb?url';
import rocks from '../Models/free_pack_-_rocks_stylized.glb?url';
import pines from '../Models/snowy_pine_trees_pack__ps1_low_poly.glb?url';
import fence from '../Models/wood_fence (1).glb?url';
import flag from '../Models/flag_gdrive.glb?url';
import startLine from '../Models/starting_line.glb?url';

// Resolves once every GLB has settled, so the caller can tell the difference
// between "the scene exists" and "the real models are in it".
export function loadTrailModels(onModel) {
  const gltf = new GLTFLoader();
  const entries = {rider: boy, rocks, pines, fence, flag, start: startLine};
  const loads = Object.entries(entries).map(([kind, url]) =>
    gltf.loadAsync(url).then(asset => onModel(kind, asset)).catch(error => {
      console.warn(`Using fallback for ${kind}:`, error);
    }));
  return Promise.all(loads);
}

// Packs are laid out like a display shelf. Extract the individual meshes while
// retaining the exporter transforms on all their ancestors.
export function pieces(scene, filter) {
  scene.updateMatrixWorld(true);
  const result = [];
  scene.traverse(node => {
    if (!node.isMesh || !filter(node.name)) return;
    const model = node.clone();
    node.matrixWorld.decompose(model.position, model.quaternion, model.scale);
    const pivot = new T.Group();
    pivot.add(model);
    const bounds = new T.Box3().setFromObject(model);
    const center = bounds.getCenter(new T.Vector3());
    model.position.sub(new T.Vector3(center.x, bounds.min.y, center.z));
    result.push({pivot, size: bounds.getSize(new T.Vector3())});
  });
  return result;
}

export function instance(piece, {height = Infinity, width = Infinity, depth = Infinity, angle = 0} = {}) {
  const {pivot, size} = piece;
  const model = pivot.clone();
  model.rotation.y = angle;
  const bounds = new T.Box3().setFromObject(model).getSize(new T.Vector3());
  model.scale.setScalar(Math.min(height / size.y, width / bounds.x, depth / bounds.z));
  return model;
}

// Flatten a whole scene into one geometry plus its (shared) material. Used for
// props that repeat many times: a merged mesh instanced 20x costs one draw call
// instead of one per primitive per copy.
export function mergeMeshes(source) {
  const parts = [];
  let material = null;
  source.updateMatrixWorld(true);
  source.traverse(node => {
    if (!node.isMesh) return;
    const geometry = node.geometry.clone();
    geometry.applyMatrix4(node.matrixWorld);
    // Merging needs consistent attribute sets and index state.
    for (const key of Object.keys(geometry.attributes)) {
      if (key !== 'position' && key !== 'normal' && key !== 'uv') geometry.deleteAttribute(key);
    }
    if (!geometry.attributes.uv) {
      geometry.setAttribute('uv', new T.BufferAttribute(new Float32Array(geometry.attributes.position.count * 2), 2));
    }
    if (!geometry.attributes.normal) geometry.computeVertexNormals();
    material ||= node.material;
    parts.push(geometry.index ? geometry.toNonIndexed() : geometry);
  });
  const merged = parts.length === 1 ? parts[0] : mergeGeometries(parts, false);
  if (parts.length > 1) parts.forEach(part => part.dispose());
  // Base on the ground, centred on x/z, so instance placement stays simple.
  merged.computeBoundingBox();
  const box = merged.boundingBox, size = box.getSize(new T.Vector3());
  merged.translate(-(box.min.x + box.max.x) / 2, -box.min.y, -(box.min.z + box.max.z) / 2);
  merged.computeBoundingBox();
  return {geometry: merged, material, size};
}

// Full scenes need their box centred on the ground and scaled to a target size.
// The scale lives on an outer group so the inner offset stays in model units.
export function fitScene(source, {height, width, depth} = {}) {
  const model = source.clone(true);
  const bounds = new T.Box3().setFromObject(model);
  const size = bounds.getSize(new T.Vector3());
  const center = bounds.getCenter(new T.Vector3());
  const scale = Math.min(
    height ? height / size.y : Infinity,
    width ? width / size.x : Infinity,
    depth ? depth / size.z : Infinity,
  );
  model.position.sub(new T.Vector3(center.x, bounds.min.y, center.z));
  const inner = new T.Group();
  inner.add(model);
  const pivot = new T.Group();
  pivot.add(inner);
  pivot.scale.setScalar(scale);
  pivot.userData.size = size.clone().multiplyScalar(scale);
  return pivot;
}

// Replace every texture on a scene with a freshly loaded map, keeping the UVs.
export function retint(source, map) {
  source.traverse(node => {
    if (!node.isMesh) return;
    const materials = [].concat(node.material);
    for (const material of materials) {
      material.map = map;
      material.color?.set(0xffffff);
      material.transparent = false;
      material.alphaTest = 0;
      material.needsUpdate = true;
    }
  });
  return source;
}

export function disposeModel(scene) {
  const resources = new Set();
  scene.traverse(node => {
    if (!node.isMesh) return;
    resources.add(node.geometry);
    if (node.isSkinnedMesh) resources.add(node.skeleton);
    for (const material of [].concat(node.material)) {
      resources.add(material);
      for (const value of Object.values(material)) if (value?.isTexture) resources.add(value);
    }
  });
  resources.forEach(resource => resource.dispose());
}
