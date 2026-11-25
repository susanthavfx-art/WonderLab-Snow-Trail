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
// Keep listeners so tests can drive the rider with synthetic key events.
const __win = { _k: {}, _u: {}, _b: {},
  addEventListener(k, f) { (k === 'keydown' ? __win._k : k === 'keyup' ? __win._u : __win._b)[f] = f; },
  removeEventListener(k, f) { delete (k === 'keydown' ? __win._k : __win._u)[f]; } };
globalThis.window = __win;
globalThis.__keys = {
  down: key => Object.values(__win._k).forEach(f => f({ key, preventDefault(){} })),
  up: key => Object.values(__win._u).forEach(f => f({ key })),
};
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
const objects = run.debugObjects;
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
if (objects) {
  const rocks = objects.filter(o => o.kind === 'rock').sort((a, b) => b.z - a.z);
  const lanes = {};
  for (const r of rocks) lanes[r.lane] = (lanes[r.lane] ?? 0) + 1;
  const gaps = rocks.slice(1).map((r, i) => Math.round(rocks[i].z - r.z)).filter(g => g > 0);
  console.log('rocks alive', rocks.length, 'by lane', JSON.stringify(lanes));
  if (gaps.length) console.log('rock gaps  min', Math.min(...gaps), 'avg', Math.round(gaps.reduce((a,b)=>a+b,0)/gaps.length), 'max', Math.max(...gaps));
  console.log('gates', objects.filter(o=>o.kind==='gate').length, 'stars', objects.filter(o=>o.kind==='star').length, 'ramps', objects.filter(o=>o.kind==='ramp').length);
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
s = s.replace("  return {\n    stop() {", "  return {\n    debugScene: scene,\n    debugObjects: objects,\n    debugRiderX: () => x,\n    stop() {", 1)
open(p, 'w').write(s)
PY

cat > .simtmp/density.mjs <<'EOF'
// How many rocks actually reach the rider, and on which lines?
import { El } from './fake-dom.mjs';
const { createRun } = await import('./run.js');
const run = createRun(new El(), { camera: null, icon: () => '', finish: () => {} });
let now = 1000, frames = 0;
let spawned = 0, reached = 0;
const lanes = {};
while (frames < 3600) {                       // 60 s
  now += 16.7; globalThis.__raf.take().forEach(cb => cb(now)); frames++;
  for (const r of run.debugObjects) {
    if (r.kind !== 'rock') continue;
    if (!r.seen) { r.seen = true; spawned++; }
    if (!r.counted && r.z > -1) { r.counted = true; reached++; lanes[r.lane] = (lanes[r.lane] ?? 0) + 1; }
  }
}
console.log('rocks spawned in 60 s:', spawned, '| reached the rider:', reached, '| lanes', JSON.stringify(lanes));
run.stop();
EOF

cat > .simtmp/diag.mjs <<'EOF'
// Replays the dodge bot and reports what killed it.
import { El } from './fake-dom.mjs';
const { createRun } = await import('./run.js');
let finished = null, lastRocks = [], lastX = 0;
const run = createRun(new El(), { camera: null, icon: () => '', finish: s => { finished = s; } });
let now = 1000;
const step = ms => { now += ms; globalThis.__raf.take().forEach(cb => cb(now)); };
for (let i = 0; i < 40; i++) { step(16.7); await new Promise(r => setTimeout(r, 15)); }
const LANES = [-6,-3,0,3,6];
let frames = 0;
while (!finished && frames < 7200) {
  if (frames % 4 === 0) {
    const rocks = run.debugObjects.filter(o => o.kind === 'rock' && o.z < 4 && o.z > -40);
    let best = 0, bestScore = -Infinity;
    for (const lane of LANES) {
      let score = -Math.abs(lane)*.12;
      for (const r of rocks) if (Math.abs(r.lane-lane) < 2.2) score -= 120/Math.max(3, Math.abs(r.z));
      if (score > bestScore) { bestScore = score; best = lane; }
    }
    const x = run.debugRiderX();
    globalThis.__keys.up('ArrowLeft'); globalThis.__keys.up('ArrowRight');
    if (best < x-.5) globalThis.__keys.down('ArrowLeft');
    else if (best > x+.5) globalThis.__keys.down('ArrowRight');
  }
  lastRocks = run.debugObjects.filter(o => o.kind === 'rock').map(r => ({lane: r.lane, z: +r.z.toFixed(1)}));
  lastX = run.debugRiderX();
  step(16.7); frames++;
}
if (finished) {
  const near = lastRocks.filter(r => Math.abs(r.z) < 2.5);
  console.log('CRASH t=', (frames*16.7/1000).toFixed(1), 'riderX', lastX.toFixed(2), 'near', JSON.stringify(near));
} else console.log('survived 2 min');
run.stop();
EOF

cat > .simtmp/idle.mjs <<'EOF'
// A rider who never steers should be caught by a rock fairly quickly: that is
// the "no end" complaint, and it needs to be demonstrably fixed.
import { El } from './fake-dom.mjs';
const { createRun } = await import('./run.js');
let finished = null;
const run = createRun(new El(), { camera: null, icon: () => '', finish: s => { finished = s; } });
let now = 1000;
let frames = 0;
while (!finished && frames < 7200) { now += 16.7; globalThis.__raf.take().forEach(cb => cb(now)); frames++; }
console.log(JSON.stringify({ seconds: +(frames * 16.7 / 1000).toFixed(1), ended: finished?.reason ?? 'never ended (bad)', score: finished?.score ?? null }));
run.stop();
EOF

cat > .simtmp/first.mjs <<'EOF'
// Where do the first hazards land? They must not sit in the rider's start lane.
import { El } from './fake-dom.mjs';
const { createRun } = await import('./run.js');
const run = createRun(new El(), { camera: null, icon: () => '', finish: () => {} });
let now = 1000;
globalThis.__raf.take().forEach(cb => cb(now));
const rocks = run.debugObjects.filter(o => o.kind === 'rock').map(r => ({lane: r.lane, z: +r.z.toFixed(1)}));
console.log('first rocks', JSON.stringify(rocks.slice(0, 5)));
console.log('any in start lane 0?', rocks.some(r => r.lane === 0) ? 'YES (bad)' : 'no');
run.stop();
EOF

cat > .simtmp/dodge.mjs <<'EOF'
// Balance check: a simple bot that steers away from rocks. If the course is
// fair it survives a couple of minutes; if hazards are too dense it dies fast.
import { El } from './fake-dom.mjs';
const listeners = {};
const host = new El();
host.addEventListener = (k, f) => { (listeners[k] ??= []).push(f); };
const { createRun } = await import('./run.js');

let finished = null;
const run = createRun(host, { camera: null, icon: () => '', finish: s => { finished = s; } });
let now = 1000;
const step = ms => { now += ms; globalThis.__raf.take().forEach(cb => cb(now)); };
for (let i = 0; i < 40; i++) { step(16.7); await new Promise(r => setTimeout(r, 15)); }

const press = k => globalThis.__keys.down(k);
const release = k => globalThis.__keys.up(k);
const LANES = [-6, -3, 0, 3, 6];
let frames = 0;
while (!finished && frames < 7200) {          // up to 2 minutes of riding
  if (frames % 4 === 0) {
    const rocks = run.debugObjects.filter(o => o.kind === 'rock' && o.z < 4 && o.z > -40);
    let best = 0, bestScore = -Infinity;
    for (const lane of LANES) {
      let score = -Math.abs(lane) * .12;
      for (const r of rocks) if (Math.abs(r.lane - lane) < 2.2) score -= 120 / Math.max(3, Math.abs(r.z));
      if (score > bestScore) { bestScore = score; best = lane; }
    }
    const x = run.debugRiderX();
    release('ArrowLeft'); release('ArrowRight');
    if (best < x - .5) press('ArrowLeft');
    else if (best > x + .5) press('ArrowRight');
  }
  step(16.7); frames++;
}
console.log(JSON.stringify({
  seconds: +(frames * 16.7 / 1000).toFixed(1),
  ended: finished?.reason ?? 'still riding after 2 min',
  score: finished?.score ?? null, flags: finished?.flagPasses ?? null,
}));
run.stop();
EOF

echo "harness ready -> node .simtmp/verify.mjs"
