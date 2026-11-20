import { client, configured, rpc, loadSeasonCatalog } from './client.js?v=season-lifecycle-20261119';
import { buildBracket, roundNames } from './knockout-model.js';
import {alignedKnockoutMarkup,knockoutGeometry,knockoutCenter,knockoutRoute,knockoutRoundLabels} from './knockout-layout.js?v=20261120';

const main = document.querySelector('main');
const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let catalog={installed:false}, season="2026-27";
let drawRounds=[],drawLayout=null,chosenMatch=null,drawCompetition=null,jumpRound=0,drawRenderRevision=0;
let data, records = [], revisions = {}, isAdmin = false, connected = false, saving = false;
let selected = new URLSearchParams(location.search).get('competition') || 'handicap-singles';
const date = s => new Date(s + 'T12:00:00').toLocaleDateString('en-GB', { day:'numeric',month:'short',year:'numeric' });
function notice(message, error = false) {
  const box = document.querySelector('#toast');
  box.textContent = message; box.className = 'notice ' + (error ? 'error' : 'success'); box.hidden = false;
}
async function loadResults() {
  connected = false;
  records = data.competitions.flatMap(c => c.confirmed_results || []);
  revisions = {}; isAdmin = false;
  if (!configured) return;
  try {
    const result = await rpc('knockout_snapshot', { p_season: data.season });
    if(catalog.installed && result.competitions.every(c=>Array.isArray(c.slots))) {data.competitions=result.competitions;data.draw_version=result.draw_version;}
    if (result.draw_version !== data.draw_version) throw new Error('The knockout draw is being updated. Refresh shortly.');
    records = result.results; revisions = Object.fromEntries(result.competitions.map(c => [c.id,c.revision])); isAdmin = result.is_admin; connected = true;
  } catch (error) {
    // Static source draws remain available before the one-time database setup.
    const { data: session } = await client.auth.getSession();
    if (session.session) {
      const league = await rpc('league_snapshot', { p_season: data.season }).catch(() => null);
      isAdmin = league?.membership?.role === 'admin';
    }
  }
}
function render(preserveScroll=false) {
  const renderToken=++drawRenderRevision;
  const previousEditor=preserveScroll?main.querySelector('#ko-result-editor form'):null;
  const editorDraft=previousEditor?{winner:previousEditor.querySelector('[name="winner"]').value,note:previousEditor.querySelector('[name="note"]').value}:null;
  const previous=main.querySelector('.ko-aligned'),scroll=preserveScroll&&previous?{left:previous.scrollLeft,top:previous.scrollTop}:null;
  document.querySelectorAll('.season-chip').forEach(node=>node.textContent=(catalog.active_season||season).replace('-','–')+' season');
  const seasonFilter=catalog.installed?`<label>Season<select id="ko-season">${catalog.seasons.map(s=>`<option value="${esc(s.id)}" ${s.id===season?'selected':''}>${esc(s.name)}${s.archived?' · previous league season':''}</option>`).join('')}</select></label>`:'';
  if(!data.competitions.length){main.innerHTML=`<h1>Knockout draws</h1>${seasonFilter}<p class="card">No draws have been published for this season.</p>`;return;}
  const c=data.competitions.find(c=>c.id===selected)||data.competitions[0];selected=c.id;
  if(drawCompetition!==season+':'+c.id){chosenMatch=null;jumpRound=0;drawCompetition=season+':'+c.id;}
  drawRounds=buildBracket(c,records);drawLayout=knockoutGeometry(drawRounds,{mobile:(window.innerWidth||1024)<600});
  const labels=knockoutRoundLabels(drawRounds.length),final=drawRounds.at(-1)[0];
  main.innerHTML=`<div class="heading"><div><div class="eyebrow">${esc(season.replace('-','–'))} season</div><h1>Knockout draws.</h1><p class="intro">Follow each competition from the opening draw to the final.</p></div></div>
   <div class="ko-layout-controls">${seasonFilter}<label for="competition-select">Competition<select id="competition-select">${data.competitions.map(x=>`<option value="${esc(x.id)}" ${x.id===c.id?'selected':''}>${esc(x.title)}</option>`).join('')}</select></label><label for="ko-round-jump">Jump to round<select id="ko-round-jump">${labels.map((label,r)=>`<option value="${r}" ${r===jumpRound?'selected':''}>${label}</option>`).join('')}</select></label><button type="button" class="secondary" id="ko-refresh">Refresh results</button><button type="button" class="secondary" id="ko-clear-path" hidden>Clear highlighted path</button></div>
   <section aria-labelledby="draw-title"><div class="ko-draw-caption"><h2 id="draw-title">${esc(c.title)}</h2><span>${Object.keys(c.entries).length} ${c.format==='Doubles'?'pairs':'players'}</span></div>${(c.notes||[]).map(n=>`<p class="notice">${esc(n)}</p>`).join('')}
   ${!connected?'<p class="notice">Confirmed draw shown. Live result updates are temporarily unavailable. Refresh to try again.</p>':''}
   ${isAdmin&&connected?`<p class="notice">${c.archived?'Archived competition · results are read-only.':'Administrator: select a match to record its confirmed winner. Correcting an earlier result clears results later in that branch.'}</p>`:''}
   <p class="ko-draw-instruction">Swipe or scroll across the draw. Select a match to highlight its route to the final. Deadlines do not automatically decide a winner.</p>
   <p id="ko-path-description" class="ko-path-description" aria-live="polite"></p><div id="ko-result-editor" class="ko-result-editor"></div>
   ${alignedKnockoutMarkup(c,drawRounds,drawLayout)}
   ${final.winner?`<p class="ko-layout-champion"><strong>Champion: ${esc(c.entries[final.winner].name)}</strong></p>`:''}</section><p class="section-gap">${esc(data.general_notes?.[1]||'')}</p>`;
  updateSelectedMatch();
  if(editorDraft){const form=main.querySelector('#ko-result-editor form');if(form){form.querySelector('[name="winner"]').value=editorDraft.winner;form.querySelector('[name="note"]').value=editorDraft.note;}}
  const applySizing=()=>{
   if(renderToken!==drawRenderRevision)return;
   const nodes=[...main.querySelectorAll('.ko-match-node')];
   const height=Math.ceil(Math.max(128,...nodes.map(node=>Math.max(node.scrollHeight||0,node.getBoundingClientRect?.().height||0))));
   if(height>drawLayout.matchHeight){drawLayout=knockoutGeometry(drawRounds,{mobile:(window.innerWidth||1024)<600,matchHeight:height});const viewport=main.querySelector('.ko-aligned');if(viewport)viewport.outerHTML=alignedKnockoutMarkup(c,drawRounds,drawLayout);updateSelectedMatch(false);}
   const viewport=main.querySelector('.ko-aligned');if(scroll&&viewport){viewport.scrollLeft=scroll.left;viewport.scrollTop=scroll.top;}
  };
  if(window.requestAnimationFrame)window.requestAnimationFrame(applySizing);else applySizing();
}
function updateSelectedMatch(updateEditor=true){
 const keys=new Set(chosenMatch?knockoutRoute(chosenMatch.round,chosenMatch.slot,drawRounds.length):[]);
 for(const node of main.querySelectorAll('.ko-match-node')){const key=node.dataset.koRound+'-'+node.dataset.koSlot,active=chosenMatch&&Number(node.dataset.koRound)===chosenMatch.round&&Number(node.dataset.koSlot)===chosenMatch.slot;node.classList.toggle('is-highlighted',keys.has(key));node.classList.toggle('ko-node-selected',Boolean(active));node.setAttribute('aria-pressed',String(Boolean(active)));}
 for(const line of main.querySelectorAll('.ko-connector'))line.classList.toggle('is-highlighted',keys.has(line.dataset.from)&&keys.has(line.dataset.to));
 const clear=main.querySelector('#ko-clear-path');if(clear)clear.hidden=!chosenMatch;
 const description=main.querySelector('#ko-path-description');if(description)description.textContent=chosenMatch?`${knockoutRoundLabels(drawRounds.length)[chosenMatch.round]} · Match ${chosenMatch.slot+1} · highlighted route to the final`:'';
 if(!updateEditor)return;
 const editor=main.querySelector('#ko-result-editor');if(!editor)return;editor.innerHTML='';
 const c=data.competitions.find(c=>c.id===selected),tie=chosenMatch?drawRounds[chosenMatch.round]?.[chosenMatch.slot]:null;
 if(!isAdmin||!connected||c?.archived||!tie?.editable)return;
 editor.innerHTML=`<section class="card"><h3>${knockoutRoundLabels(drawRounds.length)[chosenMatch.round]} · Match ${tie.slot}</h3><form data-round="${tie.round}" data-slot="${tie.slot}"><div class="form-grid"><label>Confirmed winner<select name="winner" required><option value="">Choose winner…</option>${[tie.home,tie.away].map(id=>`<option value="${esc(id)}" ${tie.winner===id?'selected':''}>${esc(c.entries[id].name)}</option>`).join('')}</select></label><label>Result note<input name="note" required minlength="5" maxlength="300" placeholder="Confirmed by captain / result card"></label></div><button ${saving?'disabled':''}>${tie.winner?'Update winner':'Record winner'}</button></form></section>`;
}
function jumpToRound(round){
 const viewport=main.querySelector('.ko-aligned');if(!viewport)return;
 jumpRound=round;
 const slot=chosenMatch?Math.min(drawRounds[round].length-1,round>=chosenMatch.round?Math.floor(chosenMatch.slot/2**(round-chosenMatch.round)):chosenMatch.slot*2**(chosenMatch.round-round)):0;
 const target={left:Math.max(0,round*drawLayout.stride),top:Math.max(0,knockoutCenter(drawLayout,round,slot)-(viewport.clientHeight||600)/2+82),behavior:window.matchMedia?.('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'};
 if(viewport.scrollTo)viewport.scrollTo(target);else{viewport.scrollLeft=target.left;viewport.scrollTop=target.top;}
}
main.addEventListener('change', async e => {
  if(e.target.id==='ko-round-jump'){jumpToRound(Number(e.target.value));return;}
  if(e.target.id==='ko-season'){season=e.target.value;const url=new URL(location.href);url.searchParams.set('season',season);history.replaceState(null,'',url);try{await loadSeason();}catch(error){notice(error.message,true);}return;}
  if (e.target.id !== 'competition-select') return;
  selected = e.target.value;
  const url = new URL(location.href); url.searchParams.set('competition',selected); history.replaceState(null,'',url);
  render();
});
main.addEventListener('click', async e => {
  const match=e.target.closest('.ko-match-node');if(match){chosenMatch={round:Number(match.dataset.koRound),slot:Number(match.dataset.koSlot)};updateSelectedMatch();return;}
  if(e.target.id==='ko-clear-path'){chosenMatch=null;updateSelectedMatch();return;}
  if (e.target.id !== 'ko-refresh') return;
  await loadResults(); render(); notice(connected ? 'Latest knockout results loaded.' : 'Draw loaded. Live updates are not connected yet.');
});
main.addEventListener('submit', async e => {
  e.preventDefault(); if (saving) return;
  const form = e.target, values = new FormData(form); saving = true;
  for (const b of main.querySelectorAll('button')) b.disabled = true;
  try {
    await rpc('record_knockout_winner', { p_competition: selected, p_round: Number(form.dataset.round), p_slot:Number(form.dataset.slot), p_revision:revisions[selected], p_winner:values.get('winner'), p_note:values.get('note') });
    await loadResults(); saving=false;render(true);notice(connected ? 'Winner recorded and the draw updated.' : 'Winner saved. The latest draw could not be reloaded; refresh results before entering another winner.', !connected);
  } catch(error) { notice(error.message, true); }
  finally { saving = false; for(const b of main.querySelectorAll('button'))b.disabled=false; }
});
async function loadSeason() {
  if(season==='2026-27') {
    const response=await fetch('/data/knockouts/2026-27.json',{cache:'no-store'});
    if(!response.ok)throw new Error('The knockout draws could not be loaded. Refresh to try again.');
    data=await response.json();
  } else data={season,draw_version:null,competitions:[],general_notes:['','']};
  await loadResults();render();
}
async function start() {
  try { catalog=await loadSeasonCatalog(); } catch {}
  season=new URLSearchParams(location.search).get('season') || catalog.active_season || '2026-27';
  await loadSeason();
  client?.auth.onAuthStateChange(() => { setTimeout(async () => { await loadResults(); render(); }, 0); });
}
start().catch(error => { main.textContent = error.message; });

let knockoutResize;window.addEventListener('resize',()=>{clearTimeout(knockoutResize);knockoutResize=setTimeout(()=>{if(data?.competitions.length)render(true);},150);});
