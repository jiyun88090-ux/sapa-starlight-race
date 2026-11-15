import {renderPodium} from './result-podium.js';
let currentPlan=null,visible=new Set(),next=0,context;
const $=id=>document.getElementById(id);
export function showAwards(options){
 context=options;if(currentPlan!==options.plan){currentPlan=options.plan;visible=new Set();next=Math.min(5,options.results.length);}
 let controls=$('revealControls');if(!controls){controls=document.createElement('div');controls.id='revealControls';controls.className='result-actions';controls.innerHTML='<button type="button" id="revealNextBtn" class="primary-btn"></button><button type="button" id="allRanksBtn" class="secondary-btn">전체 순위 보기</button>';document.querySelector('.result-actions').before(controls);const list=document.createElement('div');list.id='allRanksPanel';list.hidden=true;controls.after(list);
  $('revealNextBtn').onclick=()=>{const rank=next;visible.add(rank);next--;draw();const place=document.querySelector(`.podium-place-${rank}`);place?.classList.add(rank%2?'award-jump':'award-spin');context.onReveal?.();};
  $('allRanksBtn').onclick=()=>{const panel=$('allRanksPanel');panel.hidden=!panel.hidden;$('allRanksBtn').textContent=panel.hidden?'전체 순위 보기':'전체 순위 닫기';if(!panel.hidden){panel.replaceChildren();context.results.forEach((r,i)=>{const row=document.createElement('p');row.textContent=`${i+1}위 · ${r.grade?r.grade+'학년 '+r.classroom+'반 ':''}${r.number}번${i<context.winnerCount?' · 당첨':''}`;panel.append(row);});}};
 }
 $('allRanksPanel').hidden=true;$('allRanksBtn').textContent='전체 순위 보기';draw();
}
function draw(){
 const student=context.results.some(r=>r.grade),done=!student||next===0;
 renderPodium($('resultPodium'),{...context,revealedRanks:student?visible:null});
 $('revealNextBtn').hidden=!student;$('revealNextBtn').disabled=done;$('revealNextBtn').textContent=done?'학년 · 반 공개 완료':`${next}위 학년 · 반 공개`;
 $('allRanksBtn').disabled=!done;$('allRanksBtn').title=done?'':'단상의 학년·반을 모두 공개한 뒤 볼 수 있습니다.';
 $('saveImageBtn').hidden=!done;$('winnerCards').hidden=!done||context.winnerCount<=5;
}
