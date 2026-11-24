import poseScript from '@mediapipe/pose/pose.js?url';
let loading;
function loadPose(){return loading ||= new Promise((resolve,reject)=>{const script=document.createElement('script');script.src=poseScript;script.onload=()=>resolve(window.Pose);script.onerror=()=>{loading=null;script.remove();reject(Error('Could not load pose tracking'));};document.head.append(script);});}
const assets=import.meta.glob('/node_modules/@mediapipe/pose/{pose_web.binarypb,pose_solution*,pose_landmark_lite.tflite}',{eager:true,query:'?url',import:'default'});
export async function startCamera(){
  if(!navigator.mediaDevices?.getUserMedia)throw Error('Webcam access requires a secure browser page. You can play without a webcam.');
  let stream;try{stream=await navigator.mediaDevices.getUserMedia({audio:false,video:{width:{ideal:640},height:{ideal:480},facingMode:'user'}});}catch{throw Error('Could not access the webcam. Check your browser permissions or play without a webcam.');}
  const video=document.createElement('video');video.muted=true;video.playsInline=true;video.srcObject=stream;
  let pose,active=true,busy=false,frame,last=-1,lean=0,seen=0,failed=false;
  const stop=()=>{if(!active)return;active=false;cancelAnimationFrame(frame);stream.getTracks().forEach(t=>t.stop());video.srcObject=null;if(!busy)pose?.close();};
  try{await video.play();const Pose=await loadPose();pose=new Pose({locateFile:name=>assets[`/node_modules/@mediapipe/pose/${name}`]});pose.setOptions({modelComplexity:0,smoothLandmarks:true,enableSegmentation:false});pose.onResults(({poseLandmarks:p})=>{if(!active||!p||![11,12,23,24].every(i=>p[i]?.visibility>.55))return;const dx=(p[23].x+p[24].x-p[11].x-p[12].x)/2;const height=Math.abs(p[23].y+p[24].y-p[11].y-p[12].y)/2;if(height<.04)return;const angle=dx/height;lean= Math.abs(angle)<.07?0:Math.sign(angle)*Math.min(1,(Math.abs(angle)-.07)*5);seen=performance.now();});await pose.initialize();}
  catch{stop();throw Error('Motion tracking could not load on this device. Try playing without the webcam.');}
  async function tick(){if(!active)return;if(video.readyState>=2&&video.currentTime!==last){last=video.currentTime;busy=true;try{await pose.send({image:video});}catch{failed=true;}finally{busy=false;if(!active){pose.close();return;}}}if(active&&!failed)frame=requestAnimationFrame(tick);}
  frame=requestAnimationFrame(tick);
  return {video,stop,get failed(){return failed||!stream.getVideoTracks().some(t=>t.readyState==='live')},get ready(){return !this.failed&&seen>0&&performance.now()-seen<750},get lean(){return this.ready?lean:0}};
}
