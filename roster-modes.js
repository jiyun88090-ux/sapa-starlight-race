import {manualRoster,maxClassSize} from './engine.js';
export function mountModes(onChange){
 const grid=document.querySelector('.setup-grid'),tabs=document.createElement('div');tabs.className='mode-tabs';tabs.innerHTML='<button type="button" id="excelMode">엑셀 명단</button><button type="button" id="manualMode">인원 직접 선택</button>';
 grid.before(tabs);
 const panel=document.createElement('section');panel.id='manualPanel';panel.className='manual-panel';panel.innerHTML='<span class="eyebrow">READY, SET, RUN!</span><h3>몇 명이 달릴까요?</h3><div class="count-stepper"><button id="countDown" type="button" aria-label="인원 줄이기">−</button><input id="manualCount" type="number" value="28" min="3" max="50" aria-label="참가 인원"><button id="countUp" type="button" aria-label="인원 늘리기">＋</button></div><p>참가 인원 3~50명</p><input id="manualSlider" type="range" min="3" max="50" value="28" aria-label="참가 인원 슬라이더"><div class="range-ends"><span>3명</span><span>50명</span></div><div class="mode-note">엑셀 없이 바로 달려요.<br>번호별로 동일한 당첨 기회를 갖습니다.</div>';
 grid.prepend(panel);
 const $=id=>document.getElementById(id);let mode='manual',count=28;
 function show(m,notify=true){mode=m;$('excelMode').classList.toggle('active',m==='excel');$('manualMode').classList.toggle('active',m==='manual');panel.hidden=m!=='manual';document.querySelector('.roster-panel').hidden=m==='manual';document.querySelector('label[for="excludeInput"]').hidden=m==='manual';$('excludeInput').hidden=m==='manual';document.querySelector('.field-hint').hidden=m==='manual';if(notify)onChange(mode,count);}
 function setCount(n){count=Math.max(3,Math.min(50,Math.round(Number(n)||3)));$('manualCount').value=count;$('manualSlider').value=count;onChange(mode,count);}
 $('countDown').onclick=()=>setCount(count-1);$('countUp').onclick=()=>setCount(count+1);$('manualCount').onchange=e=>setCount(e.target.value);$('manualSlider').oninput=e=>setCount(e.target.value);$('manualMode').onclick=()=>show('manual');$('excelMode').onclick=()=>show('excel');show('manual',false);
 return {get mode(){return mode;},get count(){return count;},restore(m,n){count=Math.max(3,Math.min(50,n||28));$('manualCount').value=count;$('manualSlider').value=count;show(m,false);},pool:()=>manualRoster(count),limit:roster=>mode==='manual'?count:maxClassSize(roster)};
}
