import {connectEnrollment,normalizeEventId,studentFromId,enrollmentError} from './enrollment-store.js';
const $=id=>document.getElementById(id),eventId=normalizeEventId(new URLSearchParams(location.search).get('event'));
let sdk,status='loading',submitted=false,busy=false,eventReady=false;
function message(text,error=false){$('joinMessage').textContent=text;$('joinMessage').dataset.error=String(error);}
function sync(){const open=status==='open';$('joinStatus').textContent=open?'✦ 지금 참가 신청을 받고 있어요':status==='loading'?'접수 상태를 확인하고 있어요…':status==='closed'?'이번 참가 신청이 마감되었어요':status==='offline'?'인터넷 연결을 확인해 주세요':'아직 접수가 시작되지 않았어요';$('joinSubmit').disabled=!open||busy||submitted;}
function success(id){submitted=true;$('joinForm').hidden=true;$('joinResult').hidden=false;$('joinResult').textContent=`✦ ${id}번 신청 완료!\n선생님이 명단을 확정하면 추첨에 참여합니다.`;message('');sync();}
try{
 sdk=await connectEnrollment();
 sdk.onSnapshot(sdk.doc(sdk.db,'events',eventId),{includeMetadataChanges:true},snapshot=>{eventReady=!snapshot.metadata.fromCache;status=snapshot.metadata.fromCache?'offline':snapshot.exists()?snapshot.data().status:'pending';sync();},error=>{status='offline';sync();message(enrollmentError(error),true);});
 if(sdk.auth.currentUser){const own=await sdk.getDocFromServer(sdk.doc(sdk.db,'events',eventId,'participantsByUid',sdk.auth.currentUser.uid));if(own.exists())success(own.data().studentId);}
}catch(error){status='offline';sync();message(enrollmentError(error),true);}
$('joinForm').addEventListener('submit',async event=>{
 event.preventDefault();if(!sdk||busy||submitted)return;
 const student=studentFromId($('studentId').value);if(!student){message('3학년 학번 네 자리를 확인해 주세요. 예: 3105',true);return;}
 if(!$('joinConsent').checked){message('학번 수집·이용 동의에 체크해 주세요.',true);return;}
 if(!eventReady||status!=='open'){message('현재 접수 중이 아닙니다. 접수 상태를 확인해 주세요.',true);return;}
 busy=true;sync();message('신청을 저장하고 있어요…');
 try{
  const user=sdk.auth.currentUser||(await sdk.signInAnonymously(sdk.auth)).user;
  const ownRef=sdk.doc(sdk.db,'events',eventId,'participantsByUid',user.uid),own=await sdk.getDocFromServer(ownRef);
  if(own.exists()){success(own.data().studentId);return;}
  const batch=sdk.writeBatch(sdk.db);
  batch.set(sdk.doc(sdk.db,'events',eventId,'registrations',student.id),{studentId:student.id,uid:user.uid,createdAt:sdk.serverTimestamp()});
  batch.set(ownRef,{studentId:student.id,createdAt:sdk.serverTimestamp()});
  await batch.commit();success(student.id);
 }catch(error){message(String(error?.code).includes('permission-denied')?'이미 신청된 학번이거나 접수가 마감되었습니다. 학번을 확인하고, 필요하면 담당 선생님께 문의해 주세요.':enrollmentError(error),true);}
 finally{busy=false;sync();}
});
