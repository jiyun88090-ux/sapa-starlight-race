import {validatedSnapshot} from './enrollment-store.js';
export function mountEnrollmentRoster({saved,onChange}={}){
 let snapshot=null,admin;
 try{if(saved?.snapshot)snapshot=validatedSnapshot(saved.snapshot);}catch{}
 const panel=document.createElement('section');panel.className='enrollment-ui enroll-merge';
 panel.innerHTML='<label><input type="checkbox" data-field="include">QR로 신청한 3학년도 함께 추첨</label><p class="enroll-mini-summary" data-view="summary"></p><div class="enroll-actions"><button type="button" data-action="manage">3학년 접수 관리 · QR</button><button type="button" data-action="file">신청 명단 파일 불러오기</button><button type="button" data-action="clear">가져온 명단 비우기</button></div><input type="file" accept=".json,application/json" hidden><p class="enroll-message" data-view="message" role="status"></p>';
 document.querySelector('.setup-grid').before(panel);
 const include=panel.querySelector('[data-field="include"]'),summary=panel.querySelector('[data-view="summary"]'),message=panel.querySelector('[data-view="message"]'),fileInput=panel.querySelector('input[type=file]');
 include.checked=!!snapshot&&saved?.enabled===true;
 function sync(){summary.textContent=snapshot?`${snapshot.eventId} · 마감된 3학년 ${snapshot.students.length}명 · ${new Date(snapshot.closedAt).toLocaleString('ko-KR')} 마감`:'마감된 신청 명단을 가져오면 입력한 1·2학년과 합칩니다. 인원 직접 선택 모드에는 합치지 않습니다.';panel.querySelector('[data-action="clear"]').disabled=!snapshot;}
 function accept(value){snapshot=validatedSnapshot(value);include.checked=true;message.textContent=`3학년 ${snapshot.students.length}명을 가져왔습니다. 아래 ‘명단 확인 완료’를 눌러 적용해 주세요.`;message.dataset.error='false';sync();onChange?.();}
 include.onchange=()=>onChange?.();
 panel.querySelector('[data-action="file"]').onclick=()=>fileInput.click();
 fileInput.onchange=async()=>{const file=fileInput.files[0];if(!file)return;try{if(file.size>256*1024)throw Error('명단 파일은 256KB 이하만 불러올 수 있습니다.');accept(JSON.parse(await file.text()));}catch(error){message.textContent=error.message||'명단을 불러오지 못했습니다.';message.dataset.error='true';}finally{fileInput.value='';}};
 panel.querySelector('[data-action="clear"]').onclick=()=>{snapshot=null;include.checked=false;message.textContent='가져온 3학년 명단을 비웠습니다. 온라인 신청 내역은 삭제하지 않습니다.';sync();onChange?.();};
 const dialog=document.createElement('dialog');dialog.className='enrollment-dialog enrollment-ui';const close=document.createElement('button');close.type='button';close.className='enroll-close';close.textContent='닫기 ×';close.onclick=()=>dialog.close();const root=document.createElement('div');dialog.append(close,root);document.body.append(dialog);dialog.addEventListener('close',()=>admin?.suspend());
 panel.querySelector('[data-action="manage"]').onclick=async()=>{dialog.showModal();try{if(!admin){root.textContent='접수 화면을 준비하고 있습니다…';const {mountEnrollmentAdmin}=await import('./enrollment-admin.js');admin=mountEnrollmentAdmin(root,{onUseSnapshot:accept});}if(dialog.open)admin.resume();}catch(error){root.textContent=error.message||'접수 화면을 불러오지 못했습니다.';}};
 sync();return {students:()=>include.checked&&snapshot?snapshot.students:[],serialize:()=>({enabled:include.checked&&!!snapshot,snapshot}),setMode(mode){include.disabled=mode==='manual';}};
}
