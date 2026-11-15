import {applyPortraitTint} from './character-colors.js';
const CHARACTER_NAMES=['치이카와','하치와레','우사기','모몽가','쿠리만쥬','랏코','시사','카니'];
const ASSETS={
 standard:{cheer:new URL('./assets/action-atlas.png',import.meta.url).href,run:new URL('./assets/run-atlas.png',import.meta.url).href},
 extra:{cheer:new URL('./assets/extra-side-actions.png',import.meta.url).href,run:new URL('./assets/extra-side-run.png',import.meta.url).href}
};

export function createCharacterPortrait(type,{size=104,celebrate=true,variant=0,tinted=true}={}){
 const characterType=Number.isInteger(type)?((type%8)+8)%8:0;
 const portrait=document.createElement('span');
 portrait.className='race-character-portrait';
 portrait.setAttribute('role','img');
 portrait.setAttribute('aria-label',`${CHARACTER_NAMES[characterType]} 캐릭터`);
 portrait.dataset.character=String(characterType);
 portrait.style.setProperty('--portrait-size',`${Math.max(40,Math.min(220,Number(size)||104))}px`);
 const atlas=ASSETS[characterType<4?'standard':'extra'];
 portrait.style.backgroundImage=`url("${atlas[celebrate?'cheer':'run']}")`;
 portrait.style.backgroundPosition=`${celebrate?100:0}% ${characterType%4/3*100}%`;
 return applyPortraitTint(portrait,variant,tinted);
}

function element(tag,className,text){
 const node=document.createElement(tag);node.className=className;
 if(text!==undefined)node.textContent=text;
 return node;
}

export function renderPodium(host,{plan,results,winnerCount,tinted=true,revealedRanks=null}){
 host.replaceChildren();
 const finalists=results.slice(0,Math.min(5,plan.count));
 if(!finalists.length){host.hidden=true;return;}
 host.hidden=false;host.classList.add('podium-awards');
 host.setAttribute('role','region');host.setAttribute('aria-label',`레이싱 최종 ${finalists.length}위 시상대`);
 host.closest('.result-dialog')?.classList.add('has-character-podium');
 const title=element('div','podium-caption');
 title.append(element('span','podium-caption-star','✦'),element('span','podium-caption-text',`별빛레이스 TOP ${finalists.length}`),element('span','podium-caption-star','✦'));
 const stage=element('div','podium-stage');stage.dataset.count=String(finalists.length);
 const light=element('div','podium-lights');light.setAttribute('aria-hidden','true');stage.append(light);
 const confetti=element('div','podium-confetti');confetti.setAttribute('aria-hidden','true');
 for(let i=0;i<18;i++){
  const piece=element('i','');
  piece.style.setProperty('--piece-x',`${5+(i*37)%91}%`);
  piece.style.setProperty('--piece-y',`${10+(i*23)%69}%`);
  piece.style.setProperty('--piece-angle',`${i*47}deg`);
  piece.style.setProperty('--piece-color',['#f7d78e','#b6d1ef','#f1b9d2','#dce8f8'][i%4]);
  confetti.append(piece);
 }
 stage.append(confetti);
 const types=new Map(plan.runners.map(r=>[r.id,r]));
 const columns={1:3,2:2,3:4,4:1,5:5};
 for(let i=0;i<finalists.length;i++){
  const result=finalists[i],rank=i+1,isWinner=i<winnerCount;
  const place=element('article',`podium-place podium-place-${rank}${isWinner?' is-winner':''}`);
  place.style.gridColumn=String(columns[rank]);place.dataset.rank=String(rank);
  const visible=!result.grade||revealedRanks===null||revealedRanks.has(rank);
  const identity=result.grade&&visible?`${result.grade}학년 ${result.classroom}반 ${String(result.number).padStart(2,'0')}번`:`${String(result.number).padStart(2,'0')}번`;
  place.setAttribute('aria-label',`${rank}위, ${identity}${isWinner?', 당첨':''}`);
  const character=element('div','podium-character');
  if(rank===1){const crown=element('span','podium-crown','♛');crown.setAttribute('aria-hidden','true');character.append(crown);}
  const racer=types.get(result.id);
  character.append(createCharacterPortrait(racer?.type??0,{size:rank===1?132:rank<=3?118:102,celebrate:true,variant:racer?.colorVariant??0,tinted}));
  const platform=element('div','podium-platform');
  const medal=element('span','podium-rank',`${rank}위`);
  const label=element('div','podium-identity');
  if(result.grade)label.append(element('small','podium-class',visible?`${result.grade}학년 ${result.classroom}반`:'학년 · 반 공개 대기'));
  label.append(element('b','podium-number',`${String(result.number).padStart(2,'0')}번`));
  const badge=element('span',`podium-award-badge${isWinner?'':' is-placement'}`,isWinner?'당첨':'레이스 순위');
  platform.append(medal,label,badge);place.append(character,platform);stage.append(place);
 }
 const foot=element('p','podium-footnote',winnerCount<finalists.length?'당첨 표시가 있는 참가자가 이번 추첨의 당첨자입니다.':'오늘의 별빛 주인공을 축하합니다!');
 host.append(title,stage,foot);
}
