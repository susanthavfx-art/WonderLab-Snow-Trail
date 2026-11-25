import poseScript from '@mediapipe/pose/pose.js?url';
let loading;
function loadPose() {
  return loading ||= new Promise((resolve, reject) => {
    const script = document.createElement('script');
    const fail = (error) => {
      clearTimeout(timer);
      script.remove();
      loading = null;
      reject(error instanceof Error ? error : Error('Could not load pose tracking'));
    };
    const timer = setTimeout(() => fail(Error('Timed out loading the pose tracker script.')), 15000);
    script.src = poseScript;
    script.onload = () => {
      if (typeof window.Pose !== 'function') return fail();
      clearTimeout(timer);
      resolve(window.Pose);
    };
    script.onerror = fail;
    document.head.append(script);
  });
}
// MediaPipe fetches these by bare filename at runtime through locateFile, so the
// build has to emit every one of them. The wasm glue (.js/.wasm) and the packed
// assets loader were missing, which left initialize() waiting forever on the
// deployed site even though the camera had already opened.
// Only the lite landmark model is imported: the pose graph runs with
// modelComplexity 0, so the 27MB full/heavy weights would never be fetched.
const assets=import.meta.glob('/node_modules/@mediapipe/pose/{pose_web.binarypb,pose_landmark_lite.tflite,pose_solution*,*.wasm}',{eager:true,query:'?url',import:'default'});
const assetUrl=name=>assets[`/node_modules/@mediapipe/pose/${name}`];
function waitFor(task, signal, ms, message) {
  return new Promise((resolve, reject) => {
    const finish = (settle, value) => {
      clearTimeout(timer);
      signal.removeEventListener('abort', abort);
      settle(value);
    };
    const abort = () => finish(reject, signal.reason);
    const timer = setTimeout(() => finish(reject, Error(message)), ms);
    Promise.resolve(task).then(value => finish(resolve, value), error => finish(reject, error));
    if (signal.aborted) abort();
    else signal.addEventListener('abort', abort, {once:true});
  });
}
export async function startCamera({signal, onStatus = () => {}}) {
  if (!navigator.mediaDevices?.getUserMedia) throw Error('Webcam access requires a secure browser page. You can play without a webcam.');
  signal.throwIfAborted();
  const video = document.createElement('video');
  video.muted = true;
  video.playsInline = true;
  let stream, pose, active = true, busy = false, frame, last = -1, nextFrame = 0, landmarks = null, validPose = false, lean = 0, seen = 0, failed = false;
  const closePose = () => {
    const instance = pose;
    pose = null;
    if (instance) Promise.resolve().then(() => instance.close()).catch(() => {});
  };
  const stop = () => {
    if (!active) return;
    active = false;
    signal.removeEventListener('abort', stop);
    cancelAnimationFrame(frame);
    stream?.getTracks().forEach(track => track.stop());
    video.srcObject = null;
    if (!busy) closePose();
  };
  signal.addEventListener('abort', stop, {once:true});
  try {
    onStatus('Waiting for browser camera permission…');
    const request = navigator.mediaDevices.getUserMedia({audio:false,video:{width:{ideal:480},height:{ideal:360},frameRate:{ideal:24,max:30},facingMode:'user'}}).then(result => {
      if (!active) result.getTracks().forEach(track => track.stop());
      else stream = result;
      return result;
    }, error => {
      if (error.name === 'NotAllowedError') throw Error('Camera permission was denied. Allow Camera in your browser site settings and retry.');
      throw Error('Could not open the camera. Close Windows Camera, Teams or other apps using it and retry.');
    });
    await waitFor(request, signal, 20000, 'Camera access timed out. Check the browser permission prompt or play without a webcam.');
    signal.throwIfAborted();
    onStatus('Camera connected. Loading motion tracking…');
    const initialize = async () => {
      video.srcObject = stream;
      await video.play();
      if (!active) return;
      const Pose = await loadPose();
      if (!active) return;
      pose = new Pose({locateFile:name=>{
        const url=assetUrl(name);
        if(!url) console.warn('Missing pose asset', name);
        return url||name;
      }});
      pose.setOptions({modelComplexity:0,smoothLandmarks:true,enableSegmentation:false});
      pose.onResults(({poseLandmarks:p})=>{
        if(!active)return;
        landmarks=p||null;
        validPose=false;
        if(!p||![11,12,23,24].every(i=>p[i]?.visibility>.55))return;
        const dx=(p[23].x+p[24].x-p[11].x-p[12].x)/2;
        const height=Math.abs(p[23].y+p[24].y-p[11].y-p[12].y)/2;
        if(height<.04)return;
        validPose=true;
        const angle=dx/height;
        lean=Math.abs(angle)<.07?0:Math.sign(angle)*Math.min(1,(Math.abs(angle)-.07)*5);
        seen=performance.now();
      });
      busy = true;
      try { await pose.initialize(); }
      finally { busy = false; if (!active) closePose(); }
    };
    await waitFor(initialize().catch(error => {
      console.error(error);
      throw Error('Motion tracking could not start. Try again or play without a webcam.');
    }), signal, 30000, 'Motion tracking took too long to start. Check your connection, or play without a webcam.');
    signal.throwIfAborted();
  } catch (error) { stop(); throw error; }
  async function tick(now) {
    if (!active) return;
    if (now >= nextFrame && video.readyState >= 2 && video.currentTime !== last) {
      nextFrame = now + 64;
      last = video.currentTime;
      busy = true;
      const send = Promise.resolve().then(() => pose.send({image:video}));
      try { await waitFor(send, signal, 12000, 'Motion tracking stopped responding.'); }
      catch { failed = true; stop(); }
      finally {
        // Don't destroy the tracker until its underlying inference settles.
        const done = () => { busy = false; if (!active) closePose(); };
        send.then(done, done);
      }
    }
    if (active && !failed) frame = requestAnimationFrame(tick);
  }
  frame = requestAnimationFrame(tick);
  // A track that ends on its own (device unplugged, another app grabbed the
  // camera, the tab was backgrounded on mobile) leaves pose.send() throwing on
  // every frame. Without this the run died the moment the loader went away.
  stream.getVideoTracks().forEach(track=>track.addEventListener('ended',()=>{failed=true;stop();},{once:true}));
  return {video,stop,get landmarks(){return landmarks},get locked(){return this.ready&&validPose},get failed(){return failed||!stream.getVideoTracks().some(t=>t.readyState==='live')},get ready(){return !this.failed&&seen>0&&performance.now()-seen<750},get lean(){return this.ready?lean:0}};
}
