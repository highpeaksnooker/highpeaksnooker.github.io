import {roundNames} from './knockout-model.js';
const h=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export const knockoutRoundLabels=count=>roundNames.slice(-count);
export function knockoutGeometry(rounds,{mobile=false,matchHeight=128}={}) {
 const width=mobile?232:248,gap=mobile?56:64,pitch=matchHeight+24;
 return {width,gap,pitch,matchHeight,stride:width+gap,boardWidth:rounds.length*width+(rounds.length-1)*gap+24,boardHeight:rounds[0].length*pitch+24};
}
export const knockoutCenter=(layout,round,slot)=>(slot+.5)*2**round*layout.pitch+12;
export function knockoutRoute(round,slot,count){const keys=[];while(round<count){keys.push(round+'-'+slot);round++;slot=Math.floor(slot/2);}return keys;}
export function alignedKnockoutMarkup(competition,rounds,layout) {
 const labels=knockoutRoundLabels(rounds.length),lines=[];
 for(let r=0;r<rounds.length-1;r++)for(let s=0;s<rounds[r].length;s++){
  const x=12+r*layout.stride+layout.width,y=knockoutCenter(layout,r,s),targetY=knockoutCenter(layout,r+1,Math.floor(s/2)),bridge=x+layout.gap/2,targetX=12+(r+1)*layout.stride;
  lines.push(`<path class="ko-connector" data-from="${r}-${s}" data-to="${r+1}-${Math.floor(s/2)}" d="M ${x} ${y} H ${bridge} V ${targetY} H ${targetX}"/>`);
 }
 const date=value=>new Date(value+'T12:00:00').toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric'});
 const label=(id,resolved,r,s,side)=>id?h(competition.entries[id]?.name||'Unknown entrant'):resolved?'Bye':`Winner of ${h(labels[r-1])}<br>Match ${s*2+side+1}`;
 return `<div class="ko-aligned" tabindex="0" aria-label="${h(competition.title)} draw. Scroll horizontally and vertically to follow the rounds."><div class="ko-round-headings" style="width:${layout.boardWidth}px;grid-template-columns:repeat(${rounds.length},${layout.width}px);column-gap:${layout.gap}px">${rounds.map((_,r)=>`<section class="ko-aligned-heading"><h3>${labels[r]}</h3><p>${competition.deadlines?.[r]?'Play by '+date(competition.deadlines[r]):'Date to confirm'}</p></section>`).join('')}</div><div class="ko-draw-world" style="width:${layout.boardWidth}px;height:${layout.boardHeight}px"><svg class="ko-connectors" width="${layout.boardWidth}" height="${layout.boardHeight}" aria-hidden="true">${lines.join('')}</svg>${rounds.map((ties,r)=>ties.map((tie,s)=>`<button type="button" class="ko-match-node" data-ko-round="${r}" data-ko-slot="${s}" aria-pressed="false" aria-label="${h(labels[r])}, match ${s+1}: ${h(tie.home?competition.entries[tie.home]?.name:tie.homeResolved?'Bye':'Awaiting feeder winner')} versus ${h(tie.away?competition.entries[tie.away]?.name:tie.awayResolved?'Bye':'Awaiting feeder winner')}" style="left:${12+r*layout.stride}px;top:${knockoutCenter(layout,r,s)-layout.matchHeight/2}px;width:${layout.width}px;min-height:${layout.matchHeight}px"><span class="ko-node-label">Match ${s+1}${tie.bye?'<span>Bye · automatic progression</span>':''}</span>${[tie.home,tie.away].map((id,side)=>`<span class="ko-node-player ${id&&id===tie.winner?'ko-node-winner':id&&id===tie.loser?'ko-node-loser':''}"><span class="ko-node-name ${!id?'ko-node-pending':''}">${label(id,side===0?tie.homeResolved:tie.awayResolved,r,s,side)}</span>${id&&id===tie.winner?`<small>${tie.bye?'Through':'Winner'}</small>`:''}</span>`).join('')}</button>`).join('')).join('')}</div></div>`;
}
