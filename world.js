import * as THREE from './vendor/three.module.js';
import {positionAt,eventAt,cameraPhase,FINISH} from './engine.js';
const TAU=Math.PI*2, lerp=THREE.MathUtils.lerp,clamp=THREE.MathUtils.clamp;
const COLORS=[0xfff3e5,0xf9f7ec,0xffdc81,0xf2efff];
const ACCENTS=['#ee7e8b','#599deb','#e4b240','#a4a1f0'];
const ICONS=['♥','♛','★','✿'];
function canvasTexture(w,h,paint){const c=document.createElement('canvas');c.width=w;c.height=h;paint(c.getContext('2d'),w,h);const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;return t;}
function faceTexture(type){return canvasTexture(256,192,(c)=>{
 c.clearRect(0,0,256,192);c.fillStyle='#ee9c9a';c.globalAlpha=.7;c.beginPath();c.ellipse(44,118,24,12,-.1,0,TAU);c.ellipse(211,118,24,12,.1,0,TAU);c.fill();c.globalAlpha=1;
 c.fillStyle='#30282e';for(const x of [82,174]){c.beginPath();c.ellipse(x,82,9,type===2?14:17,0,0,TAU);c.fill();c.fillStyle='white';c.beginPath();c.arc(x-2,76,3.5,0,TAU);c.fill();c.fillStyle='#30282e';}
 c.strokeStyle='#30282e';c.lineWidth=5;c.lineCap='round';c.beginPath();c.moveTo(110,114);c.quadraticCurveTo(115,130,128,115);c.quadraticCurveTo(140,130,147,114);c.stroke();
 c.beginPath();c.moveTo(125,105);c.lineTo(131,105);c.stroke();
 c.strokeStyle='#cb7a82';c.lineWidth=3;for(const x of [32,43,54,199,210,221]){c.beginPath();c.moveTo(x,111);c.lineTo(x-4,120);c.stroke();}
 if(type===2){c.strokeStyle='#8d663d';c.lineWidth=4;c.beginPath();c.moveTo(73,51);c.lineTo(90,48);c.moveTo(167,48);c.lineTo(183,51);c.stroke();}
 });}
function starGeometry(radius=1){const s=new THREE.Shape();for(let i=0;i<10;i++){const a=Math.PI/2+i*Math.PI/5,r=i%2?radius*.43:radius,x=Math.cos(a)*r,y=Math.sin(a)*r;i?s.lineTo(x,y):s.moveTo(x,y);}s.closePath();return new THREE.ExtrudeGeometry(s,{depth:.12,bevelEnabled:true,bevelSegments:1,steps:1,bevelSize:.035,bevelThickness:.035});}
export class RaceWorld{
 constructor(canvas,labelCanvas){
  this.canvas=canvas;this.labels=labelCanvas;this.ctx=labelCanvas.getContext('2d');this.renderer=new THREE.WebGLRenderer({canvas,antialias:true,alpha:false,powerPreference:'high-performance'});this.renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));this.renderer.outputColorSpace=THREE.SRGBColorSpace;this.renderer.toneMapping=THREE.ACESFilmicToneMapping;this.renderer.toneMappingExposure=1.3;
  this.scene=new THREE.Scene();this.scene.fog=new THREE.FogExp2(0x536388,.0017);
  this.camera=new THREE.PerspectiveCamera(41,1,.1,1200);this.camera.position.set(0,45,80);
  this.scene.add(new THREE.HemisphereLight(0xd5e6ff,0xa66765,2.65));const key=new THREE.DirectionalLight(0xffe0ad,3.2);key.position.set(-30,45,35);this.scene.add(key);const rim=new THREE.DirectionalLight(0x8aaaff,2.5);rim.position.set(40,22,-30);this.scene.add(rim);
  this.sphere=new THREE.SphereGeometry(1,12,8);this.box=new THREE.BoxGeometry(1,1,1);this.cone=new THREE.ConeGeometry(1,2,12);this.cylinder=new THREE.CylinderGeometry(1,1,1,10);this.star=starGeometry();this.materialCache=new Map();this.temp=new THREE.Object3D();this.local=new THREE.Object3D();this.mat4=new THREE.Matrix4();this.vector=new THREE.Vector3();this.rootMatrix=new THREE.Matrix4();this.projected=[];this.camTarget=new THREE.Vector3();this.camPos=new THREE.Vector3();this.firstFrame=true;this.lastTime=0;
  this.env=new THREE.Group();this.scene.add(this.env);this.makeSky();
  this.resizeObserver=new ResizeObserver(()=>this.resize());this.resizeObserver.observe(canvas.parentElement);this.resize();
 }
 material(color,emissive=0){const key=`${color}-${emissive}`;if(!this.materialCache.has(key))this.materialCache.set(key,new THREE.MeshStandardMaterial({color,roughness:.77,metalness:.02,emissive,emissiveIntensity:emissive?.7:0}));return this.materialCache.get(key);}
 mesh(parent,geo,color,pos,scale,emissive=0){const m=new THREE.Mesh(geo,this.material(color,emissive));m.position.set(...pos);m.scale.set(...scale);parent.add(m);return m;}
 makeSky(){
  const geo=new THREE.SphereGeometry(850,24,16);const mat=new THREE.ShaderMaterial({side:THREE.BackSide,depthWrite:false,uniforms:{top:{value:new THREE.Color('#101b46')},bottom:{value:new THREE.Color('#b282b6')}},vertexShader:'varying vec3 v;void main(){v=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',fragmentShader:'uniform vec3 top;uniform vec3 bottom;varying vec3 v;void main(){float f=smoothstep(-.05,.65,normalize(v).y);gl_FragColor=vec4(mix(bottom,top,f),1.);}'});this.sky=new THREE.Mesh(geo,mat);this.scene.add(this.sky);
  const verts=[];let s=3461;const rand=()=>{s=(s*1664525+1013904223)>>>0;return s/4294967296;};for(let i=0;i<950;i++)verts.push((rand()-.5)*1400,45+rand()*380,-120-rand()*480);const stars=new THREE.BufferGeometry();stars.setAttribute('position',new THREE.Float32BufferAttribute(verts,3));this.scene.add(new THREE.Points(stars,new THREE.PointsMaterial({color:0xffe8b7,size:1.1,sizeAttenuation:true,transparent:true,opacity:.85})));
 }
 resize(){const r=this.canvas.parentElement.getBoundingClientRect();this.width=Math.max(1,r.width);this.height=Math.max(1,r.height);this.renderer.setSize(this.width,this.height,false);this.camera.aspect=this.width/this.height;this.camera.updateProjectionMatrix();const dpr=Math.min(devicePixelRatio,2);this.labels.width=this.width*dpr;this.labels.height=this.height*dpr;this.ctx.setTransform(dpr,0,0,dpr,0,0);this.labelDpr=dpr;}
 setQuality(value,count){this.quality=value;this.renderer.setPixelRatio(value==='low'?1:Math.min(devicePixelRatio,value==='high'?2:count>350?1:1.5));this.resize();}
 clearGroup(group){group.traverse(o=>{if(o.userData.disposableTexture){o.material.map?.dispose();o.material.dispose();o.geometry.dispose();}});group.clear();}
 setPlan(plan){this.plan=plan;this.clearGroup(this.env);if(this.actorGroup){this.actorGroup.traverse(o=>{if(o.isInstancedMesh)o.dispose();});this.scene.remove(this.actorGroup);for(const b of this.batches||[])for(const p of b.parts)if(p.face){p.mesh.material.map.dispose();p.mesh.material.dispose();p.mesh.geometry.dispose();}}this.createEnvironment();this.createActors();this.createProps();this.firstFrame=true;this.projected=[];}
 sign(text,x,y,z,width=17,height=5){const tex=canvasTexture(768,256,(c,w,h)=>{c.fillStyle='#fff2d2';c.fillRect(0,0,w,h);c.strokeStyle='#deb670';c.lineWidth=16;c.strokeRect(8,8,w-16,h-16);c.fillStyle='#263c65';c.font='900 77px "Malgun Gothic", sans-serif';c.textAlign='center';c.textBaseline='middle';c.fillText(text,w/2,h/2);});const m=new THREE.Mesh(new THREE.PlaneGeometry(width,height),new THREE.MeshStandardMaterial({map:tex,roughness:1,emissive:0xffe2b1,emissiveIntensity:.22}));m.position.set(x,y,z);m.userData.disposableTexture=true;this.env.add(m);return m;}
 createEnvironment(){const half=this.plan.lanes*2.65/2+2;this.halfTrack=half;
  this.mesh(this.env,this.box,0x536d5a,[280,-.32,0],[850,.6,220]);this.mesh(this.env,this.box,0xa65960,[260,-.02,0],[690,.12,half*2]);
  const verts=[];for(let i=0;i<=this.plan.lanes;i++){const z=(i-this.plan.lanes/2)*2.65;verts.push(-80,.05,z,605,.05,z);}const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(verts,3));this.env.add(new THREE.LineSegments(g,new THREE.LineBasicMaterial({color:0xf0c3b8,transparent:true,opacity:.52})));
  for(let x=-70;x<620;x+=10){this.mesh(this.env,this.box,x%20===0?0xf1d9b8:0xc26764,[x,.58,-half-2],[9.8,1.1,.5]);}
  for(let x=-30;x<640;x+=70){
   const z=-half-24,tree=new THREE.Group();tree.position.set(x,0,z);this.env.add(tree);this.mesh(tree,this.cylinder,0x876452,[0,3,0],[.75,6,.75]);this.mesh(tree,this.sphere,0x3f786c,[0,8,0],[4.8,5.5,4.8]);this.mesh(tree,this.sphere,0x669477,[2,7,1],[3.6,3.6,3.6]);
   const tent=new THREE.Group();tent.position.set(x+20,0,-half-12);this.env.add(tent);this.mesh(tent,this.box,0xe5b19a,[0,1.3,0],[10,2.6,5]);for(const dx of [-4.7,4.7])this.mesh(tent,this.cylinder,0xffdfaa,[dx,3,2],[.12,6,.12]);const roof=this.mesh(tent,new THREE.ConeGeometry(8,4,4),0xe995aa,[0,6,0],[1,1,.72]);roof.rotation.y=Math.PI/4;this.mesh(tent,this.box,0xffefcb,[0,3,2.7],[8,1.8,.1],0xe9a953);
  }
  for(let x=0;x<600;x+=160){const school=new THREE.Group();school.position.set(x,0,-half-64);this.env.add(school);this.mesh(school,this.box,0xb4a7bd,[0,10,0],[60,20,12]);this.mesh(school,this.box,0xe3bdac,[0,12,1],[15,24,15]);this.mesh(school,this.box,0x5b6587,[0,21,-1],[64,1.3,16]);for(let row=0;row<3;row++)for(let col=0;col<16;col++){if(col===7||col===8)continue;this.mesh(school,this.box,0xffde93,[-27+col*3.6,5+row*5,6.1],[1.8,2.6,.15],0xffc16d);}this.mesh(school,this.cylinder,0xeee4c9,[0,18,8.6],[2.1,.2,2.1]).rotation.x=Math.PI/2;this.mesh(school,this.box,0x636b81,[0,18.7,8.8],[.16,1.4,.1]);this.mesh(school,this.box,0x636b81,[.65,18.1,8.8],[1.4,.15,.1]);}
  for(let x=-65;x<635;x+=7){const y=8+Math.sin(x*.1)*.6;const star=this.mesh(this.env,this.star,0xffd884,[x,y,-half-4],[.46,.46,.46],0xffc45c);star.rotation.z=x*.08;if(x%21===0)this.mesh(this.env,this.cylinder,0xb5a5a2,[x,4,-half-4],[.09,8,.09]);}
  // Thousands of spectators are one instanced draw, behind the barrier.
  const n=550,heads=new THREE.InstancedMesh(this.sphere,this.material(0xffebce),n);let random=13;for(let i=0;i<n;i++){random=(random*16807)%2147483647;const x=-70+(i%110)*6.4,z=-half-6-Math.floor(i/110)*1.5;this.temp.position.set(x,1+(i%3)*.1,z);this.temp.scale.set(.48,.55,.42);this.temp.rotation.set(0,0,0);this.temp.updateMatrix();heads.setMatrixAt(i,this.temp.matrix);heads.setColorAt(i,new THREE.Color([0xffe2bc,0xf4eeff,0xbed7ef,0xffcfdd][i%4]));}this.env.add(heads);
  for(const x of [5,205,410]){this.sign('제24회 터누림제',x,9,-half-7,23,6);for(const dx of [-12,12])this.mesh(this.env,this.cylinder,0xeac68a,[x+dx,5,-half-7],[.18,10,.18]);}
  this.sign('FINISH',FINISH,9,0,2,1).visible=false;
  for(const z of [-half,half])this.mesh(this.env,this.box,0xffd99a,[FINISH,5,z],[.5,10,.5],0xc99958);this.mesh(this.env,this.box,0xffd99a,[FINISH,10,0],[.6,.8,half*2],0xbb7b40);
  for(let z=-half;z<half;z+=1.2)for(let r=0;r<3;r++)this.mesh(this.env,this.box,(Math.round((z+half)/1.2)+r)%2?0x33344c:0xffefcf,[FINISH+r*.8,.08,z],[.8,.03,1.2]);
  const polePositions=[-45,110,270,430,590];for(const x of polePositions){this.mesh(this.env,this.cylinder,0x8194a9,[x,11,-half-20],[.2,22,.2]);this.mesh(this.env,this.box,0xffefbd,[x,22,-half-20],[5,1,1],0xffe1a3);}
 }
 createActors(){this.actorGroup=new THREE.Group();this.scene.add(this.actorGroup);this.batches=[];
  for(let type=0;type<4;type++){
   const runners=this.plan.runners.filter(r=>r.type===type),parts=[];
   const add=(name,geo,col,pos,scale,extra={})=>{const m=new THREE.InstancedMesh(geo,this.material(col),Math.max(1,runners.length));m.count=runners.length;m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);m.frustumCulled=false;this.actorGroup.add(m);parts.push({name,mesh:m,pos,scale,...extra});};
   add('body',this.sphere,COLORS[type],[0,.78,0],[.65,.70,.53]);add('head',this.sphere,COLORS[type],[0,1.7,0],[1.02,.9,.74]);
   if(type===1){add('cap',this.sphere,0x80abe5,[0,2.13,-.04],[.96,.50,.70]);}
   if(type===3){add('hair',this.sphere,0xaac0ed,[0,2.18,-.04],[.86,.36,.61]);add('tail',this.sphere,0xccd6f1,[-.6,.85,-.6],[.85,.90,.7]);}
   for(const side of [-1,1]){
    const earY=type===2?2.9:2.4,earX=type===2?.48:.68;
    add('ear'+side,type===1?this.cone:this.sphere,type===1?0x85ade4:COLORS[type],[side*earX,earY,0],type===2?[.23,.8,.22]:type===1?[.31,.34,.28]:[.29,.38,.25]);
    if(type!==1)add('inner'+side,this.sphere,type===2?0xefb39c:0xedc8c8,[side*earX,earY,.18],type===2?[.12,.57,.05]:[.15,.24,.05]);
    add('arm',this.sphere,COLORS[type],[side*.65,.85,.23],[.24,.42,.25],{side});add('leg',this.sphere,COLORS[type],[side*.34,.22,.18],[.25,.28,.37],{side});
   }
   const faceMat=new THREE.MeshBasicMaterial({map:faceTexture(type),transparent:true,depthWrite:false,side:THREE.DoubleSide});const face=new THREE.InstancedMesh(new THREE.PlaneGeometry(1.65,1.22),faceMat,Math.max(1,runners.length));face.count=runners.length;face.instanceMatrix.setUsage(THREE.DynamicDrawUsage);face.frustumCulled=false;this.actorGroup.add(face);parts.push({name:'face',mesh:face,pos:[0,1.7,.729],scale:[1,1,1],face:true});
   const shadows=new THREE.InstancedMesh(new THREE.CircleGeometry(1,16),new THREE.MeshBasicMaterial({color:0x353052,transparent:true,opacity:.17,depthWrite:false}),Math.max(1,runners.length));shadows.count=runners.length;shadows.frustumCulled=false;this.actorGroup.add(shadows);
   this.batches.push({type,runners,parts,shadows});
  }
 }
 createProps(){if(this.props){this.scene.remove(this.props);this.props.traverse(o=>{if(o.geometry&&!['SphereGeometry','BoxGeometry'].includes(o.geometry.type))o.geometry.dispose();});}this.props=new THREE.Group();this.scene.add(this.props);this.propPools={};
  for(const type of ['banana','hurdle','pit','dig','spin']){const pool=[];for(let i=0;i<22;i++){const g=new THREE.Group();g.visible=false;this.props.add(g);
    if(type==='banana'){for(let j=0;j<3;j++){const b=this.mesh(g,this.sphere,0xffdc47,[Math.cos(j*TAU/3)*.4,.16,Math.sin(j*TAU/3)*.4],[.55,.12,.18]);b.rotation.y=-j*TAU/3;}this.mesh(g,this.cone,0xfed04b,[0,.3,0],[.12,.3,.12]);}
    if(type==='hurdle'){for(const z of [-.9,.9])this.mesh(g,this.box,0x83cbbb,[0,.6,z],[.2,1.2,.2]);this.mesh(g,this.box,0xffefce,[0,1.15,0],[.3,.3,2.1]);}
    if(type==='pit'||type==='dig'){this.mesh(g,this.sphere,0x4f3741,[0,.03,0],[1.05,.08,.85]);for(let j=0;j<6;j++)this.mesh(g,this.sphere,0x92604f,[Math.cos(j)*1,.15,Math.sin(j)*.8],[.23,.22,.25]);if(type==='dig'){this.mesh(g,this.cylinder,0xbb8b57,[.45,.75,0],[.06,1.3,.06]);this.mesh(g,this.box,0xdb7e67,[.45,.18,0],[.5,.35,.15]);}}
    if(type==='spin'){this.mesh(g,this.cylinder,0xb18bc6,[0,.75,0],[.3,1.5,.3]);const arm=this.mesh(g,this.box,0xeec36c,[0,1.1,0],[3.3,.25,.3]);g.userData.arm=arm;}
    pool.push(g);
  }this.propPools[type]=pool;}
 }
 update(t,ranking,options={}){
  if(!this.plan)return;const sceneT=options.idle?0:t,zoom=options.idle?.25:cameraPhase(t),selected=this.plan.runners.find(r=>r.id===options.follow),lead=selected??ranking[0]??this.plan.runners[0];
  const farX=(positionAt(ranking[0],sceneT)+positionAt(ranking.at(-1),sceneT))/2;
  const leadX=positionAt(lead,sceneT);const targetX=lerp(farX,leadX-6,zoom),compress=1-zoom*.73;
  const targetZ=selected?selected.z*compress:0;
  const portrait=this.width/this.height<1,wideZ=62+this.plan.lanes*1.1,closeZ=portrait?33:22;
  this.camTarget.set(targetX,zoom>0.8?1.5:0,targetZ);this.camPos.set(targetX+lerp(8,4,zoom),lerp(39+this.plan.lanes*.3,10,zoom),targetZ+lerp(wideZ,closeZ,zoom));
  const blend=this.firstFrame?1:.065;this.camera.position.lerp(this.camPos,blend);if(!this.lookTarget)this.lookTarget=this.camTarget.clone();this.lookTarget.lerp(this.camTarget,blend);this.camera.lookAt(this.lookTarget);this.firstFrame=false;this.sky.position.x=this.camera.position.x;this.camera.updateMatrixWorld();
  const topIds=new Set(ranking.slice(0,10).map(r=>r.id)),events=[];this.projected.length=0;
  const animTime=options.animTime??t;
  for(const batch of this.batches){for(let k=0;k<batch.runners.length;k++){
    const r=batch.runners[k],x=positionAt(r,sceneT),e=options.idle?null:eventAt(r,t),u=e?clamp((t-e.at)/e.duration,0,1):0;
    const step=animTime*(e?.type==='boost'?23:15)+r.phase;let y=Math.abs(Math.sin(step))*.14,rz=0,ry=.55,sc=1,z=r.z*compress;
    if(e){events.push({r,e,u,z});if(e.type==='hurdle')y+=Math.sin(u*Math.PI)*2.4;if(e.type==='banana'){rz=-Math.sin(u*Math.PI)*1.35;y+=Math.sin(u*Math.PI)*.15;}if(e.type==='tumble'){rz=-u*TAU;y+=Math.sin(u*Math.PI)*.4;z+=Math.sin(u*TAU)*.5;}if(e.type==='pit'){y-=Math.sin(u*Math.PI)*1.4;sc=1-.2*Math.sin(u*Math.PI);}if(e.type==='dig'){rz=.45*Math.sin(u*Math.PI);y=0;}if(e.type==='spin'){ry+=u*TAU*2;y+=Math.sin(u*Math.PI)*.6;}if(e.type==='boost')rz=-.15;}
    if(t>=r.finish){y=Math.abs(Math.sin(animTime*10+r.phase))*.5;rz=Math.sin(animTime*9)*.08;}
    this.temp.position.set(x,y,z);this.temp.rotation.set(0,ry,rz);this.temp.scale.setScalar(sc);this.temp.updateMatrix();this.rootMatrix.copy(this.temp.matrix);
    for(const p of batch.parts){this.local.position.set(...p.pos);this.local.scale.set(...p.scale);this.local.rotation.set(0,0,0);
      if(p.name==='leg'){this.local.position.z+=Math.sin(step+p.side*Math.PI/2)*.27;this.local.rotation.x=Math.sin(step+p.side*Math.PI/2)*.65;}
      if(p.name==='arm'){this.local.rotation.x=Math.sin(step-p.side*Math.PI/2)*.8;this.local.position.z+=Math.sin(step-p.side*Math.PI/2)*.15;if(e?.type==='banana'||e?.type==='pit')this.local.rotation.z=p.side*1.8;if(t>=r.finish)this.local.rotation.z=p.side*2.6;}
      if(p.name.startsWith('ear')&&batch.type===2)this.local.rotation.z=Math.sin(step*.5)*.1;
      this.local.updateMatrix();this.mat4.multiplyMatrices(this.rootMatrix,this.local.matrix);p.mesh.setMatrixAt(k,this.mat4);
    }
    this.temp.position.set(x,.07,z);this.temp.rotation.set(-Math.PI/2,0,0);this.temp.scale.set(1.05,.72,1);this.temp.updateMatrix();batch.shadows.setMatrixAt(k,this.temp.matrix);
    this.vector.set(x,3.1+y,z).project(this.camera);
    if(this.vector.z>-1&&this.vector.z<1&&Math.abs(this.vector.x)<1.12&&Math.abs(this.vector.y)<1.1){this.projected.push({r,x:(this.vector.x*.5+.5)*this.width,y:(-.5*this.vector.y+ .5)*this.height,depth:this.vector.z,e,u,top:topIds.has(r.id),selected:r.id===options.follow});}
   }for(const p of batch.parts)p.mesh.instanceMatrix.needsUpdate=true;batch.shadows.instanceMatrix.needsUpdate=true;}
  for(const pool of Object.values(this.propPools))for(const p of pool)p.visible=false;
  const used={};for(const {e,z,u} of events){const pool=this.propPools[e.type];if(!pool)continue;const i=used[e.type]||0;if(i>=pool.length)continue;const g=pool[i];used[e.type]=i+1;g.visible=true;g.position.set(e.x,0,z);if(g.userData.arm)g.userData.arm.rotation.y=t*6;}
  this.renderer.render(this.scene,this.camera);this.drawLabels(t,zoom,options);this.lastTime=t;
 }
 drawLabels(t,zoom,options){const c=this.ctx,w=this.width,h=this.height;c.clearRect(0,0,w,h);const reveal=t>=45,placed=[],size=clamp(9+zoom*5,9,14),maxLabels=zoom>.8?60:zoom>.4?150:this.quality==='low'?180:420;
  const sorted=[...this.projected].sort((a,b)=>(b.selected-a.selected)||(b.top-a.top)||a.depth-b.depth);this.labelHits=[];let count=0;
  for(const p of sorted){if(count>=maxLabels)break;const {r}=p;const large=p.top||p.selected,fs=large?size+2:size,number=String(r.number).padStart(2,'0')+(large?'번':''),line=reveal?`${r.grade}학년 ${r.classroom}반`:'';c.font=`900 ${fs}px "Malgun Gothic",sans-serif`;let tw=c.measureText(number).width+13+(large?15:0);if(reveal){c.font=`700 ${Math.max(8,fs-4)}px "Malgun Gothic",sans-serif`;tw=Math.max(tw,c.measureText(line).width+12);}const th=reveal?fs*1.95:fs+9;let x=clamp(p.x-tw/2,2,w-tw-2),y=p.y-th-2;
    if(y<62||y>h-42||x>w-2)continue;
    let tries=0;const overlap=()=>placed.some(q=>x<q.x+q.w+1&&x+tw+1>q.x&&y<q.y+q.h+1&&y+th+1>q.y);
    while(tries<2&&overlap()){y-=th*.65;tries++;}if(y<62||(overlap()&&!large))continue;
    placed.push({x,y,w:tw,h:th});count++;c.strokeStyle=large?'#3e3a46':'#74646b';c.fillStyle=p.selected?'#ffdf85':'#fff8e8';c.lineWidth=large?1.8:1;
    c.beginPath();c.moveTo(p.x,p.y);c.lineTo(x+tw/2,y+th);c.stroke();c.beginPath();c.roundRect(x,y,tw,th,large?7:4);c.fill();c.stroke();c.textAlign='center';c.textBaseline='middle';
    if(reveal){c.fillStyle='#494050';c.font=`700 ${Math.max(8,fs-4)}px "Malgun Gothic",sans-serif`;c.fillText(line,x+tw/2,y+fs*.55);}
    const textY=y+(reveal?th-fs*.65:th/2);c.font=`900 ${fs}px "Malgun Gothic",sans-serif`;c.fillStyle='#272b39';c.fillText(number,x+tw/2+(large?7:0),textY);if(large){c.fillStyle=ACCENTS[r.type];c.font=`bold ${fs}px sans-serif`;c.fillText(ICONS[r.type],x+10,textY);}
    this.labelHits.push({x,y,w:tw,h:th,id:r.id});
  }
  // Screen-space effects are tied to each visible actor, including the distant pack.
  for(const p of this.projected){if(!p.e)continue;const {e,u}=p,x=p.x,y=p.y+14,sz=5+zoom*10;c.save();c.globalAlpha=Math.sin(u*Math.PI)*.8;
   if(e.type==='boost'){c.strokeStyle='#9ce8ff';c.lineWidth=1.5+zoom;for(let j=0;j<3;j++){c.beginPath();c.moveTo(x-7,y+j*3);c.lineTo(x-15-sz*2-j*3,y+j*3);c.stroke();}}
   else if(e.type==='banana'||e.type==='spin'){c.strokeStyle='#ffe598';c.lineWidth=1.5;c.beginPath();c.ellipse(x,y-8,sz,sz*.45,u*8,0,Math.PI*1.7);c.stroke();c.fillStyle='#ffe8a6';c.font=`${10+zoom*8}px sans-serif`;c.fillText('✦',x+sz,y-8);}
   else if(e.type==='tumble'||e.type==='dig'||e.type==='pit'){for(let j=0;j<4;j++){c.fillStyle=e.type==='dig'?'#c49168':'#f5dfc7';c.beginPath();c.arc(x+Math.sin(j*2+u*5)*sz,y+15-j*3,2+zoom*3,0,TAU);c.fill();}}
   c.restore();
  }
  if(t>=57.8&&t<59.25){c.fillStyle='rgba(8,17,37,.65)';c.fillRect(0,0,w,9);c.fillRect(0,h-9,w,9);}
  if(t>=60){for(let i=0;i<80;i++){const a=(options.animTime||t)*.65+i*1.76,x=(Math.sin(i*48.7)*.5+.5)*w,y=((a%4)/4)*h;c.fillStyle=['#ffe29a','#9fe0d8','#e9adc5','#a6bcf1'][i%4];c.save();c.translate(x,y);c.rotate(a+i);c.fillRect(-3,-2,6,4);c.restore();}}
 }
 hitTest(x,y){return this.labelHits?.find(p=>x>=p.x&&x<=p.x+p.w&&y>=p.y&&y<=p.y+p.h)?.id;}
}
