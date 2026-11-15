import * as THREE from './vendor/three.module.js';
import {ObstacleCourse} from './obstacle-course.js';
import {positionAt,eventAt,lateralAt,cameraPhase,identity,FINISH} from './engine.js';
const TAU=Math.PI*2,lerp=THREE.MathUtils.lerp,clamp=THREE.MathUtils.clamp;
const ACCENTS=['#e987a5','#72b9ff','#ffd15e','#c8a7ef','#ddaf87','#91d7b4','#f6b9cb','#94c8df'];
function texture(w,h,draw){const c=document.createElement('canvas');c.width=w;c.height=h;draw(c.getContext('2d'),w,h);const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;return t;}
export class RaceWorld{
 constructor(canvas,labels){this.canvas=canvas;this.labels=labels;this.ctx=labels.getContext('2d');this.renderer=new THREE.WebGLRenderer({canvas,antialias:true,powerPreference:'high-performance'});this.renderer.outputColorSpace=THREE.SRGBColorSpace;this.renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));this.scene=new THREE.Scene();this.camera=new THREE.PerspectiveCamera(45,1,.1,900);this.scene.add(new THREE.HemisphereLight(0xd2e3ff,0x7e424b,2));const key=new THREE.DirectionalLight(0xffe1a0,2.7);key.position.set(-15,25,-10);this.scene.add(key);this.temp=new THREE.Object3D();this.v=new THREE.Vector3();this.camTarget=new THREE.Vector3();this.camPos=new THREE.Vector3();this.lookTarget=new THREE.Vector3();this.sphere=new THREE.SphereGeometry(1,20,12);this.box=new THREE.BoxGeometry(1,1,1);this.cyl=new THREE.CylinderGeometry(1,1,1,24);this.cone=new THREE.ConeGeometry(1,1,16);this.materials=new Map();this.firstFrame=true;this.assetReady=false;this.projected=[];this.quality='auto';
  this.makeTrack();const loader=new THREE.TextureLoader();this.ready=Promise.all([loader.loadAsync('./assets/rear-stadium.png'),loader.loadAsync('./assets/rear-run.png'),loader.loadAsync('./assets/rear-actions.png')]).then(([bg,run,action])=>{for(const t of [bg,run,action]){t.colorSpace=THREE.SRGBColorSpace;t.anisotropy=4;}this.scene.background=bg;this.actorMat=new THREE.ShaderMaterial({uniforms:{runAtlas:{value:run},actionAtlas:{value:action}},transparent:true,side:THREE.DoubleSide,depthWrite:true,
    vertexShader:`attribute vec3 pose;varying vec2 atlasUv;varying float actionSet;void main(){vec2 p=uv*.98+.01;atlasUv=vec2((p.x+pose.x)/4.,(p.y+3.-pose.y)/4.);actionSet=pose.z;gl_Position=projectionMatrix*modelViewMatrix*instanceMatrix*vec4(position,1.);}`,
    fragmentShader:`uniform sampler2D runAtlas;uniform sampler2D actionAtlas;varying vec2 atlasUv;varying float actionSet;void main(){vec4 c=actionSet>.5?texture2D(actionAtlas,atlasUv):texture2D(runAtlas,atlasUv);if(c.a<.12)discard;gl_FragColor=c;
    #include <colorspace_fragment>
    }`});this.assetReady=true;if(this.plan)this.makeActors();});
  this.resizeObserver=new ResizeObserver(()=>this.resize());this.resizeObserver.observe(canvas.parentElement);this.resize();
 }
 material(col,glow=false){const id=col+'-'+glow;if(!this.materials.has(id))this.materials.set(id,new THREE.MeshStandardMaterial({color:col,roughness:.55,metalness:.05,emissive:glow?col:0,emissiveIntensity:glow?.7:0}));return this.materials.get(id);}
 mesh(parent,geo,col,pos,scale,glow=false){const m=new THREE.Mesh(geo,this.material(col,glow));m.position.set(...pos);m.scale.set(...scale);parent.add(m);return m;}
 resize(){const r=this.canvas.parentElement.getBoundingClientRect();this.width=Math.max(r.width,1);this.height=Math.max(r.height,1);this.renderer.setSize(this.width,this.height,false);this.camera.aspect=this.width/this.height;this.camera.updateProjectionMatrix();const d=Math.min(devicePixelRatio,2);this.labels.width=this.width*d;this.labels.height=this.height*d;this.ctx.setTransform(d,0,0,d,0,0);this.labelAnchors?.clear();}
 setQuality(q,count){this.quality=q;this.renderer.setPixelRatio(q==='low'?1:Math.min(devicePixelRatio,q==='high'?2:1.5));this.resize();}
 makeTrack(){
  const tex=texture(512,512,(c,w,h)=>{c.fillStyle='#a84b51';c.fillRect(0,0,w,h);let s=31;for(let i=0;i<17000;i++){s=(s*1664525+1013904223)>>>0;const x=s%512;s=(s*1664525+1013904223)>>>0;const y=s%512;c.fillStyle=i%3?'rgba(246,174,136,.10)':'rgba(39,14,39,.12)';c.fillRect(x,y,1+(i%2),1);}const g=c.createLinearGradient(0,0,w,0);g.addColorStop(0,'#f3ad4a55');g.addColorStop(.18,'#ffa24900');g.addColorStop(.85,'#ffc35200');g.addColorStop(1,'#ffb43e55');c.fillStyle=g;c.fillRect(0,0,w,h);c.fillStyle='#ffe4cba8';c.fillRect(8,0,3,h);c.fillRect(w-11,0,3,h);for(let i=1;i<6;i++){c.fillStyle='#ffe3cf28';c.fillRect(i*w/6,0,1,h);}c.fillStyle='#efccab33';c.fillRect(0,0,w,2);});tex.wrapS=tex.wrapT=THREE.RepeatWrapping;tex.repeat.set(1,80);
  this.road=new THREE.Mesh(new THREE.PlaneGeometry(29,1400),new THREE.MeshStandardMaterial({map:tex,roughness:.75,metalness:.05}));this.road.rotation.x=-Math.PI/2;this.road.position.set(0,-.08,300);this.scene.add(this.road);
  this.terrain=this.mesh(this.scene,this.box,0x667268,[0,-.4,300],[250,.5,1400]);
  this.scenery=new THREE.Group();this.scene.add(this.scenery);for(let z=-70;z<680;z+=9){for(const side of [-1,1]){this.mesh(this.scenery,this.box,Math.round(z/9)%2?0xcc736c:0xf5dfb9,[side*15,.7,z],[.45,1.4,8.7]);this.mesh(this.scenery,this.sphere,0xffd38a,[side*15,1.65,z],[.15,.15,.15],true);if(z%27===2){this.mesh(this.scenery,this.cyl,0xd2ac70,[side*17,4.5,z],[.08,9,.08]);this.mesh(this.scenery,this.sphere,0xffd45b,[side*17,9,z],[.4,.4,.4],true);}}}
  this.finishGate=new THREE.Group();this.finishGate.position.z=FINISH;this.scene.add(this.finishGate);for(const x of [-13.5,13.5]){this.mesh(this.finishGate,this.cyl,0xf0c46b,[x,4.6,0],[.42,9.2,.42],true);for(let y=1;y<9;y+=1.2)this.mesh(this.finishGate,this.sphere,0xffe68f,[x,y,-.4],[.15,.15,.15],true);}
  const signTex=texture(1024,180,(c,w,h)=>{c.fillStyle='#b7474c';c.fillRect(0,0,w,h);c.strokeStyle='#ffe3a0';c.lineWidth=15;c.strokeRect(7,7,w-14,h-14);c.fillStyle='#fff1c7';c.font='900 115px sans-serif';c.textAlign='center';c.textBaseline='middle';c.fillText('★  FINISH  ★',w/2,h/2);});const sign=new THREE.Mesh(new THREE.PlaneGeometry(27,4.5),new THREE.MeshBasicMaterial({map:signTex,side:THREE.DoubleSide}));sign.position.y=9;sign.rotation.y=Math.PI;this.finishGate.add(sign);
  for(let x=-13.5;x<13.5;x+=1.5)for(let row=0;row<3;row++)this.mesh(this.finishGate,this.box,(Math.round((x+13.5)/1.5)+row)%2?0x342e43:0xfff0ce,[x,.015,row*.7],[1.5,.03,.7]);
 }
 setPlan(plan){this.plan=plan;this.firstFrame=true;this.lastRaceTime=0;this.projected=[];this.labelAnchors=new Map();this.labelFrame=0;if(this.assetReady)this.makeActors();this.makeObstacles();}
 makeActors(){if(this.actors){this.scene.remove(this.actors);this.actors.geometry.dispose();this.actors.dispose();this.scene.remove(this.shadows);this.shadows.geometry.dispose();this.shadows.dispose();}
  const n=this.plan.count,g=new THREE.PlaneGeometry(1,1);this.poses=new Float32Array(n*3);g.setAttribute('pose',new THREE.InstancedBufferAttribute(this.poses,3));this.actors=new THREE.InstancedMesh(g,this.actorMat,n);this.actors.frustumCulled=false;this.scene.add(this.actors);
  const st=texture(64,64,c=>{const g=c.createRadialGradient(32,32,0,32,32,32);g.addColorStop(0,'rgba(36,17,32,.45)');g.addColorStop(1,'rgba(36,17,32,0)');c.fillStyle=g;c.fillRect(0,0,64,64);});this.shadows=new THREE.InstancedMesh(new THREE.PlaneGeometry(1,1),new THREE.MeshBasicMaterial({map:st,transparent:true,depthWrite:false,side:THREE.DoubleSide}),n);this.shadows.renderOrder=-1;this.shadows.frustumCulled=false;this.scene.add(this.shadows);
 }
 makeObstacles(){
  if(this.obstacles)this.scene.remove(this.obstacles);
  this.obstacleCourse?.dispose();
  this.obstacleCourse=new ObstacleCourse(this.plan);
  this.obstacles=this.obstacleCourse.group;
  this.scene.add(this.obstacles);
 }
 update(t,ranking,options={}){if(!this.assetReady||!this.actors||!this.plan)return;const idle=!!options.idle,preparing=!!options.preparing,ready=clamp((options.countdown??0)/3,0,1),time=idle?0:(options.raceTime??t),launch=idle?0:clamp(1-time/1.25,0,1),zoom=idle?.05:cameraPhase(t),lead=ranking[0],tail=ranking.at(-1),selected=options.follow?this.plan.runners.find(r=>r.id===options.follow):null;const lp=positionAt(lead,time),tp=positionAt(tail,time),focus=selected?positionAt(selected,time):lp;
  if(this.updateCourse)this.updateCourse(t,ranking,options);
  const behind=selected?focus-24:lerp(tp-24,lp-21,zoom),camX=selected?lateralAt(selected,time)*.65:Math.sin(time*.11)*.55;
  this.camPos.set(camX,lerp(19,7.5,zoom),behind);this.camTarget.set(selected?lateralAt(selected,time)*.65:0,lerp(1.8,2.1,zoom),focus+lerp(16,11,zoom));
  if(this.setCinematicCamera)this.setCinematicCamera(t,ranking,options);
  const smoothing=this.firstFrame?1:.085;this.camera.position.lerp(this.camPos,smoothing);this.lookTarget.lerp(this.camTarget,smoothing);this.camera.lookAt(this.lookTarget);this.camera.updateMatrixWorld();this.firstFrame=false;
  const anim=options.animTime??t,topIds=new Set(ranking.slice(0,10).map(r=>r.id));this.projected=[];this.impacts=[];this.labelFrame++;
  for(let i=0;i<this.plan.runners.length;i++){const r=this.plan.runners[i],progress=positionAt(r,time),e=idle?null:eventAt(r,time),u=e?clamp((time-e.at)/e.duration,0,1):0,holding=!!e&&time>=(e.contactAt??Infinity)&&time<(e.holdUntil??-Infinity),water=idle?null:r.events.find(q=>q.type==='waterballoon'&&time>=q.contactAt&&time<q.holdUntil+.35);let x=lateralAt(r,time),y=idle||holding?0:Math.abs(Math.sin(anim*16+r.phase))*.15,rot=0,frame=idle?1:Math.floor(anim*(e?.type==='boost'?18:12+launch*4)+r.phase)%4,action=0,scaleY=1;const h=r.type===2?3.8:3.5;
   if(e){const influence=Math.sin(Math.PI*u);if(!e.collisionManaged&&e.type!=='dodge'&&Number.isFinite(e.lateral))x=lerp(x,e.lateral,.8*influence);if(e.type==='hurdle'){y+=influence*2.7;frame=0;action=1;}if(e.type==='banana'){frame=1;action=1;rot=-influence*.65;y+=influence*.25;}if(e.type==='tumble'){frame=1;action=1;rot=-u*TAU;y+=influence*.6;if(!e.collisionManaged)x+=Math.sin(u*TAU)*.8;}if(e.type==='pit'){frame=1;action=1;y-=influence*1.25;scaleY=1-influence*.25;}if(e.type==='dig'){frame=2;action=1;rot=Math.sin(anim*13)*.08;}if(e.type==='spin'||e.type==='turntable'){frame=1;action=1;rot=u*TAU*(e.type==='turntable'?2:1);if(!e.collisionManaged)x+=Math.sin(u*TAU)*1.3;y+=influence*.9;}if(e.type==='dodge')rot=influence*.14;if(e.type==='boost')rot=Math.sin(anim*12)*.035;}
   if(e?.type==='waterballoon'&&holding){frame=0;action=1;y=.24+Math.sin(anim*3+r.phase)*.055;rot=Math.sin(anim*3+r.phase)*.035;x=lateralAt(r,time);}
   if(holding&&e.type!=='waterballoon')x=lateralAt(r,time)+(e.collisionManaged?0:Math.sin(anim*6+r.phase)*.12);
   if(idle&&preparing){scaleY=.94-ready*.08;rot=-.055-ready*.065;y=-(1-scaleY)*h*.42+Math.sin(ready*Math.PI*6)*.008;}
   else if(launch>0&&!e){rot=-.19*launch;scaleY=1-launch*.035;}
   if(!idle&&time>=r.finish){frame=3;action=1;y=Math.abs(Math.sin(anim*8+r.phase))*.3;}
   this.temp.position.set(x,h*.4+y,progress);this.temp.quaternion.copy(this.camera.quaternion);this.temp.rotateZ(rot);this.temp.scale.set(h*(idle?1:1+Math.sin(anim*16+r.phase)*.025),h*scaleY,1);this.temp.updateMatrix();this.actors.setMatrixAt(i,this.temp.matrix);this.poses[i*3]=frame;this.poses[i*3+1]=r.type;this.poses[i*3+2]=action;
   this.temp.position.set(x,.02,progress);this.temp.rotation.set(-Math.PI/2,0,0);this.temp.scale.set(2.2,1.4,1);this.temp.updateMatrix();this.shadows.setMatrixAt(i,this.temp.matrix);
   this.v.set(x,h*.85+y,progress).project(this.camera);const px=(this.v.x*.5+.5)*this.width,py=(-this.v.y*.5+.5)*this.height,depth=this.v.z;this.v.set(x,.1+y,progress).project(this.camera);const fx=(this.v.x*.5+.5)*this.width,fy=(-this.v.y*.5+.5)*this.height;
   if(depth>-1&&depth<1&&Math.abs(this.v.x)<1.3&&Math.abs(this.v.y)<1.4){
    // Numbers belong to a steady height over the path, never to bouncing artwork.
    this.v.set(lateralAt(r,time),4.2,progress).project(this.camera);
    const labelRawX=(this.v.x*.5+.5)*this.width,labelRawY=(-this.v.y*.5+.5)*this.height;
    let anchor=this.labelAnchors.get(r.id);
    if(!anchor||anchor.frame<this.labelFrame-1)anchor={x:labelRawX,y:labelRawY,frame:this.labelFrame};
    else{const dx=labelRawX-anchor.x,dy=labelRawY-anchor.y;anchor.x+=dx*.22;if(Math.abs(dy)>3)anchor.y+=(dy-Math.sign(dy)*3)*.12;anchor.frame=this.labelFrame;}
    this.labelAnchors.set(r.id,anchor);
    this.projected.push({r,x:px,y:py,fx,fy,depth,e,u,holding,water,launch,labelX:anchor.x,labelY:anchor.y,labelRawX,labelRawY,top:topIds.has(r.id),selected:r.id===options.follow});
   }
  }
  this.actors.instanceMatrix.needsUpdate=true;this.actors.geometry.attributes.pose.needsUpdate=true;this.shadows.instanceMatrix.needsUpdate=true;
  this.obstacleCourse?.update(anim,this.camera);
  this.finishGate.visible=lp>430;this.renderer.render(this.scene,this.camera);this.drawOverlay(t,zoom,options);this.lastRaceTime=t;
 }
 drawOverlay(t,zoom,options){const c=this.ctx,w=this.width,h=this.height;c.clearRect(0,0,w,h);const moving=!options.idle&&t>0&&t<60,anim=options.animTime??t,reveal=false;this.labelHits=[];
  // Ground rush, peripheral streaks and dust are driven by race time, so pause is exact.
  if(moving){const vanishX=w*.5,vanishY=h*.30,sideView=this.sideWeight||0;c.save();c.lineCap='round';for(let i=0;i<22;i++){const phase=(anim*(.55+zoom*.3)+i*.167)%1,side=i%2?1:-1,rx=vanishX+side*(w*.30+phase*w*.3),ry=vanishY+phase*h*.8,sx=w*(1.15-phase*1.3),sy=i%2?h*(.82+(i%5)*.035):h*(.16+(i%5)*.035),x=lerp(rx,sx,sideView),y=lerp(ry,sy,sideView);c.strokeStyle=i%3?'rgba(255,217,139,.22)':'rgba(168,226,255,.30)';c.lineWidth=1+phase*2;c.beginPath();c.moveTo(x,y);c.lineTo(lerp(lerp(rx,vanishX,.11),sx+45+zoom*30,sideView),lerp(lerp(ry,vanishY,.11),sy,sideView));c.stroke();}c.restore();}
  for(const p of this.projected){const size=clamp((p.fy-p.y)*.18,4,20),sideView=this.sideWeight||0;c.save();if(moving&&!p.holding){c.globalAlpha=.33+p.launch*.22;c.fillStyle='#ffe1bd';for(let j=0;j<4;j++){const u=(anim*3+p.r.phase+j*.2)%1;c.beginPath();c.arc(p.fx+Math.sin(j*3+anim)*size*.4-u*size*(2.5+p.launch)*sideView,p.fy+u*size*(2-sideView*1.4),size*(.16+u*.2)*(1+p.launch*.65),0,TAU);c.fill();}if(p.launch>0){c.globalAlpha=p.launch*.6;c.strokeStyle='#b8f4ff';c.lineWidth=Math.max(1,size*.12);c.lineCap='round';for(let j=0;j<2;j++){const spread=(j-.5)*size*.65;c.beginPath();c.moveTo(p.fx+spread*(1-sideView),p.fy+spread*sideView);c.lineTo(p.fx+spread*(1-sideView)-size*2.8*sideView,p.fy+spread*sideView+size*1.9*(1-sideView));c.stroke();}}}
   if(p.e){c.globalAlpha=Math.sin(p.u*Math.PI)*.9;if(p.e.type==='boost'){c.strokeStyle='#a3ebff';c.shadowColor='#61bcff';c.shadowBlur=14;c.lineWidth=2+zoom*2;for(let j=0;j<5;j++){c.beginPath();c.moveTo(p.fx+(j-2)*size*.5*(1-sideView),p.fy-(j-2)*size*.35*sideView);c.lineTo(p.fx+(j-2)*size*1.2*(1-sideView)-size*(3+j%2)*sideView,p.fy+size*(3+j%2)*(1-sideView)-(j-2)*size*.35*sideView);c.stroke();}}
    else if(['spin','turntable','tumble','banana'].includes(p.e.type)){c.strokeStyle='#fff4bb';c.lineWidth=2;c.beginPath();c.ellipse(p.fx,p.y+size,size*1.1,size*.5,p.u*12,0,Math.PI*1.6);c.stroke();c.fillStyle='#ffe16e';c.font=`bold ${size*1.4}px sans-serif`;c.fillText('✦',p.fx+size,p.y);if(p.u<.3){c.fillStyle='#fff5d4';c.font=`900 ${size*2}px sans-serif`;c.fillText('✹',p.fx,p.fy-size);}}
    if(['pit','dig','tumble'].includes(p.e.type)){c.fillStyle=p.e.type==='dig'?'#b78053':'#ffdfbc';for(let j=0;j<6;j++){c.beginPath();c.arc(p.fx+Math.sin(j*2+p.u*6)*size,p.fy-j*3,2+size*.15,0,TAU);c.fill();}}}
   c.restore();
  }
  if(this.bubbleImage){
   const img=this.bubbleImage,sw=img.width/2,sh=img.height/2,time=options.raceTime??t;
   for(const p of this.projected){if(!p.water)continue;const escaped=time>=p.water.holdUntil,age=time-p.water.holdUntil;
    const frame=escaped?3:Math.floor((time-p.water.contactAt)*4)%2?2:1;
    const size=clamp(Math.abs(p.fy-p.y)*1.6,28,300)*(escaped?1+age*.8:1),cx=(p.x+p.fx)*.5,cy=(p.y+p.fy)*.5;
    c.save();c.globalAlpha=escaped?clamp(1-age/.35,0,1):.94;c.drawImage(img,(frame%2)*sw,Math.floor(frame/2)*sh,sw,sh,cx-size*.5,cy-size*.5,size,size);c.restore();
   }
  }
  const sorted=[...this.projected].sort((a,b)=>(a.selected-b.selected)||(a.top-b.top)||b.depth-a.depth),fs=w<600?11:15,numberHeight=fs+10,gradeHeight=fs+2;
  for(const p of sorted){
   const r=p.r,full=reveal&&r.grade,number=String(reveal?r.number:(r.displayNumber??r.number)).padStart(2,'0')+'번',line=r.grade?`${r.grade}학년 ${r.classroom}반`:'';
   c.font=`400 ${fs}px "Race Jua",sans-serif`;let bw=Math.max(c.measureText(number).width+24,fs*3.6);
   // Reserve the same width before the reveal; rank changes never resize a label.
   if(line){c.font=`400 ${fs-3}px "Race Gowun",sans-serif`;bw=Math.max(bw,c.measureText(line).width+16);}
   const bh=numberHeight+(full?gradeHeight:0),bottom=p.labelY,x=clamp(p.labelX-bw/2,3,w-bw-3),y=bottom-bh;
   if(y<58||bottom>h-35)continue;
   c.strokeStyle='#3e303c';c.fillStyle=p.selected?'#ffe196':'#fff8e8';c.lineWidth=p.selected?2:1.4;
   c.beginPath();c.moveTo(p.labelRawX,p.labelRawY+10);c.lineTo(x+bw/2,bottom);c.stroke();
   c.beginPath();c.roundRect(x,y,bw,bh,7);c.fill();c.stroke();c.textAlign='center';c.textBaseline='middle';
   if(full){c.font=`400 ${fs-3}px "Race Gowun",sans-serif`;c.fillStyle='#443344';c.fillText(line,x+bw/2,y+gradeHeight/2);}
   const numberY=bottom-numberHeight/2;c.font=`400 ${fs}px "Race Jua",sans-serif`;c.fillStyle='#252231';c.fillText(number,x+bw/2+3,numberY);
   c.fillStyle=ACCENTS[r.type%ACCENTS.length];c.beginPath();c.arc(x+7,numberY,2.8,0,TAU);c.fill();
   this.labelHits.unshift({x,y,w:bw,h:bh,id:r.id});
  }
  if(t>=56&&t<60){c.fillStyle='#10172c99';c.fillRect(0,0,w,11);c.fillRect(0,h-11,w,11);}
  if(t>=60){for(let i=0;i<80;i++){const a=anim*.65+i*1.76;c.fillStyle=['#ffe29a','#9fe0d8','#e9adc5','#a6bcf1'][i%4];c.save();c.translate((Math.sin(i*48.7)*.5+.5)*w,(a%4)/4*h);c.rotate(a+i);c.fillRect(-3,-2,7,4);c.restore();}}
 }
 hitTest(x,y){return this.labelHits.find(p=>x>=p.x&&x<=p.x+p.w&&y>=p.y&&y<=p.y+p.h)?.id;}
}
