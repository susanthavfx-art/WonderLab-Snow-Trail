#!/usr/bin/env bash
# Rebuild the headless verification harness in .simtmp/ from the current src/.
#   bash _simsetup.sh && node .simtmp/verify.mjs
# The harness parses the real Models/*.glb files (textures stripped), runs the
# game loop on a fake DOM and reports what ended up in the scene graph.
set -e
rm -rf .simtmp && mkdir -p .simtmp
cp src/{run,coach,ride-gate,pose-view,cartoon-pines,sky-traffic,snowfall,backdrop,trail-textures}.js .simtmp/
cp src/models.js .simtmp/models-src.mjs

cat > .simtmp/three-shim.js <<'EOF'
export * from '../node_modules/three/build/three.module.js';

export class WebGLRenderer {
  constructor(){this.domElement={getContext(){return null;},style:{},addEventListener(){}};}
  setPixelRatio(){} setClearColor(){} setSize(){} render(){} dispose(){} forceContextLoss(){}
}

// No image decoding headless: hand back inert texture stand-ins.
class FakeTexture {
  constructor(url){ this.url=url; this.image={width:4,height:4}; this.colorSpace=''; this.needsUpdate=false;
    this.wrapS=this.wrapT=0; this.repeat={set(){}}; this.offset={set(){}}; this.flipY=true; }
  clone(){ return new FakeTexture(this.url); }
  dispose(){}
}
export class TextureLoader { load(url, onLoad){ const t=new FakeTexture(url); onLoad?.(t); return t; } }
export class CanvasTexture extends FakeTexture {}
EOF

cat > .simtmp/glb-strip.mjs <<'EOF'
// Strip images/textures from a GLB so it parses in Node without image decoding.
import fs from 'node:fs';
export function stripTextureGLB(path) {
  const buf = fs.readFileSync(path);
  const dv = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  const total = dv.getUint32(8, true);
  let off = 12, json = null, bin = null;
  while (off < total) {
    const len = dv.getUint32(off, true), type = dv.getUint32(off + 4, true);
    const start = off + 8;
    if (type === 0x4E4F534A) json = JSON.parse(buf.subarray(start, start + len).toString('utf8'));
    if (type === 0x004E4942) bin = buf.subarray(start, start + len);
    off = start + len;
  }
  delete json.images; delete json.textures; delete json.samplers;
  for (const m of json.materials ?? []) {
    const p = m.pbrMetallicRoughness ?? (m.pbrMetallicRoughness = {});
    for (const k of ['baseColorTexture', 'metallicRoughnessTexture']) delete p[k];
    for (const k of ['normalTexture', 'occlusionTexture', 'emissiveTexture', 'alphaCutoff']) delete m[k];
  }
  const jsonBytes = Buffer.from(JSON.stringify(json), 'utf8');
  const jsonPadded = Buffer.concat([jsonBytes, Buffer.alloc((4 - (jsonBytes.length % 4)) % 4, 0x20)]);
  const binPadded = bin ? Buffer.concat([bin, Buffer.alloc((4 - (bin.length % 4)) % 4, 0)]) : null;
  const header = Buffer.alloc(12);
  header.writeUInt32LE(0x46546C67, 0); header.writeUInt32LE(2, 4);
  header.writeUInt32LE(12 + 8 + jsonPadded.length + (binPadded ? 8 + binPadded.length : 0), 8);
  const jh = Buffer.alloc(8); jh.writeUInt32LE(jsonPadded.length, 0); jh.writeUInt32LE(0x4E4F534A, 4);
  const parts = [header, jh, jsonPadded];
  if (binPadded) {
    const bh = Buffer.alloc(8); bh.writeUInt32LE(binPadded.length, 0); bh.writeUInt32LE(0x004E4942, 4);
    parts.push(bh, binPadded);
  }
  return Buffer.concat(parts);
}
EOF

cat > .simtmp/models-real.mjs <<'EOF'
// Real GLB loading for the headless harness.
import { GLTFLoader } from '../node_modules/three/examples/jsm/loaders/GLTFLoader.js';
import * as T from './three-shim.js';
import { stripTextureGLB } from './glb-strip.mjs';

export { pieces, instance, fitScene, mergeMeshes, disposeModel } from './models-src.mjs';

const FILES = {
  rider: 'Models/Snow Boy.glb',
  rocks: 'Models/free_pack_-_rocks_stylized.glb',
  pines: 'Models/snowy_pine_trees_pack__ps1_low_poly.glb',
  fence: 'Models/wood_fence (1).glb',
  flag: 'Models/flag_gdrive.glb',
  start: 'Models/starting_line.glb',
};

export function loadTrailModels(onModel) {
  const loader = new GLTFLoader();
  for (const [kind, file] of Object.entries(FILES)) {
    const buffer = stripTextureGLB(file);
    const ab = buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);
    loader.parse(ab, '', asset => {
      // Keep the original material names: the start gantry is branded by name.
      asset.scene.traverse(node => {
        if (node.isMesh) node.material = new T.MeshStandardMaterial({ name: node.material?.name ?? '' });
      });
      onModel(kind, asset);
    }, error => console.log('LOAD FAIL', kind, error.message));
  }
}
EOF

cat > .simtmp/fake-dom.mjs <<'EOF'
export class El {
  constructor(t = 'div') {
    this.tag = t; this.children = []; this.dataset = {}; this.style = {};
    this.classList = {add(){}, remove(){}, toggle(){}};
    this._html = ''; this._t = ''; this._q = new Map();
  }
  set innerHTML(v) { this._html = v; } get innerHTML() { return this._html; }
  set className(v) { this._cn = v; } get className() { return this._cn || ''; }
  append(...c) { this.children.push(...c); } prepend(...c) { this.children.unshift(...c); }
  insertAdjacentHTML() {} setAttribute() {} addEventListener() {}
  querySelector(s) { if (!this._q.has(s)) this._q.set(s, new El()); return this._q.get(s); }
  querySelectorAll() { return []; }
  replaceChildren() {}
  get clientWidth() { return 1280; } get clientHeight() { return 720; }
  set textContent(v) { this._t = v; } get textContent() { return this._t; }
}

const ctx = {
  clearRect(){}, fillRect(){}, beginPath(){}, arc(){}, fill(){}, stroke(){}, moveTo(){}, lineTo(){},
  roundRect(){}, fillText(){}, save(){}, restore(){}, translate(){}, scale(){}, clip(){},
  createLinearGradient: () => ({addColorStop(){}}), createRadialGradient: () => ({addColorStop(){}}),
  measureText: () => ({width: 10}), drawImage(){}, putImageData(){},
  textAlign: '', font: '', lineWidth: 0, lineCap: '', strokeStyle: '', fillStyle: '',
};

globalThis.document = {
  createElement(tag) {
    const e = new El(tag);
    if (tag === 'canvas') { e.width = 0; e.height = 0; e.getContext = () => ctx; }
    return e;
  },
  createElementNS: (ns, tag) => new El(tag),
  addEventListener(){}, querySelector: () => new El(), documentElement: new El(), fullscreenElement: null,
};
globalThis.devicePixelRatio = 2;
globalThis.window = { addEventListener(){}, removeEventListener(){} };
globalThis.self = globalThis;
globalThis.ResizeObserver = class { observe(){} disconnect(){} };
globalThis.URL.createObjectURL = () => 'blob:stub';
globalThis.URL.revokeObjectURL = () => {};
let raf = [];
globalThis.requestAnimationFrame = cb => raf.push(cb);
globalThis.cancelAnimationFrame = () => {};
globalThis.__raf = { take(){ const c = raf; raf = []; return c; } };
EOF

cat > .simtmp/verify.mjs <<'EOF'
import { El } from './fake-dom.mjs';
const T = await import('./three-shim.js');
const { createRun } = await import('./run.js');

const host = new El();
const errors = [];
process.on('uncaughtException', e => errors.push(e));
process.on('unhandledRejection', e => errors.push(e));

const run = createRun(host, { camera: null, icon: () => '', finish: () => {} });
let now = 1000;
const step = ms => { now += ms; globalThis.__raf.take().forEach(cb => cb(now)); };
const hud = () => ({
  score: host.querySelector('.score').textContent,
  flags: host.querySelector('.flags').textContent,
  dist: host.querySelector('.distance').textContent,
});

// Let the GLB parses settle, then run 40 s of game time.
for (let i = 0; i < 40; i++) { step(16.7); await new Promise(r => setTimeout(r, 20)); }
const t0 = Date.now();
for (let i = 0; i < 2400; i++) step(16.7);
const cpu = (Date.now() - t0) / 2400;

const scene = run.debugScene;
let meshes = 0;
const instanced = [], fence = [], flags = [], branded = new Set();
scene.traverse(node => {
  if (node.isInstancedMesh) instanced.push({count: node.count, tris: node.geometry.attributes.position.count / 3});
  if (node.isMesh) meshes++;
  if (node.isMesh && node.material?.name && ['Start_Texture','Ad_1','Ad_2'].includes(node.material.name)) branded.add(node.material.name);
  if (node.isMesh && /^flag-/.test(node.material?.name ?? '')) flags.push(node);
  if (node.isInstancedMesh && node.count > 5 && node.geometry.attributes.position.count / 3 === 540) fence.push(node);
});

console.log('40s run ->', JSON.stringify(hud()), 'errors', errors.map(e => e.message ?? String(e)));
console.log('avg frame cpu', cpu.toFixed(3), 'ms');
console.log('meshes', meshes, 'instanced', JSON.stringify(instanced), 'draw-call-ish', meshes + instanced.length);
console.log('gate flags in scene', flags.length);
for (const f of flags.slice(0, 6)) {
  const w = new T.Vector3(); f.getWorldPosition(w);
  const box = new T.Box3().setFromObject(f); const size = box.getSize(new T.Vector3());
  console.log(`  ${f.material.name} world x=${w.x.toFixed(2)} z=${w.z.toFixed(1)} height=${size.y.toFixed(2)} width=${size.x.toFixed(2)}`);
}
// crowd + snowfall presence
let sprites = 0, points = 0;
scene.traverse(n => { if (n.isSprite) sprites++; if (n.isPoints) points++; });
console.log('crowd sprites', sprites, 'snow layers', points);
console.log('branded gantry materials', [...branded]);
for (const f of fence) {
  const m = new T.Matrix4(), p = new T.Vector3(), q = new T.Quaternion(), s = new T.Vector3();
  const zs = [], xs = [];
  for (let i = 0; i < f.count; i++) { f.getMatrixAt(i, m); m.decompose(p, q, s); zs.push(p.z); xs.push(p.x); }
  console.log(`fence side x=${xs[0].toFixed(2)} count=${f.count} z ${Math.min(...zs).toFixed(1)}..${Math.max(...zs).toFixed(1)} scaleY=${s.y.toFixed(3)} height=${(s.y * (1.85)).toFixed(2)}m`);
}
run.stop();
console.log('dispose ok');
EOF

python3 - <<'PY'
import re, os
for f in os.listdir('.simtmp'):
    if not f.endswith(('.js', '.mjs')) or f in ('three-shim.js', 'fake-dom.mjs', 'verify.mjs', 'models-real.mjs', 'glb-strip.mjs'):
        continue
    p = '.simtmp/' + f
    s = open(p).read()
    s = s.replace("from 'three'", "from './three-shim.js'")
    s = s.replace("from 'three/addons/", "from '../node_modules/three/examples/jsm/")
    s = s.replace("from './models.js'", "from './models-real.mjs'")
    # asset imports become empty string constants (no bundler headless)
    s = re.sub(r"import (\w+) from '[^']*rider-face\.jpg';", r"const \1 = '';", s)
    s = re.sub(r"import (\w+) from '[^']*textures/[^']+';", r"const \1 = '';", s)
    s = re.sub(r"import (\w+) from '[^']*winter-horizon\.jpg\?url';", r"const \1 = '';", s)
    s = re.sub(r"import (\w+) from '[^']*Models/[^']+';", r"const \1 = '';", s)
    open(p, 'w').write(s)

# expose the scene graph for verification (not committed: .simtmp is ignored)
p = '.simtmp/run.js'
s = open(p).read()
s = s.replace("  return {\n    stop() {", "  return {\n    debugScene: scene,\n    stop() {", 1)
open(p, 'w').write(s)
PY

echo "harness ready -> node .simtmp/verify.mjs"
