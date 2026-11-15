import * as THREE from './vendor/three.module.js';
import {RaceWorld as MeshWorld} from './world.js';
import {positionAt,eventAt,cameraPhase} from './engine.js';
const TAU=Math.PI*2,lerp=THREE.MathUtils.lerp,clamp=THREE.MathUtils.clamp;

// High-quality 3D-rendered sprite atlases placed in a perspective WebGL scene.
// Each participant has its own position, pose, animation phase and event state.
export class RaceWorld extends MeshWorld{
 makeSky(){}
 constructor(canvas,labels){
  super(canvas,labels);this.renderer.toneMapping=THREE.NoToneMapping;this.renderer.toneMappingExposure=1;this.camera.fov=37;this.camera.updateProjectionMatrix();this.assetReady=false;
  const loader=new THREE.TextureLoader();
  this.ready=Promise.all([loader.loadAsync('./assets/stadium.png'),loader.loadAsync('./assets/run-atlas.png'),loader.loadAsync('./assets/action-atlas.png')]).then(([bg,run,action])=>{
   for(const t of [bg,run,action]){t.colorSpace=THREE.SRGBColorSpace;t.anisotropy=4;}
   this.scene.background=bg;this.actorMat=new THREE.ShaderMaterial({uniforms:{runAtlas:{value:run},actionAtlas:{value:action}},transparent:true,depthWrite:true,side:THREE.DoubleSide,
    vertexShader:`attribute vec3 pose;varying vec2 atlasUv;varying float actionSet;
     void main(){vec2 insetUv=uv*.98+.01;atlasUv=vec2((insetUv.x+pose.x)/4.,(insetUv.y+3.-pose.y)/4.);actionSet=pose.z;gl_Position=projectionMatrix*modelViewMatrix*instanceMatrix*vec4(position,1.);}`,
    fragmentShader:`uniform sampler2D runAtlas;uniform sampler2D actionAtlas;varying vec2 atlasUv;varying float actionSet;
     void main(){vec4 c=actionSet>.5?texture2D(actionAtlas,atlasUv):texture2D(runAtlas,atlasUv);if(c.a<.12)discard;gl_FragColor=c;
     #include <tonemapping_fragment>
     #include <colorspace_fragment>
     }`});this.assetReady=true;if(this.plan)this.createActors();
  });
 }
 setPlan(plan){this.plan=plan;this.firstFrame=true;this.projected=[];if(this.assetReady)this.createActors();this.createProps();}
 createActors(){
  if(this.actors){this.scene.remove(this.actors);this.actors.geometry.dispose();this.actors.dispose();this.scene.remove(this.shadows);this.shadows.geometry.dispose();this.shadows.material.map.dispose();this.shadows.material.dispose();this.shadows.dispose();}
  const n=this.plan.count,geometry=new THREE.PlaneGeometry(1,1);this.poseArray=new Float32Array(n*3);geometry.setAttribute('pose',new THREE.InstancedBufferAttribute(this.poseArray,3));this.actors=new THREE.InstancedMesh(geometry,this.actorMat,n);this.actors.frustumCulled=false;this.actors.instanceMatrix.setUsage(THREE.DynamicDrawUsage);this.scene.add(this.actors);
  const c=document.createElement('canvas');c.width=c.height=64;const ctx=c.getContext('2d'),g=ctx.createRadialGradient(32,32,2,32,32,32);g.addColorStop(0,'rgba(48,22,35,.45)');g.addColorStop(1,'rgba(48,22,35,0)');ctx.fillStyle=g;ctx.fillRect(0,0,64,64);
  this.shadows=new THREE.InstancedMesh(new THREE.PlaneGeometry(1,1),new THREE.MeshBasicMaterial({map:new THREE.CanvasTexture(c),transparent:true,depthWrite:false,side:THREE.DoubleSide}),n);this.shadows.frustumCulled=false;this.shadows.renderOrder=-2;this.scene.add(this.shadows);
 }
 update(t,ranking,options={}){
  if(!this.plan||!this.assetReady||!this.actors)return;
  const sceneT=options.idle?0:t,zoom=options.idle?.28:cameraPhase(t),lead=ranking[0]||this.plan.runners[0],selected=options.follow?this.plan.runners.find(r=>r.id===options.follow):null;
  const leadX=positionAt(lead,sceneT),lastX=positionAt(ranking.at(-1),sceneT),spreadScale=1+zoom*1.3,visualX=r=>leadX+(positionAt(r,sceneT)-leadX)*spreadScale;
  const center=selected?visualX(selected)-3:lerp((leadX+lastX)/2,leadX-8,zoom),laneScale=lerp(.66,.42,zoom),targetZ=selected?selected.z*laneScale:0;
  const portrait=this.width/this.height<1,wide=68+this.plan.lanes*.58,near=portrait?38:25;
  this.camTarget.set(center,lerp(8,3.5,zoom),targetZ);this.camPos.set(center+lerp(1,.5,zoom),lerp(25,9.4,zoom),targetZ+lerp(wide,near,zoom));
  const a=this.firstFrame?1:.07;this.camera.position.lerp(this.camPos,a);if(!this.lookTarget)this.lookTarget=this.camTarget.clone();this.lookTarget.lerp(this.camTarget,a);this.camera.lookAt(this.lookTarget);this.camera.updateMatrixWorld();this.firstFrame=false;
  const animTime=options.animTime??t,topIds=new Set(ranking.slice(0,10).map(r=>r.id)),effects=[];this.projected=[];
  for(let i=0;i<this.plan.runners.length;i++){
   const r=this.plan.runners[i],x=visualX(r),z=r.z*laneScale,e=options.idle?null:eventAt(r,t),u=e?clamp((t-e.at)/e.duration,0,1):0,phase=animTime*13+r.phase;
   let y=Math.abs(Math.sin(phase))*.12,rot=0,frame=Math.floor(animTime*(e?.type==='boost'?16:11)+r.phase)%4,action=0,squash=1;
   if(e){effects.push({r,e,u,z,x});if(e.type==='hurdle'){y+=Math.sin(u*Math.PI)*2.5;frame=0;action=1;}
    if(e.type==='banana'){frame=1;action=1;rot=-Math.sin(u*Math.PI)*.22;y+=Math.sin(u*Math.PI)*.2;}
    if(e.type==='tumble'){frame=1;action=1;rot=-u*TAU;y+=Math.sin(u*Math.PI)*.4;}
    if(e.type==='pit'){frame=1;action=1;y-=Math.sin(u*Math.PI)*.95;squash=1-.16*Math.sin(u*Math.PI);}
    if(e.type==='dig'){frame=2;action=1;rot=Math.sin(phase)*.07;}
    if(e.type==='spin'){frame=1;action=1;rot=u*TAU*2;y+=Math.sin(u*Math.PI)*.55;}
    if(e.type==='boost')rot=-.07;
   }
   if(t>=r.finish){frame=3;action=1;y=Math.abs(Math.sin(animTime*8+r.phase))*.35;}
   const height=r.type===2?4.25:3.65;
   this.temp.position.set(x,height*.40+y,z);this.temp.quaternion.copy(this.camera.quaternion);this.temp.rotateZ(rot);this.temp.scale.set(height*(1+Math.sin(phase)*.025),height*squash,1);this.temp.updateMatrix();this.actors.setMatrixAt(i,this.temp.matrix);this.poseArray[i*3]=frame;this.poseArray[i*3+1]=r.type;this.poseArray[i*3+2]=action;
   this.temp.position.set(x,-.08,z);this.temp.rotation.set(-Math.PI/2,0,0);this.temp.scale.set(2.1*Math.max(.5,1-y*.06),1.25,1);this.temp.updateMatrix();this.shadows.setMatrixAt(i,this.temp.matrix);
   this.vector.set(x,height*.84+y,z).project(this.camera);const hx=(this.vector.x*.5+.5)*this.width,hy=(-this.vector.y*.5+.5)*this.height,depth=this.vector.z;
   this.vector.set(x,y,z).project(this.camera);const fx=(this.vector.x*.5+.5)*this.width,fy=(-this.vector.y*.5+.5)*this.height;
   if(depth>-1&&depth<1&&Math.abs(this.vector.x)<1.15&&Math.abs(this.vector.y)<1.15)this.projected.push({r,x:hx,y:hy,footX:fx,footY:fy,depth,e,u,top:topIds.has(r.id),selected:r.id===options.follow});
  }
  this.actors.instanceMatrix.needsUpdate=true;this.actors.geometry.attributes.pose.needsUpdate=true;this.shadows.instanceMatrix.needsUpdate=true;
  for(const pool of Object.values(this.propPools))for(const prop of pool)prop.visible=false;
  const used={};for(const {e,z} of effects){const pool=this.propPools[e.type];if(!pool)continue;const i=used[e.type]||0;if(i>=pool.length)continue;const prop=pool[i];used[e.type]=i+1;prop.visible=true;prop.position.set(leadX+(e.x-leadX)*spreadScale,0,z);if(prop.userData.arm)prop.userData.arm.rotation.y=t*6;}
  this.renderer.render(this.scene,this.camera);this.drawLabels(t,zoom,options);
  const c=this.ctx;
  for(const p of this.projected){if(!p.e)continue;const x=p.footX,y=p.footY,sz=4+zoom*11;c.save();c.globalAlpha=Math.sin(p.u*Math.PI)*.75;
   if(p.e.type==='boost'){const g=c.createLinearGradient(x-sz*5,y,x,y);g.addColorStop(0,'#9aefff00');g.addColorStop(1,'#dbfbff');c.strokeStyle=g;c.lineWidth=2+zoom*2;c.shadowColor='#7ee5ff';c.shadowBlur=10;for(let j=0;j<4;j++){c.beginPath();c.moveTo(x-4,y-j*4);c.lineTo(x-sz*(3+j*.45),y-j*4);c.stroke();}}
   else if(['tumble','dig','pit','banana'].includes(p.e.type)){for(let j=0;j<5;j++){c.fillStyle=p.e.type==='dig'?'#aa724f':'#ffe3bc';c.beginPath();c.arc(x+Math.sin(j*2+p.u*4)*sz,y-j*2,2+zoom*4,0,TAU);c.fill();}}c.restore();
  }
  for(let i=0;i<16;i++){const at=options.animTime||0;c.globalAlpha=.25+Math.sin(at*1.4+i)*.2;c.fillStyle='#ffe2a6';c.font=`${6+(i%3)*3}px serif`;c.fillText('✦',(Math.sin(i*9.2)*.5+.5)*this.width,20+(i*37)%(this.height*.24));}c.globalAlpha=1;
 }
}
