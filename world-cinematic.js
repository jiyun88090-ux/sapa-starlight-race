import * as THREE from './vendor/three.module.js';
import {RaceWorld as RearWorld} from './world-rear.js';
import {positionAt,lateralAt,cinemaTime,FINISH} from './engine.js';
import {CourseScenery} from './course-scenery.js';
import {StartingGrid} from './starting-grid.js';
import {getCharacterColor} from './character-colors.js';

export const COURSES=[
 {name:'별빛 운동장',icon:'✦',sky:'#737fa5',edge:'#efba7c',ground:'#518466'},
 {name:'축제의 거리',icon:'▰',sky:'#6b80ab',edge:'#e9bd87',ground:'#6a819b'},
 {name:'은하수 트랙',icon:'✧',sky:'#383562',edge:'#83cfe4',ground:'#4a477b'},
 {name:'별빛 결승길',icon:'★',sky:'#9482ad',edge:'#ffda99',ground:'#a087b9'}
];
const TAU=Math.PI*2,lerp=THREE.MathUtils.lerp,clamp=THREE.MathUtils.clamp;
const smooth=(a,b,t)=>{const u=clamp((t-a)/(b-a),0,1);return u*u*(3-2*u);};
const cut=(t,a,b,c,d)=>smooth(a,b,t)*(1-smooth(c,d,t));
function canvas(w,h){const c=document.createElement('canvas');c.width=w;c.height=h;return c;}
function map(c,repeatX=1,repeatY=1){const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;t.wrapS=t.wrapT=THREE.RepeatWrapping;t.repeat.set(repeatX,repeatY);t.anisotropy=4;return t;}
function random(seed){let s=seed;return()=>{s=(1664525*s+1013904223)>>>0;return s/4294967296;};}

// A continuous world-space course: texture changes never reset runner positions.
export class RaceWorld extends RearWorld{
 constructor(world,labels){
  super(world,labels);
  this.sideWeight=1;this.cameraMode='side';this.courseIndex=0;this.sceneTime=0;this.edgeMaterials=[];this.colorEnabled=true;
  this.courseBlend=-1;this.backgroundCanvas=canvas(1280,720);this.backgroundCtx=this.backgroundCanvas.getContext('2d');
  this.backgroundTexture=map(this.backgroundCanvas);this.backgroundTexture.wrapS=this.backgroundTexture.wrapT=THREE.ClampToEdgeWrapping;
  this.scene.fog=new THREE.Fog(COURSES[0].sky,95,260);
  this.setupSurfaces();this.setupConnectors();this.startGrid=new StartingGrid(this.scene);
  const ready=this.ready,loader=new THREE.TextureLoader();
  this.ready=Promise.all([ready,...['city-panorama','space-panorama','final-panorama','run-atlas','action-atlas','extra-rear-run','extra-rear-actions','extra-side-run','extra-side-actions','water-bubble-atlas'].map(n=>loader.loadAsync(`./assets/${n}.png`))]).then(([,city,space,final,sideRun,sideAction,extraRearRun,extraRearAction,extraSideRun,extraSideAction,bubble])=>{
   this.panoramas=[this.scene.background.image,city.image,space.image,final.image].map((img,index)=>this.colorPanorama(img,index));
   for(const t of [city,space,final,sideRun,sideAction,extraRearRun,extraRearAction,extraSideRun,extraSideAction]){t.colorSpace=THREE.SRGBColorSpace;t.anisotropy=4;}
   this.scene.background=this.backgroundTexture;
   this.bubbleImage=bubble.image;
   Object.assign(this.actorMat.uniforms,{sideRun:{value:sideRun},sideAction:{value:sideAction},sideBlend:{value:0},extraRearRun:{value:extraRearRun},extraRearAction:{value:extraRearAction},extraSideRun:{value:extraSideRun},extraSideAction:{value:extraSideAction}});
   this.actorMat.uniforms.tintStrength={value:this.colorEnabled?1:0};
   this.actorMat.vertexShader=`attribute vec3 pose;attribute vec3 characterColor;varying vec2 atlasUv;varying float actionSet;varying float family;varying vec3 runnerTint;
    void main(){vec2 p=uv*.98+.01;float row=mod(pose.y,4.);atlasUv=vec2((p.x+pose.x)/4.,(p.y+3.-row)/4.);actionSet=pose.z;family=step(4.,pose.y);runnerTint=characterColor;gl_Position=projectionMatrix*modelViewMatrix*instanceMatrix*vec4(position,1.);}`;
   this.actorMat.fragmentShader=`uniform sampler2D runAtlas;uniform sampler2D actionAtlas;
    uniform sampler2D sideRun;uniform sampler2D sideAction;uniform float sideBlend;
    uniform sampler2D extraRearRun;uniform sampler2D extraRearAction;uniform sampler2D extraSideRun;uniform sampler2D extraSideAction;
    uniform float tintStrength;varying vec3 runnerTint;varying vec2 atlasUv;varying float actionSet;varying float family;
    void main(){vec4 rear;vec4 side;
      if(family>.5){rear=actionSet>.5?texture2D(extraRearAction,atlasUv):texture2D(extraRearRun,atlasUv);side=actionSet>.5?texture2D(extraSideAction,atlasUv):texture2D(extraSideRun,atlasUv);}
      else{rear=actionSet>.5?texture2D(actionAtlas,atlasUv):texture2D(runAtlas,atlasUv);side=actionSet>.5?texture2D(sideAction,atlasUv):texture2D(sideRun,atlasUv);}
      float a=mix(rear.a,side.a,sideBlend);
      vec3 rgb=mix(rear.rgb*rear.a,side.rgb*side.a,sideBlend)/max(a,.001);
      float preserveInk=smoothstep(.12,.8,dot(rgb,vec3(.2126,.7152,.0722)));
      rgb*=mix(vec3(1.),runnerTint,tintStrength*preserveInk);
      if(a<.12)discard;gl_FragColor=vec4(rgb,a);
      #include <colorspace_fragment>
    }`;
   this.actorMat.needsUpdate=true;
   this.environment=new CourseScenery(this.scene);this.updateCourse(0,[],{idle:true});
  });
 }

 setColorEnabled(enabled){this.colorEnabled=!!enabled;if(this.actorMat?.uniforms.tintStrength)this.actorMat.uniforms.tintStrength.value=enabled?1:0;}
 setCameraMode(mode){if(['rear','side','leader'].includes(mode))this.cameraMode=mode;}
 colorPanorama(img,index){
  const c=canvas(img.width,img.height),x=c.getContext('2d');
  x.filter='saturate(1.22) contrast(1.025)';x.drawImage(img,0,0);x.filter='none';
  // A subtle colour wash also fills neutral, grey parts of the artwork.
  const wash=x.createLinearGradient(0,0,0,c.height);wash.addColorStop(0,['#8ba9dd','#88aed7','#8c7fcb','#c5a3d8'][index]);wash.addColorStop(1,['#91ba85','#ba9dc7','#7ca7cf','#d7a8c1'][index]);
  x.globalCompositeOperation='soft-light';x.globalAlpha=.18;x.fillStyle=wash;x.fillRect(0,0,c.width,c.height);x.globalCompositeOperation='source-over';x.globalAlpha=1;return c;
 }
 setPlan(plan){super.setPlan(plan);this.startGrid?.setPlan(plan);}
 makeActors(){
  super.makeActors();const values=new Float32Array(this.plan.count*3);
  this.plan.runners.forEach((r,i)=>values.set(getCharacterColor(r.colorVariant??Math.floor(r.index/8)).rgb,i*3));
  this.actors.geometry.setAttribute('characterColor',new THREE.InstancedBufferAttribute(values,3));
 }

 setupSurfaces(){
  this.roadImages=COURSES.map((_,i)=>this.makeRoadImage(i));
  this.groundImages=COURSES.map((_,i)=>this.makeGroundImage(i));
  this.roadCanvas=canvas(512,512);this.roadCtx=this.roadCanvas.getContext('2d');
  this.groundCanvas=canvas(512,512);this.groundCtx=this.groundCanvas.getContext('2d');
  this.roadMap=map(this.roadCanvas,1,80);this.groundMap=map(this.groundCanvas,12,70);
  this.road.material.map=this.roadMap;this.road.material.color.set('#ffffff');this.road.material.roughness=.86;this.road.material.needsUpdate=true;
  this.scene.remove(this.terrain);
  this.terrain=new THREE.Mesh(new THREE.PlaneGeometry(250,1400),new THREE.MeshStandardMaterial({map:this.groundMap,roughness:1,color:0xffffff}));
  this.terrain.rotation.x=-Math.PI/2;this.terrain.position.set(0,-.16,300);this.scene.add(this.terrain);
  // Low curbs retain depth without hiding the feet in the side camera.
  this.scenery.traverse(o=>{if(!o.isMesh)return;o.material=o.material.clone();this.edgeMaterials.push(o.material);
   if(o.geometry===this.box){o.position.y=.26;o.scale.y=.52;}else if(o.geometry===this.sphere)o.position.y=.8;
  });
  this.roadLights=new THREE.Group();this.scene.add(this.roadLights);
  const lampMat=new THREE.MeshBasicMaterial({color:'#ffe3a7'}),lampGeo=new THREE.BoxGeometry(.12,.025,1.2);
  for(let z=-70;z<690;z+=6)for(const s of [-1,1]){const m=new THREE.Mesh(lampGeo,lampMat);m.position.set(s*14.25,.01,z);this.roadLights.add(m);}
 }

 makeRoadImage(index){
  const c=canvas(512,512),x=c.getContext('2d'),rand=random(213+index*77);
  x.fillStyle=['#a95b58','#4c6684','#51457b','#a482b1'][index];x.fillRect(0,0,512,512);
  for(let i=0;i<18000;i++){x.fillStyle=i%3?'rgba(255,227,196,.09)':'rgba(16,12,37,.15)';x.fillRect(rand()*512,rand()*512,rand()*2+1,1);}
  const g=x.createLinearGradient(0,0,512,0);g.addColorStop(0,['#f5c77d77','#a1a9c444','#79dcff77','#ffe8ac88'][index]);g.addColorStop(.18,'#ffffff00');g.addColorStop(.82,'#ffffff00');g.addColorStop(1,['#f5c77d77','#a1a9c444','#79dcff77','#ffe8ac88'][index]);x.fillStyle=g;x.fillRect(0,0,512,512);
  x.fillStyle=['#f8dfb5','#edcd93','#a6e7ff','#ffefb5'][index];x.fillRect(10,0,3,512);x.fillRect(499,0,3,512);
  if(index===0){x.fillStyle='#f4e2c328';for(let j=1;j<6;j++)x.fillRect(j*512/6,0,1,512);x.fillStyle='#edcfb075';x.fillRect(0,0,512,3);}
  if(index===1){x.fillStyle='#f9db98';for(let y=18;y<512;y+=128){x.fillRect(252,y,3,68);x.fillRect(258,y,3,68);}x.fillStyle='#c9d0df40';for(const px of [130,382])for(let y=20;y<512;y+=128)x.fillRect(px,y,2,64);}
  if(index===2){x.strokeStyle='#b9deff55';x.lineWidth=2;for(let y=0;y<512;y+=128){x.beginPath();x.moveTo(15,y);x.lineTo(125,y+12);x.lineTo(387,y+12);x.lineTo(497,y);x.stroke();}for(let i=0;i<65;i++){x.fillStyle=i%4?'#bce7ff88':'#fff2bb';x.fillRect(rand()*480+16,rand()*512,1.5,1.5);}}
  if(index===3){x.strokeStyle='#ffe9b766';x.lineWidth=2;for(let y=0;y<512;y+=128){x.beginPath();x.moveTo(16,y+10);x.quadraticCurveTo(256,y+60,496,y+10);x.stroke();}x.font='25px serif';x.textAlign='center';x.fillStyle='#ffe9b74d';for(let y=60;y<512;y+=128)x.fillText('✦',256,y);}
  return c;
 }

 makeGroundImage(index){
  const c=canvas(512,512),x=c.getContext('2d'),rand=random(470+index*51);
  x.fillStyle=COURSES[index].ground;x.fillRect(0,0,512,512);
  for(let i=0;i<90;i++){const px=rand()*512,py=rand()*512,r=rand()*68+14,g=x.createRadialGradient(px,py,0,px,py,r);g.addColorStop(0,index===0?'#b2ac6d40':index===2?'#9b78c72b':'#d3c1cc25');g.addColorStop(1,'#ffffff00');x.fillStyle=g;x.fillRect(px-r,py-r,r*2,r*2);}
  for(let i=0;i<13000;i++){const px=rand()*512,py=rand()*512;x.fillStyle=index===0?['#b7ae6a44','#3e503b55','#d2ba8044','#8a9e6355'][i%4]:['#ffffff16','#14183023'][i%2];x.fillRect(px,py,index===0?1:2,rand()*3+1);}
  if(index===0){for(let i=0;i<50;i++){x.fillStyle=i%3?'#dacc9b99':'#e8b8b399';x.beginPath();x.arc(rand()*512,rand()*512,rand()*1.7+.6,0,TAU);x.fill();}}
  if(index===1){x.strokeStyle='#323e5238';x.lineWidth=2;for(let p=0;p<=512;p+=64){x.beginPath();x.moveTo(p,0);x.lineTo(p,512);x.moveTo(0,p);x.lineTo(512,p);x.stroke();}}
  if(index>=2){for(let i=0;i<90;i++){x.fillStyle=i%3?'#cfe0ff88':'#fff2c7bb';x.fillRect(rand()*512,rand()*512,1,1);}}
  return c;
 }

 setupConnectors(){
  // Keep the ground's finish stripe and replace every overhead banner with flags.
  for(const child of [...this.finishGate.children])if(child.geometry!==this.box)this.finishGate.remove(child);
  this.distanceFlags=new THREE.Group();this.scene.add(this.distanceFlags);
  const poleMat=new THREE.MeshStandardMaterial({color:'#e5d3ae',roughness:.55});
  for(const remaining of [500,400,300,200,150,100,50,25,10,0]){
   const c=canvas(512,288),x=c.getContext('2d'),near=remaining<=100;
   x.fillStyle=near?'#f4cf80':'#4b6984';x.beginPath();x.moveTo(6,6);x.lineTo(506,6);x.lineTo(460,144);x.lineTo(506,282);x.lineTo(6,282);x.closePath();x.fill();
   x.strokeStyle=near?'#fff0c9':'#c9e0eb';x.lineWidth=8;x.stroke();
   if(!remaining){x.save();x.clip();for(let row=0;row<6;row++)for(let col=0;col<10;col++){x.fillStyle=(row+col)%2?'#384256':'#fff0ce';x.fillRect(col*52,row*48,52,48);}x.restore();}
   else{x.textAlign='center';x.textBaseline='middle';x.font='400 113px "Race Jua",sans-serif';x.fillStyle=near?'#433831':'#fff6dc';x.fillText(`${remaining}m`,244,148);}
   const flagMap=map(c);flagMap.wrapS=flagMap.wrapT=THREE.ClampToEdgeWrapping;
   const material=new THREE.MeshBasicMaterial({map:flagMap,transparent:true,alphaTest:.1,side:THREE.DoubleSide});
   for(const side of [-1,1]){
    const group=new THREE.Group();group.position.set(side*16.5,0,FINISH-remaining);this.distanceFlags.add(group);
    const pole=new THREE.Mesh(new THREE.CylinderGeometry(.055,.085,4.4,10),poleMat);pole.position.y=2.2;group.add(pole);
    const flag=new THREE.Mesh(new THREE.PlaneGeometry(3.2,1.8),material);flag.position.set(-1.1,3.35,1.1);flag.rotation.y=-Math.PI*.75;group.add(flag);
    const cap=new THREE.Mesh(new THREE.SphereGeometry(.12,10,8),poleMat);cap.position.y=4.42;group.add(cap);
   }
  }
 }

 cameraSide(t){if(this.cameraMode==='rear')return 0;if(this.cameraMode==='side'||this.cameraMode==='leader')return 1;return 1-Math.max(cut(t,22,23.4,26,27.4),cut(t,36,37.4,40,41.4));}

 updateCourse(t,ranking,options){
  if(!this.panoramas)return;
  this.startGrid.update({phase:options.phase??(options.idle?'idle':'racing'),time:t,countdown:options.countdown??0,animTime:options.animTime??t});
  const time=options.idle?0:(options.raceTime??cinemaTime(t));this.sceneTime=time;
  const stage=Math.min(3,Math.floor(t/15)),previous=Math.max(0,stage-1),mix=stage?smooth(stage*15,stage*15+1.7,t):1;
  if(options.cameraMode)this.setCameraMode(options.cameraMode);
  this.courseIndex=stage;this.sideWeight=lerp(this.sideWeight,this.cameraSide(options.idle?0:t),.13);this.currentLeader=ranking[0]??null;
  this.actorMat.uniforms.sideBlend.value=smooth(.28,.78,this.sideWeight);
  const blendKey=`${stage}:${Math.round(mix*80)}`;
  if(blendKey!==this.courseBlend){
   for(const [ctx,images,texture] of [[this.roadCtx,this.roadImages,this.roadMap],[this.groundCtx,this.groundImages,this.groundMap]]){ctx.globalAlpha=1;ctx.drawImage(images[previous],0,0);ctx.globalAlpha=mix;ctx.drawImage(images[stage],0,0);ctx.globalAlpha=1;texture.needsUpdate=true;}
   const edge=new THREE.Color(COURSES[previous].edge).lerp(new THREE.Color(COURSES[stage].edge),mix);
   for(const m of this.edgeMaterials){m.color.copy(edge);if(m.emissiveIntensity)m.emissive.copy(edge);}
   this.scene.fog.color.set(COURSES[previous].sky).lerp(new THREE.Color(COURSES[stage].sky),mix);
   this.courseBlend=blendKey;
  }
  const lead=ranking[0],distance=lead?positionAt(lead,time):0;
  this.paintBackground(previous,stage,mix,distance);
  this.environment?.update({camera:this.camera,distance,stage,previous,mix,sideWeight:this.sideWeight,time});
 }

 paintBackground(previous,stage,mix,distance){
  const c=this.backgroundCtx,w=this.backgroundCanvas.width,h=this.backgroundCanvas.height;
  const draw=(index,alpha)=>{
   const img=this.panoramas[index];if(!img)return;c.globalAlpha=alpha;
   // Stadium artwork is cropped above its painted track so there is only one road.
   const sourceH=index===0?img.height*.7:img.height;
   const scale=Math.max(w/img.width,h/sourceH)*1.25,dw=img.width*scale,dh=sourceH*scale;
   // The distant sky barely translates. Rotation follows the actual camera,
   // while roadside geometry supplies the fast movement and perspective.
   const yaw=Math.atan2(this.lookTarget.x-this.camera.position.x,this.lookTarget.z-this.camera.position.z);
   const drift=distance*.012+yaw*w*.065,offset=clamp((dw-w)*.3+drift,0,dw-w);
   const y=(h-dh)*.48;
   c.drawImage(img,0,0,img.width,sourceH,-offset,y,dw,dh);
  };
  c.clearRect(0,0,w,h);draw(previous,1);if(stage!==previous)draw(stage,mix);c.globalAlpha=1;
  const haze=c.createLinearGradient(0,h*.65,0,h);haze.addColorStop(0,'#ffffff00');haze.addColorStop(1,COURSES[stage].sky+'88');c.fillStyle=haze;c.fillRect(0,h*.65,w,h*.35);
  this.backgroundTexture.needsUpdate=true;
 }

 setCinematicCamera(t,ranking,options){
  if(!ranking.length)return;
  const time=options.idle?0:(options.raceTime??cinemaTime(t)),weight=this.sideWeight,leaderMode=this.cameraMode==='leader';
  const followed=options.follow&&t<50?this.plan.runners.find(r=>r.id===options.follow):null;
  if(this.cameraMode==='side'&&!followed){
   this.frameWholePack(time,weight);
   this.finishGate.children.forEach(o=>{if(o.isMesh&&o.geometry===this.cyl)o.visible=!(weight>.6&&o.position.x<0);});
   return;
  }
  const wide=leaderMode?0:1-smooth(20,49,t),close=leaderMode?1:smooth(49,55,t),lock=leaderMode?0:smooth(54,56,t);
  const leadZ=positionAt(ranking[0],time),tailZ=positionAt(ranking.at(-1),time);
  let z=leaderMode?leadZ-1:followed?positionAt(followed,time):lerp(leadZ-8,(leadZ+tailZ)*.5,wide);
  let x=leaderMode?lateralAt(ranking[0],time):followed?lateralAt(followed,time):0;
  z=lerp(z,FINISH-4,lock);x=lerp(x,0,lock);
  const distance=(leaderMode?28:lerp(lerp(42,58,wide),35,close))*Math.max(1,.9/this.camera.aspect);
  const sidePos=new THREE.Vector3(x-distance,leaderMode?16:lerp(lerp(21,29,wide),18,close),z-distance*.16);
  const sideTarget=new THREE.Vector3(x,lerp(1.8,2.4,close),z);
  this.camPos.lerp(sidePos,weight);this.camTarget.lerp(sideTarget,weight);
  this.camera.fov=lerp(45,40,close*weight);this.camera.updateProjectionMatrix();
  // Avoid a finish arch between the side camera and the front runners.
  this.finishGate.children.forEach(o=>{if(o.isMesh&&o.geometry===this.cyl)o.visible=!(weight>.6&&o.position.x<0);});
 }

 frameWholePack(time,weight){
  // Fit only the occupied racing area. A compact pack gets a closer shot;
  // a stretched field opens the framing just enough to include the last runner.
  if(!this.packFrame){
   const back=new THREE.Vector3(-1,.5,-.14).normalize(),right=new THREE.Vector3(back.z,0,-back.x).normalize();
   this.packFrame={back,right,up:new THREE.Vector3().crossVectors(back,right),position:new THREE.Vector3(),target:new THREE.Vector3()};
  }
  let minX=Infinity,maxX=-Infinity,minZ=Infinity,maxZ=-Infinity;
  for(const runner of this.plan.runners){const x=lateralAt(runner,time),z=positionAt(runner,time);minX=Math.min(minX,x);maxX=Math.max(maxX,x);minZ=Math.min(minZ,z);maxZ=Math.max(maxZ,z);}
  const f=this.packFrame,tx=(minX+maxX)/2,tz=(minZ+maxZ)/2,ty=2.8;
  const tan=Math.tan(THREE.MathUtils.degToRad(45*.5)),aspect=Math.max(.35,this.camera.aspect);
  let distance=43;
  for(const x of [minX-2,maxX+2])for(const y of [0,7.2])for(const z of [minZ-2,maxZ+2]){
   const dx=x-tx,dy=y-ty,dz=z-tz,depth=dx*f.back.x+dy*f.back.y+dz*f.back.z;
   const horizontal=Math.abs(dx*f.right.x+dy*f.right.y+dz*f.right.z)/(tan*aspect*.87);
   const vertical=Math.abs(dx*f.up.x+dy*f.up.y+dz*f.up.z)/(tan*.76);
   distance=Math.max(distance,depth+Math.max(horizontal,vertical)+1.5);
  }
  f.target.set(tx,ty,tz);f.position.copy(f.back).multiplyScalar(distance).add(f.target);
  this.camPos.lerp(f.position,weight);this.camTarget.lerp(f.target,weight);
  this.camera.fov=45;this.camera.updateProjectionMatrix();
 }

 drawOverlay(t,zoom,options){
  super.drawOverlay(t,zoom,options);
  const c=this.ctx,w=this.width,h=this.height,lead=this.currentLeader;
  const p=lead&&this.projected.find(p=>p.r.id===lead.id);
  if(p&&!options.idle){
   const radius=clamp(Math.abs(p.fy-p.y)*.4,14,54);
   c.save();c.strokeStyle='#ffe6a1';c.lineWidth=2.5;c.shadowColor='#ffd165';c.shadowBlur=13;
   c.beginPath();c.ellipse(p.fx,p.fy+3,radius,radius*.28,0,0,TAU);c.stroke();c.shadowBlur=0;
   const fs=w<600?11:15,labelX=p.labelX??p.x,labelBottom=p.labelY??p.y;
   const badgeW=68,badgeH=27,bx=clamp(labelX-badgeW/2,8,w-badgeW-8),by=clamp(labelBottom-(fs+10)-(t>=45&&p.r.grade?fs+2:0)-badgeH-6,108,h-110);
   c.fillStyle='#ffdc85';c.strokeStyle='#806035';c.lineWidth=1.5;c.beginPath();c.roundRect(bx,by,badgeW,badgeH,10);c.fill();c.stroke();c.fillStyle='#443018';c.textAlign='center';c.textBaseline='middle';c.font='400 15px "Race Jua",sans-serif';c.fillText('♛ 1위',bx+badgeW/2,by+badgeH/2);
   c.restore();
  }
  if(t>=56&&t<60){
   const a=smooth(56,56.5,t);c.fillStyle=`rgba(12,16,35,${.7*a})`;c.fillRect(0,0,w,12);c.fillRect(0,h-12,w,12);
  }
  // Local bursts at each crossing keep the finish readable without camera shake.
  if(!options.idle&&t>=56){
   const time=options.raceTime??cinemaTime(t),colors=['#ffe29a','#e0eaff','#f2bb96','#c1dfed','#e2c9f1'];
   for(const runner of this.plan.runners){
    if(runner.rank>=5)continue;const age=time-runner.finish;if(age<0||age>.34)continue;
    const u=age/.34;
    this.v.set(lateralAt(runner,runner.finish),1.1,FINISH).project(this.camera);
    const px=(this.v.x*.5+.5)*w,py=(-this.v.y*.5+.5)*h;
    c.save();c.globalAlpha=(1-u)*.88;c.fillStyle=colors[runner.rank];c.shadowColor=colors[runner.rank];c.shadowBlur=6;
    const count=runner.rank===0?24:12;
    for(let j=0;j<count;j++){
     const angle=j*2.399+runner.rank,reach=(45+j%4*13)*u;
     c.save();c.translate(px+Math.cos(angle)*reach,py-Math.abs(Math.sin(angle))*reach*1.45+u*u*45);c.rotate(angle+u*3);c.fillRect(-2,-3,4,6);c.restore();
    }
    c.restore();
   }
  }
 }
}
