import * as THREE from './vendor/three.module.js';

const clamp=THREE.MathUtils.clamp;

function roundedBox(){
 const geometry=new THREE.BoxGeometry(1,1,1,4,4,4),p=geometry.attributes.position;
 const v=new THREE.Vector3(),core=new THREE.Vector3(),radius=.1;
 for(let i=0;i<p.count;i++){
  v.fromBufferAttribute(p,i);core.copy(v).clampScalar(-.5+radius,.5-radius);
  v.sub(core).normalize().multiplyScalar(radius).add(core);p.setXYZ(i,v.x,v.y,v.z);
 }
 geometry.computeVertexNormals();return geometry;
}

/** World-fixed kart-style grid and start lamps. Race timing stays with the app. */
export class StartingGrid{
 constructor(scene){
  this.scene=scene;this.group=new THREE.Group();this.group.name='kart-starting-grid';scene.add(this.group);
  this.geometries=new Set();this.materials=new Set();this.textures=new Set();this.slots=[];
  this.box=this.geometry(roundedBox());this.sphere=this.geometry(new THREE.SphereGeometry(1,20,14));
  this.torus=this.geometry(new THREE.TorusGeometry(.65,.065,8,28));
  this.temp=new THREE.Object3D();
  this.cream=this.material(0xffefd0,{roughness:.52});
  this.blue=this.material(0x7faec6,{roughness:.4,metalness:.08});
  this.deepBlue=this.material(0x344b68,{roughness:.65});
  this.coral=this.material(0xe5959a,{roughness:.45});
  this.gold=this.material(0xe6bd78,{roughness:.35,metalness:.3});
  this.slotMaterial=this.material(0xe9e2c6,{roughness:.8,emissive:0x7d7956,emissiveIntensity:.12});
  this.lampMaterials=Array.from({length:3},()=>this.material(0x562e3b,{roughness:.2,metalness:.08,emissive:0x29151b,emissiveIntensity:.2}));
  this.launchMaterial=this.material(0xa4e9d5,{roughness:.4,emissive:0x51e9be,emissiveIntensity:.15});
  this.makePavement();this.makeGantry();this.makeSideDetails();
 }
 geometry(g){this.geometries.add(g);return g;}
 material(color,extra={}){const m=new THREE.MeshStandardMaterial({color,roughness:.6,...extra});this.materials.add(m);return m;}
 mesh(parent,geometry,material,position,scale=[1,1,1]){const m=new THREE.Mesh(geometry,material);m.position.set(...position);m.scale.set(...scale);parent.add(m);return m;}
 block(parent,material,position,scale){return this.mesh(parent,this.box,material,position,scale);}
 ball(parent,material,position,scale){return this.mesh(parent,this.sphere,material,position,scale);}
 instances(parent,geometry,material,poses){
  const m=new THREE.InstancedMesh(geometry,material,poses.length);
  poses.forEach((pose,i)=>{this.temp.position.set(...pose.position);this.temp.rotation.set(0,pose.rotation||0,0);this.temp.scale.set(...pose.scale);this.temp.updateMatrix();m.setMatrixAt(i,this.temp.matrix);});
  m.instanceMatrix.needsUpdate=true;parent.add(m);return m;
 }
 makePavement(){
  this.block(this.group,this.material(0x6d7c8e,{roughness:.95}),[0,-.062,-3.7],[28.9,.025,13.2]);
  const dark=[],light=[],width=29/20;
  for(let row=0;row<3;row++)for(let col=0;col<20;col++){
   const pose={position:[-14.5+(col+.5)*width,-.027,.18+row*.62],scale:[width-.025,.035,.6]};
   ((row+col)%2?dark:light).push(pose);
  }
  this.instances(this.group,this.box,this.deepBlue,dark);this.instances(this.group,this.box,this.cream,light);
  this.block(this.group,this.gold,[0,-.008,-.3],[29,.05,.12]);
  this.block(this.group,this.cream,[0,-.008,2.1],[29,.05,.12]);
  const canvas=document.createElement('canvas');canvas.width=768;canvas.height=192;
  const c=canvas.getContext('2d');c.fillStyle='#eff4e9';c.font='400 128px "Race Jua",sans-serif';c.textAlign='center';c.textBaseline='middle';c.fillText('START',384,99);
  const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;this.textures.add(texture);
  const material=new THREE.MeshBasicMaterial({map:texture,transparent:true,depthWrite:false,side:THREE.DoubleSide,opacity:.84});this.materials.add(material);
  const word=this.mesh(this.group,this.geometry(new THREE.PlaneGeometry(10,2.5)),material,[0,-.024,-2]);word.rotation.x=-Math.PI/2;
 }
 makeGantry(){
  for(const side of [-1,1]){
   this.block(this.group,this.deepBlue,[side*15.2,.2,1.15],[1.8,.45,2.3]);
   this.block(this.group,this.blue,[side*15.2,3.7,1.15],[.85,7.1,1.2]);
   this.block(this.group,this.cream,[side*15.2,3.7,.48],[.36,6.45,.1]);
   this.block(this.group,this.coral,[side*15.2,6.6,1.15],[1.18,.75,1.55]);
   this.block(this.group,this.gold,[side*15.2,7.1,1.15],[1.35,.19,1.7]);
   for(const y of [1.1,2.1,3.1])this.ball(this.group,this.cream,[side*15.2,y,.45],[.085,.085,.05]);
  }
  this.block(this.group,this.blue,[0,7.45,1.15],[31,.78,1.15]);
  this.block(this.group,this.cream,[0,7.47,.54],[28.5,.2,.12]);
  this.block(this.group,this.gold,[0,7.92,1.15],[29,.1,.85]);
  this.makeLampBoard([0,7.25,.2],0,.84);
  // The main side camera sees the second board on the far-side pylon.
  this.makeLampBoard([15.05,5.7,1.3],Math.PI/2,.92);
 }
 makeLampBoard(position,rotation,scale){
  const board=new THREE.Group();board.position.set(...position);board.rotation.y=rotation;board.scale.setScalar(scale);this.group.add(board);
  this.block(board,this.cream,[0,0,0],[7.8,2.05,.8]);
  this.block(board,this.deepBlue,[0,0,-.42],[7.45,1.72,.18]);
  this.block(board,this.gold,[0,-1.02,0],[6.9,.13,.68]);
  for(let i=0;i<3;i++){
   const x=(i-1)*2.18;
   this.mesh(board,this.torus,this.gold,[x,0,-.58]);
   this.ball(board,this.lampMaterials[i],[x,0,-.59],[.54,.54,.23]);
   this.ball(board,this.cream,[x-.16,.18,-.8],[.1,.13,.025]);
  }
 }
 makeSideDetails(){
  const cream=[],coral=[];
  for(const side of [-1,1])for(let i=0;i<15;i++){
   const pose={position:[side*14.65,.12,-25+i*2.1],scale:[.28,.32,2.02]};
   (i%2?coral:cream).push(pose);
  }
  this.instances(this.group,this.box,this.cream,cream);this.instances(this.group,this.box,this.coral,coral);
  for(const side of [-1,1])for(let i=0;i<4;i++){
   const z=-8+i*4.6;
   const a=this.block(this.group,this.launchMaterial,[side*12.5,-.006,z],[.13,.055,1.2]);a.rotation.y=-Math.PI/4;
   const b=this.block(this.group,this.launchMaterial,[side*12.5+.78,-.006,z],[.13,.055,1.2]);b.rotation.y=Math.PI/4;
  }
 }
 setPlan(plan){
  this.plan=plan;
  for(const mesh of this.slots){mesh.removeFromParent();mesh.dispose();}this.slots=[];
  const poses=[];
  for(const [i,r] of plan.runners.entries()){
   const x=Number.isFinite(r.gridX)?r.gridX:(i%5-2)*3.3,z=Number.isFinite(r.gridZ)?r.gridZ:-4-Math.floor(i/5)*3.5;
   poses.push({position:[x,-.019,z-1.12],scale:[2.6,.055,.11]});
   poses.push({position:[x-1.3,-.019,z-.12],scale:[.11,.055,2.1]});
   poses.push({position:[x+1.3,-.019,z-.12],scale:[.11,.055,2.1]});
  }
  this.slots.push(this.instances(this.group,this.box,this.slotMaterial,poses));
  this.update({phase:'idle',time:0,countdown:0,animTime:0});
 }
 update({phase='idle',time=0,countdown=0,animTime=0}={}){
  if(phase==='paused')return;
  const started=phase==='racing'||phase==='finished',ready=phase==='countdown';
  const lit=ready?Math.min(3,Math.floor(clamp(countdown,0,3))+1):0;
  for(let i=0;i<this.lampMaterials.length;i++){
   const material=this.lampMaterials[i],on=started||i<lit;
   material.color.setHex(started?0x9cf4c7:on?0xf77b72:0x513a47);
   material.emissive.setHex(started?0x47db93:on?0xf64c4a:0x1f1420);
   material.emissiveIntensity=on?(started?1.2:1.05):.12;
  }
  const launch=started?Math.max(0,1-time/2.8):0;
  this.launchMaterial.emissiveIntensity=.14+launch*1.4;
  this.slotMaterial.emissiveIntensity=ready?.18+.08*Math.sin(animTime*3):.1;
 }
 dispose(){
  this.group.removeFromParent();
  this.group.traverse(o=>{if(o.isInstancedMesh)o.dispose();});
  for(const geometry of this.geometries)geometry.dispose();for(const material of this.materials)material.dispose();for(const texture of this.textures)texture.dispose();
 }
}
