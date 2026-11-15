let room=null;try{const saved=JSON.parse(localStorage.getItem('starlight-race-room')||'null');if(saved&&/^room_[a-f0-9]{32}$/.test(saved.id)&&['manual','excel','classes'].includes(saved.mode))room=saved;}catch{}
function persist(){try{if(room)localStorage.setItem('starlight-race-room',JSON.stringify(room));else localStorage.removeItem('starlight-race-room');}catch{}}
export function currentRoom(){return room;}
export function prepareRoom(mode='classes'){if(!room){const random=new Uint8Array(16);crypto.getRandomValues(random);room={id:'room_'+Array.from(random,b=>b.toString(16).padStart(2,'0')).join(''),mode,established:false};}if(!room.established)room.mode=mode;persist();return room;}
export function establishRoom(mode){prepareRoom(mode);room.established=true;persist();}
export function forgetRoom(){room=null;persist();}
export function markRoomOnline(){if(room){room.online=true;persist();}}
export async function closeOnlineRoom(){
 if(!room?.online)return;
 const {connectEnrollment}=await import('./enrollment-store.js'),sdk=await connectEnrollment();
 const ref=sdk.doc(sdk.db,'events',room.id),snap=await sdk.getDocFromServer(ref);if(!snap.exists())return;
 if(!sdk.auth.currentUser||snap.data().ownerUid!==sdk.auth.currentUser.uid)throw Error('이 방을 만들었던 브라우저의 접속 정보를 확인해 주세요.');
 if(snap.data().status==='open')await sdk.updateDoc(ref,{status:'closed',closedAt:sdk.serverTimestamp(),updatedAt:sdk.serverTimestamp()});
}
