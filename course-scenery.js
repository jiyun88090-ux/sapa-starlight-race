import * as THREE from './vendor/three.module.js';

// Roadside scenery is anchored in the same world as the track. All near props
// have volume, so a side camera sees their sides instead of rotating cutouts.
const TAU=Math.PI*2;
const lerp=THREE.MathUtils.lerp;
export const TERRAIN_HALF_WIDTH=14.5+(125-14.5)*.5;
const colourCache=new Map();
const finishPalettes=[
 ['#7fbfac','#a5dcc9','#c6ead8'],
 ['#83b8de','#afd7ef','#c9e4f4'],
 ['#a18dc9','#c1abe1','#dccef0'],
 ['#e3a77d','#f0c49a','#f8ddba'],
 ['#d18faf','#e9b1ca','#f4d0df']
];
function finishPalette(x,z){return finishPalettes[Math.abs(Math.floor(z/27)+(x>0?2:0))%finishPalettes.length];}
function sceneryColour(stage,value){
 const key=stage+':'+value;if(colourCache.has(key))return colourCache.get(key);
 const colour=new THREE.Color(value),hsl={};colour.getHSL(hsl);
 if(hsl.l>.25){const neutral=hsl.s<.16;colour.setHSL(neutral?[.38,.61,.73,.83][stage]:hsl.h,neutral?.26:Math.min(.64,hsl.s*1.22),hsl.l);}
 colourCache.set(key,colour);return colour;
}
function random(seed){let n=seed;return()=>{n=(1664525*n+1013904223)>>>0;return n/4294967296;};}
// Halve the open space beyond the left road edge; retain each prop's dimensions.
function vergeX(side,distance){return side<0?-(14.5+(distance-14.5)*.5):distance;}
function roundedBox(){
 const g=new THREE.BoxGeometry(1,1,1,4,4,4),p=g.attributes.position,core=new THREE.Vector3(),v=new THREE.Vector3();
 for(let i=0;i<p.count;i++){v.fromBufferAttribute(p,i);core.set(THREE.MathUtils.clamp(v.x,-.35,.35),THREE.MathUtils.clamp(v.y,-.35,.35),THREE.MathUtils.clamp(v.z,-.35,.35));v.sub(core).normalize().multiplyScalar(.15).add(core);p.setXYZ(i,v.x,v.y,v.z);}
 g.computeVertexNormals();return g;
}
function contactTexture(){
 const c=document.createElement('canvas');c.width=c.height=96;const x=c.getContext('2d'),g=x.createRadialGradient(48,48,8,48,48,48);
 g.addColorStop(0,'rgba(22,24,40,.65)');g.addColorStop(.45,'rgba(22,24,40,.3)');g.addColorStop(1,'rgba(22,24,40,0)');x.fillStyle=g;x.fillRect(0,0,96,96);
 const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;return t;
}

export class CourseScenery{
 constructor(scene){
  this.scene=scene;this.root=new THREE.Group();this.root.name='World-anchored course scenery';scene.add(this.root);
  this.geometries={round:roundedBox(),ball:new THREE.SphereGeometry(1,16,10),stem:new THREE.CylinderGeometry(.5,.58,1,10),cone:new THREE.ConeGeometry(1,1,5),crystal:new THREE.OctahedronGeometry(1,0),plane:new THREE.PlaneGeometry(1,1)};
  this.shadowTexture=contactTexture();this.temp=new THREE.Object3D();this.layers=[];
  for(let i=0;i<4;i++){
   const layer={group:new THREE.Group(),batches:new Map(),materials:[],opacity:-1};layer.group.name=['Meadow scenery','Town scenery','Galaxy scenery','Cloud finish scenery'][i];this.root.add(layer.group);this.layers.push(layer);this.buildStage(i);this.flush(layer);layer.group.visible=i===0;
  }
 }

 add(stage,shape,color,x,y,z,sx,sy,sz,rotation=0,kind='solid'){
  if(this.distantScenery){
   // The broad hills and skyline must leave room for the painted background.
   sx*=.5;sy*=.5;y*=.5;
   // Keep large hills in the outer band so they cannot swallow roadside houses.
   if(shape==='ball')sx=Math.min(sx,(TERRAIN_HALF_WIDTH-14.5)*.18);
   const radius=shape==='round'?sx*.5:sx;
   const limit=Math.max(14.5,TERRAIN_HALF_WIDTH-radius);
   x=THREE.MathUtils.clamp(x,-limit,limit);
  }
  const layer=this.layers[stage],key=`${shape}:${color}:${kind}`;
  if(!layer.batches.has(key)){
   let material;
   if(kind==='shadow')material=new THREE.MeshBasicMaterial({map:this.shadowTexture,transparent:true,depthWrite:false,opacity:.52,polygonOffset:true,polygonOffsetFactor:-1});
   else{const colour=sceneryColour(stage,color);material=new THREE.MeshStandardMaterial({color:colour,roughness:kind==='glow'?.4:.85,metalness:kind==='crystal'?.1:0,emissive:kind==='glow'?colour:0,emissiveIntensity:kind==='glow'?.65:0,transparent:false});}
   material.userData.baseOpacity=material.opacity;layer.materials.push(material);layer.batches.set(key,{shape,material,poses:[],kind});
  }
  this.temp.position.set(x,y,z);this.temp.rotation.set(kind==='shadow'?-Math.PI/2:0,rotation,0);this.temp.scale.set(sx,sy,sz);this.temp.updateMatrix();layer.batches.get(key).poses.push(this.temp.matrix.clone());
 }

 shadow(stage,x,z,width,depth,y=.04){this.add(stage,'plane','#ffffff',x,y,z,width,depth,1,0,'shadow');}
 ball(stage,color,x,y,z,sx,sy=sx,sz=sx){this.add(stage,'ball',color,x,y,z,sx,sy,sz);}

 flush(layer){
  for(const batch of layer.batches.values()){
   const mesh=new THREE.InstancedMesh(this.geometries[batch.shape],batch.material,batch.poses.length);
   batch.poses.forEach((matrix,i)=>mesh.setMatrixAt(i,matrix));mesh.instanceMatrix.needsUpdate=true;mesh.computeBoundingSphere();
   if(batch.kind==='shadow')mesh.renderOrder=1;
   layer.group.add(mesh);batch.poses.length=0;
  }
 }

 buildStage(stage){
  const rand=random(1823+stage*851),shoulders=['#85a56b','#8298b4','#7063a0','#b899c8'],banks=['#5c8b65','#6b8a9f','#5a4c89','#c1a2cd'];
  for(const side of [-1,1]){
   // The shoulder starts exactly at the 29-unit road boundary, then layers
   // outward into banks; it never slides separately from the road.
   this.add(stage,'round',shoulders[stage],side*16.4,-.095,320,3.8,.15,900);
   this.add(stage,'round',banks[stage],side*22,-.16,320,8,.25,900);
  }
  for(let z=-105;z<760;z+=27){
   for(const side of [-1,1]){
    const jitter=(rand()-.5)*4;
    if(stage===0)this.meadowEdge(stage,side,z+jitter,rand);
    if(stage===1)this.townEdge(stage,side,z+jitter,rand);
    if(stage===2)this.spaceEdge(stage,side,z+jitter,rand);
    if(stage===3)this.finishEdge(stage,side,z+jitter,rand);
   }
  }
  this.distantScenery=true;
  for(const side of [-1,1])for(let z=-90;z<850;z+=115){
   const x=vergeX(side,side<0?106:84),sz=62+rand()*18;
   if(stage===0){this.ball(stage,'#73866f',x,0,z,43,12+rand()*8,sz);this.ball(stage,'#8a9683',x+side*32,4,z+41,46,18,sz);}
   if(stage===1){this.ball(stage,'#9b9ab0',x+side*20,0,z,40,10,sz);for(let k=0;k<3;k++){const height=11+rand()*14;this.add(stage,'round',['#a2a7b7','#9d9caf','#b8a8ad'][k],x+side*k*11,height/2,z+k*21,10,height,17);}}
   if(stage===2){this.cloud(stage,x,5,z,8,'#817895');this.floatingIsland(stage,x-side*20,6+rand()*8,z+25,rand);}
   if(stage===3){const palette=finishPalette(x,z);this.cloud(stage,x,3,z,13,palette[1]);this.cloud(stage,x+side*25,11,z+45,16,finishPalette(x,z+54)[2]);}
  }
  this.distantScenery=false;
 }

 meadowEdge(stage,side,z,rand){
  this.ball(stage,'#74865a',side*21,.02,z,5,.45,15);
  this.ball(stage,'#8e9968',side*25,.1,z+9,6,.7,13);
  for(let j=0;j<3;j++){
   const x=side*(17.4+rand()*4),zz=z-8+j*6;
   this.shadow(stage,x,zz,2.5,1.6,.055);
   this.ball(stage,j%2?'#899362':'#778951',x,.43,zz,.8+rand()*.4,.5,.75);
   this.ball(stage,'#a3a874',x+.35,.58,zz+.15,.48,.35,.45);
   if(j!==1)this.flowers(stage,x-side*.8,zz+1,rand,false);
  }
  const x=vergeX(side,side<0?84+rand()*10:30+rand()*7);
  this.tree(stage,x,z+2,.85+rand()*.4,rand,'green');
  if(Math.round(z/27)%2===0)this.tree(stage,x+side*7,z+11,.65+rand()*.3,rand,'green');
 }

 tree(stage,x,z,scale,rand,theme){
  const foliage=theme==='bloom'?finishPalette(x,z):['#6c845b','#83956a','#a1aa7a'];
  const trunk=theme==='bloom'?'#9a7c6c':'#887057',height=4.6*scale;
  this.shadow(stage,x,z,6.6*scale,5.6*scale);
  this.add(stage,'stem',trunk,x,height*.42,z,.65*scale,height*.84,.65*scale);
  this.ball(stage,foliage[0],x,height*.91,z,2.5*scale,2.2*scale,2.3*scale);
  this.ball(stage,foliage[1],x-1.3*scale,height*1.07,z-.45*scale,1.9*scale,1.9*scale,1.8*scale);
  this.ball(stage,foliage[2],x+1.1*scale,height*1.17,z+.25*scale,1.6*scale,1.7*scale,1.7*scale);
  this.ball(stage,foliage[1],x+.1*scale,height*1.38,z-.1*scale,1.65*scale,1.45*scale,1.65*scale);
  this.ball(stage,foliage[0],x-.8*scale,.45*scale,z+1.5*scale,1.4*scale,.55*scale,1.2*scale);
 }

 flowers(stage,x,z,rand,gold){
  const petals=gold?['#e9c983','#f2dca6','#c4b3d2']:['#cfafa9','#d7c18b','#b9b4c4'];
  for(let i=0;i<5;i++){
   const px=x+(rand()-.5)*1.8,pz=z+(rand()-.5)*1.5,h=.25+rand()*.25;
   this.add(stage,'stem','#6f8053',px,h*.5,pz,.035,h,.035);
   const col=petals[i%3];this.ball(stage,col,px,h,pz,.13,.08,.13);this.ball(stage,col,px+.12,h,pz,.11,.07,.11);this.ball(stage,col,px-.08,h,pz+.08,.11,.07,.11);
   this.ball(stage,'#e2c88b',px,h+.03,pz,.055,.04,.055);
  }
 }

 townEdge(stage,side,z,rand){
  // Paving slabs and flower planters form a readable continuous town verge.
  this.add(stage,'round','#b2a9a6',side*20,.01,z,6.5,.22,26.6);
  this.add(stage,'round','#c5b7ad',side*16.9,.16,z,.3,.4,26.7);
  const px=side*(side<0?23:22);
  this.add(stage,'round','#ad958b',px,.34,z+8,2.4,.65,4.8);
  this.ball(stage,'#80906a',px,.87,z+7,1,.4,1.6);this.ball(stage,'#94a07a',px,.91,z+9,1,.43,1.7);
  this.flowers(stage,px,z+8,rand,false);
  const block=Math.round(z/27);
  if(block%2===0){
   const bx=vergeX(side,side<0?88:35);
   this.building(stage,side,bx,z,.92+rand()*.22,Math.abs(block)%3,rand);
   this.building(stage,side,bx+side*(5+rand()*2),z+17,.78+rand()*.2,(Math.abs(block)+1)%3,rand);
   this.streetlamp(stage,vergeX(side,side<0?80:25),z-9,1);
   if(block%4===0)this.car(stage,vergeX(side,side<0?82:26),z+16,side,rand);
  }else this.tree(stage,vergeX(side,side<0?84:30),z,.72+rand()*.15,rand,'green');
 }

 building(stage,side,x,z,scale,tone,rand){
  const colors=['#c4b3a1','#9bafb0','#b9a9ba'],roofs=['#9d797c','#6f8994','#8a779a'],height=(6.2+rand()*2.3)*scale,w=7.8*scale,d=12*scale;
  this.shadow(stage,x,z,w*1.5,d*1.15);
  this.add(stage,'round',colors[tone],x,height/2,z,w,height,d);
  this.add(stage,'round',roofs[tone],x,height+.25,z,w+.6,.7,d+.8);
  this.add(stage,'round','#d6c8b5',x,.4,z,w+.3,.75,d+.3);
  const face=x-side*(w/2+.03);
  for(let floor=0;floor<2;floor++)for(let j=-1;j<=1;j++){
   const yy=1.9+floor*2.65,zz=z+j*d*.28;
   this.add(stage,'round','#6d7888',face,yy,zz,.12,1.7,1.8);
   this.add(stage,'round',j===0?'#e7d3a9':'#bbc7d1',face-side*.08,yy+.02,zz,.07,1.4,1.5);
   this.add(stage,'round','#dacabc',face-side*.13,yy,zz,.07,1.45,.09);
   this.add(stage,'round','#dacabc',face-side*.13,yy,zz,.07,.09,1.55);
  }
  this.add(stage,'round',roofs[tone],face-side*.6,3,z,1.7,.35,4.2);
  this.add(stage,'round','#6a7485',face-side*.08,1.14,z,.18,2.25,1.5);
  this.add(stage,'round','#c4c8c7',face-side*.18,1.65,z,.05,.85,1.1);
 }

 streetlamp(stage,x,z,scale){
  const h=4.7*scale;
  this.shadow(stage,x,z,1.3,1.2);
  this.add(stage,'stem','#847a71',x,h*.5,z,.14*scale,h,.14*scale);
  this.add(stage,'round','#a19481',x,h,z,.8*scale,.18*scale,.8*scale);
  this.add(stage,'round','#e7d3a5',x,h-.3*scale,z,.55*scale,.5*scale,.55*scale,0,'glow');
  this.add(stage,'cone','#9d8e7f',x,h+.19*scale,z,.65*scale,.45*scale,.65*scale,Math.PI/4);
 }

 car(stage,x,z,side,rand){
  const body=rand()>.5?'#b8a4b5':'#91aeb8';this.shadow(stage,x,z,4.2,6.5);
  this.add(stage,'round',body,x,.68,z,2.7,1.1,4.8);
  this.add(stage,'round',body,x,1.35,z-.15,2.35,.9,2.65);
  this.add(stage,'round','#667c90',x,1.5,z-.15,2.4,.5,2.2);
  this.add(stage,'round',body,x,1.8,z-.15,2.35,.2,2.4);
  for(const xx of [-1.25,1.25])for(const zz of [-1.4,1.4])this.ball(stage,'#454c5d',x+xx,.39,z+zz,.25,.38,.38);
  for(const xx of [-.82,.82])this.add(stage,'round','#e3d6b2',x+xx,.8,z+2.4,.46,.3,.1,0,'glow');
 }

 spaceEdge(stage,side,z,rand){
  this.add(stage,'round','#726487',side*20,-.02,z,9,.45,28);
  this.add(stage,'round','#9a88b3',side*15.9,.06,z,.28,.19,26.7);
  this.ball(stage,'#6b6082',side*22,.05,z+7,4,.42,8);
  for(let i=0;i<3;i++){
   const x=side*(18.2+rand()*4),zz=z-7+i*7,height=.55+rand()*.55;
   this.crystals(stage,x,zz,height,rand);
  }
  if(Math.round(z/27)%2===0){const x=vergeX(side,side<0?84:32);this.crystals(stage,x,z,2.6+rand()*1.3,rand);this.floatingIsland(stage,x+side*8,4.5,z+10,rand);}
 }

 crystals(stage,x,z,size,rand){
  const colors=['#8c9dbd','#a99ac1','#a7c1c8'];this.shadow(stage,x,z,size*2.4,size*2);
  for(let j=0;j<3;j++){
   const h=size*(j===0?1.7:.9+rand()*.3),xx=x+(j-1)*size*.55,zz=z+(j%2)*size*.35;
   this.add(stage,'crystal',colors[j],xx,h*.5,zz,size*.35,h*.65,size*.4,rand()*.5,'crystal');
   this.ball(stage,colors[j],xx,.12,zz,size*.45,.16,size*.45);
  }
 }

 floatingIsland(stage,x,y,z,rand){
  const size=2.8+rand()*2.2;
  this.ball(stage,'#736280',x,y,z,size,.75,size*.85);
  this.add(stage,'cone','#514765',x,y-1.8,z,size*.8,3.4,size*.72,Math.PI/5);
  this.ball(stage,'#ab96bb',x,y+.5,z,size*.92,.28,size*.78);
  this.add(stage,'crystal','#b0bfd8',x-.4,y+2,z,.7,1.8,.65,.25,'crystal');
  this.add(stage,'crystal','#bfa5cc',x+1,y+1.4,z+.5,.45,1.05,.4,-.3,'crystal');
 }

 cloud(stage,x,y,z,size,color){
  this.ball(stage,color,x,y,z,size*1.2,size*.35,size*.75);
  this.ball(stage,color,x-size*.55,y+size*.16,z,size*.65,size*.45,size*.63);
  this.ball(stage,color,x+size*.2,y+size*.27,z-size*.08,size*.75,size*.53,size*.65);
  this.ball(stage,color,x+size*.8,y+size*.05,z+.15,size*.6,size*.36,size*.6);
 }

 finishEdge(stage,side,z,rand){
  const palette=finishPalette(side*21,z);
  this.ball(stage,palette[0],side*21,.02,z,5,.4,15);
  this.ball(stage,palette[1],side*25,.1,z+7,6,.65,13);
  this.cloud(stage,side*20,.18,z+3,2.2,palette[2]);
  for(let i=0;i<3;i++)this.flowers(stage,side*(16.8+rand()*2),z-8+i*7,rand,true);
  const block=Math.round(z/27);
  if(block%2===0){this.tree(stage,vergeX(side,side<0?84:31),z,1+rand()*.2,rand,'bloom');this.streetlamp(stage,vergeX(side,side<0?80:25),z-9,1.05);}
  else this.cloud(stage,vergeX(side,side<0?84:34),1.6,z,5.5,palette[1]);
 }

 update({stage=0,previous=0,mix=1}={}){
  // Only theme opacity changes. Camera travel itself supplies all parallax;
  // no camera-facing rotation, independent drift or distance visibility cuts.
  for(let i=0;i<this.layers.length;i++){
   const layer=this.layers[i],opacity=i===stage?mix:i===previous?1-mix:0;
   layer.group.visible=opacity>.001;
   if(Math.abs(opacity-layer.opacity)<.001)continue;
   layer.opacity=opacity;
   for(const material of layer.materials){
    material.opacity=material.userData.baseOpacity*opacity;
    const transparent=material.userData.baseOpacity<1||opacity<.999;
    if(material.transparent!==transparent){material.transparent=transparent;material.needsUpdate=true;}
    material.depthWrite=!transparent;
   }
  }
 }
}
