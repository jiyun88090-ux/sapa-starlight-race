import {defaultEventId} from './firebase-config.js';
import {connectEnrollment,normalizeEventId,joinUrl,validatedSnapshot,downloadEnrollment,enrollmentError} from './enrollment-store.js';
export function mountEnrollmentAdmin(root,{onUseSnapshot}={}){
 root.classList.add('enrollment-ui');
 root.innerHTML=`<h2>3학년 참가 접수</h2><p class="enroll-muted">접수를 마감한 뒤 명단을 확정해 주세요. 확정 전에는 경주 명단이 바뀌지 않습니다.</p>
 <section class="enroll-card"><div class="enroll-row"><button type="button" data-action="connect">Firebase 연결</button><button type="button" data-action="login" disabled>선생님 Google 로그인</button><button type="button" data-action="logout" hidden>로그아웃</button><button type="button" data-action="check" hidden>관리자 권한 다시 확인</button></div><p class="enroll-login-state enroll-muted" data-view="account">연결 준비 중입니다.</p><code class="enroll-uid" data-view="uid" hidden></code></section>
 <section class="enroll-card"><label for="enrollEventId">접수 회차 이름 <small class="enroll-muted">영문·숫자·하이픈</small></label><div class="enroll-row"><input id="enrollEventId" data-field="event" maxlength="60" aria-label="접수 회차 이름"><button type="button" data-action="event">이 회차 선택</button><button type="button" data-action="qr">QR 크게 보기</button></div><p class="enroll-muted">다른 회차 이름을 사용하면 이전 신청과 분리해서 새로 접수합니다.</p><p class="enroll-event-status" data-view="status">온라인 접수 연결 전</p><div class="enroll-actions"><button type="button" class="enroll-primary" data-action="open" disabled>접수 시작</button><button type="button" data-action="close" disabled>접수 마감</button><button type="button" data-action="use" disabled ${onUseSnapshot?'':'hidden'}>마감 명단 가져오기</button><button type="button" data-action="download" disabled>마감 명단 파일 저장</button></div><div class="enroll-list" data-view="list"></div></section><p class="enroll-message" data-view="message" role="status"></p>`;
 const action=name=>root.querySelector(`[data-action="${name}"]`),view=name=>root.querySelector(`[data-view="${name}"]`),eventInput=root.querySelector('[data-field="event"]');
 let eventId;try{eventId=normalizeEventId(localStorage.getItem('starlight-enrollment-event'));}catch{eventId=defaultEventId;}
 eventInput.value=eventId;
 let sdk,active=false,busy=false,isAdmin=false,eventData=null,eventOnline=false,entries=[],authVersion=0,authUnsub,eventUnsub,listUnsub;
 const say=(text,error=false)=>{view('message').textContent=text;view('message').dataset.error=String(error);};
 function stop(){eventUnsub?.();listUnsub?.();eventUnsub=listUnsub=null;eventData=null;eventOnline=false;entries=[];}
 function render(){
  const user=sdk?.auth.currentUser,teacher=user&&!user.isAnonymous,ready=isAdmin&&eventOnline&&!busy;
  action('login').disabled=!sdk||busy;action('logout').hidden=!teacher;action('check').hidden=!teacher||isAdmin;
  action('connect').hidden=!!sdk;action('event').disabled=busy;eventInput.disabled=busy;
  action('open').disabled=!ready||eventData?.status==='open';
  action('open').textContent=eventData?.status==='closed'?'접수 다시 열기':'접수 시작';
  action('close').disabled=!ready||eventData?.status!=='open';action('use').disabled=action('download').disabled=!ready||eventData?.status!=='closed';
  view('account').textContent=isAdmin?`${user?.email||'선생님'} · 관리자 연결 완료`:teacher?'관리자 UID를 Firebase에 등록한 뒤 ‘관리자 권한 다시 확인’을 눌러주세요.':'선생님 Google 계정으로 로그인해 주세요.';
  view('uid').hidden=!teacher||isAdmin;view('uid').textContent=teacher?`관리자 UID: ${user.uid}`:'';
  view('status').textContent=!isAdmin?'관리자 로그인 후 신청 현황을 확인할 수 있습니다.':!eventOnline?'서버 연결 확인 중 · 명단을 아직 확정할 수 없습니다.':!eventData?`${eventId} · 아직 접수를 시작하지 않았습니다.`:`${eventId} · ${eventData.status==='open'?'접수 중':'접수 마감'} · 3학년 ${entries.length}명`;
  view('list').replaceChildren();
  for(const row of entries){const card=document.createElement('div');card.className='enroll-student';const text=document.createElement('span');text.textContent=row.studentId;const remove=document.createElement('button');remove.type='button';remove.textContent='삭제';remove.disabled=!ready||eventData?.status!=='closed';remove.setAttribute('aria-label',row.studentId+' 신청 삭제');remove.onclick=()=>perform(async()=>{
    if(!confirm(`${row.studentId}번 신청을 삭제할까요?`))return;
    const batch=sdk.writeBatch(sdk.db);batch.delete(sdk.doc(sdk.db,'events',eventId,'registrations',row.studentId));batch.delete(sdk.doc(sdk.db,'events',eventId,'participantsByUid',row.uid));batch.update(sdk.doc(sdk.db,'events',eventId),{updatedAt:sdk.serverTimestamp()});await batch.commit();say(row.studentId+'번 신청을 삭제했습니다.');
   });card.append(text,remove);view('list').append(card);}
 }
 async function perform(work){if(busy)return;busy=true;render();try{await work();}catch(error){say(enrollmentError(error),true);}finally{busy=false;render();}}
 function listen(){
  stop();if(!active||!isAdmin)return;
  eventUnsub=sdk.onSnapshot(sdk.doc(sdk.db,'events',eventId),{includeMetadataChanges:true},snapshot=>{eventData=snapshot.exists()?snapshot.data():null;eventOnline=!snapshot.metadata.fromCache;render();},error=>{eventOnline=false;say(enrollmentError(error),true);render();});
  listUnsub=sdk.onSnapshot(sdk.collection(sdk.db,'events',eventId,'registrations'),snapshot=>{entries=snapshot.docs.map(doc=>({...doc.data(),studentId:doc.id})).sort((a,b)=>a.studentId.localeCompare(b.studentId));render();},error=>{entries=[];say(enrollmentError(error),true);render();});
 }
 async function checkAdmin(user){
  const version=++authVersion;isAdmin=false;stop();render();if(!user||user.isAnonymous)return;
  try{const doc=await sdk.getDocFromServer(sdk.doc(sdk.db,'admins',user.uid));if(version!==authVersion)return;isAdmin=doc.exists()&&doc.data().active===true;if(isAdmin){say('관리자 연결 완료. 접수 회차를 확인해 주세요.');listen();}else say('Firestore의 admins 컬렉션에 위 UID를 문서 ID로 등록하고 active를 true로 설정해 주세요.');}
  catch(error){if(version===authVersion)say(enrollmentError(error),true);}render();
 }
 async function connect(){
  try{sdk=await connectEnrollment();if(!authUnsub)authUnsub=sdk.onAuthStateChanged(sdk.auth,checkAdmin);else await checkAdmin(sdk.auth.currentUser);}
  catch(error){say(enrollmentError(error),true);}render();
 }
 async function closedSnapshot(){
  const ref=sdk.doc(sdk.db,'events',eventId),before=await sdk.getDocFromServer(ref);
  if(!before.exists()||before.data().status!=='closed'||!before.data().closedAt)throw Error('먼저 접수를 마감해 주세요.');
  const rows=await sdk.getDocsFromServer(sdk.collection(sdk.db,'events',eventId,'registrations')),after=await sdk.getDocFromServer(ref);
  if(!after.exists()||after.data().status!=='closed'||after.data().updatedAt?.toMillis()!==before.data().updatedAt?.toMillis())throw Error('접수 상태나 명단이 바뀌었습니다. 마감 상태를 확인하고 다시 가져와 주세요.');
  return validatedSnapshot({format:'starlight-grade3-v1',eventId,closedAt:before.data().closedAt.toDate().toISOString(),students:rows.docs.map(doc=>doc.id)});
 }
 action('connect').onclick=connect;
 action('login').onclick=()=>perform(async()=>{const provider=new sdk.GoogleAuthProvider();provider.setCustomParameters({prompt:'select_account'});await sdk.signInWithPopup(sdk.auth,provider);});
 action('logout').onclick=()=>perform(()=>sdk.signOut(sdk.auth));
 action('check').onclick=()=>perform(()=>checkAdmin(sdk.auth.currentUser));
 action('event').onclick=()=>{const entered=eventInput.value.trim();if(!/^[a-zA-Z0-9_-]{1,60}$/.test(entered)){say('회차 이름은 영문·숫자·하이픈·밑줄로 1~60자 입력해 주세요.',true);return;}eventId=entered;try{localStorage.setItem('starlight-enrollment-event',eventId);}catch{}say('접수 회차를 '+eventId+'로 선택했습니다.');listen();render();};
 action('open').onclick=()=>perform(async()=>{if(!isAdmin)return;await sdk.setDoc(sdk.doc(sdk.db,'events',eventId),{title:'창원사파고 별빛레이스',status:'open',closedAt:null,updatedAt:sdk.serverTimestamp()},{merge:true});say('접수를 시작했습니다. 학생용 페이지를 배포한 뒤 QR을 보여주세요.');});
 action('close').onclick=()=>perform(async()=>{if(!isAdmin)return;await sdk.updateDoc(sdk.doc(sdk.db,'events',eventId),{status:'closed',closedAt:sdk.serverTimestamp(),updatedAt:sdk.serverTimestamp()});say('접수를 마감했습니다. 명단을 가져오거나 파일로 저장해 주세요.');});
 action('use').onclick=()=>perform(async()=>{const snapshot=await closedSnapshot();await onUseSnapshot?.(snapshot);say(`마감된 3학년 ${snapshot.students.length}명을 가져왔습니다. 참가자 설정에서 ‘명단 확인 완료’를 눌러 적용해 주세요.`);});
 action('download').onclick=()=>perform(async()=>{const snapshot=await closedSnapshot();downloadEnrollment(snapshot);say('마감 명단 파일을 저장했습니다. 이 파일을 실행파일의 참가자 설정에서 불러올 수 있습니다.');});
 action('qr').onclick=()=>showQr(eventId).catch(error=>say(enrollmentError(error),true));
 render();return {resume(){active=true;connect();},suspend(){active=false;stop();render();}};
}
let qrScript;
async function showQr(eventId){
 if(!globalThis.qrcode){if(!qrScript)qrScript=new Promise((resolve,reject)=>{const script=document.createElement('script');script.src=new URL('./vendor/qrcode.js',import.meta.url).href;script.onload=resolve;script.onerror=()=>reject(Error('QR 생성 파일을 불러오지 못했습니다.'));document.head.append(script);}).catch(error=>{qrScript=null;throw error;});await qrScript;}
 const url=joinUrl(eventId),qr=globalThis.qrcode(0,'M');qr.addData(url);qr.make();
 const dialog=document.createElement('dialog');dialog.className='enrollment-dialog enrollment-ui enroll-qr-view';const heading=document.createElement('h2');heading.textContent='✦ 3학년 별빛레이스 참가 신청';
 const text=document.createElement('p');text.textContent='QR을 찍고 본인 학번을 입력해 주세요.';
 const canvas=document.createElement('canvas'),count=qr.getModuleCount(),scale=8,margin=4;canvas.width=canvas.height=(count+margin*2)*scale;const context=canvas.getContext('2d');context.fillStyle='white';context.fillRect(0,0,canvas.width,canvas.height);context.fillStyle='#101b33';for(let y=0;y<count;y++)for(let x=0;x<count;x++)if(qr.isDark(y,x))context.fillRect((x+margin)*scale,(y+margin)*scale,scale,scale);
 const link=document.createElement('a');link.href=url;link.target='_blank';link.rel='noopener';link.textContent=url;
 const notice=document.createElement('p');notice.className='enroll-muted';notice.textContent='학생용 신청 페이지를 인터넷에 배포한 뒤 사용하세요.';
 const button=document.createElement('button');button.type='button';button.textContent='닫기';button.onclick=()=>dialog.close();dialog.append(heading,text,canvas,link,notice,button);dialog.addEventListener('close',()=>dialog.remove(),{once:true});document.body.append(dialog);dialog.showModal();
}
