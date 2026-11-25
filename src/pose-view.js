const links=[[11,12],[11,23],[12,24],[23,24],[11,13],[13,15],[12,14],[14,16],[23,25],[25,27],[24,26],[26,28]];
export function createPoseView(source) {
  // Accept either the camera's <video> or the MediaStream it owns. Creating our
  // own element from the stream means the preview survives the run being torn
  // down and rebuilt without stealing the element the tracker is drawing from.
  // Duck-type rather than instanceof: HTMLMediaElement is not defined in every
  // environment, and a thrown error here would abort the whole run.
  const isVideo = source && typeof source.play === 'function' && 'videoWidth' in source;
  const video = isVideo
    ? source
    : Object.assign(document.createElement('video'), {muted:true, playsInline:true, srcObject:source});
  const panel=document.createElement('div');
  panel.className='pose-preview';
  video.className='pose-video';
  const overlay=document.createElement('canvas');
  overlay.setAttribute('aria-hidden','true');
  panel.append(video,overlay);
  const ctx=overlay.getContext('2d');
  // Autoplay rules: start muted+inline, and retry once metadata is in.
  if(video.srcObject) Promise.resolve(video.play?.()).catch(()=>{});
  let previous, wasReady;
  return {panel, draw(landmarks,ready){
    if(landmarks===previous&&ready===wasReady)return;
    previous=landmarks;wasReady=ready;
    const w=video.videoWidth||480,h=video.videoHeight||360;
    if(overlay.width!==w||overlay.height!==h){overlay.width=w;overlay.height=h;panel.style.aspectRatio=`${w}/${h}`;}
    ctx.clearRect(0,0,w,h);
    if(!landmarks)return;
    const visible=i=>landmarks[i]?.visibility>.5;
    ctx.strokeStyle=ctx.fillStyle=ready?'#6bffa7':'#ffcd63';
    ctx.lineWidth=Math.max(3,w/100);ctx.lineCap='round';
    ctx.beginPath();
    for(const [i,j] of links)if(visible(i)&&visible(j)){
      const a=landmarks[i],b=landmarks[j];ctx.moveTo(a.x*w,a.y*h);ctx.lineTo(b.x*w,b.y*h);
    }
    ctx.stroke();
    for(const i of [0,11,12,13,14,15,16,23,24,25,26,27,28])if(visible(i)){
      const p=landmarks[i];ctx.beginPath();ctx.arc(p.x*w,p.y*h,ctx.lineWidth*.85,0,Math.PI*2);ctx.fill();
    }
  }};
}
