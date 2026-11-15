import {connectEnrollment,joinUrl,validatedSnapshot,downloadEnrollment,enrollmentError} from './enrollment-store.js';

export function mountEnrollmentAdmin(root,{onUseSnapshot}={}){
 root.classList.add('enrollment-ui');
 root.innerHTML=`<h2>학생 참가 접수</h2><p class="enroll-muted">방을 개설하고 QR을 보여주세요. 접수를 마감한 뒤 명단을 가져올 수 있습니다.</p>
 <section class="enroll-card"><p class="enroll-event-status" data-view="status">연결을 준비하고 있습니다.</p><div class="enroll-actions"><button type="button" class="enroll-primary" data-action="create" disabled>새 방 개설</button><button type="button" data-action="qr" disabled>QR 크게 보기</button><button type="button" data-action="close" disabled>접수 마감</button><button type="button" data-action="use" disabled ${onUseSnapshot?'':'hidden'}>마감 명단 가져오기</button><button type="button" data-action="download" disabled>마감 명단 파일 저장</button></div><p class="enroll-muted">방을 개설한 같은 브라우저에서 접수와 마감을 관리해 주세요. 브라우저 기록을 삭제하거나 다른 기기로 바꾸면 방 관리 권한을 잃을 수 있습니다.</p><div class="enroll-list" data-view="list"></div></section><p class="enroll-message" data-view="message" role="status"></p>`;
 const action=name=>root.querySelector(`[data-action="${name}"]`),view=name=>root.querySelector(`[data-view="${name}"]`);
 let eventId='';try{eventId=localStorage.getItem('starlight-room-id')||'';}catch{}
 let sdk,active=false,busy=false,eventData=null,eventOnline=false,entries=[],eventUnsub,listUnsub;
 const say=(text,error=false)=>{view('message').textContent=text;view('message').dataset.error=String(error);};
 function stop(){eventUnsub?.();listUnsub?.();eventUnsub=listUnsub=null;eventData=null;eventOnline=false;entries=[];}
 function render(){
  const owner=eventData&&sdk?.auth.currentUser?.uid===eventData.ownerUid,ready=!!sdk&&!busy,roomReady=ready&&eventOnline&&owner;
  action('create').disabled=!ready||!!(owner&&eventData?.status==='open');action('qr').disabled=!roomReady||eventData.status!=='open';action('close').disabled=!roomReady||eventData.status!=='open';action('use').disabled=action('download').disabled=!roomReady||eventData.status!=='closed';
  view('status').textContent=!sdk?'온라인 접수 연결 중':!eventId?'아직 열린 방이 없습니다. 새 방을 개설해 주세요.':!eventOnline?'방 연결 상태를 확인하고 있습니다.':!eventData?'방을 찾을 수 없습니다. 새 방을 개설해 주세요.':!owner?'이 브라우저에 이 방의 관리 권한이 없습니다. 새 방을 개설해 주세요.':`학생 ${entries.length}명 신청 · ${eventData.status==='open'?'접수 중':'접수 마감'}`;
  view('list').replaceChildren();
  for(const row of entries){const card=document.createElement('div');card.className='enroll-student';const label=document.createElement('span');label.textContent=row.studentId;const button=document.createElement('button');button.type='button';button.textContent='삭제';button.disabled=!roomReady||eventData.status!=='closed';button.onclick=()=>perform(async()=>{if(!confirm(`${row.studentId}번 신청을 삭제할까요?`))return;const batch=sdk.writeBatch(sdk.db);batch.delete(sdk.doc(sdk.db,'events',eventId,'registrations',row.studentId));batch.delete(sdk.doc(sdk.db,'events',eventId,'participantsByUid',row.uid));batch.update(sdk.doc(sdk.db,'events',eventId),{updatedAt:sdk.serverTimestamp()});await batch.commit();say(row.studentId+'번 신청을 삭제했습니다.');});card.append(label,button);view('list').append(card);}
 }
 async function perform(work){if(busy)return;busy=true;render();try{await work();}catch(error){say(enrollmentError(error),true);}finally{busy=false;render();}}
 function listen(){
  stop();if(!active||!sdk||!eventId)return;
  eventUnsub=sdk.onSnapshot(sdk.doc(sdk.db,'events',eventId),{includeMetadataChanges:true},snap=>{
   eventData=snap.exists()?snap.data():null;eventOnline=!snap.metadata.fromCache;listUnsub?.();listUnsub=null;entries=[];
   if(eventData?.ownerUid===sdk.auth.currentUser?.uid)listUnsub=sdk.onSnapshot(sdk.collection(sdk.db,'events',eventId,'registrations'),rows=>{entries=rows.docs.map(d=>({...d.data(),studentId:d.id})).sort((a,b)=>a.studentId.localeCompare(b.studentId));render();},error=>{say(enrollmentError(error),true);render();});
   render();
  },error=>{eventOnline=false;say(enrollmentError(error),true);render();});
 }
 async function connect(){try{sdk=await connectEnrollment();if(!sdk.auth.currentUser)await sdk.signInAnonymously(sdk.auth);if(active)listen();}catch(error){sdk=null;say(enrollmentError(error),true);}render();}
 async function closedSnapshot(){
  const ref=sdk.doc(sdk.db,'events',eventId),before=await sdk.getDocFromServer(ref);
  if(!before.exists()||before.data().ownerUid!==sdk.auth.currentUser.uid||before.data().status!=='closed'||!before.data().closedAt)throw Error('방을 만든 브라우저에서 먼저 접수를 마감해 주세요.');
  const rows=await sdk.getDocsFromServer(sdk.collection(sdk.db,'events',eventId,'registrations')),after=await sdk.getDocFromServer(ref);
  if(!after.exists()||after.data().status!=='closed'||after.data().updatedAt?.toMillis()!==before.data().updatedAt?.toMillis())throw Error('접수 상태나 명단이 바뀌었습니다. 다시 가져와 주세요.');
  return validatedSnapshot({format:'starlight-grade3-v1',eventId,closedAt:before.data().closedAt.toDate().toISOString(),students:rows.docs.map(d=>d.id)});
 }
 action('create').onclick=()=>perform(async()=>{
  if(eventData?.status==='open'&&!confirm('현재 방의 접수를 마감하지 않았습니다. 새 방을 개설할까요?'))return;
  const random=new Uint8Array(16);crypto.getRandomValues(random);const id='room_'+Array.from(random,b=>b.toString(16).padStart(2,'0')).join('');
  await sdk.setDoc(sdk.doc(sdk.db,'events',id),{title:'창원사파고 별빛레이스',status:'open',ownerUid:sdk.auth.currentUser.uid,closedAt:null,updatedAt:sdk.serverTimestamp()});eventId=id;
  try{localStorage.setItem('starlight-room-id',eventId);}catch{}listen();say('방을 개설했습니다. QR을 학생들에게 보여주세요.');
 });
 action('qr').onclick=()=>showQr(eventId).catch(error=>say(enrollmentError(error),true));
 action('close').onclick=()=>perform(async()=>{await sdk.updateDoc(sdk.doc(sdk.db,'events',eventId),{status:'closed',closedAt:sdk.serverTimestamp(),updatedAt:sdk.serverTimestamp()});say('접수를 마감했습니다. 명단을 가져오거나 파일로 저장해 주세요.');});
 action('use').onclick=()=>perform(async()=>{const snapshot=await closedSnapshot();await onUseSnapshot?.(snapshot);say(`학생 ${snapshot.students.length}명을 가져왔습니다. 참가자 설정에서 ‘방 만들기 · 참가 확정’를 눌러 주세요.`);});
 action('download').onclick=()=>perform(async()=>{const snapshot=await closedSnapshot();downloadEnrollment(snapshot);say('마감 명단 파일을 저장했습니다.');});
 render();return {resume(){active=true;connect();},suspend(){active=false;stop();render();}};
}
let qrScript;
async function showQr(eventId){
 if(!globalThis.qrcode){if(!qrScript)qrScript=new Promise((resolve,reject)=>{const script=document.createElement('script');script.src=new URL('./vendor/qrcode.js',import.meta.url).href;script.onload=resolve;script.onerror=()=>reject(Error('QR 생성 파일을 불러오지 못했습니다.'));document.head.append(script);}).catch(error=>{qrScript=null;throw error;});await qrScript;}
 const url=joinUrl(eventId),qr=globalThis.qrcode(0,'M');qr.addData(url);qr.make();const dialog=document.createElement('dialog');dialog.className='enrollment-dialog enrollment-ui enroll-qr-view';const heading=document.createElement('h2');heading.textContent='✦ 학생 별빛레이스 참가 신청';const text=document.createElement('p');text.textContent='QR을 찍고 본인 학번을 입력해 주세요.';
 const canvas=document.createElement('canvas'),count=qr.getModuleCount(),scale=8,margin=4;canvas.width=canvas.height=(count+margin*2)*scale;const context=canvas.getContext('2d');context.fillStyle='white';context.fillRect(0,0,canvas.width,canvas.height);context.fillStyle='#101b33';for(let y=0;y<count;y++)for(let x=0;x<count;x++)if(qr.isDark(y,x))context.fillRect((x+margin)*scale,(y+margin)*scale,scale,scale);
 const link=document.createElement('a');link.href=url;link.target='_blank';link.rel='noopener';link.textContent=url;const button=document.createElement('button');button.type='button';button.textContent='닫기';button.onclick=()=>dialog.close();dialog.append(heading,text,canvas,link,button);dialog.addEventListener('close',()=>dialog.remove(),{once:true});document.body.append(dialog);dialog.showModal();
}
