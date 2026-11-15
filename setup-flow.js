import {currentRoom,prepareRoom} from './race-room.js';
export function syncSetupRoom(){
 const room=currentRoom(),dialog=document.getElementById('setupDialog'),created=!!room?.established;
 dialog.classList.toggle('room-established',created);dialog.classList.toggle('choosing',!created&&!dialog.dataset.roomChosen);
 document.querySelector('.dialog-heading h2').textContent=created?'현재 방 설정':'레이스 방 개설';
 const name={classes:'학급별 입력',excel:'엑셀 명단',manual:'인원 직접 선택'}[room?.mode];
 document.querySelector('.dialog-heading p').textContent=room?`${name} 방 · 참가 인원과 경주 설정을 확인하세요.`:'참가 방법을 선택해 방을 만들어 주세요.';
 document.getElementById('readyBtn').textContent=created?'✦ 설정 적용':'✦ 방 만들기 · 참가 확정';
 const leave=document.getElementById('leaveRoomBtn');if(leave)leave.hidden=!created;
 const qr=document.querySelector('.enroll-merge');if(qr)qr.hidden=room?.mode==='manual';
}
export function tidySetup(){
 const dialog=document.getElementById('setupDialog');dialog.classList.add('choosing');
 document.querySelector('.dialog-heading h2').textContent='레이스 방 개설';document.querySelector('.dialog-heading p').textContent='참가 방법을 선택해 방을 만들어 주세요.';
 const settings=document.querySelector('.settings-panel'),qr=document.querySelector('.enroll-merge');settings.append(qr);
 const advanced=document.createElement('details');advanced.className='setup-advanced';const title=document.createElement('summary');title.textContent='추가 설정 · 제외 학번 / 화면 품질';advanced.append(title);
 for(const selector of ['label[for="excludeInput"]','#excludeInput','.field-hint','label[for="qualitySelect"]','#qualitySelect']){const node=document.querySelector(selector);if(node)advanced.append(node);}
 settings.append(advanced);
 for(const button of document.querySelectorAll('.mode-tabs button'))button.addEventListener('click',()=>{dialog.dataset.roomChosen='yes';prepareRoom({classMode:'classes',excelMode:'excel',manualMode:'manual'}[button.id]);syncSetupRoom();});
 syncSetupRoom();
}
