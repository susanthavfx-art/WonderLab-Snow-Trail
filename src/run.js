import * as T from 'three';
import {createPoseView} from './pose-view.js';
import {createRideGate} from './ride-gate.js';
import {createTrailPines} from './trail-pines.js';
import {loadTrailModels,pieces,instance,disposeModel} from './models.js';
export function createRun(host,{camera,icon,finish}){
  const renderer=new T.WebGLRenderer({antialias:true,alpha:true});renderer.setPixelRatio(Math.min(devicePixelRatio,camera?1:1.25));renderer.setClearColor(0x9bd5ff,0);const scene=new T.Scene();scene.fog=new T.FogExp2(0xc9e6fa,.0125);const view=new T.PerspectiveCamera(53,1,.1,330);view.position.set(.65,2.35,6.8);view.lookAt(0,1.3,-12);scene.add(new T.HemisphereLight(0xf3fbff,0x7794bd,1.75));const sun=new T.DirectionalLight(0xffecd0,2.0);sun.position.set(-25,24,-12);scene.add(sun);
  const mats=new Map(), geos=new Map();const mat=(color)=>{if(!mats.has(color))mats.set(color,new T.MeshStandardMaterial({color,roughness:.77}));return mats.get(color);};
  function mesh(parent,kind,color,x,y,z,sx,sy,sz){if(!geos.has(kind))geos.set(kind,kind==='ball'?new T.SphereGeometry(1,18,12):kind==='cone'?new T.ConeGeometry(1,1,9):kind==='rock'?new T.DodecahedronGeometry(1,0):kind==='ramp'?rampGeometry():kind==='star'?starGeometry():new T.BoxGeometry(1,1,1));const o=new T.Mesh(geos.get(kind),mat(color));o.position.set(x,y,z);o.scale.set(sx,sy,sz);parent.add(o);return o;}
  function starGeometry(){const shape=new T.Shape();for(let i=0;i<10;i++){const a=Math.PI/2+i*Math.PI/5,r=i%2?.45:1;shape[i?'lineTo':'moveTo'](Math.cos(a)*r,Math.sin(a)*r);}shape.closePath();return new T.ExtrudeGeometry(shape,{depth:.19,bevelEnabled:true,bevelThickness:.055,bevelSize:.06,bevelSegments:2});}
  function rampGeometry(){const shape=new T.Shape();shape.moveTo(-.5,0);shape.lineTo(.5,0);shape.lineTo(.5,1);shape.closePath();const g=new T.ExtrudeGeometry(shape,{depth:1,bevelEnabled:false});g.translate(0,0,-.5);g.rotateY(Math.PI/2);return g;}
  const snow=mesh(scene,'box',0xf0f7ff,0,-.26,-125,260,.5,285);
  // A soft groomed strip and a fading horizon let the snow meet the backdrop.
  snow.material.transparent=true;
  snow.material.depthWrite=false;
  snow.material.onBeforeCompile=shader=>{
    shader.vertexShader='varying vec2 snowXZ;\n'+shader.vertexShader.replace('#include <begin_vertex>',
      '#include <begin_vertex>\n  snowXZ = (modelMatrix * vec4(position, 1.0)).xz;');
    shader.fragmentShader='varying vec2 snowXZ;\n'+shader.fragmentShader
      .replace('#include <color_fragment>',`#include <color_fragment>
        float groomed = 1.0 - smoothstep(7.7, 11.0, abs(snowXZ.x));
        float drift = sin(snowXZ.x * .55 + snowXZ.y * .19) * sin(snowXZ.y * .38) * .035;
        float corduroy = sin(snowXZ.x * 52.0) * .018 * (1.0 - smoothstep(5.0, 20.0, vFogDepth));
        diffuseColor.rgb *= mix(vec3(.79,.88,.98), vec3(.96,.99,1.0), groomed) + drift + groomed * corduroy;
      `).replace('#include <opaque_fragment>',
      'diffuseColor.a *= 1.0 - smoothstep(28.0, 105.0, vFogDepth);\n#include <opaque_fragment>');
  };
  function tree(g,s=1){mesh(g,'box',0x775842,0,.47*s,0,.26*s,.94*s,.24*s);for(let i=0;i<3;i++){let r=(1.28-i*.28)*s;mesh(g,'cone',i%2?0x276476:0x215667,0,(1.15+i*.65)*s,0,r,1.62*s,r);mesh(g,'cone',0xe6f5ff,0,(1.43+i*.65)*s,0,r*.78,1.28*s,r*.78);}}
  const scenery=[], trailside=[], packs={}, modelScenes=[];
  const forest=createTrailPines(scene);
  let mixer;
  function decorate(g,kind,height,angle,index){
    const pack=packs[kind];
    if(!pack?.length)return;
    const model=instance(pack[index%pack.length],{
      height,angle,width:kind==='rocks'?1.85:Infinity,
      depth:kind==='rocks'?1.75:Infinity,
    });
    g.clear();g.add(model);
  }
  for(let i=0;i<12;i++){
    const g=new T.Group();
    g.position.set((i%2?1:-1)*(11.5+Math.random()*15),0,-i*19);
    mesh(g,'rock',0xb4c9da,0,.45,0,1.1,.65,.8);
    scene.add(g);scenery.push(g);trailside.push({g,height:1.4,angle:Math.random()*Math.PI*2,index:i});
  }
  for(let i=0;i<28;i++){
    const x=i%3===0?(i%2?1:-1)*(8.55+Math.random()*.6):(Math.random()-.5)*15;
    const f=mesh(scene,'box',i%3===0?0xc4dcef:0xdbeaf7,x,.002,-i*7.8,Math.random()*.17+.04,.007,1.4+Math.random()*4);scenery.push(f);
  }
  const rider=new T.Group(),body=new T.Group(),board=new T.Group(),fallback=new T.Group();
  scene.add(rider);rider.add(body);body.add(board,fallback);
  const blue=0x0879ed,navy=0x16263e,ice=0xa3eaff,hair=0x512c21,skin=0xffbb87;
  mesh(board,'ball',0x063d99,0,.09,0,1.04,.075,.25);
  mesh(board,'ball',0x36baff,0,.13,0,1,.04,.23);
  for(const side of [-1,1])mesh(board,'box',0xeaf7ff,side*.48,.15,0,.11,.022,.36).rotation.y=-.33;
  mesh(fallback,'ball',blue,0,1.05,0,.35,.43,.23);mesh(fallback,'ball',ice,0,1.31,.10,.30,.145,.16);mesh(fallback,'ball',skin,0,1.61,0,.25,.276,.24);mesh(fallback,'ball',hair,0,1.76,.059,.264,.21,.23);mesh(fallback,'ball',navy,0,1.66,.055,.27,.071,.236);for(let i=0;i<5;i++)mesh(fallback,'ball',hair,(i-2)*.086,1.893+(i%2)*.025,.06,.091,.1,.12).rotation.z=-.34;mesh(fallback,'ball',0x29c6ff,0,1.68,-.19,.22,.09,.067);
  for(const side of [-1,1]){mesh(fallback,'ball',navy,side*.25,.52,.015,.15,.32,.15).rotation.z=side*.35;mesh(fallback,'ball',navy,side*.36,.265,.035,.17,.10,.19);mesh(fallback,'ball',blue,side*.52,1.16,.02,.27,.113,.116).rotation.z=side*-.23;mesh(fallback,'ball',ice,side*.69,1.12,.025,.12,.094,.10);mesh(fallback,'ball',navy,side*.79,1.08,.022,.105,.073,.081);}
  const shadow=mesh(scene,'ball',0x8bbbd6,0,.011,0,.9,.012,.34);
  host.innerHTML=`<div class="hud"><span class="score">0 pts</span><span class="stars">★ 0</span><span class="distance">0 m</span><button class="square quit" aria-label="Exit run" title="Exit run">${icon('log-out')}</button></div><div class="run-message" aria-live="polite"></div>${camera?'<div class="pose-status" role="status">Looking for shoulders & hips…</div>':'<div class="touch"><button data-dir="left" aria-label="Steer left">←</button><button data-dir="right" aria-label="Steer right">→</button></div>'}`;
  const poseView=camera?createPoseView(camera.video):null;
  if(poseView)host.append(poseView.panel);
  host.prepend(renderer.domElement);
  const gate=createRideGate(!!camera);
  const scoreEl=host.querySelector('.score'),starsEl=host.querySelector('.stars'),distanceEl=host.querySelector('.distance'),message=host.querySelector('.run-message'),status=host.querySelector('.pose-status');
  const resize=()=>{if(!host.clientWidth||!host.clientHeight)return;view.aspect=host.clientWidth/host.clientHeight;view.updateProjectionMatrix();renderer.setSize(host.clientWidth,host.clientHeight,false);};const observer=new ResizeObserver(resize);observer.observe(host);resize();
  const keys=new Set(), pointers=new Map();const map={ArrowLeft:'left',a:'left',ArrowRight:'right',d:'right'};const dir=e=>map[e.key]||map[e.key.toLowerCase()];function keydown(e){if(e.key==='Escape'){finish(null);return;}if(!camera&&dir(e)){e.preventDefault();keys.add(dir(e));}}function keyup(e){if(dir(e))keys.delete(dir(e));}function blur(){keys.clear();pointers.clear();}window.addEventListener('keydown',keydown);window.addEventListener('keyup',keyup);window.addEventListener('blur',blur);
  host.querySelector('.quit').onclick=()=>finish(null);for(const b of host.querySelectorAll('[data-dir]')){b.onpointerdown=e=>{e.preventDefault();b.setPointerCapture(e.pointerId);pointers.set(e.pointerId,b.dataset.dir);};b.onpointerup=b.onpointercancel=b.onlostpointercapture=e=>pointers.delete(e.pointerId);}
  const objects=[],lanes=[-6,-3,0,3,6];let distance=0, stars=0,jumps=0, x=0, velocity=0, jump=-1,nextRow=22, flash=0, row=0, last=performance.now(), frame, stopped=false;
  function spawn(kind,lane,z){const g=new T.Group();g.position.set(lane,0,z);scene.add(g);if(kind==='tree')tree(g,.88);if(kind==='rock'){mesh(g,'rock',0x59738f,0,.52,0,.95,.73,.73).rotation.z=.3;mesh(g,'rock',0xdaf2ff,.04,.92,.03,.69,.43,.53);}if(kind==='snowball'){mesh(g,'ball',0xf7fcff,0,.82,0,.85,.85,.85);for(let i=0;i<4;i++)mesh(g,'ball',0xd3eaf9,Math.cos(i*1.6)*.62,.8+Math.sin(i*1.6)*.47,.46,.19,.16,.16);}if(kind==='star')mesh(g,'star',0xffc229,0,1.0,0,.52,.52,.52);if(kind==='ramp'){mesh(g,'ramp',0x54c6ed,0,0,0,2.15,.82,2.65);for(let i=0;i<3;i++)mesh(g,'box',0xe7faff,0,.18+i*.214, .8-i*.68,1.72,.035,.09).rotation.x=.30;}const o={g,kind,lane,z,used:false,variant:row};objects.push(o);decorateObstacle(o);}
  function decorateObstacle(o){
    if(o.kind==='tree')decorate(o.g,'pines',2.85,o.variant*.63,o.variant);
    if(o.kind==='rock')decorate(o.g,'rocks',1.35,o.variant*.63,o.variant);
  }
  loadTrailModels((kind,asset)=>{
    if(stopped){disposeModel(asset.scene);return;}
    modelScenes.push(asset.scene);
    if(kind==='rider'){
      const model=asset.scene;
      // Freeze a frame of the supplied clip for a planted stance; the whole
      // body and board still animate together when carving or jumping.
      if(asset.animations.length){
        mixer=new T.AnimationMixer(model);
        mixer.clipAction(asset.animations[0]).play();
        mixer.setTime(0.6);
      }
      model.rotation.y=Math.PI*.8;
      const bounds=new T.Box3().setFromObject(model,true);
      const size=bounds.getSize(new T.Vector3());
      if(size.y<=0||!Number.isFinite(size.y))return;
      const center=bounds.getCenter(new T.Vector3());
      const scale=2.15/size.y;
      const fitted=new T.Group();
      model.position.sub(new T.Vector3(center.x,bounds.min.y,center.z));
      fitted.add(model);fitted.scale.setScalar(scale);fitted.position.y=.16;
      body.add(fitted);fallback.visible=false;
      return;
    }
    const filters={pines:name=>name.startsWith('Tree_Pine_Snowy_'),rocks:()=>true};
    packs[kind]=pieces(asset.scene,filters[kind]);
    if(kind==='rocks')trailside.forEach(({g,height,angle,index})=>decorate(g,kind,height,angle,index));
    objects.filter(o=>(kind==='pines'&&o.kind==='tree')||(kind==='rocks'&&o.kind==='rock')).forEach(decorateObstacle);
  });
  function addRow(d){const z=distance-d,kinds=['tree','rock','snowball'];const permutation=[...lanes];for(let i=4;i>0;i--){const j=Math.floor(Math.random()*(i+1));[permutation[i],permutation[j]]=[permutation[j],permutation[i]];}if(row===0){spawn('star',0,z);spawn('tree',3,z);}else{spawn('star',permutation[0],z);spawn('star',permutation[0],z-3.4);if(row%4===2)spawn('ramp',permutation[1],z);spawn(kinds[row%3],permutation[2],z);if(row>3)spawn(kinds[(row+1)%3],permutation[3],z);}row++;}
  const stats=reason=>({reason,score:Math.floor(distance)+stars*100+jumps*150,stars,distance:Math.floor(distance),jumps});
  function animate(now){if(stopped)return;const dt=Math.min(.05,(now-last)/1e3);last=now;if(camera?.failed){finish(stats('Webcam tracking stopped'));return;}const phase=gate(camera?.locked,now,camera?.ready),ready=phase.ride;const speed=ready?Math.min(36,15+distance*.018):0;distance+=speed*dt;while(nextRow<distance+125){addRow(nextRow);nextRow+=Math.max(13,23-distance*.009);}
    if(status&&status.textContent!==phase.status)status.textContent=phase.status;
    poseView?.draw(camera.ready?camera.landmarks:null,camera.locked);
    if(speed)forest.advance(distance);const down=k=>keys.has(k)||[...pointers.values()].includes(k);const steer=camera?(ready?camera.lean:0):Number(down('right'))-Number(down('left'));velocity=T.MathUtils.lerp(velocity,steer*10,1-Math.exp(-10*dt));x=T.MathUtils.clamp(x+velocity*dt,-7.6,7.6);if(jump>=0&&ready){jump+=dt;if(jump>=.94)jump=-1;}const height=jump<0?0:Math.sin(jump/.94*Math.PI)*2.05;rider.position.set(x,height,0);shadow.position.x=x;body.rotation.z=-velocity*.045;body.rotation.y=-velocity*.028;body.rotation.x=height*.07;view.position.x=T.MathUtils.lerp(view.position.x,x*.53+.65,1-Math.exp(-4*dt));view.position.y=T.MathUtils.lerp(view.position.y,2.35+height*.24,1-Math.exp(-5*dt));view.lookAt((view.position.x-.65)*.75,1.3+height*.15,-12);
    for(const g of scenery){g.position.z+=speed*dt;if(g.position.z>15)g.position.z-=243;}
    for(let i=objects.length-1;i>=0;i--){const o=objects[i];o.z+=speed*dt;o.g.position.z=o.z;if(o.kind==='star')o.g.rotation.y+=dt*2.7;if(o.kind==='snowball'){o.g.position.x=o.lane+Math.sin(o.z*.094)*.83;o.g.rotation.x+=speed*dt*.9;}if(ready&&!o.used&&Math.abs(o.z)<1.05&&Math.abs(o.g.position.x-x)<(o.kind==='ramp'?1.13:1.0)){if(o.kind==='star'){if(height<1.5){stars++;o.used=true;o.g.visible=false;}}else if(o.kind==='ramp'){if(jump<0){jump=0;jumps++;flash=now+1000;o.used=true;}}else if(height<1.29){finish(stats('Run complete!'));return;}}if(o.z>14){scene.remove(o.g);objects.splice(i,1);}}
    const st=stats();for(const [el,value] of [[scoreEl,`${st.score} pts`],[starsEl,`★ ${stars}`],[distanceEl,`${st.distance} m`]])if(el.textContent!==value)el.textContent=value;const text=phase.message||(now<flash?'+150 RAMP BONUS':'');if(message.textContent!==text)message.textContent=text;message.classList.toggle('countdown',!!phase.message);renderer.render(scene,view);frame=requestAnimationFrame(animate);}
  frame=requestAnimationFrame(animate);
  return {stop(){stopped=true;cancelAnimationFrame(frame);observer.disconnect();window.removeEventListener('keydown',keydown);window.removeEventListener('keyup',keyup);window.removeEventListener('blur',blur);geos.forEach(g=>g.dispose());mats.forEach(m=>m.dispose());forest.dispose();mixer?.stopAllAction();modelScenes.forEach(disposeModel);renderer.dispose();renderer.forceContextLoss();host.replaceChildren();}};
}
