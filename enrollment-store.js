import {firebaseConfig,defaultEventId,publicSiteUrl} from './firebase-config.js';
const sdkRoot='https://www.gstatic.com/firebasejs/13.3.0/';
let connection;
export function connectEnrollment(){
 if(!connection)connection=(async()=>{
  const [appSdk,authSdk,storeSdk]=await Promise.all([import(sdkRoot+'firebase-app.js'),import(sdkRoot+'firebase-auth.js'),import(sdkRoot+'firebase-firestore.js')]);
  const app=appSdk.getApps().find(app=>app.name==='starlight-enrollment')||appSdk.initializeApp(firebaseConfig,'starlight-enrollment');
  const auth=authSdk.getAuth(app),db=storeSdk.getFirestore(app);
  await auth.authStateReady();
  return {auth,db,...authSdk,...storeSdk};
 })().catch(error=>{connection=null;throw error;});
 return connection;
}
export function normalizeEventId(value){const id=String(value||'').trim();return /^[a-zA-Z0-9_-]{1,60}$/.test(id)?id:defaultEventId;}
export function studentFromId(value){const id=String(value??'').trim(),m=id.match(/^3([1-7])(0[1-9]|[1-9][0-9])$/);return m?{id,grade:3,classroom:Number(m[1]),number:Number(m[2])}:null;}
export function validatedSnapshot(value){
 if(!value||value.format!=='starlight-grade3-v1'||!Array.isArray(value.students)||value.students.length>693||!Number.isFinite(Date.parse(value.closedAt)))throw Error('별빛레이스에서 마감 후 저장한 3학년 명단 파일을 선택해 주세요.');
 const ids=value.students.map(row=>typeof row==='string'?row:row?.id),students=ids.map(studentFromId);
 if(students.some(row=>!row)||new Set(students.map(row=>row.id)).size!==ids.length)throw Error('3학년 학번이 잘못되었거나 중복되어 있습니다.');
 return {format:'starlight-grade3-v1',eventId:normalizeEventId(value.eventId),closedAt:value.closedAt,students:students.sort((a,b)=>a.id.localeCompare(b.id))};
}
export function joinUrl(eventId){const url=new URL('join.html',publicSiteUrl);url.searchParams.set('event',normalizeEventId(eventId));return url.href;}
export function enrollmentError(error){
 const code=String(error?.code||'');
 if(code.includes('operation-not-allowed')||code.includes('configuration-not-found'))return 'Firebase Authentication에서 Google 로그인과 익명 로그인을 먼저 사용 설정해 주세요.';
 if(code.includes('unauthorized-domain'))return 'Firebase Authentication → 설정 → 승인된 도메인에 현재 사이트 주소를 등록해 주세요.';
 if(code.includes('popup-blocked'))return '로그인 팝업을 허용한 뒤 다시 눌러주세요.';
 if(code.includes('popup-closed')||code.includes('cancelled-popup'))return '로그인 창이 닫혔습니다. 다시 시도해 주세요.';
 if(code.includes('permission-denied'))return '접근 권한이 없습니다. 새 방 개설용 Firestore 보안 규칙이 게시되었는지 확인해 주세요.';
 if(code.includes('too-many-requests'))return '신청이 일시적으로 몰렸습니다. 잠시 후 다시 시도하거나 다른 인터넷 연결을 이용해 주세요.';
 if(code.includes('unavailable')||code.includes('network')||error instanceof TypeError)return '인터넷 연결 또는 Firebase 연결 상태를 확인해 주세요.';
 return error?.message||'처리를 완료하지 못했습니다. 다시 시도해 주세요.';
}
export function downloadEnrollment(value){const blob=new Blob([JSON.stringify(value,null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=`별빛레이스_3학년_${value.eventId}.json`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
