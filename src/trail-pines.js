import * as T from 'three';

// A single alpha-cutout atlas and instanced quads replace dozens of mesh trees.
export function createTrailPines(scene) {
  const canvas=document.createElement('canvas');canvas.width=256;canvas.height=384;
  const ctx=canvas.getContext('2d');
  const rng=(()=>{let seed=21;return ()=>((seed=Math.imul(seed,1664525)+1013904223|0)>>>0)/4294967296;})();
  ctx.fillStyle='#796953';ctx.fillRect(118,285,20,96);
  for(let tier=5;tier>=0;tier--){
    const y=14+tier*49, radius=38+tier*16, bottom=y+112;
    function branch(offset,scale){
      ctx.beginPath();ctx.moveTo(128,y+offset);
      for(let j=0;j<=10;j++){
        const t=j/10, x=128+(t*2-1)*radius*scale;
        ctx.lineTo(x,bottom+offset-Math.abs(t*2-1)*16+(j%2?9:0)+rng()*5);
      }
      ctx.closePath();ctx.fill();
    }
    const green=ctx.createLinearGradient(15,y,235,bottom);green.addColorStop(0,'#337365');green.addColorStop(1,'#153642');ctx.fillStyle=green;branch(0,1);
    const snow=ctx.createLinearGradient(30,y,226,bottom);snow.addColorStop(0,'#fff9ee');snow.addColorStop(.65,'#d7ecfc');snow.addColorStop(1,'#8ab2ce');ctx.fillStyle=snow;branch(-13,.81);
  }
  const texture=new T.CanvasTexture(canvas);texture.colorSpace=T.SRGBColorSpace;
  const geometry=new T.PlaneGeometry(1,1);
  const material=new T.MeshBasicMaterial({map:texture,alphaTest:.46,side:T.DoubleSide});
  const count=64, spacing=3.7, span=count*spacing;
  const forest=new T.InstancedMesh(geometry,material,count);forest.frustumCulled=false;forest.instanceMatrix.setUsage(T.DynamicDrawUsage);scene.add(forest);
  const transform=new T.Object3D();
  const trees=Array.from({length:count},(_,i)=>({
    x:(i%2?1:-1)*(10+rng()*26),z:-i*spacing,height:2.8+rng()*5.5,stretch:.6+rng()*.16,
  }));
  function advance(traveled){
    trees.forEach(({x,z,height,stretch},i)=>{
      const wrap=((15-z-traveled)%span+span)%span;
      transform.position.set(x,height*.5,15-wrap);
      transform.scale.set(height*stretch,height,1);
      transform.updateMatrix();forest.setMatrixAt(i,transform.matrix);
    });
    forest.instanceMatrix.needsUpdate=true;
  }
  advance(0);
  return {advance,dispose(){forest.dispose();geometry.dispose();material.dispose();texture.dispose();}};
}
