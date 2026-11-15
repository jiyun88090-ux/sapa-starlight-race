export function mountClassRoster(onChange){
 const panel=document.createElement('section');panel.id='classRosterPanel';panel.className='class-roster-panel';
 panel.innerHTML='<h3>우리 반, 함께 달려요!</h3><p>참여할 반을 체크하고 각 반의 인원수를 입력하세요.</p><div class="class-actions"><button type="button" data-check="yes">전체 참여</button><button type="button" data-check="no">전체 해제</button></div><div class="grade-columns"></div><div class="class-summary" aria-live="polite"></div><small>학번은 각 반의 1번부터 입력한 인원수까지 자동으로 만듭니다.</small>';
 const rows=[];
 for(let grade=1;grade<=2;grade++){
  const group=document.createElement('fieldset'),legend=document.createElement('legend');legend.textContent=grade+'학년';group.append(legend);
  for(let classroom=1;classroom<=7;classroom++){
   const row=document.createElement('div');row.className='class-entry';
   const label=document.createElement('label'),check=document.createElement('input'),name=document.createElement('span');check.type='checkbox';check.setAttribute('aria-label',grade+'학년 '+classroom+'반 참여');name.textContent=grade+'학년 '+classroom+'반';label.append(check,name);
   const count=document.createElement('input');count.type='number';count.min='1';count.max='99';count.step='1';count.placeholder='인원';count.disabled=true;count.setAttribute('aria-label',grade+'학년 '+classroom+'반 인원수');
   const unit=document.createElement('span');unit.textContent='명';row.append(label,count,unit);group.append(row);
   rows.push({grade,classroom,row,check,count});check.onchange=()=>notify();count.oninput=()=>notify();
  }
  panel.querySelector('.grade-columns').append(group);
 }
 function students(){const all=[];for(const r of rows){const n=Number(r.count.value);if(!r.check.checked||!Number.isInteger(n)||n<1||n>99)continue;for(let number=1;number<=n;number++)all.push({id:r.grade+String(r.classroom)+String(number).padStart(2,'0'),grade:r.grade,classroom:r.classroom,number});}return all;}
 function sync(){let total=0,max=0,selected=0;for(const r of rows){r.row.classList.toggle('selected',r.check.checked);r.count.disabled=!r.check.checked;if(r.check.checked){selected++;const n=Number(r.count.value);if(Number.isInteger(n)&&n>=1&&n<=99){total+=n;max=Math.max(max,n);}}}panel.querySelector('.class-summary').textContent='참여 '+selected+'개 반 · 전체 '+total+'명 · 경주 캐릭터 '+Math.min(50,Math.max(3,max),total)+'명';}
 function notify(){sync();onChange();}
 panel.querySelectorAll('[data-check]').forEach(button=>button.onclick=()=>{rows.forEach(r=>r.check.checked=button.dataset.check==='yes');notify();});
 function validate(){
  const selected=rows.filter(r=>r.check.checked);if(!selected.length)return '참여할 반을 하나 이상 체크해 주세요.';
  for(const r of selected){const n=Number(r.count.value);if(!Number.isInteger(n)||n<1||n>99){r.count.focus();return r.grade+'학년 '+r.classroom+'반 인원수를 1~99명의 정수로 입력해 주세요.';}}
  if(students().length<3)return '참여하는 학생은 총 3명 이상이어야 합니다.';
  if(students().length>1200)return '전체 참가 인원은 1,200명까지 입력할 수 있습니다.';
  return '';
 }
 function restore(saved){if(Array.isArray(saved))for(const r of rows){const item=saved.find(x=>x.grade===r.grade&&x.classroom===r.classroom);if(item){r.check.checked=item.enabled===true;const n=Number(item.count);r.count.value=Number.isInteger(n)&&n>=1&&n<=99?String(n):'';}}sync();}
 sync();return {panel,students,validate,restore,serialize:()=>rows.map(r=>({grade:r.grade,classroom:r.classroom,enabled:r.check.checked,count:r.count.value})),selectedCount:()=>rows.filter(r=>r.check.checked).length};
}
