import * as T from 'three';
import {createPoseView} from './pose-view.js';
import {createRideGate} from './ride-gate.js';
import {createSideForest} from './cartoon-pines.js';
import {createSkyTraffic} from './sky-traffic.js';
import {loadTrailModels, pieces, instance, disposeModel} from './models.js';
import riderFace from './rider-face.jpg';
import {createCoach} from './coach.js';

const LANES = [-6, -3, 0, 3, 6];
const GATE_HALF = 1.55;
const GATE_SCORE = 50;

export function createRun(host, {camera, icon, finish}) {
  const renderer = new T.WebGLRenderer({antialias: true, alpha: true});
  renderer.setPixelRatio(Math.min(devicePixelRatio, camera ? 1 : 1.25));
  renderer.setClearColor(0x9bd5ff, 0);
  const scene = new T.Scene();
  scene.fog = new T.FogExp2(0xdcefff, .0032);
  const view = new T.PerspectiveCamera(53, 1, .1, 330);
  view.position.set(.65, 2.35, 6.8);
  view.lookAt(0, 1.3, -12);
  scene.add(new T.HemisphereLight(0xf3fbff, 0x7794bd, 1.75));
  const sun = new T.DirectionalLight(0xffecd0, 2);
  sun.position.set(-25, 24, -12);
  scene.add(sun);

  const mats = new Map(), geos = new Map();
  const mat = color => {
    if (!mats.has(color)) mats.set(color, new T.MeshStandardMaterial({color, roughness: .77}));
    return mats.get(color);
  };
  function mesh(parent, kind, color, x, y, z, sx, sy, sz) {
    if (!geos.has(kind)) geos.set(kind,
      kind === 'ball' ? new T.SphereGeometry(1, 18, 12)
      : kind === 'cone' ? new T.ConeGeometry(1, 1, 9)
      : kind === 'rock' ? new T.DodecahedronGeometry(1, 0)
      : kind === 'ramp' ? rampGeometry()
      : kind === 'star' ? starGeometry()
      : kind === 'flag' ? flagGeometry()
      : kind === 'pole' ? new T.CylinderGeometry(.055, .07, 1, 7)
      : new T.BoxGeometry(1, 1, 1));
    const o = new T.Mesh(geos.get(kind), mat(color));
    o.position.set(x, y, z);
    o.scale.set(sx, sy, sz);
    parent.add(o);
    return o;
  }
  function starGeometry() {
    const shape = new T.Shape();
    for (let i = 0; i < 10; i++) {
      const a = Math.PI / 2 + i * Math.PI / 5, r = i % 2 ? .45 : 1;
      shape[i ? 'lineTo' : 'moveTo'](Math.cos(a) * r, Math.sin(a) * r);
    }
    shape.closePath();
    return new T.ExtrudeGeometry(shape, {depth: .19, bevelEnabled: true, bevelThickness: .055, bevelSize: .06, bevelSegments: 2});
  }
  function rampGeometry() {
    const shape = new T.Shape();
    shape.moveTo(-.5, 0); shape.lineTo(.5, 0); shape.lineTo(.5, 1); shape.closePath();
    const g = new T.ExtrudeGeometry(shape, {depth: 1, bevelEnabled: false});
    g.translate(0, 0, -.5);
    g.rotateY(Math.PI / 2);
    return g;
  }
  function flagGeometry() {
    const shape = new T.Shape();
    shape.moveTo(0, 0); shape.lineTo(.86, -.24); shape.lineTo(0, -.52); shape.closePath();
    const g = new T.ShapeGeometry(shape);
    g.translate(0, 0, 0);
    return g;
  }

  const snow = mesh(scene, 'box', 0xf0f7ff, 0, -.26, -125, 260, .5, 285);
  // A soft groomed strip and a fading horizon let the snow meet the backdrop.
  snow.material.transparent = true;
  snow.material.depthWrite = false;
  snow.material.onBeforeCompile = shader => {
    shader.vertexShader = 'varying vec2 snowXZ;\n' + shader.vertexShader.replace('#include <begin_vertex>',
      '#include <begin_vertex>\n  snowXZ = (modelMatrix * vec4(position, 1.0)).xz;');
    shader.fragmentShader = 'varying vec2 snowXZ;\n' + shader.fragmentShader
      .replace('#include <color_fragment>', `#include <color_fragment>
        float groomed = 1.0 - smoothstep(7.7, 11.0, abs(snowXZ.x));
        float drift = sin(snowXZ.x * .55 + snowXZ.y * .19) * sin(snowXZ.y * .38) * .035;
        float corduroy = sin(snowXZ.x * 52.0) * .018 * (1.0 - smoothstep(5.0, 20.0, vFogDepth));
        diffuseColor.rgb *= mix(vec3(.79,.88,.98), vec3(.96,.99,1.0), groomed) + drift + groomed * corduroy;
      `).replace('#include <opaque_fragment>',
      'diffuseColor.a *= 1.0 - smoothstep(70.0, 165.0, vFogDepth);\n#include <opaque_fragment>');
  };

  const scenery = [], trailside = [], packs = {}, modelScenes = [];
  const forest = createSideForest(scene);
  const sky = createSkyTraffic(scene);
  let mixer;

  function decorate(g, kind, height, angle, index) {
    const pack = packs[kind];
    if (!pack?.length) return;
    const model = instance(pack[index % pack.length], {
      height, angle, width: kind === 'rocks' ? 1.85 : Infinity, depth: kind === 'rocks' ? 1.75 : Infinity,
    });
    g.clear();
    g.add(model);
  }
  for (let i = 0; i < 12; i++) {
    const g = new T.Group();
    g.position.set((i % 2 ? 1 : -1) * (11.5 + Math.random() * 15), 0, -i * 19);
    mesh(g, 'rock', 0xb4c9da, 0, .45, 0, 1.1, .65, .8);
    scene.add(g);
    scenery.push(g);
    trailside.push({g, height: 1.4, angle: Math.random() * Math.PI * 2, index: i});
  }
  for (let i = 0; i < 28; i++) {
    const x = i % 3 === 0 ? (i % 2 ? 1 : -1) * (8.55 + Math.random() * .6) : (Math.random() - .5) * 15;
    const f = mesh(scene, 'box', i % 3 === 0 ? 0xc4dcef : 0xdbeaf7, x, .002, -i * 7.8,
      Math.random() * .17 + .04, .007, 1.4 + Math.random() * 4);
    scenery.push(f);
  }

  const rider = new T.Group(), body = new T.Group(), board = new T.Group(), fallback = new T.Group();
  scene.add(rider);
  rider.add(body);
  body.add(board, fallback);
  const blue = 0x0879ed, navy = 0x16263e, ice = 0xa3eaff, hair = 0x512c21, skin = 0xffbb87;
  mesh(board, 'ball', 0x063d99, 0, .09, 0, 1.04, .075, .25);
  mesh(board, 'ball', 0x36baff, 0, .13, 0, 1, .04, .23);
  for (const side of [-1, 1]) mesh(board, 'box', 0xeaf7ff, side * .48, .15, 0, .11, .022, .36).rotation.y = -.33;
  mesh(fallback, 'ball', blue, 0, 1.05, 0, .35, .43, .23);
  mesh(fallback, 'ball', ice, 0, 1.31, .10, .30, .145, .16);
  mesh(fallback, 'ball', skin, 0, 1.61, 0, .25, .276, .24);
  mesh(fallback, 'ball', hair, 0, 1.76, .059, .264, .21, .23);
  mesh(fallback, 'ball', navy, 0, 1.66, .055, .27, .071, .236);
  for (let i = 0; i < 5; i++) mesh(fallback, 'ball', hair, (i - 2) * .086, 1.893 + (i % 2) * .025, .06, .091, .1, .12).rotation.z = -.34;
  mesh(fallback, 'ball', 0x29c6ff, 0, 1.68, -.19, .22, .09, .067);
  for (const side of [-1, 1]) {
    mesh(fallback, 'ball', navy, side * .25, .52, .015, .15, .32, .15).rotation.z = side * .35;
    mesh(fallback, 'ball', navy, side * .36, .265, .035, .17, .10, .19);
    mesh(fallback, 'ball', blue, side * .52, 1.16, .02, .27, .113, .116).rotation.z = side * -.23;
    mesh(fallback, 'ball', ice, side * .69, 1.12, .025, .12, .094, .10);
    mesh(fallback, 'ball', navy, side * .79, 1.08, .022, .105, .073, .081);
  }
  const shadow = mesh(scene, 'ball', 0x8bbbd6, 0, .011, 0, .9, .012, .34);

  host.innerHTML = `<div class="play-header">
      <div class="ph-brand"><i></i> WONDERLAB · AR GAMING</div>
      <div class="ph-title">MOTION SNOW TRAIL</div>
      <div class="ph-tag">AI MOTION TRACKING</div>
    </div>
    <div class="hud">
      <div class="hud-score"><span class="hud-label">SCORE</span><strong class="score">0</strong><span class="hud-sub">★ <b class="stars">0</b> · <b class="distance">0</b> m · <b class="flags">0</b> flags</span></div>
      <div class="hud-stats">
        <div class="hud-pill"><span class="hud-label">SPEED</span><b class="speed">0</b><small>km/h</small></div>
        <div class="hud-pill"><span class="hud-label">TIME</span><b class="time">0</b><small>s</small></div>
      </div>
      <div class="hud-buttons">
        <button class="hud-btn cam" aria-label="Switch camera view" title="Switch camera view">${icon('video')}<span class="cam-label">CHASE</span></button>
        <button class="hud-btn max" aria-label="Full screen" title="Full screen">${icon('maximize')}</button>
        <button class="hud-btn quit" aria-label="Exit run" title="Exit run">${icon('log-out')}</button>
      </div>
    </div>
    <div class="run-message" aria-live="polite"></div>
    ${camera ? '' : '<div class="touch"><button data-dir="left" aria-label="Steer left">←</button><button data-dir="right" aria-label="Steer right">→</button></div>'}`;

  const coach = createCoach(host, riderFace);

  const poseView = camera ? createPoseView(camera.video) : null;
  if (poseView) {
    poseView.panel.classList.add('camera-card');
    poseView.panel.insertAdjacentHTML('beforeend', `<div class="camera-meta"><span class="live-dot"></span><span class="pose-status" role="status">Looking for shoulders &amp; hips…</span></div>`);
    host.append(poseView.panel);
  }
  host.prepend(renderer.domElement);

  const gate = createRideGate(!!camera);
  const $ = s => host.querySelector(s);
  const scoreEl = $('.score'), starsEl = $('.stars'), distanceEl = $('.distance'), flagsEl = $('.flags');
  const speedEl = $('.speed'), timeEl = $('.time'), message = $('.run-message'), status = $('.pose-status');
  const camBtn = $('.cam'), camLabel = $('.cam-label');

  const resize = () => {
    if (!host.clientWidth || !host.clientHeight) return;
    view.aspect = host.clientWidth / host.clientHeight;
    view.updateProjectionMatrix();
    renderer.setSize(host.clientWidth, host.clientHeight, false);
  };
  const observer = new ResizeObserver(resize);
  observer.observe(host);
  resize();

  // ---- Controls ------------------------------------------------------------
  const keys = new Set(), pointers = new Map();
  const map = {ArrowLeft: 'left', a: 'left', ArrowRight: 'right', d: 'right'};
  const dir = e => map[e.key] || map[e.key.toLowerCase()];
  let camMode = 'chase', eyeBlend = 0;
  function toggleCamera() {
    camMode = camMode === 'chase' ? 'eyes' : 'chase';
    camLabel.textContent = camMode === 'eyes' ? 'EYES' : 'CHASE';
    camBtn.setAttribute('aria-pressed', String(camMode === 'eyes'));
  }
  function keydown(e) {
    if (e.key === 'Escape') { finish(null); return; }
    if (e.key === 'c' || e.key === 'C') { toggleCamera(); return; }
    if (!camera && dir(e)) { e.preventDefault(); keys.add(dir(e)); }
  }
  const keyup = e => { if (dir(e)) keys.delete(dir(e)); };
  const blur = () => { keys.clear(); pointers.clear(); };
  window.addEventListener('keydown', keydown);
  window.addEventListener('keyup', keyup);
  window.addEventListener('blur', blur);
  $('.quit').onclick = () => finish(null);
  camBtn.onclick = toggleCamera;
  $('.max').onclick = () => {
    if (document.fullscreenElement) document.exitFullscreen?.();
    else document.documentElement.requestFullscreen?.().catch(() => {});
  };
  for (const b of host.querySelectorAll('[data-dir]')) {
    b.onpointerdown = e => { e.preventDefault(); b.setPointerCapture(e.pointerId); pointers.set(e.pointerId, b.dataset.dir); };
    b.onpointerup = b.onpointercancel = b.onlostpointercapture = e => pointers.delete(e.pointerId);
  }

  // ---- Course --------------------------------------------------------------
  const objects = [];
  let distance = 0, stars = 0, jumps = 0, flags = 0, x = 0, velocity = 0, jump = -1;
  let nextRow = 26, flash = 0, row = 0, elapsed = 0, last = performance.now(), frame, stopped = false;

  function spawn(kind, lane, z) {
    const g = new T.Group();
    g.position.set(lane, 0, z);
    scene.add(g);
    if (kind === 'rock') {
      mesh(g, 'rock', 0x8fa6bb, 0, .52, 0, 1.15, .85, .85).rotation.z = .3;
      mesh(g, 'rock', 0xeaf7ff, .04, 1.02, .03, .83, .5, .62);
    }
    if (kind === 'gate') {
      for (const side of [-1, 1]) {
        mesh(g, 'pole', 0xf1f6ff, side * GATE_HALF, 1.05, 0, 1, 2.1, 1);
        const flag = mesh(g, 'flag', side > 0 ? 0x2f7bff : 0xef3b45, side * GATE_HALF, 1.95, 0, 1, 1, 1);
        flag.material = new T.MeshStandardMaterial({color: side > 0 ? 0x2f7bff : 0xef3b45, side: T.DoubleSide, roughness: .7});
        flag.rotation.y = side > 0 ? Math.PI : 0;
      }
      mesh(g, 'box', 0xbfefff, 0, .012, 0, GATE_HALF * 2, .006, .5);
    }
    if (kind === 'star') mesh(g, 'star', 0xffc229, 0, 1.0, 0, .52, .52, .52);
    if (kind === 'ramp') {
      mesh(g, 'ramp', 0x54c6ed, 0, 0, 0, 2.15, .82, 2.65);
      for (let i = 0; i < 3; i++) mesh(g, 'box', 0xe7faff, 0, .18 + i * .214, .8 - i * .68, 1.72, .035, .09).rotation.x = .30;
    }
    const o = {g, kind, lane, z, used: false, variant: row};
    objects.push(o);
    if (kind === 'rock') decorate(o.g, 'rocks', 1.35, o.variant * .63, o.variant);
  }

  loadTrailModels((kind, asset) => {
    if (stopped) { disposeModel(asset.scene); return; }
    modelScenes.push(asset.scene);
    if (kind === 'rider') {
      const model = asset.scene;
      // Freeze a frame of the supplied clip for a planted stance; the whole
      // body and board still animate together when carving or jumping.
      if (asset.animations.length) {
        mixer = new T.AnimationMixer(model);
        mixer.clipAction(asset.animations[0]).play();
        mixer.setTime(.6);
      }
      model.rotation.y = Math.PI * .8;
      const bounds = new T.Box3().setFromObject(model, true);
      const size = bounds.getSize(new T.Vector3());
      if (size.y <= 0 || !Number.isFinite(size.y)) return;
      const center = bounds.getCenter(new T.Vector3());
      const scale = 2.15 / size.y;
      const fitted = new T.Group();
      model.position.sub(new T.Vector3(center.x, bounds.min.y, center.z));
      fitted.add(model);
      fitted.scale.setScalar(scale);
      fitted.position.y = .16;
      body.add(fitted);
      fallback.visible = false;
      return;
    }
    packs[kind] = pieces(asset.scene, kind === 'rocks' ? (() => true) : (name => name.startsWith('Tree_Pine_Snowy_')));
    if (kind === 'rocks') trailside.forEach(({g, height, angle, index}) => decorate(g, kind, height, angle, index));
    objects.filter(o => o.kind === 'rock').forEach(o => decorate(o.g, 'rocks', 1.35, o.variant * .63, o.variant));
  });

  const shuffled = () => {
    const list = [...LANES];
    for (let i = list.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [list[i], list[j]] = [list[j], list[i]];
    }
    return list;
  };

  const OUTER = [-6, 6];

  // A flag gate opens on every row, so clean passes are always available. The
  // road is never blocked across its middle: trees are scenery only, the ice
  // balls are gone, and rocks only ever sit on the outer lanes.
  function addRow(d) {
    const z = distance - d;
    const lane = shuffled();
    spawn('gate', row === 0 ? 0 : lane[0], z);
    spawn('star', row === 0 ? 0 : lane[0], z - 4);
    if (row % 3 === 1) spawn('ramp', lane[1], z - 8);
    if (row > 2 && row % 2 === 1) spawn('rock', OUTER[row % 2], z - 11);
    row++;
  }

  const stats = reason => ({
    reason,
    score: Math.floor(distance) + stars * 100 + jumps * 150 + flags * GATE_SCORE,
    stars, flagPasses: flags, distance: Math.floor(distance), jumps,
  });

  function animate(now) {
    if (stopped) return;
    const dt = Math.min(.05, (now - last) / 1e3);
    last = now;
    if (camera?.failed) { finish(stats('Webcam tracking stopped')); return; }
    const phase = gate(camera?.locked, now, camera?.ready), ready = phase.ride;
    const speed = ready ? Math.min(32, 15 + distance * .012) : 0;
    distance += speed * dt;
    elapsed += dt;
    while (nextRow < distance + 130) { addRow(nextRow); nextRow += Math.max(19, 27 - distance * .007); }

    if (status && status.textContent !== phase.status) status.textContent = phase.status;
    poseView?.draw(camera.ready ? camera.landmarks : null, camera.locked);

    if (speed) forest.advance(distance);
    sky.advance(now * .001);

    const down = k => keys.has(k) || [...pointers.values()].includes(k);
    const steer = camera ? (ready ? camera.lean : 0) : Number(down('right')) - Number(down('left'));
    velocity = T.MathUtils.lerp(velocity, steer * 10, 1 - Math.exp(-10 * dt));
    x = T.MathUtils.clamp(x + velocity * dt, -7.2, 7.2);
    if (jump >= 0 && ready) { jump += dt; if (jump >= .94) jump = -1; }
    const height = jump < 0 ? 0 : Math.sin(jump / .94 * Math.PI) * 2.05;
    rider.position.set(x, height, 0);
    shadow.position.x = x;
    body.rotation.z = -velocity * .045;
    body.rotation.y = -velocity * .028;
    body.rotation.x = height * .07;

    // Chase camera behind the rider, or a first-person view from the boy's eyes.
    eyeBlend = T.MathUtils.lerp(eyeBlend, camMode === 'eyes' ? 1 : 0, 1 - Math.exp(-8 * dt));
    const chasePos = new T.Vector3(T.MathUtils.lerp(view.position.x, x * .53 + .65, 1 - Math.exp(-4 * dt)), 2.35 + height * .24, 6.8);
    const eyesPos = new T.Vector3(x, height + 1.66 + Math.sin(now * .006) * .02, -.12);
    const look = new T.Vector3(
      T.MathUtils.lerp((view.position.x - .65) * .75, x + velocity * .06, eyeBlend),
      T.MathUtils.lerp(1.3 + height * .15, height + 1.5, eyeBlend),
      T.MathUtils.lerp(-12, -22, eyeBlend),
    );
    view.position.lerpVectors(chasePos, eyesPos, eyeBlend);
    view.lookAt(look);
    rider.visible = eyeBlend < .55;
    shadow.visible = eyeBlend < .55;

    for (const g of scenery) { g.position.z += speed * dt; if (g.position.z > 15) g.position.z -= 243; }

    for (let i = objects.length - 1; i >= 0; i--) {
      const o = objects[i];
      o.z += speed * dt;
      o.g.position.z = o.z;
      if (o.kind === 'star') o.g.rotation.y += dt * 2.7;
      if (ready && !o.used && Math.abs(o.z) < 1.05) {
        const off = Math.abs(o.g.position.x - x);
        if (o.kind === 'gate') {
          o.used = true;
          if (off < GATE_HALF - .35) {
            flags++;
            flash = now + 1100;
            message.dataset.kind = 'flag';
            coach.cheer('Clean pass! +50');
          }
        } else if (o.kind === 'star') {
          if (off < 1 && height < 1.5) { stars++; o.used = true; o.g.visible = false; }
        } else if (o.kind === 'ramp') {
          if (off < 1.13 && jump < 0) { jump = 0; jumps++; flash = now + 1000; message.dataset.kind = 'ramp'; }
        } else if (height < 1.29 && off < 1.2) {
          finish(stats('Run complete!'));
          return;
        }
      }
      if (o.z > 14) { scene.remove(o.g); objects.splice(i, 1); }
    }

    const st = stats();
    const values = [[scoreEl, `${st.score}`], [starsEl, `${stars}`], [distanceEl, `${st.distance}`],
      [flagsEl, `${flags}`], [speedEl, `${Math.round(speed * 3.6)}`], [timeEl, `${Math.floor(elapsed)}`]];
    for (const [el, value] of values) if (el && el.textContent !== value) el.textContent = value;
    const text = phase.message || (now < flash ? (message.dataset.kind === 'ramp' ? '+150 RAMP BONUS' : '+50 FLAG PASS') : '');
    if (message.textContent !== text) message.textContent = text;
    message.classList.toggle('countdown', !!phase.message);
    coach.tick(now);
    coach.set(ready ? 'Riding' : 'Get ready', camMode === 'eyes' ? 'Riding from the eyes view' : 'Pass between the flags');
    renderer.render(scene, view);
    frame = requestAnimationFrame(animate);
  }
  frame = requestAnimationFrame(animate);

  return {
    stop() {
      stopped = true;
      cancelAnimationFrame(frame);
      observer.disconnect();
      window.removeEventListener('keydown', keydown);
      window.removeEventListener('keyup', keyup);
      window.removeEventListener('blur', blur);
      geos.forEach(g => g.dispose());
      mats.forEach(m => m.dispose());
      forest.dispose();
      sky.dispose();
      mixer?.stopAllAction();
      modelScenes.forEach(disposeModel);
      renderer.dispose();
      renderer.forceContextLoss();
      host.replaceChildren();
    },
  };
}
