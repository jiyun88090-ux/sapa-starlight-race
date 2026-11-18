// These stories stage the already drawn result; they never choose a winner.
export const FINISH_SCENARIOS = [
 {id:'double-fall',title:'1·2위가 동시에 우당탕! 3위의 대역전!',order:[1,2,0,3,4],falls:[1,2],burst:.65},
 {id:'fifth-boost',title:'5위의 별빛 부스터! 네 명을 제치고 결승선으로!',order:[1,2,3,4,0],burst:.25},
 {id:'banana-upset',title:'선두가 바나나에 미끌! 빈틈을 파고든 추격자!',order:[1,0,2,3,4],falls:[1],action:'banana',burst:.6},
 {id:'fourth-surge',title:'4위의 숨겨 둔 부스터! 마지막 직선 대추월!',order:[1,2,3,0,4],burst:.4},
 {id:'spin-recovery',title:'빙글 돈 추격자! 다시 가속해 끝내 역전!',order:[1,0,2,3,4],falls:[0],action:'spin',burst:.2},
 {id:'jump-finish',title:'휘청이는 선두 사이로 점프! 결승선을 잡았다!',order:[1,2,0,3,4],falls:[1],jump:true,burst:.6},
 {id:'chain-stumble',title:'선두부터 연달아 휘청! 4위에게 열린 길!',order:[1,2,3,0,4],falls:[1,2,3],stagger:true,burst:.5},
 {id:'late-counter',title:'추월당한 순간 다시 부스터! 끝나지 않은 재역전!',order:[0,1,2,3,4],counter:true,burst:.15},
 {id:'outside-sprint',title:'5위의 점프와 부스터! 마지막에 전원 추월!',order:[1,2,3,4,0],jump:true,burst:.55},
 {id:'photo-duel',title:'나란히 달리는 두 선수! 마지막 부스터로 간발의 차!',order:[1,0,2,3,4],burst:.7}
];

export function stageFinish(runners, story, finishPositionAt) {
 const cast=runners.filter(r=>r.rank<5),order=story.order.filter(rank=>cast.some(r=>r.rank===rank));
 for(const r of cast){
  const place=order.indexOf(r.rank),start=538-place*4.5,end=finishPositionAt(r,59.1);
  for(const p of r.points){if(p.t>=52&&p.t<=57.2)p.x=({52:486,54:507,56:526,57.2:538})[p.t]-place*4.5;}
  const fallen=story.falls?.includes(r.rank),holdEnd=57.65+(story.stagger?r.rank*.1:0);
  const fraction=r.rank===0?story.burst:story.counter&&r.rank===1?.8:.45;
  const middle=Math.max(start,Math.min(end-7,start+(end-start)*fraction));
  const keys=[{t:57.2,x:start}];
  if(fallen)keys.push({t:holdEnd,x:start});
  keys.push({t:58.3,x:middle},{t:59.1,x:end});
  // Monotone Hermite tangents preserve forward motion and continuous speed.
  const slopes=keys.slice(1).map((k,i)=>(k.x-keys[i].x)/(k.t-keys[i].t));
  keys.forEach((k,i)=>{k.speed=i===0?Math.min(10,3*slopes[0]):i===keys.length-1?25:slopes[i-1]*slopes[i]<=0?0:Math.min((slopes[i-1]+slopes[i])/2,3*Math.min(slopes[i-1],slopes[i]));});
  r.finishDrama={at:57.2,keyframes:keys};
  if(fallen)r.events.push({at:57.2,duration:holdEnd-57.2,type:story.action||'tumble',cinematicOnly:true,featured:true});
  if(r.rank===0){
   if(story.jump)r.events.push({at:57.8,duration:.42,type:'hurdle',cinematicOnly:true,featured:true});
   r.events.push({at:story.jump?58.22:fallen?holdEnd:57.7,duration:.85,type:'boost',cinematicOnly:true,featured:true});
  }
 }
}

export function storyPosition(drama,t){
 const keys=drama.keyframes;
 let i=0;while(i<keys.length-2&&t>keys[i+1].t)i++;
 const a=keys[i],b=keys[i+1],h=b.t-a.t,u=Math.max(0,Math.min(1,(t-a.t)/h)),u2=u*u,u3=u2*u;
 return (2*u3-3*u2+1)*a.x+(u3-2*u2+u)*h*a.speed+(-2*u3+3*u2)*b.x+(u3-u2)*h*b.speed;
}
