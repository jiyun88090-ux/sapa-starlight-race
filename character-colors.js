// Gentle material tints; source artwork is never rewritten.
const PALETTE=[
 {rgb:[1,.87,.92],css:'#ffdeeb',name:'벚꽃'},
 {rgb:[.86,.94,1],css:'#dbf0ff',name:'하늘'},
 {rgb:[.86,1,.92],css:'#dbffeb',name:'민트'},
 {rgb:[1,.93,.82],css:'#ffedd1',name:'살구'},
 {rgb:[.94,.87,1],css:'#f0deff',name:'라일락'},
 {rgb:[1,.98,.82],css:'#fffad1',name:'레몬'},
 {rgb:[.84,1,1],css:'#d6ffff',name:'아쿠아'},
 {rgb:[1,.91,.86],css:'#ffe8db',name:'복숭아'}
];
export function getCharacterColor(variant=0){return PALETTE[((Number(variant)||0)%PALETTE.length+PALETTE.length)%PALETTE.length];}
export function applyPortraitTint(portrait,variant=0,enabled=true){
 portrait.dataset.colorVariant=String(variant);portrait.classList.toggle('is-tinted',enabled);
 portrait.style.setProperty('--portrait-tint',getCharacterColor(variant).css);
 portrait.style.setProperty('--portrait-mask',portrait.style.backgroundImage);
 portrait.style.setProperty('--portrait-position',portrait.style.backgroundPosition);
 return portrait;
}
export function setPortraitTintEnabled(enabled){document.querySelectorAll('.race-character-portrait').forEach(p=>p.classList.toggle('is-tinted',enabled));}
