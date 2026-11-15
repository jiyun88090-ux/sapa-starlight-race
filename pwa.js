import {publicSiteUrl} from './firebase-config.js';
const button=document.createElement('button');button.type='button';button.className='icon-btn install-app-btn';button.id='installAppBtn';button.textContent='↓ 앱 설치';button.title='별빛레이스를 크롬 앱으로 설치';
document.querySelector('.header-actions')?.append(button);
let pendingPrompt;
const standalone=()=>matchMedia('(display-mode: standalone)').matches||navigator.standalone===true;
function sync(){button.hidden=standalone();}
window.addEventListener('beforeinstallprompt',event=>{event.preventDefault();pendingPrompt=event;sync();});
window.addEventListener('appinstalled',()=>{pendingPrompt=null;button.hidden=true;});
matchMedia('(display-mode: standalone)').addEventListener('change',sync);sync();
button.onclick=async()=>{
 if(pendingPrompt){const prompt=pendingPrompt;pendingPrompt=null;try{await prompt.prompt();const choice=await prompt.userChoice;if(choice.outcome==='accepted')button.hidden=true;return;}catch{}}
 showInstallHelp();
};
function showInstallHelp(){
 const dialog=document.createElement('dialog');dialog.className='install-help';
 const heading=document.createElement('h2');heading.textContent='별빛레이스 앱 설치';
 const text=document.createElement('p');text.textContent='일반 크롬 브라우저에서 아래 주소를 여세요. 주소창 오른쪽의 설치 아이콘 또는 크롬 메뉴(⋮)의 설치 항목으로 앱을 설치할 수 있습니다.';
 const link=document.createElement('a');link.href=publicSiteUrl;link.target='_blank';link.rel='noopener';link.textContent=publicSiteUrl;
 const note=document.createElement('p');note.className='install-help-note';note.textContent='설치하면 바탕화면·시작 메뉴 또는 홈 화면의 아이콘으로 실행할 수 있습니다. QR 신청과 접수 관리에는 인터넷 연결이 필요합니다.';
 const close=document.createElement('button');close.type='button';close.textContent='확인';close.onclick=()=>dialog.close();dialog.append(heading,text,link,note,close);dialog.addEventListener('close',()=>dialog.remove(),{once:true});document.body.append(dialog);dialog.showModal();
}
if('serviceWorker' in navigator&&(location.protocol==='https:'||new URLSearchParams(location.search).has('qa'))){window.addEventListener('load',()=>navigator.serviceWorker.register(new URL('./sw.js',import.meta.url),{scope:'./',updateViaCache:'none'}).catch(()=>{}));}
