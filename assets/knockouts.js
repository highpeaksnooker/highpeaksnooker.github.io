import { client, configured, rpc } from './client.js';
import { buildBracket, roundNames } from './knockout-model.js';

const main = document.querySelector('main');
const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
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
function render() {
  const c = data.competitions.find(c => c.id === selected) || data.competitions[0]; selected = c.id;
  const rounds = buildBracket(c, records);
  const entrant = (id, resolved, tie) => {
    const label = id ? c.entries[id]?.name || 'Unknown entrant' : resolved ? 'Bye' : 'Awaiting previous match';
    const state = id === tie.winner && id ? (tie.bye ? 'Through · bye' : 'Winner') : id === tie.loser && id ? 'Eliminated' : '';
    return `<li class="ko-entrant ${state === 'Winner' || state === 'Through · bye' ? 'ko-winner' : state === 'Eliminated' ? 'ko-loser' : ''}"><span>${esc(label)}</span>${state ? `<span class="badge">${state}</span>` : ''}</li>`;
  };
  main.innerHTML = `<div class="heading"><div><div class="eyebrow">2026–27 season</div><h1>Knockout draws.</h1><p class="intro">Follow each competition from the opening draw to the final.</p></div></div>
    <div class="ko-controls"><label for="competition-select">Competition<select id="competition-select">${data.competitions.map(x => `<option value="${x.id}" ${x.id === c.id ? 'selected' : ''}>${esc(x.title)}</option>`).join('')}</select></label><button class="secondary" id="ko-refresh">Refresh results</button></div>
    <section aria-labelledby="draw-title"><h2 id="draw-title">${esc(c.title)}</h2><p>${Object.keys(c.entries).length} ${c.format === 'Doubles' ? 'pairs' : 'players'}</p>
    ${c.notes.map(n => `<p class="notice">${esc(n)}</p>`).join('')}
    ${!connected ? `<p class="notice">Confirmed draw shown. Live result updates are temporarily unavailable. Refresh to try again.</p>` : ''}
    ${isAdmin && connected ? '<p class="notice">Administrator: record confirmed winners below. Correcting an earlier result clears results later in that branch.</p>' : ''}
    <p><small>Scroll across to see later rounds. Deadlines do not automatically decide a winner.</small></p>
    <div class="ko-bracket" tabindex="0" aria-label="${esc(c.title)} bracket, scroll horizontally">${rounds.map((ties, i) => `<section class="ko-round" aria-labelledby="ko-round-${i}"><h3 id="ko-round-${i}">${roundNames[i]}</h3><p class="ko-deadline">${c.deadlines[i] ? 'Play by ' + date(c.deadlines[i]) : 'Deadline to confirm'}</p><div class="ko-ties">${ties.map(t => `<article class="ko-tie"><p class="ko-match-label">Match ${t.slot}</p><ul>${entrant(t.home,t.homeResolved,t)}${entrant(t.away,t.awayResolved,t)}</ul>${isAdmin && connected && t.editable ? `<form data-round="${t.round}" data-slot="${t.slot}" data-revision="${t.revision}"><label>Confirmed winner<select name="winner" required><option value="">Choose winner…</option>${[t.home,t.away].map(id => `<option value="${esc(id)}" ${t.winner === id ? 'selected' : ''}>${esc(c.entries[id].name)}</option>`).join('')}</select></label><label>Result note<input name="note" required minlength="5" maxlength="300" placeholder="Confirmed by captain / result card"></label><button ${saving ? 'disabled' : ''}>${t.winner ? 'Update winner' : 'Record winner'}</button></form>` : ''}</article>`).join('')}</div></section>`).join('')}</div>
    ${rounds.at(-1)[0].winner ? `<p class="notice success"><strong>Champion: ${esc(c.entries[rounds.at(-1)[0].winner].name)}</strong></p>` : ''}</section>
    <p class="section-gap">${esc(data.general_notes[1])}</p>`;
}
main.addEventListener('change', e => {
  if (e.target.id !== 'competition-select') return;
  selected = e.target.value;
  const url = new URL(location.href); url.searchParams.set('competition',selected); history.replaceState(null,'',url);
  render();
});
main.addEventListener('click', async e => {
  if (e.target.id !== 'ko-refresh') return;
  await loadResults(); render(); notice(connected ? 'Latest knockout results loaded.' : 'Draw loaded. Live updates are not connected yet.');
});
main.addEventListener('submit', async e => {
  e.preventDefault(); if (saving) return;
  const form = e.target, values = new FormData(form); saving = true;
  for (const b of main.querySelectorAll('button')) b.disabled = true;
  try {
    await rpc('record_knockout_winner', { p_competition: selected, p_round: Number(form.dataset.round), p_slot:Number(form.dataset.slot), p_revision:revisions[selected], p_winner:values.get('winner'), p_note:values.get('note') });
    await loadResults(); notice(connected ? 'Winner recorded and the draw updated.' : 'Winner saved. The latest draw could not be reloaded; refresh results before entering another winner.', !connected);
  } catch(error) { notice(error.message, true); }
  finally { saving = false; render(); }
});
async function start() {
  const response = await fetch('/data/knockouts/2026-27.json', {cache:'no-store'});
  if (!response.ok) throw new Error('The knockout draws could not be loaded. Refresh to try again.');
  data = await response.json(); await loadResults(); render();
  client?.auth.onAuthStateChange(() => { setTimeout(async () => { await loadResults(); render(); }, 0); });
}
start().catch(error => { main.textContent = error.message; });
