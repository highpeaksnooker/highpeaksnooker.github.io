import {configured,rpc,loadSeasonCatalog} from './client.js?v=season-lifecycle-20261119';
import {homeAwayTotals} from './standings-columns.js?v=league-tiebreaks-20261118';
const h = value => String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function table(headers,rows) {return `<div class="table-scroll"><table><thead><tr>${headers.map(x=>`<th scope="col">${h(x)}</th>`).join('')}</tr></thead><tbody>${rows.map(row=>`<tr>${row.map(x=>`<td>${h(x)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;}
async function start(){
 if(!configured)return;
 const catalog=await loadSeasonCatalog();if(!catalog.installed)return;
 document.querySelectorAll('.season-chip').forEach(node=>node.textContent=catalog.active_season.replace('-','–')+' season');
 if(location.pathname.endsWith('history.html')) {
  for(const honour of [...(catalog.honours||[])].reverse()) {
   const section=document.getElementById(honour.competition);if(!section)continue;
   const body=section.querySelector('tbody'),year=String(Number(honour.season_id.slice(0,4))+1);
   const tr=document.createElement('tr');tr.dataset.season=honour.season_id;
   const columns=section.querySelectorAll('thead th').length;
   tr.innerHTML=`<td>${h(year)}</td><td>${h(honour.winner)}</td>`+(columns>2?`<td>${h(honour.value??'')}</td>`:'');
   body.prepend(tr);
   const heading=section.querySelector('h3');if(heading)heading.textContent=heading.textContent.replace(/–[0-9]{4}\)/,'–'+Math.max(Number(year),Number(heading.textContent.match(/–([0-9]{4})\)/)?.[1]||0))+')');
   const option=document.querySelector(`#honoursSelect option[value="${honour.competition}"]`);if(option)option.textContent=heading?.textContent || option.textContent;
  }
  return;
 }
 const main=document.querySelector('main');
 const section=document.createElement('section');section.id='archived-season-records';
 const selected=new URLSearchParams(location.search).get('season');
 section.innerHTML=(catalog.archives||[]).length ? `<h2>Final season records</h2><div class="archive-grid">${catalog.archives.map(s=>`<a class="card archive-record" href="archive.html?season=${encodeURIComponent(s.id)}#archived-season-records"><div class="archive-caption"><h3>${h(s.name)}</h3><span>Final standings &amp; merit ↗</span></div></a>`).join('')}</div>`:'';
 main.querySelector('.heading').after(section);
 if(!selected)return;
 if(!catalog.archives.some(s=>s.id===selected))throw new Error('That season has not been archived.');
 const snapshot=await rpc('archived_season_snapshot',{p_season:selected});if(!snapshot)throw new Error('The archived record is unavailable.');
 const splits=homeAwayTotals(snapshot.results.map(m=>({...m,status:'approved'})));
 const league=snapshot.standings.map(r=>{const s=splits.get(r.id)||{};return[r.position,r.name,r.played,s.home||0,s.away||0,s.framesHome||0,s.framesAway||0,r.bonus,r.points];});
 const merit=snapshot.merit.map(r=>[r.position,r.name,r.played,r.won,r.lost,r.diff,r.breaks25,r.high]);
 section.innerHTML=`<div class="card"><h2>${h(snapshot.season.name)} · Final league standings</h2>${table(['Pos','Team','P','Home','Away','FrW (H)','FrW (A)','Bonus','Pts'],league)}</div><div class="card"><h2>${h(snapshot.season.name)} · Final merit table</h2>${table(['Pos','Player','P','W','L','±','25+','High'],merit)}</div><p><a href="archive.html">All archived seasons</a></p>`;
}
start().catch(error=>{const section=document.getElementById('archived-season-records');if(section){const p=document.createElement('p');p.className='notice';p.textContent=error.message;section.append(p);}});
