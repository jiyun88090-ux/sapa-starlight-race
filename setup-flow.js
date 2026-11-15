export function tidySetup(){
 const dialog=document.getElementById('setupDialog');dialog.classList.add('choosing');
 document.querySelector('.dialog-heading h2').textContent='레이스 방 개설';document.querySelector('.dialog-heading p').textContent='참가 방법을 선택해 방을 만들어 주세요.';
 const settings=document.querySelector('.settings-panel'),qr=document.querySelector('.enroll-merge');settings.append(qr);
 const advanced=document.createElement('details');advanced.className='setup-advanced';const title=document.createElement('summary');title.textContent='추가 설정 · 제외 학번 / 화면 품질';advanced.append(title);
 for(const selector of ['label[for="excludeInput"]','#excludeInput','.field-hint','label[for="qualitySelect"]','#qualitySelect']){const node=document.querySelector(selector);if(node)advanced.append(node);}
 settings.append(advanced);
 for(const button of document.querySelectorAll('.mode-tabs button'))button.addEventListener('click',()=>{dialog.classList.remove('choosing');qr.hidden=button.id==='manualMode';});
}
