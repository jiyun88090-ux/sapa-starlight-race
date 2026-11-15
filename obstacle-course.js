import * as THREE from './vendor/three.module.js';

const TAU=Math.PI*2,UP=new THREE.Vector3(0,1,0);
const PALETTE={cream:0xffe8bc,teal:0x75c8bd,tealDark:0x3f8b8c,coral:0xe88187,rose:0xdca6bd,lavender:0x9c8fc9,ink:0x41455e,gold:0xe6b76a,metal:0xc7ccdb,soil:0x946c50,dirt:0xb18b67};

/** Larger, handcrafted course objects. The plan controls the total count. */
export class ObstacleCourse{
 constructor(plan){
  this.group=new THREE.Group();this.group.name='hero-obstacle-course';this.entries=[];
  this.geometries=new Set();this.materials=new Map();this.textures=new Set();
  this.sphere=this.geometry(new THREE.SphereGeometry(1,24,16));
  this.cylinder=this.geometry(new THREE.CylinderGeometry(1,1,1,40));
  this.shadowPlane=this.geometry(new THREE.PlaneGeometry(1,1));
  this.shadowMaterial=this.makeShadowMaterial();
  for(const [index,event] of (plan.obstacles??[]).entries()){
   const root=new THREE.Group();root.name=`obstacle-${event.id??index}`;root.position.set(event.lateral,0,event.x);root.scale.setScalar(event.type==='waterballoon'?1:1.32);this.group.add(root);
   const entry={root,event,rotor:null,phase:index*.83};this.entries.push(entry);
   const size=event.type==='banana'?3.8:event.type==='hurdle'?5.4:6.1;
   this.contactShadow(root,size,event.type==='hurdle'?2.4:size*.8);
   if(event.type==='banana')this.banana(root);
   else if(event.type==='hurdle')this.hurdle(root);
   else if(event.type==='pit'||event.type==='dig')this.pit(root,event.type==='dig');
   else if(event.type==='spin')entry.rotor=this.spinner(root);
   else if(event.type==='turntable')entry.rotor=this.turntable(root);
   else if(event.type==='waterballoon')entry.balloon=this.waterBalloon(root);
  }
 }

 geometry(g){this.geometries.add(g);return g;}
 material(name,color=PALETTE[name],options={}){
  if(!this.materials.has(name))this.materials.set(name,new THREE.MeshStandardMaterial({color:color??0xffffff,roughness:.62,metalness:.04,...options}));
  return this.materials.get(name);
 }
 mesh(parent,geometry,material,position=[0,0,0],scale=[1,1,1]){
  const m=new THREE.Mesh(geometry,material);m.position.set(...position);m.scale.set(...scale);parent.add(m);return m;
 }
 ball(parent,position,scale,material){return this.mesh(parent,this.sphere,material,position,scale);}
 disk(parent,radius,height,y,material){return this.mesh(parent,this.cylinder,material,[0,y,0],[radius,height,radius]);}
 ring(parent,radius,tube,y,material,arc=TAU){
  const geometry=this.geometry(new THREE.TorusGeometry(radius,tube,10,64,arc));
  const ring=this.mesh(parent,geometry,material,[0,y,0]);ring.rotation.x=Math.PI/2;return ring;
 }
 capsule(parent,start,end,radius,material){
  const a=new THREE.Vector3(...start),b=new THREE.Vector3(...end),delta=b.clone().sub(a),length=delta.length();
  const body=this.mesh(parent,this.cylinder,material,a.clone().add(b).multiplyScalar(.5).toArray(),[radius,length,radius]);
  body.quaternion.setFromUnitVectors(UP,delta.normalize());
  this.ball(parent,start,[radius,radius,radius],material);this.ball(parent,end,[radius,radius,radius],material);return body;
 }
 makeShadowMaterial(){
  const canvas=document.createElement('canvas');canvas.width=canvas.height=128;const c=canvas.getContext('2d');
  const g=c.createRadialGradient(64,64,8,64,64,64);g.addColorStop(0,'rgba(26,28,49,.38)');g.addColorStop(.48,'rgba(26,28,49,.23)');g.addColorStop(1,'rgba(26,28,49,0)');c.fillStyle=g;c.fillRect(0,0,128,128);
  const map=new THREE.CanvasTexture(canvas);this.textures.add(map);
  const material=new THREE.MeshBasicMaterial({map,transparent:true,depthWrite:false,side:THREE.DoubleSide});this.materials.set('contact-shadow',material);return material;
 }
 contactShadow(parent,width,depth){const shadow=this.mesh(parent,this.shadowPlane,this.shadowMaterial,[0,-.052,0],[width,depth,1]);shadow.rotation.x=-Math.PI/2;return shadow;}

 foot(parent,x,z,scale=1){
  const rubber=this.material('rubber',0x41485e,{roughness:.9}),paint=this.material('tealDark');
  this.ball(parent,[x,.12,z],[.48*scale,.15,.82*scale],rubber);
  this.ball(parent,[x,.23,z],[.4*scale,.18,.7*scale],paint);
  for(const dz of [-.43,.43])this.ball(parent,[x,.36,z+dz*scale],[.065,.035,.065],this.material('metal',PALETTE.metal,{metalness:.65,roughness:.3}));
 }
 padBar(parent,y,length,material){
  this.capsule(parent,[-length/2,y,0],[length/2,y,0],.29,material);
  // Rounded piping and contrasting soft bands give the arm a sewn bumper finish.
  const stripe=this.material('cream'),seam=this.material('arm-seam',0xc86578);
  for(const x of [-length*.36,-length*.12,length*.12,length*.36]){
   const band=this.mesh(parent,this.cylinder,stripe,[x,y,0],[.301,.22,.301]);band.rotation.z=Math.PI/2;
   for(const dx of [-.12,.12]){const edge=this.mesh(parent,this.geometry(new THREE.TorusGeometry(.3,.025,8,24)),seam,[x+dx,y,0]);edge.rotation.y=Math.PI/2;}
  }
  for(const sign of [-1,1])this.ball(parent,[sign*length/2,y,0],[.32,.32,.32],this.material('gold'));
 }

 hurdle(root){
  const cream=this.material('cream'),teal=this.material('teal'),metal=this.material('metal',PALETTE.metal,{metalness:.65,roughness:.3});
  for(const x of [-2.05,2.05]){
   this.foot(root,x,0,1.1);
   this.capsule(root,[x,.35,0],[x,1.65,0],.17,teal);
   this.ball(root,[x,1.65,0],[.27,.27,.27],cream);
   this.ball(root,[x,1.63,-.25],[.085,.085,.05],metal);
   this.capsule(root,[x,.45,-.51],[x,1.1,0],.075,cream);
   this.capsule(root,[x,.45,.51],[x,1.1,0],.075,cream);
  }
  this.padBar(root,1.69,4.05,this.material('coral'));
  this.capsule(root,[-1.8,1.4,0],[1.8,1.4,0],.055,this.material('tealDark'));
 }

 platform(root,radius){
  const dark=this.material('rubber',0x41485e,{roughness:.9}),cream=this.material('cream');
  this.disk(root,radius,.22,.08,dark);
  this.disk(root,radius-.08,.24,.25,this.material('lavender'));
  this.ring(root,radius-.13,.065,.36,cream);
  this.disk(root,radius-.2,.13,.43,this.material('platform-top',0xc7bddb,{roughness:.46,metalness:.14}));
  this.ring(root,radius-.32,.032,.505,this.material('rim-light',0xffe1a2,{emissive:0xffcc72,emissiveIntensity:.5,roughness:.35}));
  const metal=this.material('metal',PALETTE.metal,{metalness:.65,roughness:.3});
  for(let i=0;i<10;i++){const a=i*TAU/10;this.ball(root,[Math.cos(a)*(radius-.2),.51,Math.sin(a)*(radius-.2)],[.055,.026,.055],metal);}
 }

 turntable(root){
  const radius=2.65;this.platform(root,radius);
  const rotor=new THREE.Group();root.add(rotor);
  for(let i=0;i<8;i++){
   const sector=this.mesh(rotor,this.geometry(new THREE.RingGeometry(.45,2.24,12,1,i*TAU/8+.025,TAU/8-.05)),this.material(i%2?'deck-teal':'deck-rose',i%2?0x91ccc8:0xe3afc1),[0,.515,0]);sector.rotation.x=-Math.PI/2;
  }
  this.ring(rotor,1.45,.021,.53,this.material('cream'));
  this.disk(root,.47,.76,.85,this.material('tealDark'));
  this.ring(root,.47,.04,1.08,this.material('gold'));
  this.padBar(rotor,1.12,5.0,this.material('coral'));
  this.ball(rotor,[0,1.32,0],[.38,.3,.38],this.material('cream'));
  this.ball(rotor,[0,1.57,0],[.13,.1,.13],this.material('rim-light'));
  return rotor;
 }

 spinner(root){
  this.platform(root,1.25);
  this.disk(root,.46,.85,.93,this.material('tealDark'));
  this.disk(root,.51,.19,1.25,this.material('cream'));
  this.ring(root,.5,.055,1.37,this.material('gold'));
  const rotor=new THREE.Group();root.add(rotor);
  this.padBar(rotor,1.46,5.7,this.material('teal'));
  this.disk(rotor,.5,.36,1.47,this.material('lavender'));
  this.ball(rotor,[0,1.71,0],[.42,.25,.42],this.material('cream'));
  this.ball(rotor,[0,1.94,0],[.12,.09,.12],this.material('rim-light'));
  return rotor;
 }

 taperedTube(points,width){
  const curve=new THREE.CatmullRomCurve3(points.map(p=>new THREE.Vector3(...p))),steps=28,sides=10,frames=curve.computeFrenetFrames(steps,false),positions=[],normals=[],uv=[],indices=[];
  for(let i=0;i<=steps;i++){
   const t=i/steps,p=curve.getPointAt(t),r=width*(.35+.65*Math.sin(Math.PI*t))*(1-.68*t)+.018;
   for(let j=0;j<=sides;j++){const a=j/sides*TAU,n=frames.normals[i].clone().multiplyScalar(Math.cos(a)).addScaledVector(frames.binormals[i],Math.sin(a));positions.push(p.x+n.x*r,p.y+n.y*r,p.z+n.z*r);normals.push(n.x,n.y,n.z);uv.push(j/sides,t);}
  }
  for(let i=0;i<steps;i++)for(let j=0;j<sides;j++){const a=i*(sides+1)+j,b=a+sides+1;indices.push(a,b,a+1,b,b+1,a+1);}
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));g.setAttribute('normal',new THREE.Float32BufferAttribute(normals,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));g.setIndex(indices);return this.geometry(g);
 }

 banana(root){
  const gold=this.material('banana-skin',0xf6ca49,{roughness:.5}),inner=this.material('banana-inside',0xffedaf,{roughness:.85}),brown=this.material('banana-stem',0x8d6944);
  for(let i=0;i<3;i++){
   const peel=new THREE.Group();peel.rotation.y=i*TAU/3+.25;root.add(peel);
   this.mesh(peel,this.taperedTube([[0,.7,0],[.43,.46,.04],[.95,.16,.07],[1.45,.12,.07],[1.72,.29,.04]],.25),gold);
   this.mesh(peel,this.taperedTube([[.1,.75,0],[.49,.53,.04],[.97,.25,.07],[1.43,.2,.07],[1.66,.34,.04]],.09),inner);
   this.ball(peel,[1.73,.28,.04],[.08,.055,.06],brown);
  }
  this.capsule(root,[0,.56,0],[0,.98,0],.13,gold);
  this.capsule(root,[0,.94,0],[.035,1.1,0],.085,brown);
 }

 pit(root,digging){
  const hole=this.material('pit-depth',0x27283b,{roughness:1}),soil=this.material('soil'),dirt=this.material('dirt'),cream=this.material('cream');
  const recess=this.disk(root,1.55,.11,-.03,hole);recess.scale.z*=.84;
  const lip=this.ring(root,1.6,.28,.08,soil);lip.scale.y=.83;
  const inner=this.ring(root,1.36,.09,.065,this.material('inner-earth',0x5f4b47));inner.scale.y=.83;
  for(let i=0;i<12;i++){
   const a=i*TAU/12,r=1.64+Math.sin(i*3.7)*.12;
   const rock=this.ball(root,[Math.cos(a)*r,.13+(i%3)*.035,Math.sin(a)*r*.84],[.26+(i%2)*.08,.18+(i%3)*.025,.25],i%3?dirt:soil);rock.rotation.y=a;
  }
  for(const sign of [-1,1]){
   const edge=new THREE.Group();edge.position.set(sign*1.93,.06,0);root.add(edge);
   this.capsule(edge,[0,0,-.6],[0,0,.6],.075,cream);
   for(const z of [-.44,.44])this.ball(edge,[0,.025,z],[.11,.05,.11],this.material('gold'));
  }
  if(digging){
   const mound=this.ball(root,[1.63,.2,.98],[.72,.36,.53],dirt);mound.rotation.y=-.4;
   for(let j=0;j<4;j++)this.ball(root,[1.45+j*.17,.34+(j%2)*.07,.84+(j%3)*.12],[.14,.12,.13],soil);
  }
 }

 waterBalloon(root){
  const water=this.material('water-balloon',0x7ed7fa,{transparent:true,opacity:.38,roughness:.08,metalness:.12,emissive:0x2b6c9a,emissiveIntensity:.2,depthWrite:false});
  const edge=this.material('water-edge',0xbfeeff,{transparent:true,opacity:.72,roughness:.13,emissive:0x5399b7,emissiveIntensity:.35,depthWrite:false});
  const body=new THREE.Group();root.add(body);
  this.ball(body,[0,3.4,0],[3.85,3.7,3.85],water);
  this.ball(body,[-1.4,5.2,-2.5],[.7,1.1,.11],this.material('water-shine',0xf5ffff,{transparent:true,opacity:.77,depthWrite:false}));
  this.ball(body,[1.7,2.6,-3.15],[.25,.4,.07],edge);
  this.ball(body,[0,.12,0],[.44,.35,.44],edge);
  this.ring(root,3.9,.09,.06,edge);this.ring(root,3.35,.045,.065,edge);
  for(let i=0;i<7;i++){const a=i*TAU/7;this.ball(body,[Math.cos(a)*2.8,2+Math.sin(a)*1.5,Math.sin(a)*2.8],[.13,.13,.13],edge);}
  const droplets=new THREE.Group();droplets.visible=false;root.add(droplets);
  for(let i=0;i<14;i++){const a=i*2.399;const drop=this.ball(droplets,[0,2.5,0],[.16+(i%3)*.07,.29,.16],edge);drop.userData={angle:a,lift:1+i%4*.45};}
  return {body,droplets};
 }

 update(sceneTime,camera){
  for(const entry of this.entries){
   if(entry.rotor)entry.rotor.rotation.y=entry.phase+sceneTime*(entry.event.type==='turntable'?2.15:2.6);
   if(entry.balloon){
    const burst=entry.event.burstAt??entry.event.activeUntil??entry.event.at+1,age=sceneTime-burst;
    entry.balloon.body.visible=age<0;
    if(age<0){const pulse=Math.sin(sceneTime*2.4)*.025;entry.balloon.body.scale.set(1+pulse,1-pulse*.7,1+pulse);}
    entry.balloon.droplets.visible=age>=0&&age<.65;
    if(entry.balloon.droplets.visible)for(const drop of entry.balloon.droplets.children){const {angle,lift}=drop.userData;drop.position.set(Math.cos(angle)*(2+age*6),2.3+lift*age*3-age*age*9,Math.sin(angle)*(2+age*6));drop.scale.setScalar(Math.max(.01,1-age/.65));}
   }
  }
 }
 dispose(){
  this.group.removeFromParent();
  for(const g of this.geometries)g.dispose();for(const m of this.materials.values())m.dispose();for(const t of this.textures)t.dispose();
  this.entries.length=0;
 }
}
