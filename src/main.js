import './style.css';
// Bumped by the build config below: lets anyone confirm which deploy the browser
// actually loaded (shown in Settings and on the console) instead of guessing.
const BUILD_VERSION=__BUILD_ID__;
import {createRun} from './run.js';
// The site is served from a subpath on GitHub Pages, so runtime markup must not
// use root-absolute asset URLs: resolve them through Vite instead.
import logoSmall from '/public/wonderlab-logo-sm.png?url';
import heroTrailJpg from '/public/hero-trail.jpg?url';
import heroTrailWebp from '/public/hero-trail.webp?url';
const icons=import.meta.glob('/node_modules/lucide-static/icons/{flask-conical,trophy,settings,play,circle-help,mountain-snow,move-horizontal,triangle,star,snowflake,x,video,log-out,maximize,flag,eye,timer,gauge,send,pause,chevron-down}.svg',{eager:true,query:'?raw',import:'default'});
const ic=(name)=>icons[`/node_modules/lucide-static/icons/${name}.svg`]||'';
let best=0;try{best=+localStorage.getItem('snow-best')||0}catch{}
const app=document.querySelector('#app');
app.innerHTML=`<header><div class="brand"><img class="brand-logo" src="${logoSmall}" alt="" width="40" height="40"><div>Wonder<span>Lab</span><small>AR GAMING</small></div></div><div class="top-actions"><div class="best">${ic('trophy')}<span>BEST SCORE</span><strong id="best">${best}</strong></div><button class="square" id="settings" aria-label="Settings">${ic('settings')}</button></div></header><main><section class="hero" id="hero"><picture><source srcset="${heroTrailWebp}" type="image/webp"><img class="hero-img" src="${heroTrailJpg}" alt="WonderLab Motion Snow Rider — the snowboarder carving down a mountain trail lined with flags and fences" width="1672" height="941" fetchpriority="high"></picture><div class="hero-body"><div class="hero-brand"><img src="${logoSmall}" alt="WonderLab AR" width="72" height="72"><div><strong>WONDER<span>LAB</span></strong><small>AI · 3D · ANIMATION · VIDEO</small></div></div><div class="eyebrow"><i></i> THE MOTION ARCADE</div><h1><span class="h1-top">Motion</span><span class="h1-main">Snow Rider</span></h1><p>Carve down the mountain, dodge the rocks, and bank the flag gates. Your body is the controller.</p><div class="actions"><button class="primary" id="start">${ic('play')} Start Game</button><button class="secondary" id="help">${ic('circle-help')} How to Play</button></div><div class="hero-tags"><span>${ic('flag')} FLAG GATES</span><span>${ic('eye')} EYES VIEW</span><span>${ic('video')} MOTION TRACKED</span></div></div><div class="camera-chip"><i></i> <span id="camera-status">Webcam not connected</span></div><span class="trail-label">${ic('mountain-snow')} &nbsp; ALPINE TRAIL 01</span></section><div id="game" hidden></div><section class="guide"><div class="section-title"><h2>Ride basics</h2><span>THREE MOVES. ONE MOUNTAIN.</span></div><div class="cards">${[['move-horizontal','Lean to steer','Tilt your body left or right to carve across the slope.'],['flag','Pass the gates','Ride between the edge flags for +50 points, then steer clear of the rocks.'],['triangle','Hit the ramps','Ride over snow ramps to jump and earn bonus points.']].map(([icon,title,desc],i)=>`<article><div class="card-icon c${i}">${ic(icon)}</div><div><h3>${title}</h3><p>${desc}</p></div></article>`).join('')}</div></section><footer><span>WONDERLAB AR GAMING</span><span>${ic('snowflake')} BUILT FOR THE SLOPES</span></footer></main><div class="loader" id="loader" role="status" aria-live="polite" aria-label="Loading the trail" hidden><div class="loader-stage"><div class="loader-art"></div><i class="loader-fill" id="loader-fill"></i><span class="sr-only" id="loader-label">Loading the trail</span></div></div><dialog id="modal"></dialog>`;
const $=s=>document.querySelector(s), modal=$('#modal');
// If the hero art ever fails to fetch, fall back to the gradient fill the hero
// already has instead of leaving an empty panel.
const heroImg=$('.hero-img');
heroImg?.addEventListener('error',()=>heroImg.classList.add('missing'));
const brandLogos=[...document.querySelectorAll('img[src*="wonderlab-logo"]')];
brandLogos.forEach(img=>img.addEventListener('error',()=>{img.hidden=true;}));
let mode='webcam', run, camera;
const loader=$('#loader'), loaderFill=$('#loader-fill'), loaderLabel=$('#loader-label');
// Width of the fill area inside the painted bar, in the loader stage's units.
const BAR_FILL=38.76;
// The bar tracks real milestones plus a slow trickle that never reaches 100%,
// so it is honest about progress without looking frozen while a GLB decodes.
function showLoader(){
  const started=performance.now();
  let done=false, value=0, raf=0, resolve;
  const promise=new Promise(r=>{resolve=r});
  loader.hidden=false; loader.classList.remove('done');
  loader.setAttribute('aria-busy','true');
  const paint=v=>{
    value=Math.max(value,Math.min(v,100));
    const pct=Math.round(value);
    loaderFill.style.width=(value/100*BAR_FILL)+'%';
    // The bar itself is the progress readout; keep the percentage for AT only.
    loaderLabel.textContent=pct>=100?'Trail ready. Starting the run.':'Loading the trail — '+pct+'%';
  };
  paint(0);
  const tick=()=>{
    if(done)return;
    const elapsed=performance.now()-started;
    paint(Math.min(92,elapsed/26));
    raf=requestAnimationFrame(tick);
  };
  raf=requestAnimationFrame(tick);
  return {
    promise,
    resolve(){
      if(done)return;
      done=true;
      cancelAnimationFrame(raf);
      paint(100);
      resolve();
    },
  };
}
function hideLoader(){
  loader.setAttribute('aria-busy','false');
  loader.classList.add('done');
  setTimeout(()=>{
    loader.hidden=true;
    loader.classList.remove('done');
    loaderFill.style.width='0%';
    loaderLabel.textContent='Loading the trail';
  },380);
}
function show(title,body){modal.innerHTML=`<button class="square close" aria-label="Close">${ic('x')}</button><h2>${title}</h2>${body}`;if(!modal.open)modal.showModal();modal.querySelector('.close').onclick=()=>{cancelStartup();modal.close();};}
function choose(title='Ready to ride?'){show(title,`<p>Use your webcam to steer with your body, or try keyboard and touch controls without a camera.</p><div class="dialog-actions"><button class="primary" id="motion">${ic('video')} Enable Webcam & Ride</button><button class="secondary" id="manual">Play without webcam</button></div><p class="error" role="status"></p>`);$('#motion').onclick=()=>launch('webcam');$('#manual').onclick=()=>launch('manual');}
$('#start').onclick=()=>choose();
$('#settings').onclick=()=>{if(run)return;show('Settings',`<p>Choose how to control your next run.</p><label>Control mode <select><option value="webcam">Webcam motion</option><option value="manual">Keyboard / touch</option></select></label><p class="build-stamp">Build ${BUILD_VERSION}</p>`);modal.querySelector('select').value=mode;modal.querySelector('select').onchange=e=>{mode=e.target.value;$('#start').onclick=()=>mode==='manual'?launch(mode):choose();};};
$('#help').onclick=()=>show('How to Play',`<ol><li>Allow webcam access and stand back until your shoulders and hips are visible. Stand upright to center yourself.</li><li>Lean left or right to steer. Ride between the flag pairs at the edges of the trail to bank +50 points each, hit ramps for +150, and grab gold stars for +100.</li><li>Rocks are scattered across the whole trail and they end the run — steer around them or jump them with a ramp. The forest is scenery only. Press <b>C</b> or tap the CHASE button to swap between the chase view and a view from the rider's eyes.</li></ol><p>Without a webcam, use ← / →, A / D, or the on-screen arrows. <b>Esc</b> exits the run, <b>C</b> switches camera, and the ⛶ button goes full screen.</p>`);
let startup;
function cancelStartup() {
  startup?.abort();
  startup=null;
  if(!camera) $('#camera-status').textContent='Webcam not connected';
}
modal.addEventListener('close',()=>{if(!modal.open)cancelStartup();});
modal.addEventListener('cancel',cancelStartup);
window.addEventListener('pagehide',()=>{cancelStartup();if(camera)finishRun(null);});
// Pages keeps serving a cached index.html after a deploy, which points at bundle
// files that no longer exist. When that happens, drop the cache and load again.
window.addEventListener('vite:preloadError',event=>{
  if(sessionStorage.getItem('snow-reloaded')===BUILD_VERSION)return;
  try{sessionStorage.setItem('snow-reloaded',BUILD_VERSION)}catch{}
  event.preventDefault();
  location.reload();
});
console.info('WonderLab Snow Rider build', BUILD_VERSION);
async function launch(input) {
  if(run || (startup && input==='webcam')) return;
  cancelStartup();
  mode=input;
  const attempt=new AbortController();
  startup=attempt;
  try {
    if(input==='webcam') {
      $('#motion').disabled=true;
      const onStatus=text=>{
        if(startup!==attempt||!modal.open)return;
        modal.querySelector('.error').textContent=text;
        $('#camera-status').textContent=text;
      };
      onStatus('Preparing webcam…');
      const {startCamera}=await import('./camera.js');
      if(startup!==attempt||!modal.open)return;
      const cam=await startCamera({signal:attempt.signal,onStatus});
      if(startup!==attempt||!modal.open){cam.stop();return;}
      camera=cam;
      $('#camera-status').textContent='Webcam connected';
    }
    const game=$('#game');
    // Cover the hand-over from the landing page with the loading screen, then
    // build the run behind it so the first visible frame is the real trail.
    modal.close();
    const ready=showLoader();
    // Let the browser paint the loading screen before the scene build blocks the
    // thread, otherwise the poster can flash past for a frame.
    await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));
    try {
      game.hidden=false;
      document.body.classList.add('playing');
      run=createRun(game,{camera,icon:ic,finish:finishRun,onReady:ready.resolve});
    } catch(error) {
      ready.resolve();
      hideLoader();
      throw error;
    }
    startup=null;
    await ready.promise;
    hideLoader();
  } catch(e) {
    if(startup!==attempt)return;
    camera?.stop();
    camera=null;
    cancelStartup();
    $('#game').hidden=true;
    document.body.classList.remove('playing');
    hideLoader();
    if(!modal.open)choose('Could not start the run');
    $('#motion').disabled=false;
    modal.querySelector('.error').textContent=e.message||'Try again or play without the webcam.';
  }
}
function finishRun(stats){run?.stop();run=null;camera?.stop();camera=null;$('#camera-status').textContent='Webcam not connected';$('#game').hidden=true;document.body.classList.remove('playing');hideLoader();if(!stats)return;if(stats.score>best){best=stats.score;$('#best').textContent=best;try{localStorage.setItem('snow-best',best)}catch{}}choose(stats.reason);modal.querySelector('h2').insertAdjacentHTML('afterend',`<div class="results"><strong>${stats.score} pts</strong><span>${stats.stars} stars · ${stats.distance} m · ${stats.jumps} jumps</span></div>`);}
