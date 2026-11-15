import {showAwards} from './results-reveal.js';
import {tidySetup,syncSetupRoom} from './setup-flow.js';
import {currentRoom,establishRoom,forgetRoom} from './race-room.js';
import {parseRoster,parseStudentId,demoRoster,manualRoster,maxClassSize,prepareDraw,makePlan,rankingAt,positionAt,eventAt,identity,cinemaTime,EVENT_NAMES} from './engine.js';
import {RaceWorld,COURSES} from './world-cinematic.js';
import {mountModes} from './roster-modes.js';
import {RaceAudio} from './audio.js';
import {renderPodium,createCharacterPortrait} from './result-podium.js';
import {RacerIntro} from './racer-intro.js';
import {setPortraitTintEnabled} from './character-colors.js';
import {mountEnrollmentRoster} from './enrollment-roster.js';
const $=id=>document.getElementById(id),MAX_PARTICIPANTS=1200;
let cameraMode='side',preferredCameraMode='side';
function selectCamera(mode,automatic=false){
 if(!automatic)preferredCameraMode=mode;
 cameraMode=mode;world?.setCameraMode(mode);
 document.querySelectorAll('[data-race-camera]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.raceCamera===mode)));
 if(mode==='leader'){follow=null;$('leadBtn').hidden=true;if(plan)updateRanks();}
}
document.querySelectorAll('[data-race-camera]').forEach(button=>button.addEventListener('click',()=>selectCamera(button.dataset.raceCamera)));
const audio=new RaceAudio();let roster=[],rosterName='참가 명단',activeRoster=manualRoster(28),winnerCount=3,mode='manual',manualCount=28,fullDraw=[],plan,world,state='idle',elapsed=0,countElapsed=0,introElapsed=0,characterColors=true,pausedFrom='racing',follow=null,ranking=[],lastFrame=0,lastUi=-1,lastToast=0,shownEvents=new Set(),revealed=false,finishShown=false,quality='auto',workbook=null,pendingRoster=null,previousRanks=new Map(),performanceSamples=[];
let settings;try{settings=JSON.parse(localStorage.getItem('starlight-settings')||'null');if(settings?.roster){const p=parseRoster(settings.roster);if(p.participants.length>=3&&p.participants.length<=MAX_PARTICIPANTS){roster=p.participants;activeRoster=[...roster];rosterName=settings.name||'저장된 명단';}}if(settings?.winners)winnerCount=settings.winners;quality=settings?.quality||'auto';if(settings?.volume!==undefined){audio.setVolume(settings.volume);$('volume').value=Math.round(settings.volume*100);}if(settings?.muted){audio.muted=true;$('soundBtn').textContent='♪';$('soundBtn').setAttribute('aria-pressed','true');}}catch{}
characterColors=settings?.characterColors!==false;
let raceDuration=Number.isInteger(settings?.raceDuration)&&settings.raceDuration>=10&&settings.raceDuration<=300?settings.raceDuration:60;
function clockText(seconds){const n=Math.max(0,Math.floor(seconds));return String(Math.floor(n/60)).padStart(2,'0')+':'+String(n%60).padStart(2,'0');}
function syncDurationDraft(){
 const preset=[20,40,60].includes(raceDuration);$('durationSelect').value=preset?String(raceDuration):'custom';
 $('customDuration').value=raceDuration;$('customDurationField').hidden=preset;$('durationTotal').textContent=' / '+clockText(raceDuration);
}
$('durationSelect').addEventListener('change',()=>{$('customDurationField').hidden=$('durationSelect').value!=='custom';});
syncDurationDraft();
const racerIntro=new RacerIntro({onSkip:()=>{if(state==='intro'||(state==='paused'&&pausedFrom==='intro')){if(state==='paused')audio.unlock().catch(()=>{});beginCountdown();}},onTogglePause:()=>state==='paused'?resume():pause()});
function sceneTime(){return elapsed<=60?cinemaTime(elapsed):elapsed;}
function racePhase(){return state==='paused'?pausedFrom:state;}
function preRace(){return ['idle','intro','countdown'].includes(racePhase());}
function syncCharacterColors(){world?.setColorEnabled(characterColors);racerIntro.setTinted(characterColors);setPortraitTintEnabled(characterColors);}
syncCharacterColors();
function toast(msg){$('toast').textContent=msg;$('toast').classList.add('show');setTimeout(()=>$('toast').classList.remove('show'),3500);}
const enrollmentUi=mountEnrollmentRoster({saved:settings?.grade3Enrollment,onChange:()=>updateRosterUi()});
let confirmedEnrollment=enrollmentUi.serialize();
const modeUi=mountModes(()=>updateRosterUi());
function draftRoster(){const base=modeUi.mode==='excel'?roster:modeUi.pool();if(modeUi.mode==='manual')return base;return [...new Map([...base,...enrollmentUi.students()].map(student=>[`${student.grade}-${student.classroom}-${student.number}`,student])).values()];}
let classSettings=Array.isArray(settings?.classes)?settings.classes:[];
if(settings?.classSizeVersion!=='all-22-v1'){classSettings=classSettings.map(row=>({...row,count:'22'}));settings={...(settings||{}),classes:classSettings,classSizeVersion:'all-22-v1'};try{localStorage.setItem('starlight-settings',JSON.stringify(settings));}catch{}}
mode=['excel','classes'].includes(settings?.mode)?settings.mode:'manual';manualCount=Math.max(3,Math.min(50,settings?.manualCount||28));modeUi.restore(mode,manualCount,classSettings);
if(mode==='classes'&&modeUi.validateClasses()&&(modeUi.selectedClasses>0||enrollmentUi.students().length<3)){mode='manual';modeUi.restore(mode,manualCount,classSettings);}
activeRoster=draftRoster();if(maxClassSize(activeRoster)<3||activeRoster.length>MAX_PARTICIPANTS){mode='manual';modeUi.restore(mode,manualCount,classSettings);activeRoster=modeUi.pool();}winnerCount=Math.min(winnerCount,mode==='manual'?manualCount:Math.min(activeRoster.length,maxClassSize(activeRoster)));
function save(){try{localStorage.setItem('starlight-settings',JSON.stringify({roster:roster.map(p=>p.id),name:rosterName,winners:winnerCount,mode,manualCount,classes:classSettings,classSizeVersion:'all-22-v1',grade3Enrollment:confirmedEnrollment,quality,characterColors,raceDuration,volume:audio.volume,muted:audio.muted}));}catch{}}
function updateRosterUi(){
 const draft=modeUi.mode,pool=draftRoster(),n=pool.length,limit=draft==='manual'?n:n?Math.min(n,maxClassSize(pool)):0;enrollmentUi.setMode(draft);
 $('rosterBadge').textContent=mode==='manual'?`번호 레이스 · ${activeRoster.length}명`:`학생 ${activeRoster.length}명 · 캐릭터 ${plan?.count??maxClassSize(activeRoster)}명`;
 $('participantCount').textContent=`${plan?.count??limit}명 레이스`;$('setupCount').textContent=draft==='manual'?n:limit;
 $('rosterKind').textContent=draft==='manual'?'인원 직접 선택':draft==='classes'?`학급별 입력 · ${modeUi.selectedClasses}개 반 · 전체 ${n}명`:`엑셀 · 전체 ${n}명`;
 $('rosterSummaryText').textContent=draft==='manual'?'선택한 번호가 모두 함께 달립니다.':`${limit}개 번호가 출전합니다. 번호 순위를 뽑은 뒤, 같은 번호의 학생 중 학년·반을 추첨해 단상에서 공개합니다.`;
 $('winnerCount').max=Math.max(1,limit);if(limit>0)$('winnerCount').value=Math.min(Number($('winnerCount').value)||winnerCount,limit);$('qualitySelect').value=quality;
}
function setupPlan(){const draw=prepareDraw(activeRoster,mode);fullDraw=draw.all;plan=makePlan(draw.cast,{order:draw.order});plan.eligibleCount=activeRoster.length;plan.runners.forEach(r=>{r.colorVariant=Math.floor(r.index/8)%8;});ranking=rankingAt(plan,0);world.setQuality(quality,plan.count);world.setColorEnabled(characterColors);world.setPlan(plan);selectCamera(preferredCameraMode);follow=null;$('leadBtn').hidden=true;previousRanks.clear();updateRanks(true);$('participantCount').textContent=`${plan.count}명 레이스`;}
function updateRanks(force=false){if(!plan)return;const reveal=false;const list=$('rankList');if(force||list.children.length!==Math.min(10,ranking.length)){list.replaceChildren();ranking.slice(0,10).forEach(()=>{const button=document.createElement('button');button.className='rank-row';button.innerHTML='<span class="rank-no"></span><span class="rank-identity"><small></small><b></b></span><span class="rank-change"></span>';button.addEventListener('click',()=>{if(state==='idle')return;follow=button.dataset.id;$('leadBtn').hidden=false;updateRanks();});list.append(button);});}
 ranking.slice(0,10).forEach((r,i)=>{const row=list.children[i];row.dataset.id=r.id;row.classList.toggle('selected',follow===r.id);row.querySelector('.rank-no').textContent=i+1;const small=row.querySelector('small');small.textContent=reveal&&r.grade?`${r.grade}학년 ${r.classroom}반`:'';small.hidden=!reveal||!r.grade;row.querySelector('b').textContent=`${String(reveal?r.number:(r.displayNumber??r.number)).padStart(2,'0')}번`;const crossed=elapsed>=56&&sceneTime()>=r.finish;row.classList.toggle('crossed',crossed);const prev=previousRanks.get(r.id),delta=prev===undefined?0:prev-i;const arrow=row.querySelector('.rank-change');arrow.className='rank-change'+(delta>0?' up':delta<0?' down':'');arrow.classList.toggle('finish-check',crossed);arrow.textContent=crossed?'✓':delta>0?'▲':delta<0?'▼':'·';row.setAttribute('aria-label',`${i+1}위 ${identity(r,reveal)} 따라가기`);});previousRanks=new Map(ranking.map((r,i)=>[r.id,i]));}
function showSetup(){if(['racing','arrivals','intro','countdown'].includes(state))pause();updateRosterUi();syncDurationDraft();syncSetupRoom();$('setupError').textContent='';if(!$('setupDialog').open)$('setupDialog').showModal();}
function applySettings(){
 if(modeUi.mode==='classes'&&(modeUi.selectedClasses>0||enrollmentUi.students().length<3)){const error=modeUi.validateClasses();if(error){$('setupError').textContent=error;return false;}}
 const baseRoster=draftRoster(),raw=modeUi.mode!=='manual'?$('excludeInput').value.trim():'',excluded=new Set();
 if(raw){for(const s of raw.split(/[\s,;]+/).filter(Boolean)){const p=parseStudentId(s);if(!p){$('setupError').textContent=`제외 학번 '${s}' 형식을 확인해 주세요.`;return false;}excluded.add(`${p.grade}-${p.classroom}-${p.number}`);}const unknown=[...excluded].filter(key=>!baseRoster.some(p=>`${p.grade}-${p.classroom}-${p.number}`===key));if(unknown.length){$('setupError').textContent='참가 명단에 없는 제외 학번이 있습니다. 학번을 확인해 주세요.';return false;}}
 const list=baseRoster.filter(p=>!excluded.has(`${p.grade}-${p.classroom}-${p.number}`)),wc=Number($('winnerCount').value),limit=modeUi.mode==='manual'?list.length:Math.min(list.length,maxClassSize(list));if(limit<3||list.length>MAX_PARTICIPANTS){$('setupError').textContent='전체 1,200명 이하, 서로 다른 번호 3개 이상이 필요합니다.';return false;}if(!Number.isInteger(wc)||wc<1||wc>limit){$('setupError').textContent=`당첨 인원은 1~${limit}명으로 입력해 주세요.`;return false;}
 const seconds=Number($('durationSelect').value==='custom'?$('customDuration').value:$('durationSelect').value);
 if(!Number.isInteger(seconds)||seconds<10||seconds>300){$('setupError').textContent='경주 시간은 10~300초의 정수로 입력해 주세요.';return false;}
 raceDuration=seconds;syncDurationDraft();
 mode=modeUi.mode;manualCount=modeUi.count;classSettings=modeUi.classSettings();confirmedEnrollment=enrollmentUi.serialize();activeRoster=list;winnerCount=wc;quality=$('qualitySelect').value;establishRoom(mode);syncSetupRoom();reset();updateRosterUi();save();$('setupDialog').close();return true;}
function reset(){racerIntro.close();state='idle';elapsed=0;countElapsed=0;introElapsed=0;revealed=false;finishShown=false;shownEvents.clear();audio.pause();$('countdown').hidden=true;$('pausedNotice').hidden=true;$('eventToast').classList.remove('visible');$('raceMoment').classList.remove('visible');$('leaderSpotlight').hidden=true;$('finishTally').hidden=true;$('pauseBtn').hidden=true;$('settingsBtn').disabled=false;$('startBtn').hidden=false;$('startBtn').disabled=false;$('startBtn').textContent='✦ 레이스 시작';$('statusTitle').textContent='축제의 주인공은 누구?';$('statusDesc').textContent='명단을 확인하고 별빛레이스를 시작하세요.';$('phaseBadge').textContent='✦ 별빛 아래, 모두의 레이스';setupPlan();lastUi=-1;}
async function start(){if(!currentRoom()?.established){showSetup();return;}if(!['idle','finished'].includes(state))return;if($('setupDialog').open)return;const startingState=state;try{await audio.unlock();}catch{toast('소리 재생을 시작하지 못했습니다. 화면 경주는 계속됩니다.');}if(state!==startingState||$('resultDialog').open)return;setupPlan();elapsed=0;countElapsed=0;introElapsed=0;state='intro';revealed=false;finishShown=false;shownEvents.clear();lastToast=0;audio.lastEvent=-1;$('startBtn').hidden=true;$('settingsBtn').disabled=true;$('pauseBtn').hidden=false;$('pauseBtn').textContent='Ⅱ 일시정지';$('pausedNotice').hidden=true;$('countdown').hidden=true;$('leaderSpotlight').hidden=true;$('finishTally').hidden=true;$('eventToast').classList.remove('visible');$('raceMoment').classList.remove('visible');$('statusTitle').textContent='참가 캐릭터 소개';$('statusDesc').textContent='열 명씩 함께 만나고, 출발선으로!';$('phaseBadge').textContent='✦ 나의 번호를 찾아보세요';racerIntro.start(plan,{tinted:characterColors});lastUi=-1;lastFrame=performance.now();if(document.hidden)pause();}
function beginCountdown(){if(state!=='intro'&&!(state==='paused'&&pausedFrom==='intro'))return;racerIntro.close();state='countdown';countElapsed=0;elapsed=0;$('pauseBtn').textContent='Ⅱ 일시정지';$('pausedNotice').hidden=true;$('countdown').hidden=false;$('countdown').textContent='3';$('statusTitle').textContent='출발 준비!';$('statusDesc').textContent=`${plan.count}명의 캐릭터, 힘차게 출발할 준비!`;$('phaseBadge').textContent='✦ 준비… 출발 신호를 기다려요';$('leaderSpotlight').hidden=true;audio.effect('count');lastUi=-1;lastFrame=performance.now();}
function pause(){if(!['racing','arrivals','intro','countdown'].includes(state))return;pausedFrom=state;state='paused';audio.pause();racerIntro.setPaused(pausedFrom==='intro');$('pauseBtn').textContent=pausedFrom==='intro'?'▶ 이어서 소개':'▶ 이어서 달리기';$('pausedNotice').hidden=pausedFrom==='intro';lastUi=-1;}
async function resume(){if(state!=='paused')return;state=pausedFrom;lastFrame=performance.now();racerIntro.setPaused(false);$('pauseBtn').textContent='Ⅱ 일시정지';$('pausedNotice').hidden=true;lastUi=-1;try{if(state==='racing')await audio.resume();else await audio.unlock();}catch{}}
function finish(){racerIntro.close();$('countdown').hidden=true;$('pausedNotice').hidden=true;$('eventToast').classList.remove('visible');state='finished';elapsed=Math.max(60,elapsed);ranking=rankingAt(plan,elapsed);updateRanks();audio.win();$('pauseBtn').hidden=true;$('settingsBtn').disabled=false;$('statusTitle').textContent='별빛레이스 결과 발표!';$('statusDesc').textContent=`${plan.count}개 캐릭터 참가 · 전체 추첨 대상 ${activeRoster.length}명 · 당첨 ${winnerCount}명`;$('phaseBadge').textContent='✦ 오늘의 별빛 주인공을 축하합니다';$('startBtn').hidden=false;$('startBtn').textContent='🏆 결과 보기';}
function finishNow(){
 if(!currentRoom()?.established){showSetup();return;}
 if(!plan||!world||!$('loading').hidden||$('setupDialog').open)return;
 if(state!=='finished'){finishShown=true;revealed=true;finish();lastUi=-1;}
 showResults();
}
$('quickResultBtn').addEventListener('click',finishNow);
function showResults(){
 if(!plan||state!=='finished'||$('resultDialog').open)return;
 const results=fullDraw;
 $('resultSubtitle').textContent=`전체 ${activeRoster.length}명 중 당첨 ${winnerCount}명 · ${plan.count}개 캐릭터의 레이스`;
 $('winnerCards').replaceChildren();$('winnerCards').hidden=winnerCount<=5;
 results.slice(5,winnerCount).forEach((r,index)=>{
  const i=index+5,card=document.createElement('div');card.className='winner-card';
  const racer=plan.runners.find(p=>p.id===r.id);
  card.append(createCharacterPortrait(racer?.type??0,{size:82,celebrate:true,variant:racer?.colorVariant??0,tinted:characterColors}));
  const rank=document.createElement('span');rank.textContent=r.grade?`${i+1}등 · ${r.grade}학년 ${r.classroom}반`:`${i+1}등`;
  const n=document.createElement('b');n.textContent=`${String(r.number).padStart(2,'0')}번`;
  const id=document.createElement('small');id.textContent=r.grade?`학번 ${r.id}`:'별빛 주인공';card.append(rank,n,id);$('winnerCards').append(card);
 });
 showAwards({plan,results,winnerCount,tinted:characterColors,onReveal:()=>audio.effect('reveal')});
 $('resultDialog').showModal();
}
function showRaceMoments(){
 const active=!preRace();
 const time=sceneTime(),front=[...plan.runners].sort((a,b)=>a.rank-b.rank);
 const crossed=front.filter(r=>time>=r.finish),recent=[...crossed].reverse().find(r=>time-r.finish<.17);
 const beat=(plan.beats||[]).find(b=>elapsed>=b.at&&elapsed<b.at+b.duration);
 $('finishTally').hidden=!active||elapsed<55;
 $('finishTally').textContent=`결승 통과 ${crossed.length} / ${front.length}`;
 const title=active?(recent?`${identity(recent,false)} · ${recent.rank+1}위 통과`:beat?.title):'';
 $('raceMoment').textContent=title||'';$('raceMoment').classList.toggle('visible',!!title);
 if(title)$('eventToast').classList.remove('visible');
 if(['racing','arrivals'].includes(state)){
  for(const r of crossed){const key=`finish:${r.id}`;if(!shownEvents.has(key)){shownEvents.add(key);audio.effect(r.rank===0?'finish-first':'finish');}}
  if(beat){const key=`beat:${beat.at}`;if(!shownEvents.has(key)){shownEvents.add(key);audio.effect(beat.kind==='comeback'?'comeback':beat.kind==='defend'?'defend':'boost');}}
 }
}
function drawFrame(now){requestAnimationFrame(drawFrame);const dt=lastFrame?Math.min((now-lastFrame)/1000,.5):0;lastFrame=now;if(!world||!plan)return;
 const prevElapsed=elapsed;
 if(state==='intro'){introElapsed+=dt;if(racerIntro.update(introElapsed))beginCountdown();}
 else if(state==='countdown'){const prev=Math.ceil(3-countElapsed);countElapsed+=dt;const cur=Math.ceil(3-countElapsed);if(cur!==prev&&cur>0){$('countdown').textContent=cur;audio.effect('count');}if(countElapsed>=3){state='racing';elapsed=0;lastUi=-1;$('countdown').hidden=true;audio.effect('go');audio.start();$('statusTitle').textContent='별빛레이스 진행 중';$('statusDesc').textContent='순위표나 캐릭터 번호를 누르면 따라갈 수 있어요.';}}
 else if(state==='racing'){elapsed=Math.min(60,elapsed+dt*60/raceDuration);if(elapsed>=60){state='arrivals';selectCamera('side',true);$('statusTitle').textContent='마지막 참가자까지, 결승선으로!';} audio.update(elapsed);}
 if(state==='arrivals'){elapsed+=dt*1.5;if(sceneTime()>=Math.max(...plan.runners.map(r=>r.finish))+.2)finish();}
 if(state==='racing'&&prevElapsed<51&&elapsed>=51)selectCamera('leader',true);
 if(state==='finished'&&!finishShown){finishShown=true;setTimeout(()=>{if(state==='finished')showResults();},1200);}
 if(Math.abs(elapsed-lastUi)>.12||lastUi<0){ranking=rankingAt(plan,sceneTime());updateRanks();const seconds=Math.min(raceDuration,Math.floor(elapsed*raceDuration/60));$('timeValue').textContent=`${String(Math.floor(seconds/60)).padStart(2,'0')}:${String(seconds%60).padStart(2,'0')}`;$('timeValue').parentElement.classList.toggle('urgent',elapsed>=50&&elapsed<60);$('progressFill').style.width=`${Math.min(100,elapsed/60*100)}%`;$('progressStar').style.left=`${Math.min(100,elapsed/60*100)}%`;
  if(state==='arrivals')$('phaseBadge').textContent='모든 참가자가 결승선을 통과하고 있어요';
  if(state==='racing')$('phaseBadge').textContent=elapsed>=56?'◷ 결승선 슬로모션':`${COURSES[Math.min(3,Math.floor(elapsed/15))].icon} ${COURSES[Math.min(3,Math.floor(elapsed/15))].name}${cameraMode==='leader'?' · 선두 근접 추적':''}`;
  $('leaderSpotlight').textContent=`♛ 현재 1위 · ${identity(ranking[0],false)}`;
  $('leaderSpotlight').hidden=preRace();
  $('slowMotionBadge').hidden=elapsed<56||elapsed>=60;
  document.querySelectorAll('.course-stop').forEach((el,i)=>el.classList.toggle('active',i===Math.min(3,Math.floor(elapsed/15))));
  lastUi=elapsed;
 }
 if(state==='racing'&&elapsed-lastToast>2.4&&elapsed<56){for(const r of ranking.slice(0,30)){const e=eventAt(r,sceneTime());if(e&&!shownEvents.has(`${r.id}-${e.at}`)){shownEvents.add(`${r.id}-${e.at}`);$('eventToast').textContent=`${identity(r,false)} · ${EVENT_NAMES[e.type]}`;$('eventToast').classList.add('visible');audio.effect(e.type);lastToast=elapsed;break;}}}if(elapsed-lastToast>1.8)$('eventToast').classList.remove('visible');
 showRaceMoments();
 // One shared scene clock slows displacement, limbs, obstacles and camera together.
 let animTime=state==='paused'?(preRace()?0:sceneTime()):['idle','intro'].includes(state)?now/1000:sceneTime();
 world.update(elapsed,ranking,{cameraMode,phase:state,countdown:countElapsed,preparing:racePhase()==='countdown',idle:preRace(),follow:elapsed>=50?null:follow,raceTime:sceneTime(),animTime:state==='finished'?now/1000:animTime});
 if(state==='racing'){performanceSamples.push(dt);if(performanceSamples.length>120)performanceSamples.shift();if(quality==='auto'&&elapsed>5&&performanceSamples.length===120&&performanceSamples.reduce((a,b)=>a+b,0)/120>.043&&world.renderer.getPixelRatio()>1){world.setQuality('low',activeRoster.length);}}
}
function reportPending(parsed){pendingRoster=parsed;const n=parsed.participants.length;$('importReport').replaceChildren();const b=document.createElement('b');b.textContent=`유효 학번 ${n}명`;$('importReport').append(b);const lines=[];if(parsed.duplicates.length)lines.push(`중복 ${parsed.duplicates.length}건은 한 번만 등록합니다.`);if(parsed.invalid.length)lines.push(`형식이 맞지 않는 값 ${parsed.invalid.length}건 제외: ${parsed.invalid.slice(0,5).join(', ')}`);if(n>MAX_PARTICIPANTS)lines.push(`한 번에 ${MAX_PARTICIPANTS}명까지 등록할 수 있습니다.`);for(const line of lines){const d=document.createElement('div');d.textContent=line;$('importReport').append(d);}if(n>0){const d=document.createElement('div');d.textContent=parsed.participants.slice(0,4).map(p=>`${p.id} (${p.grade}-${p.classroom}-${p.number})`).join(' · ');$('importReport').append(d);}$('applyImport').hidden=false;$('applyImport').disabled=n<3||n>MAX_PARTICIPANTS;}
function sheetRows(){return window.XLSX.utils.sheet_to_json(workbook.Sheets[$('sheetSelect').value],{header:1,defval:'',raw:false});}
function setColumns(){const rows=sheetRows(),cols=Math.max(1,...rows.slice(0,30).map(r=>r.length));$('columnSelect').replaceChildren();let chosen=0,best=-1;for(let i=0;i<cols;i++){const header=String(rows[0]?.[i]||''),score=/학번|student.?id/i.test(header)?999:rows.slice(0,20).filter(r=>parseStudentId(r[i])).length;if(score>best){chosen=i;best=score;}const o=document.createElement('option');o.value=i;o.textContent=`${window.XLSX.utils.encode_col(i)}열${header&&!parseStudentId(header)?' · '+header.slice(0,20):''}`;$('columnSelect').append(o);}$('columnSelect').value=chosen;previewColumn();}
function previewColumn(){const col=Number($('columnSelect').value),values=sheetRows().map(r=>r[col]);if(values.length&&!parseStudentId(values[0])&&/학번|student|번호|id/i.test(String(values[0])))values.shift();reportPending(parseRoster(values));}
async function loadFile(file){if(!file)return;if(file.size>10*1024*1024){toast('10MB 이하의 파일을 선택해 주세요.');return;}if(!/\.(xlsx|xls|csv)$/i.test(file.name)){toast('XLSX, XLS, CSV 파일을 선택해 주세요.');return;}try{if(!window.XLSX)throw Error('엑셀 읽기 도구를 불러오지 못했습니다. 새로고침 후 다시 시도해 주세요.');const bytes=await file.arrayBuffer();workbook=window.XLSX.read(bytes,{type:'array',cellFormula:false,cellHTML:false});if(!workbook.SheetNames.length)throw Error('시트가 없습니다.');$('sheetSelect').replaceChildren();for(const name of workbook.SheetNames){const o=document.createElement('option');o.value=name;o.textContent=name;$('sheetSelect').append(o);}$('importOptions').hidden=false;setColumns();}catch(e){pendingRoster=null;$('applyImport').hidden=true;$('importReport').textContent=`파일을 읽지 못했습니다. ${e.message}`;}}
function download(blob,name){const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);}
function exportImage(){const ranking=fullDraw,count=ranking.length,c=document.createElement('canvas');c.width=1200;c.height=250+Math.ceil(count/3)*46;const x=c.getContext('2d');x.fillStyle='#14213e';x.fillRect(0,0,c.width,c.height);x.fillStyle='#ffdb8a';x.textAlign='center';x.font='900 40px "Race Jua",sans-serif';x.fillText('창원사파고 별빛레이스',600,70);x.font='19px "Race Jua",sans-serif';x.fillStyle='#cfdaef';x.fillText(`제24회 터누림제 · 출전 ${count}개 번호 · 후보 ${activeRoster.length}명 · 당첨 ${winnerCount}명`,600,116);x.fillStyle='#ffd986';x.font='bold 19px "Race Jua",sans-serif';x.fillText('별빛 주인공을 축하합니다!',600,162);ranking.forEach((r,i)=>{const col=i%3,row=Math.floor(i/3),px=30+col*390,py=205+row*46;x.fillStyle=i<winnerCount?'#ffdd94':'#263552';x.beginPath();x.roundRect(px,py,370,37,8);x.fill();x.fillStyle=i<winnerCount?'#41321f':'#e8edfc';x.textAlign='left';x.font='bold 16px "Race Jua",sans-serif';x.fillText(`${i+1}위  ${identity(r,true)}`,px+13,py+25);});c.toBlob(b=>{if(b)download(b,'별빛레이스_결과.png');else toast('이미지 저장을 준비하지 못했습니다. CSV로 저장해 주세요.');});}
function exportCsv(){const lines=['순위,학번,학년,반,번호,당첨',...fullDraw.map((r,i)=>`${i+1},${r.grade?r.id:''},${r.grade||''},${r.classroom||''},${r.number},${i<winnerCount?'당첨':''}`)];download(new Blob(['\ufeff'+lines.join('\r\n')],{type:'text/csv;charset=utf-8'}),'별빛레이스_전체순위.csv');}
$('settingsBtn').addEventListener('click',showSetup);$('readyBtn').addEventListener('click',applySettings);$('startBtn').addEventListener('click',()=>state==='finished'?showResults():start());$('pauseBtn').addEventListener('click',()=>state==='paused'?resume():pause());$('leadBtn').addEventListener('click',()=>{follow=null;$('leadBtn').hidden=true;updateRanks();});$('stage').addEventListener('click',e=>{if(!['racing','arrivals','paused','finished'].includes(state)||e.target.closest('button,.camera-controls'))return;const rect=$('stage').getBoundingClientRect(),id=world.hitTest(e.clientX-rect.left,e.clientY-rect.top);if(id){follow=id;$('leadBtn').hidden=false;updateRanks();}});
$('soundBtn').addEventListener('click',async()=>{try{await audio.unlock();}catch{}const muted=audio.toggle();$('soundBtn').textContent=muted?'♪':'♫';$('soundBtn').setAttribute('aria-pressed',String(muted));toast(muted?'소리를 껐습니다.':'소리를 켰습니다.');save();});$('volume').addEventListener('input',e=>{audio.setVolume(Number(e.target.value)/100);save();});
function fullscreenLabel(){const active=!!(document.fullscreenElement||document.webkitFullscreenElement);$('fullscreenBtn').textContent=active?'⛶ 화면 복귀':'⛶ 전체 화면';$('fullscreenBtn').setAttribute('aria-label',active?'전체 화면 종료':'전체 화면');}
$('fullscreenBtn').addEventListener('click',async()=>{
 try{
  if(document.fullscreenElement||document.webkitFullscreenElement){const exit=document.exitFullscreen||document.webkitExitFullscreen;if(exit)await exit.call(document);}
  else{const root=document.documentElement,request=root.requestFullscreen||root.webkitRequestFullscreen;
   if(request){await request.call(root);try{await screen.orientation?.lock?.('landscape');}catch{}}
   else toast('이 브라우저에서는 현재 화면을 가득 채운 가로 레이아웃으로 이용할 수 있어요.');
  }
 }catch{toast('전체 화면은 PC의 F11 키나 브라우저 메뉴에서도 켤 수 있어요.');}
 fullscreenLabel();
});
document.addEventListener('fullscreenchange',fullscreenLabel);document.addEventListener('webkitfullscreenchange',fullscreenLabel);
$('fileInput').addEventListener('change',e=>loadFile(e.target.files[0]));$('dropZone').addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();$('fileInput').click();}});$('dropZone').addEventListener('dragover',e=>{e.preventDefault();$('dropZone').classList.add('dragging');});$('dropZone').addEventListener('dragleave',()=>$('dropZone').classList.remove('dragging'));$('dropZone').addEventListener('drop',e=>{e.preventDefault();$('dropZone').classList.remove('dragging');loadFile(e.dataTransfer.files[0]);});$('sheetSelect').addEventListener('change',setColumns);$('columnSelect').addEventListener('change',previewColumn);$('pasteApply').addEventListener('click',()=>{reportPending(parseRoster($('pasteInput').value.split(/[\s,;]+/).filter(Boolean)));});$('applyImport').addEventListener('click',()=>{if(!pendingRoster||pendingRoster.participants.length<3||pendingRoster.participants.length>MAX_PARTICIPANTS)return;roster=pendingRoster.participants;rosterName='축제 참가 명단';$('excludeInput').value='';updateRosterUi();toast(`${roster.length}명 명단을 적용했습니다. 아래 확인 완료를 눌러주세요.`);});
for(const [id,n] of [['demoBtn',160],['demoLargeBtn',600]])$(id).addEventListener('click',()=>{roster=demoRoster(n);rosterName='체험 명단';$('excludeInput').value='';updateRosterUi();});
$('templateBtn').addEventListener('click',()=>{if(!window.XLSX){toast('엑셀 도구를 불러오지 못했습니다.');return;}const wb=window.XLSX.utils.book_new(),ws=window.XLSX.utils.aoa_to_sheet([['학번'],['1101'],['1102'],['1103'],['2101'],['2102']]);ws['!cols']=[{wch:18}];window.XLSX.utils.book_append_sheet(wb,ws,'참가명단');const bytes=window.XLSX.write(wb,{bookType:'xlsx',type:'array'});download(new Blob([bytes],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'}),'별빛레이스_참가명단_양식.xlsx');});
$('saveImageBtn').addEventListener('click',exportImage);$('againBtn').addEventListener('click',()=>{$('resultDialog').close();reset();});
document.addEventListener('visibilitychange',()=>{if(document.hidden)pause();});window.addEventListener('keydown',e=>{if(e.code==='Space'&&!['INPUT','TEXTAREA','SELECT','BUTTON'].includes(e.target.tagName)&&!$('setupDialog').open&&!$('resultDialog').open){e.preventDefault();if(state==='paused')resume();else if(['racing','arrivals','intro','countdown'].includes(state))pause();}});
$('world').addEventListener('webglcontextlost',e=>{e.preventDefault();pause();toast('그래픽 연결이 중단되었습니다. 페이지를 새로고침해 주세요.');});
const leaveRoomButton=document.createElement('button');leaveRoomButton.id='leaveRoomBtn';leaveRoomButton.className='secondary-btn';leaveRoomButton.textContent='방 나가기';leaveRoomButton.hidden=true;$('settingsBtn').after(leaveRoomButton);
leaveRoomButton.onclick=async()=>{if(!confirm('현재 방을 나갈까요? 열려 있는 QR 접수를 마감하고 첫 화면으로 돌아갑니다.'))return;pause();leaveRoomButton.disabled=true;try{await enrollmentUi.leaveRoom();forgetRoom();confirmedEnrollment=enrollmentUi.serialize();mode='manual';modeUi.restore(mode,manualCount,classSettings);activeRoster=modeUi.pool();winnerCount=Math.min(winnerCount,manualCount);if($('resultDialog').open)$('resultDialog').close();delete $('setupDialog').dataset.roomChosen;reset();save();syncSetupRoom();showSetup();}catch(error){toast(error.message||'접수를 마감하지 못했습니다. 인터넷 연결을 확인해 주세요.');}finally{leaveRoomButton.disabled=false;}};
tidySetup();
try{await Promise.all([document.fonts.load('16px "Race Jua"'),document.fonts.load('16px "Race Gowun"')]);world=new RaceWorld($('world'),$('labels'));updateRosterUi();setupPlan();await world.ready;syncCharacterColors();$('loading').hidden=true;$('startBtn').disabled=false;$('quickResultBtn').disabled=false;requestAnimationFrame(drawFrame);if(!new URLSearchParams(location.search).has('qa'))setTimeout(showSetup,350);}catch(e){$('loading').innerHTML='<b>화면 자산을 불러오지 못했습니다.</b><p>잠시 후 새로고침해 주세요. 최신 Chrome 또는 Edge를 권장합니다.</p>';$('startBtn').disabled=true;console.error(e);}
// Local-only integration-test bridge. The production website never exposes this interface.
if(['127.0.0.1','localhost'].includes(location.hostname)&&new URLSearchParams(location.search).has('qa'))window.__raceTest={
 snapshot:()=>({state,elapsed,count:activeRoster.length,winners:winnerCount,revealed:elapsed>=45,order:plan?.order,ranking:ranking.map(r=>r.id),labels:world?.labelHits?.length,drawCalls:world?.renderer.info.render.calls,triangles:world?.renderer.info.render.triangles,averageFrame:performanceSamples.reduce((a,b)=>a+b,0)/performanceSamples.length,version:'1.0'}),
 seek(t){elapsed=t;state='paused';pausedFrom='racing';ranking=rankingAt(plan,t);lastUi=-1;world.firstFrame=true;world.update(t,ranking,{animTime:t});updateRanks(true);},
 setRoster(n){roster=demoRoster(n);rosterName='체험 명단';activeRoster=[...roster];reset();updateRosterUi();},
 finish(){elapsed=60;finish();finishShown=true;showResults();},
 start,reset,parseRoster,loadFile,
};
