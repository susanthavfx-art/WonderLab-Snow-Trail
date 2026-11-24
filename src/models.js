import * as T from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import boy from '../Models/Snow Boy.glb?url';
import rocks from '../Models/free_pack_-_rocks_stylized.glb?url';
import trees from '../Models/snow_trees_pack_lowpoly.glb?url';
import pines from '../Models/snowy_pine_trees_pack__ps1_low_poly.glb?url';
import fallen from '../Models/snowy_fallen_tree.glb?url';

function loader() {
  // The fallen tree uses the older spec/gloss extension; retain its diffuse map.
  return new GLTFLoader().register(parser => ({
    name: 'KHR_materials_pbrSpecularGlossiness',
    async extendMaterialParams(index, params) {
      const diffuse = parser.json.materials[index].extensions?.[this.name]?.diffuseTexture;
      if (diffuse) await parser.assignTexture(params, 'map', diffuse, T.SRGBColorSpace);
    },
  }));
}

export function loadTrailModels(onModel) {
  const gltf = loader();
  const entries = {rider:boy, rocks, trees, pines, fallen};
  for (const [kind, url] of Object.entries(entries)) {
    gltf.loadAsync(url).then(asset => onModel(kind, asset)).catch(error => {
      console.warn(`Using fallback for ${kind}:`, error);
    });
  }
}

// Packs are laid out like a display shelf. Extract the individual meshes while
// retaining the exporter transforms on all their ancestors.
export function pieces(scene, filter) {
  scene.updateMatrixWorld(true);
  const result=[];
  scene.traverse(node => {
    if (!node.isMesh || !filter(node.name)) return;
    const model=node.clone();
    node.matrixWorld.decompose(model.position, model.quaternion, model.scale);
    const pivot=new T.Group();
    pivot.add(model);
    const bounds=new T.Box3().setFromObject(model);
    const center=bounds.getCenter(new T.Vector3());
    model.position.sub(new T.Vector3(center.x,bounds.min.y,center.z));
    result.push({pivot,size:bounds.getSize(new T.Vector3())});
  });
  return result;
}

export function instance(piece,{height=Infinity,width=Infinity,depth=Infinity,angle=0}={}) {
  const {pivot,size}=piece;
  const model=pivot.clone();
  model.rotation.y=angle;
  const bounds=new T.Box3().setFromObject(model).getSize(new T.Vector3());
  model.scale.setScalar(Math.min(height/size.y,width/bounds.x,depth/bounds.z));
  return model;
}

export function disposeModel(scene) {
  const resources=new Set();
  scene.traverse(node=>{
    if (!node.isMesh) return;
    resources.add(node.geometry);
    if(node.isSkinnedMesh) resources.add(node.skeleton);
    for (const material of [].concat(node.material)) {
      resources.add(material);
      for (const value of Object.values(material)) if (value?.isTexture) resources.add(value);
    }
  });
  resources.forEach(resource=>resource.dispose());
}
