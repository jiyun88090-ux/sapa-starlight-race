export const DURATION = 60;
export const REVEAL_AT = 45;
export const FINISH = 560;
export const EVENT_NAMES = {banana:'바나나에 미끌!',hurdle:'허들 점프!',tumble:'우당탕! 다시 출발!',pit:'앗, 함정이다!',dig:'비밀 함정 만들기!',boost:'별빛 부스터!',spin:'회전 막대에 휘청!',turntable:'회전판에 빙글!',waterballoon:'물풍선에 갇혔다!',dodge:'옆으로 쏙! 장애물 회피!'};
export function parseStudentId(value) {
  const raw=String(value??'').trim().replace(/\.0+$/,'');
  const m=raw.match(/^([123])(\d{1,2})(\d{2})$/);
  if(!m || +m[2]<1 || +m[3]<1) return null;
  return {id:raw,grade:+m[1],classroom:+m[2],number:+m[3]};
}
export function parseRoster(values) {
  const participants=[],invalid=[],duplicates=[]; const seen=new Set();
  for (const value of values) {
    if(value===null || value===undefined || String(value).trim()==='')continue;
    const p=parseStudentId(value);
    if(!p){invalid.push(String(value));continue;}
    const key=`${p.grade}-${p.classroom}-${p.number}`;
    if(seen.has(key)){duplicates.push(p.id);continue;}
    seen.add(key);participants.push(p);
  }
  return {participants,invalid,duplicates};
}
export function demoRoster(n=160){return Array.from({length:n},(_,i)=>{const g=1+Math.floor(i/300),c=1+Math.floor(i%300/30),num=i%30+1;return {id:`${g}${c<10?c:String(c).padStart(2,'0')}${String(num).padStart(2,'0')}`,grade:g,classroom:c,number:num};});}
export function rng(seed){return ()=>{seed|=0;seed=seed+0x6D2B79F5|0;let t=Math.imul(seed^seed>>>15,1|seed);t=t+Math.imul(t^t>>>7,61|t)^t;return ((t^t>>>14)>>>0)/4294967296;};}
export function secureInt(max){if(!Number.isInteger(max)||max<1)throw Error('Invalid range');const a=new Uint32Array(1),limit=Math.floor(4294967296/max)*max;do{globalThis.crypto.getRandomValues(a);}while(a[0]>=limit);return a[0]%max;}
export function shuffle(a,randomInt=secureInt){const out=[...a];for(let i=out.length-1;i>0;i--){const j=randomInt(i+1);[out[i],out[j]]=[out[j],out[i]];}return out;}
export function identity(p,revealed){return revealed&&p.grade?`${p.grade}학년 ${p.classroom}반 ${String(p.number).padStart(2,'0')}번`:`${String(revealed?p.number:(p.displayNumber??p.number)).padStart(2,'0')}번`;}
export function maxClassSize(roster){const sizes=new Map();for(const p of roster){const key=`${p.grade}-${p.classroom}`;sizes.set(key,(sizes.get(key)||0)+1);}return Math.min(50,Math.max(3,...sizes.values()));}
export function manualRoster(n){return Array.from({length:n},(_,i)=>({id:`runner-${i+1}`,grade:0,classroom:0,number:i+1,displayNumber:i+1}));}
export function prepareDraw(pool,mode='manual'){
  // Shuffle the ENTIRE student population before choosing the visual cast.
  // Taking the first K winners gives every student exactly K / N probability.
  const all=shuffle(pool),count=mode!=='manual'?Math.min(pool.length,maxClassSize(pool)):pool.length;
  const slots=shuffle(Array.from({length:count},(_,i)=>i+1));
  const cast=all.slice(0,count).map((p,i)=>({...p,displayNumber:mode!=='manual'?slots[i]:p.number}));
  return {cast,order:cast.map(p=>p.id),all,count};
}
const mix=(a,b,t)=>a+(b-a)*t;
const ease=t=>{const u=Math.max(0,Math.min(1,t));return u*u*(3-2*u);};
const FINAL_SEQUENCE_AT=58.8,FINAL_STRAIGHT_AT=59.1,FINISH_SPEED=25,LEADER_FINISH_AT=59.1;
// Five distinct crossings fit into the slow-motion shot, with visible air
// between runners; the tail remains spread out beyond the camera frame.
const finishGap=rank=>rank<=9?rank*4.5:9*4.5+34*(1-Math.exp(-(rank-9)/15));
function finishPosition(r,t){
 const straight=FINISH+(t-r.finish)*FINISH_SPEED;
 if(!r.finishDrama||t>=FINAL_STRAIGHT_AT)return straight;
 const u=Math.max(0,Math.min(1,(t-FINAL_SEQUENCE_AT)/(FINAL_STRAIGHT_AT-FINAL_SEQUENCE_AT))),u2=u*u,u3=u2*u;
 const h=FINAL_STRAIGHT_AT-FINAL_SEQUENCE_AT,start=r.finishDrama.start,end=FINISH+(FINAL_STRAIGHT_AT-r.finish)*FINISH_SPEED;
 // Positive monotone Hermite curves: one runner accelerates while the former
 // leader briefly stumbles, then both join the same forward finish speed.
 return (2*u3-3*u2+1)*start+(u3-2*u2+u)*h*r.finishDrama.entrySpeed+(-2*u3+3*u2)*end+(u3-u2)*h*FINISH_SPEED;
}
function rawPosition(r,t){
 let j=0;while(j<r.points.length-2&&t>r.points[j+1].t)j++;
 const a=r.points[j],b=r.points[j+1];
 let x=mix(a.x,b.x,Math.max(0,Math.min(1,(t-a.t)/(b.t-a.t))));
 if(t<1.2){const speed=(r.points[1].x-r.points[0].x)/r.points[1].t;const u=Math.max(0,t/1.2);x=r.gridZ+speed*1.2*(u*u*(2-u));}
 for(const e of r.events){if(e.cinematicOnly||e.collisionManaged||e.holdDuration||e.recoveryBoost)continue;const u=(t-e.at)/e.duration;if(u>0&&u<1)x+=(e.amplitude||0)*Math.sin(Math.PI*u)**2;}
 return x;
}
function holdPosition(segment,t){
 if(t<=segment.holdUntil)return segment.x+segment.drift*ease((t-segment.at)/(segment.holdUntil-segment.at));
 const h=segment.recoveryUntil-segment.holdUntil,u=Math.max(0,Math.min(1,(t-segment.holdUntil)/h)),u2=u*u,u3=u2*u;
 return (2*u3-3*u2+1)*segment.releaseX+(-2*u3+3*u2)*segment.endX+(u3-u2)*h*segment.endSpeed;
}
function motionPosition(r,t,segments){
 for(const s of segments)if(t>=s.at&&t<s.recoveryUntil)return holdPosition(s,t);
 return rawPosition(r,t);
}
function buildRunnerMotion(r){
 r.events.sort((a,b)=>a.at-b.at);
 const segments=[];
 for(const e of r.events){
  if(!e.holdDuration||e.cinematicOnly)continue;
  e.contactAt=e.at;e.holdUntil=e.at+e.holdDuration;e.recoveryUntil=e.holdUntil+e.recoveryDuration;
  const x=motionPosition(r,e.contactAt,segments),drift=e.type==='waterballoon'?0:.12,releaseX=x+drift;
  const endX=Math.max(releaseX+.1,rawPosition(r,e.recoveryUntil)),h=e.recoveryDuration;
  const slope=(rawPosition(r,e.recoveryUntil+.025)-rawPosition(r,e.recoveryUntil-.025))/.05;
  const endSpeed=Math.max(0,Math.min(slope,3*(endX-releaseX)/h));
  const segment={at:e.contactAt,holdUntil:e.holdUntil,recoveryUntil:e.recoveryUntil,x,drift,releaseX,endX,endSpeed};
  segments.push(segment);e.x=x;e.lateral=freeLateralAt(r,e.contactAt);e.stalled=true;
 }
 r.motionHolds=segments;
 const samples=new Float64Array(1201);let previous=r.points[0].x;
 for(let i=0;i<samples.length;i++){
  const t=i*.05,x=t>=FINAL_SEQUENCE_AT?finishPosition(r,t):motionPosition(r,t,segments);
  samples[i]=Math.max(previous,x);previous=samples[i];
 }
 r.samples=samples;
 for(const e of r.events){
  if(e.holdDuration)continue;
  const contact=e.obstacleId?e.at+e.duration*.5:e.at;
  e.contactAt=contact;e.x=positionAt(r,contact);e.lateral=freeLateralAt(r,contact);
 }
}
function addHold(r,event,holdDuration,escapeBoost=false){
 const recoveryDuration=escapeBoost?2.1:3.45;
 Object.assign(event,{duration:holdDuration,holdDuration,contactAt:event.at,holdUntil:event.at+holdDuration,recoveryDuration,recoveryUntil:event.at+holdDuration+recoveryDuration,escapeBoost,amplitude:0,stalled:true,trapped:event.type==='waterballoon'});
 r.events.push(event);
 if(escapeBoost)r.events.push({at:event.holdUntil,duration:recoveryDuration,type:'boost',amplitude:0,recoveryBoost:true,sourceObstacleId:event.obstacleId});
}

// Bake the whole cast against the same fixed objects. Rendering and ranking
// consume these samples, so a hit cannot leave a runner travelling forward.
function bakeSharedCourse(runners,obstacles,random){
 const rate=40,dt=1/rate,steps=50*rate,limit=11.4;
 const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
 const move=(a,b,d)=>a+clamp(b-a,-d,d);
 const course=obstacles.map(o=>{
  const sizes={turntable:[4.5,4.5],spin:[5,5],banana:[3.1,3.1],pit:[3.35,3.35],dig:[3.35,3.35],hurdle:[3.8,1.9],waterballoon:[4.2,4.2]};
  const [rx,rz]=sizes[o.type];o.participantIds=[];
  if(o.type==='waterballoon'){o.activeUntil=Infinity;o.burstAt=Infinity;}
  return {o,rx,rz};
 }).sort((a,b)=>a.o.x-b.o.x);
 const states=runners.map(r=>{
  const scheduled=r.events.filter(e=>e.holdDuration&&!e.obstacleId&&!e.cinematicOnly).map(e=>({...e}));
  r.events=r.events.filter(e=>e.cinematicOnly||(!e.obstacleId&&!e.holdDuration&&!e.recoveryBoost));
  r.samples=new Float64Array(2401);r.lateralSamples=new Float64Array(2401);r.sampleRate=rate;
  r.samples[0]=r.gridZ;r.lateralSamples[0]=r.gridX;r.motionHolds=[];
  return {r,z:r.gridZ,x:r.gridX,speed:0,route:null,hold:null,boostUntil:0,scheduled,
   choices:new Map(course.map(c=>[c.o.id,{avoid:c.o.runnerId!==r.id&&random()<.34,boost:random()<.68}]))};
 });
 const active=(c,t)=>t<(c.o.activeUntil??Infinity);
 function exitX(c,x){
  const sides=[c.o.lateral-c.rx-.65,c.o.lateral+c.rx+.65].filter(v=>v>=-limit&&v<=limit);
  return sides.sort((a,b)=>Math.abs(a-x)-Math.abs(b-x))[0]??clamp(c.o.lateral>0?c.o.lateral-c.rx-.65:c.o.lateral+c.rx+.65,-limit,limit);
 }
 function sweep(c,x,z,nx,nz){
  const ax=(x-c.o.lateral)/c.rx,az=(z-c.o.x)/c.rz,dx=(nx-x)/c.rx,dz=(nz-z)/c.rz;
  const C=ax*ax+az*az-1,A=dx*dx+dz*dz,B=2*(ax*dx+az*dz);
  if(C<-.0001)return 0;
  if(A<1e-12)return null;
  const discriminant=B*B-4*A*C;if(discriminant<0)return null;
  const u=(-B-Math.sqrt(discriminant))/(2*A);
  return u>=0&&u<=1?u:null;
 }
 function beginHold(s,c,t){
  const type=c.o.type==='hurdle'?'tumble':c.o.type;
  const duration=type==='waterballoon'?1:type==='banana'?.85:type==='spin'||type==='turntable'?1.2:1.05;
  const choice=s.choices.get(c.o.id),e={at:t,contactAt:t,duration,holdDuration:duration,holdUntil:t+duration,
   type,obstacleType:c.o.type,obstacleId:c.o.id,collisionManaged:true,amplitude:0,
   x:s.z,lateral:s.x,stalled:true,trapped:type==='waterballoon',escapeBoost:choice.boost};
  s.r.events.push(e);s.hold={until:t+duration,e};s.speed=0;
  s.route=type==='waterballoon'?null:{c,target:exitX(c,s.x),exiting:true,boost:choice.boost};
  c.o.participantIds.push(s.r.id);
  if(type==='waterballoon'){
   // Leave a short shared contact window before the large balloon bursts.
   if(!Number.isFinite(c.o.burstAt)){c.o.at=t;c.o.burstAt=t+.28;c.o.activeUntil=c.o.burstAt;}
   s.hold.waterBoost=true;
  }
 }
 for(let i=1;i<=steps;i++){
  const t=i*dt;
  for(const s of states){
   const r=s.r;
   if(s.hold&&t>=s.hold.until){
    if(s.hold.waterBoost){s.boostUntil=t+2.1;r.events.push({at:t,duration:2.1,type:'boost',amplitude:0,recoveryBoost:true,collisionManaged:true});}
    else if(s.route){s.route.dodgeEvent={at:t,duration:3,type:'dodge',amplitude:0,collisionManaged:true,obstacleId:s.route.c.o.id};r.events.push(s.route.dodgeEvent);}
    s.hold=null;
   }
   if(!s.hold){
    const stumble=s.scheduled.find(e=>!e.started&&t>=e.at);
    if(stumble){stumble.started=true;const e={...stumble,at:t,contactAt:t,holdUntil:t+stumble.holdDuration,x:s.z,lateral:s.x,collisionManaged:true};r.events.push(e);s.hold={until:e.holdUntil,e,waterBoost:!!e.escapeBoost};s.speed=0;}
   }
   if(s.hold){r.samples[i]=s.z;r.lateralSamples[i]=s.x;continue;}
   if(s.route&&s.z>s.route.c.o.x+s.route.c.rz+1){
    if(s.route.dodgeEvent)s.route.dodgeEvent.duration=Math.max(dt,t-s.route.dodgeEvent.at);
    s.route=null;
   }
   const nominal=Math.max(0,(rawPosition(r,t+.025)-rawPosition(r,t-.025))/.05);
   if(!s.route){
    const next=course.find(c=>active(c,t)&&c.o.x>s.z&&c.o.x-s.z<c.rz+Math.max(8,nominal*1.45)&&Math.abs(s.x-c.o.lateral)<c.rx+.65&&s.choices.get(c.o.id).avoid);
    if(next){const e={at:t,duration:4,type:'dodge',amplitude:0,collisionManaged:true,obstacleId:next.o.id};r.events.push(e);s.route={c:next,target:exitX(next,s.x),exiting:false,dodgeEvent:e};}
   }
   let target=s.route?s.route.target:freeLateralAt(r,t);
   const nx=move(s.x,target,dt*(s.route?8.5:5));
   let stationary=false;
   if(s.route?.exiting){
    stationary=Math.abs(s.x-s.route.c.o.lateral)<s.route.c.rx+.25;
    if(!stationary){
     s.route.exiting=false;
     if(s.route.dodgeEvent)s.route.dodgeEvent.duration=Math.max(dt,t-s.route.dodgeEvent.at);
     if(s.route.boost){s.boostUntil=t+2.1;r.events.push({at:t,duration:2.1,type:'boost',amplitude:0,recoveryBoost:true,collisionManaged:true,sourceObstacleId:s.route.c.o.id});}
    }
   }
   const speedLimit=s.boostUntil>t?24:17;
   const desired=stationary?0:clamp(nominal+(rawPosition(r,t)-s.z)/.72,0,speedLimit);
   s.speed=stationary?0:move(s.speed,desired,dt*(s.boostUntil>t?22:15));
   const nz=stationary?s.z:Math.max(s.z,Math.min(rawPosition(r,t),s.z+s.speed*dt));
   let collision=null,first=Infinity;
   for(const c of course){
    if(!active(c,t)||s.z>c.o.x+c.rz+1)continue;
    // A caught runner slides outward along the front of this object's
    // surface, then passes with its full padded width clear of the rim.
    if(s.route?.exiting&&s.route.c===c)continue;
    const u=sweep(c,s.x,s.z,nx,nz);
    if(u!==null&&u<first){first=u;collision=c;}
   }
   if(collision){
    s.x=mix(s.x,nx,Math.max(0,first-.001));s.z=mix(s.z,nz,Math.max(0,first-.001));
    if(s.route?.dodgeEvent)s.route.dodgeEvent.duration=Math.max(dt,t-s.route.dodgeEvent.at);
    beginHold(s,collision,t);
   }else{s.x=nx;s.z=nz;}
   r.samples[i]=s.z;r.lateralSamples[i]=s.x;
  }
 }
 for(const s of states){
  const r=s.r,start=s.z,startX=s.x,end=rawPosition(r,52),h=2;
  const secant=Math.max(0,(end-start)/h),v0=clamp(s.speed,0,3*secant),v1=clamp((rawPosition(r,52.025)-rawPosition(r,51.975))/.05,0,3*secant);
  // Recover smoothly before the authored finish sequence; this never
  // changes the independently drawn outcome or the 80% dramatic branch.
  for(let i=steps+1;i<r.samples.length;i++){
   const t=i/rate;
   if(t<52){const u=(t-50)/h,u2=u*u,u3=u2*u;r.samples[i]=(2*u3-3*u2+1)*start+(u3-2*u2+u)*h*v0+(-2*u3+3*u2)*end+(u3-u2)*h*v1;r.lateralSamples[i]=mix(startX,freeLateralAt(r,t),ease(u));}
   else{r.samples[i]=t>=FINAL_SEQUENCE_AT?finishPosition(r,t):rawPosition(r,t);r.lateralSamples[i]=freeLateralAt(r,t);}
  }
  r.events.sort((a,b)=>a.at-b.at);
 }
}
export function makePlan(participants, {seed=secureInt(4294967295),order=shuffle(participants.map(p=>p.id))}={}) {
  if(participants.length<3)throw Error('참가자는 3명 이상이어야 합니다.');
  if(new Set(participants.map(p=>p.id)).size!==participants.length || order.length!==participants.length || new Set(order).size!==participants.length || participants.some(p=>!order.includes(p.id)))throw Error('참가 명단과 순위가 일치하지 않습니다.');
  // Narrative choice is independent of the outcome and the animation seed.
  const dramaticFinish=secureInt(100)<80;
  const random=rng(seed),n=participants.length,lanes=Math.min(24,Math.max(6,Math.ceil(Math.sqrt(n)*.85)));
  const ranks=new Map(order.map((id,i)=>[id,i]));
  const shuffled=shuffle(participants, max=>Math.floor(random()*max));
  const checkpoints=[0,8,16,24,32,40,46,52,54,56,57.2,58.8];
  const bases=[-4,62,136,214,290,366,424,482,504,526,538,557.6];
  const spreads=[0,25,32.5,38.75,37.5,35,30,21,18,14,10,8];
  const stageRanks=checkpoints.map(()=>new Map(shuffle(participants.map(p=>p.id),max=>Math.floor(random()*max)).map((id,i)=>[id,i])));
  const comebackOffsets={52:[-11,4,0,-5,-8],54:[-8,3,0,-4,-7],56:[-1,1,-3.8,-8,-12],57.2:[0,-4,-8.5,-13,-17.5]};
  const gridColumns=Math.min(5,n),gridRows=Math.ceil(n/gridColumns);
  const runners=shuffled.map((p,i)=>{
    const rank=ranks.get(p.id),gap=finishGap(rank),finish=LEADER_FINISH_AT+gap/FINISH_SPEED;
    const gridColumn=i%gridColumns,gridRow=Math.floor(i/gridColumns),gridX=(gridColumn-(gridColumns-1)/2)*3.5+(gridRow%2?.3:-.3),gridZ=-3.6-gridRow*3.5-(gridColumn%2)*.38;
    const start=gridZ;
    const points=checkpoints.map((t,j)=>{
      let x;
      if(j===0)x=start;
      else if(t<52)x=bases[j]-spreads[j]*stageRanks[j].get(p.id)/Math.max(1,n-1);
      else if(t===FINAL_SEQUENCE_AT)x=dramaticFinish&&rank<2?(rank===0?550:553):FINISH+(t-finish)*FINISH_SPEED;
      else if(rank<5)x=bases[j]+comebackOffsets[t][rank];
      else x=bases[j]-gap*(t===52?.65:t===54?.78:t===56?.9:1);
      return {t,x};
    });
    points.push({t:finish,x:FINISH});
    const finishDrama=dramaticFinish&&rank<2?{start:rank===0?550:553,entrySpeed:rank===0?7.5:11.875}:null;
    const launchX=Math.max(-11,Math.min(11,(gridColumn-(gridColumns-1)/2)/Math.max(1,(gridColumns-1)/2)*10.5+(random()-.5)*1.1));
    return {...p,index:i,rank,finish,finishDrama,type:i%8,lane:i%lanes,gridColumn,gridRow,gridX,gridZ,launchX,z:(random()-.5)*21,phase:random()*Math.PI*2,wander:1+random()*1.5,points,events:[]};
  });
  // A small authored obstacle course is shared by the entire field. This
  // replaces one obstacle for every runner/event (hundreds at full capacity).
  const physicalTypes=['turntable','hurdle','banana','spin','pit','hurdle','turntable','dig','spin','banana','turntable','hurdle'];
  const featured=shuffle(runners,max=>Math.floor(random()*max));
  physicalTypes.forEach((type,k)=>{
    const runner=featured[k%n],at=5+k*3.56,event={at,type,obstacleId:`course-${k+1}`};
    if(type==='hurdle')runner.events.push({...event,duration:1.1,amplitude:0});
    else addHold(runner,event,type==='banana'?.85:type==='spin'||type==='turntable'?1.2:1.05,k%3!==1);
  });
  [10.3,17.5,25.4,34.6,42.6,48.8].forEach((at,k)=>{
    const candidates=featured.filter(r=>!r.events.some(e=>at<(e.recoveryUntil??e.at+e.duration)+.35&&at+4.8>e.at-.35));
    const runner=candidates[k%Math.max(1,candidates.length)];
    if(runner){if(k%3===1)addHold(runner,{at,type:'tumble'},.8,true);else runner.events.push({at,duration:1.3,type:'boost',amplitude:3.1});}
  });
  const winner=runners.find(r=>r.rank===0);
  winner.events.push({at:55.1,duration:1.3,type:'boost',amplitude:3.2,featured:true});
  const challenger=runners.find(r=>r.rank===1);
  if(dramaticFinish){
    challenger.events.push({at:58.82,duration:.16,type:'tumble',amplitude:0,featured:true,cinematicOnly:true});
    winner.events.push({at:58.82,duration:.27,type:'boost',amplitude:0,featured:true,cinematicOnly:true});
  }else winner.events.push({at:58.84,duration:.26,type:'boost',amplitude:0,featured:true,cinematicOnly:true});
  for(const runner of runners)buildRunnerMotion(runner);
  // One large water balloon catches everyone who reaches its surface during
  // the short impact window, then bursts and leaves individual
  // water shells around the captured runners for precisely one second.
  const waterAt=30.1,waterRadius=4.2,waterId='course-waterballoon';
  const freeForWater=(r,at)=>!r.events.some(e=>!e.cinematicOnly&&at<(e.recoveryUntil??e.at+e.duration)+.2&&at+3.1>e.at-.2);
  const available=featured.filter(r=>freeForWater(r,waterAt));
  const waterRunner=(available.length?available:featured).slice().sort((a,b)=>Math.abs(freeLateralAt(b,waterAt))-Math.abs(freeLateralAt(a,waterAt)))[0];
  const waterX=positionAt(waterRunner,waterAt)+3.95,waterLateral=freeLateralAt(waterRunner,waterAt),contacts=[];
  for(const runner of runners){
   for(let step=0;step<=42;step++){
    const at=waterAt-.4+step*.025,dx=freeLateralAt(runner,at)-waterLateral,dz=positionAt(runner,at)-waterX;
    if(dx*dx+dz*dz<=waterRadius*waterRadius&&freeForWater(runner,at)){contacts.push({runner,at});break;}
   }
  }
  if(!contacts.length)contacts.push({runner:waterRunner,at:waterAt});
  contacts.sort((a,b)=>a.at-b.at);const waterContacts=contacts.filter(c=>c.at<=contacts[0].at+.28);
  for(const {runner,at} of waterContacts)addHold(runner,{at,type:'waterballoon',obstacleId:waterId,obstacleX:waterX,obstacleLateral:waterLateral},1,true);
  for(const runner of runners)buildRunnerMotion(runner);
  const waterBurstAt=waterContacts.at(-1).at+.0001;
  const obstacles=[{id:waterId,type:'waterballoon',x:waterX,lateral:waterLateral,at:waterContacts[0].at,duration:1,runnerId:waterContacts[0].runner.id,participantIds:waterContacts.map(c=>c.runner.id),radius:waterRadius,activeAt:0,activeUntil:waterBurstAt,burstAt:waterBurstAt}];
  for(const runner of runners)for(const e of runner.events){
   if(e.obstacleId&&e.type!=='waterballoon')obstacles.push({id:e.obstacleId,type:e.type,x:e.x,lateral:e.lateral,at:e.at,duration:e.duration,holdUntil:e.holdUntil,runnerId:runner.id});
  }
  bakeSharedCourse(runners,obstacles,random);
  const beats=[
    {at:50,duration:1.6,title:'마지막 승부, 아직 끝나지 않았어!',kind:'sprint',runnerId:order[Math.min(1,n-1) ]},
    {at:53.6,duration:1.5,title:'마지막 직선, 전력 질주!',kind:'sprint',runnerId:winner.id},
    {at:55.4,duration:.7,title:'결승선 앞, 끝까지 달려!',kind:'finish',runnerId:dramaticFinish?challenger.id:winner.id},
    {at:57.78,duration:.9,title:dramaticFinish?'휘청한 순간, 마지막 역전!':'추격을 뿌리친 선두! 끝까지!',kind:dramaticFinish?'comeback':'defend',runnerId:winner.id}
  ];
  const finishEvent={kind:dramaticFinish?'overtake':'defend',at:57.78,duration:.9,overtakeAt:dramaticFinish?57.87:null,winnerId:winner.id,challengerId:challenger.id,leaderBeforeId:dramaticFinish?challenger.id:winner.id,crossings:runners.filter(r=>r.rank<5).sort((a,b)=>a.rank-b.rank).map(r=>({runnerId:r.id,rank:r.rank,at:56+(r.finish-58)/.5}))};
  const startGrid={columns:gridColumns,rows:gridRows,columnSpacing:3.5,rowSpacing:3.5,startLine:0,slots:runners.map(r=>({id:r.id,x:r.gridX,z:r.gridZ}))};
  return {runners,obstacles,beats,dramaticFinish,finishEvent,startGrid,order:[...order],seed,lanes,count:n,duration:DURATION};
}
export function positionAt(r,t){
 // On the 60-second timeline the first five cross at 58.2, 58.56,
 // 58.92, 59.28 and 59.64 seconds during the 0.5x finish.
 // They keep moving beyond the stripe while the remaining field approaches.
 if(t>=FINAL_SEQUENCE_AT)return finishPosition(r,t);
 const rate=r.sampleRate||20,s=Math.max(0,Math.min(60,t))*rate,i=Math.min(r.samples.length-2,Math.floor(s));return mix(r.samples[i],r.samples[i+1],Math.min(1,s-i));
}
export function eventAt(r,t){const active=r.events.filter(e=>t>=e.at&&t<e.at+e.duration);return active.find(e=>e.cinematicOnly)||active.find(e=>e.holdDuration)||active.find(e=>e.type==='hurdle')||active.find(e=>e.type==='dodge')||active[0]||null;}
function freeLateralAt(r,t){
 const roaming=r.z+Math.sin(t*.67+r.phase)*r.wander+Math.sin(t*.23+r.phase*2)*1.5;
 const u=Math.max(0,Math.min(1,(t-49)/8)),settle=u*u*(3-2*u);
 // Keep an irregular pack, but reduce sideways weaving for a readable photo finish.
 const approach=r.z*.42+Math.sin(t*.44+r.phase)*.6;
 const natural=Math.max(-11.4,Math.min(11.4,roaming+(approach-roaming)*settle));
 if(t<4.2)return mix(r.gridX??natural,r.launchX??natural,ease((t-.15)/4.05));
 if(t<9)return mix(r.launchX??natural,natural,ease((t-4.2)/4.8));
 return natural;
}
export function lateralAt(r,t){
 if(r.lateralSamples){const s=Math.max(0,Math.min(60,t))*(r.sampleRate||40),i=Math.min(r.lateralSamples.length-2,Math.floor(s));return mix(r.lateralSamples[i],r.lateralSamples[i+1],Math.min(1,s-i));}
 const natural=freeLateralAt(r,t);
 const holding=r.events?.find(e=>e.holdDuration&&Number.isFinite(e.lateral)&&t>=e.contactAt&&t<e.holdUntil+.45);
 if(!holding)return natural;
 return mix(holding.lateral,natural,ease((t-holding.holdUntil)/.45));
}
export function rankingAt(plan,t){return [...plan.runners].sort((a,b)=>{const af=t>=a.finish,bf=t>=b.finish;if(af&&bf)return a.rank-b.rank;if(af!==bf)return af?-1:1;return positionAt(b,t)-positionAt(a,t)||a.index-b.index;});}
export function cameraPhase(t){return t<=20?0:t<45?((t-20)/25)*.7:.7+.3*Math.min(1,(t-45)/12);}
// A final sprint followed by genuine slow motion, ending at 60 wall-clock seconds.
export function cinemaTime(t){
 if(t<=52)return t;
 // Join the final 0.5x segment with continuous position and speed.
 // Its scene clock reaches 60 exactly when the race timer ends.
 if(t<56){const u=(t-52)/4;return 52+4*u+8*u*u-6*u*u*u;}
 return Math.min(60,58+(t-56)*.5);
}
