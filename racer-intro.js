import {createCharacterPortrait} from './result-podium.js';

const PAGE_SIZE=10,PAGE_SECONDS=2.8;
const numberOf=runner=>Number(runner.displayNumber??runner.number);
const labelOf=runner=>`${String(numberOf(runner)).padStart(2,'0')}번`;
function element(tag,className,text){
 const node=document.createElement(tag);node.className=className;
 if(text!==undefined)node.textContent=text;
 return node;
}

// The app owns the clock, so pausing or hiding the tab also pauses these pages.
export class RacerIntro{
 constructor({onSkip,onTogglePause}={}){
  this.onSkip=onSkip;this.onTogglePause=onTogglePause;this.isOpen=false;this.duration=0;this.page=-1;this.tinted=true;this.paused=false;
  this.root=element('section','racer-intro');this.root.hidden=true;
  this.root.setAttribute('role','dialog');this.root.setAttribute('aria-modal','true');
  this.root.setAttribute('aria-labelledby','racerIntroTitle');
  const shell=element('div','racer-intro-shell');
  const header=element('header','racer-intro-header');
  const heading=element('div','racer-intro-heading');
  heading.append(element('p','racer-intro-kicker','창원사파고 별빛레이스'));
  const title=element('h2','racer-intro-title','참가 캐릭터 소개');title.id='racerIntroTitle';heading.append(title);
  this.pageLabel=element('div','racer-intro-page');this.pageLabel.setAttribute('aria-live','polite');
  header.append(heading,this.pageLabel);
  this.grid=element('div','racer-intro-grid');this.grid.setAttribute('role','list');
  const footer=element('footer','racer-intro-footer');
  const note=element('div','racer-intro-note');
  this.range=element('b','racer-intro-range');
  note.append(this.range,element('span','racer-intro-hint','나의 번호와 캐릭터를 기억해 주세요!'));
  this.dots=element('div','racer-intro-dots');this.dots.setAttribute('aria-hidden','true');
  const actions=element('div','racer-intro-actions');
  this.pause=element('button','racer-intro-pause','잠시 멈춤');this.pause.type='button';
  this.pause.setAttribute('aria-pressed','false');this.pause.addEventListener('click',()=>this.onTogglePause?.());
  this.skip=element('button','racer-intro-skip','바로 출발');this.skip.type='button';
  this.skip.addEventListener('click',()=>this.onSkip?.());
  actions.append(this.pause,this.skip);footer.append(note,this.dots,actions);
  this.progress=element('div','racer-intro-progress');this.progress.setAttribute('aria-hidden','true');
  this.progressFill=element('div','racer-intro-progress-fill');this.progress.append(this.progressFill);
  shell.append(header,this.grid,footer,this.progress);this.root.append(shell);document.body.append(this.root);
  this.root.addEventListener('keydown',event=>{
   if(event.key==='Escape'){event.preventDefault();this.onSkip?.();}
   if(event.key==='Tab'){event.preventDefault();(document.activeElement===this.pause?this.skip:this.pause).focus();}
  });
 }

 start(plan,{tinted=true}={}){
  this.runners=[...plan.runners].sort((a,b)=>numberOf(a)-numberOf(b)||a.index-b.index);
  this.tinted=tinted;this.pageCount=Math.ceil(this.runners.length/PAGE_SIZE);
  this.duration=this.pageCount*PAGE_SECONDS;this.page=-1;this.elapsed=0;
  this.setPaused(false);
  this.previousFocus=document.activeElement;this.isOpen=!!this.pageCount;this.root.hidden=!this.isOpen;
  this.dots.replaceChildren();
  for(let i=0;i<this.pageCount;i++)this.dots.append(element('i',''));
  if(this.isOpen){this.renderPage(0);this.progressFill.style.width='0%';this.skip.focus({preventScroll:true});}
  return this.duration;
 }

 renderPage(page){
  this.page=page;
  const runners=this.runners.slice(page*PAGE_SIZE,(page+1)*PAGE_SIZE);
  this.grid.replaceChildren();this.grid.dataset.count=String(runners.length);
  for(const runner of runners){
   const card=element('article','racer-intro-card');card.setAttribute('role','listitem');
   card.setAttribute('aria-label',`${labelOf(runner)} 참가 캐릭터`);
   const portraitBox=element('div','racer-intro-portrait');
   portraitBox.append(createCharacterPortrait(runner.type,{size:150,celebrate:false,variant:runner.colorVariant??runner.index,tinted:this.tinted}));
   card.append(portraitBox,element('b','racer-intro-number',labelOf(runner)));
   this.grid.append(card);
  }
  this.pageLabel.textContent=`${page+1} / ${this.pageCount}`;
  this.range.textContent=runners.length===1?labelOf(runners[0]):`${labelOf(runners[0])} — ${labelOf(runners.at(-1))}`;
  [...this.dots.children].forEach((dot,index)=>dot.classList.toggle('active',index===page));
 }

 update(elapsed){
  if(!this.isOpen)return true;
  this.elapsed=Math.max(0,elapsed);
  if(this.elapsed>=this.duration){this.close();return true;}
  const page=Math.min(this.pageCount-1,Math.floor(this.elapsed/PAGE_SECONDS));
  if(page!==this.page)this.renderPage(page);
  this.progressFill.style.width=`${Math.min(100,this.elapsed/this.duration*100)}%`;
  return false;
 }

 setTinted(enabled){
  this.tinted=!!enabled;
  if(this.isOpen)this.renderPage(this.page);
 }

 setPaused(paused){
  this.paused=!!paused;this.root.classList.toggle('is-paused',this.paused);
  this.pause.textContent=this.paused?'이어서 소개':'잠시 멈춤';
  this.pause.setAttribute('aria-pressed',String(this.paused));
 }

 close(){
  this.isOpen=false;this.root.hidden=true;
  if(this.root.contains(document.activeElement)&&this.previousFocus?.isConnected&&!this.previousFocus.hidden)this.previousFocus.focus({preventScroll:true});
 }
}
