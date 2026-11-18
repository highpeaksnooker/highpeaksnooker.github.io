import { travellersPrize } from "./travellers.js?v=20261116";
import { upcomingFixtures, seasonHighestBreak, resultCardData } from "./league-features.js?v=20261116";
import { showResultCard } from "./result-card.js?v=20261116";
import { scorecardLocked, liveScoreMatches, amendmentChanges, agreedBreaks } from "./scorecards.js?v=break-agreement-20261116";
import { nextCaptainFixture } from "./captain-fixture.js";
import { breakTableRows } from "./break-table.js";
import { homeAwayTotals } from "./standings-columns.js";
import {
  client,
  configured,
  loadSnapshot,
  rpc,
  authLinkType,
  manageCaptainAccount,
  captainPinStatus, signInCaptainPin, setCaptainPin, unlockCaptainPin,
} from "./client.js?v=captain-pin-20261118";
import { handicapAt, parseBreaks, frameTotals } from "./rules.js";
import { loginEmail, captainUsername } from "./login-identities.js";
import { pageFromPath } from "./routes.js";
const main = document.querySelector("main");
const page = pageFromPath(location.pathname);
let state,
  session,
  busy = false,
  dirty = false,
  recovery = ["invite", "recovery"].includes(authLinkType),
  tableMode = "official";
const notifiedAmendments = new Set();
let pinStatus = {ready:false,teams:[]};
let captainLoginTeam = "";
let tickerPaused = false;
let filterTeam = "",
  filterRound = "";
const h = (value) =>
  String(value ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
const teamName = (id) =>
  state.teams.find((t) => t.id === id)?.name || id || "—";
const playerName = (id) =>
  id === null ? "No player" : state.players.find((p) => p.id === id)?.name || "Unknown player";
const member = () => state.membership;
const admin = () => member()?.role === "admin";
const ownTeam = () => member()?.team_id;
const number = (data, key) => Number(data.get(key));
const date = (value) =>
  new Date(value + "T12:00:00").toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
function options(items, value, label, selected = "", blank = "Choose…") {
  return (
    `<option value="">${h(blank)}</option>` +
    items
      .map(
        (x) =>
          `<option value="${h(x[value])}" ${String(x[value]) === String(selected) ? "selected" : ""}>${h(x[label])}</option>`,
      )
      .join("")
  );
}
const teamOptions = (selected = "", blank = "Choose team…") =>
  options(state.teams, "id", "name", selected, blank);
function toast(message, error = false) {
  const box = document.querySelector("#toast");
  box.className = "notice " + (error ? "error" : "success");
  box.textContent = message;
  box.hidden = false;
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => {
    box.hidden = true;
  }, 9000);
}
function heading(title, description, extra = "") {
  return `<div class="heading"><div><div class="eyebrow">2026–27 season</div><h1>${title}</h1>${description ? `<p class="intro">${description}</p>` : ""}</div>${extra}</div>`;
}
function empty(title, text) {
  return `<div class="empty"><strong>${title}</strong>${text}</div>`;
}
function commonNotice() {
  return !configured
    ? '<div class="notice">The new season is being prepared. Live scores and captain access will become available when setup is complete.</div>'
    : !state.season?.ready
      ? '<div class="notice">Season setup is in progress. The starting roster and handicaps must be checked before team selections open.</div>'
      : "";
}
function status(m) {
  return m.status === "approved"
    ? '<span class="badge">Official result</span>'
    : m.home_confirmed && m.away_confirmed
      ? '<span class="badge pending">Awaiting administrator</span>'
      : m.status === "live"
        ? '<span class="badge live">In progress · provisional</span>'
        : '<span class="badge">Scheduled</span>';
}
function currentTravellersPrize() {
  return travellersPrize(state.matches, {seasonId:state.season.id, teamCount:state.teams.length, lastRound:state.season.last_round});
}
function leagueTable(rows) {
  const prizeHolder = currentTravellersPrize()?.holder;
  const splits = homeAwayTotals(state.matches, tableMode === "provisional");
  const columns = [["Pos", "Position"], ["Team", "Team"], ["P", "Matches played"], ["Home", "Matches played at home"], ["Away", "Matches played away"], ["FrW (H)", "Frames won at home"], ["FrW (A)", "Frames won away"], ["Bonus", "Total bonus points"], ["Pts", "Total points"]];
  return `<div class="table-scroll"><table class="league-table"><caption class="screen-reader">${tableMode === "official" ? "Official" : "Provisional"} league table</caption><thead><tr>${columns.map(([label, description]) => `<th scope="col" title="${description}" aria-label="${description}">${label}</th>`).join("")}</tr></thead><tbody>${rows.map(r => {
    const split = splits.get(r.id) || { home: 0, away: 0, framesHome: 0, framesAway: 0, bonus: 0 };
    return `<tr><td class="rank">${r.position}</td><td class="team-name"><span class="team-prize-label"><a href="merit.html?team=${encodeURIComponent(r.id)}">${h(r.name)}</a>${r.id === prizeHolder ? '<span class="travellers-marker" role="img" aria-label="Travellers Prize holders" title="Travellers Prize holders">T</span>' : ""}</span></td>${[r.played, split.home, split.away, split.framesHome, split.framesAway, split.bonus].map(n => `<td>${n}</td>`).join("")}<td class="points"${r.adjustment ? ` title="Includes ${h(r.adjustment)} adjustment points"` : ""}>${r.points}</td></tr>`;
  }).join("")}</tbody></table></div>`;
}
function fixtureBanner() {
  const matches = upcomingFixtures(state.matches);
  if (!matches.length) return "";
  const items = hidden => matches.map(match => `<a href="fixtures.html?round=${match.round}&amp;team=${encodeURIComponent(match.home_id)}" ${hidden ? 'tabindex="-1"' : ''}>${h(teamName(match.home_id))} <span>v</span> ${h(teamName(match.away_id))}</a>`).join("");
  return `<section class="fixture-banner ${matches.length === 1 ? "is-single" : ""}" aria-label="Next fixtures" ${tickerPaused ? "data-paused" : ""}><div class="fixture-label"><strong>Next fixtures</strong><time datetime="${matches[0].date}">${date(matches[0].date)}</time></div><div class="fixture-window"><div class="fixture-track"><div class="fixture-set">${items(false)}</div><div class="fixture-set" aria-hidden="true">${items(true)}</div></div></div><button type="button" class="fixture-pause" data-ticker-pause aria-pressed="${tickerPaused}" aria-label="${tickerPaused ? "Resume" : "Pause"} fixture announcements">${tickerPaused ? "Play" : "Pause"}</button></section>`;
}
function travellersCard() {
  const prize = currentTravellersPrize();
  if (!prize) return "";
  const trophy = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><path d="M7 3h10v5a5 5 0 0 1-10 0V3ZM7 5H4v2a4 4 0 0 0 4 4m9-6h3v2a4 4 0 0 1-4 4M12 13v5m-4 3h8m-7-3h6v3H9z"/></svg>';
  return `<section class="card travellers-card"><div class="eyebrow">${trophy}Travellers Prize</div><h2 class="section-gap">${h(teamName(prize.holder))}</h2><p class="muted">${prize.seasonComplete ? "Season winners" : "Current holders"} · ${h(state.season.name)}</p>${prize.blocked ? '<p class="muted">Awaiting confirmation of the prize journey.</p>' : ""}<details><summary>Prize journey</summary><ol class="travellers-journey">${prize.journey.map(step => `<li><strong>${h(teamName(step.holder))}</strong><small>${step.starting ? "Started the season as the previous holders" : `Round ${step.round} · ${date(step.date)}<br>${h(step.score)} against ${h(teamName(step.previous))}`}</small></li>`).join("")}</ol>${prize.nextFixture ? `<p class="travellers-next"><a href="fixtures.html?team=${encodeURIComponent(prize.holder)}&amp;round=${prize.nextFixture.round}">Next defence: ${h(teamName(prize.nextFixture.home_id))} v ${h(teamName(prize.nextFixture.away_id))} · ${date(prize.nextFixture.date)}</a></p>` : ""}</details></section>`;
}
function renderHome() {
  return (
    fixtureBanner() +
    ` <section class="card standings-card"><div class="toolbar"><h2 style="margin:0;margin-right:auto">League standings</h2><button type="button" data-view="official" ${tableMode === "official" ? "disabled" : ""}>Official</button><button type="button" class="secondary" data-view="provisional" ${tableMode === "provisional" ? "disabled" : ""}>Provisional</button></div>${leagueTable(state[tableMode])}<p class="muted"><small>Points → frame difference → frames won → head-to-head points → head-to-head frame difference. A remaining tie requires a playoff.</small></p></section>
 <div class="two-col">${travellersCard()}<section class="card"><div class="eyebrow">Season guide</div><h2 class="section-gap">Three handicap reviews.</h2><p class="muted">Reviews follow rounds 5, 10 and 15. A win difference of +2 or more reduces a handicap by 7; −2 or below increases it by 7.</p><a href="merit.html">Players, handicaps & merit →</a></section></div>`
  );
}
function filters() {
  return `<div class="toolbar"><label>Team<select id="team-filter">${teamOptions(filterTeam, "All teams")}</select></label><label>Round<select id="round-filter"><option value="">All rounds</option>${Array.from({ length: 18 }, (_, i) => `<option value="${i + 1}" ${String(i + 1) === filterRound ? "selected" : ""}>Round ${i + 1}</option>`).join("")}</select></label><button type="button" class="secondary" data-refresh>Refresh</button></div>`;
}
function filtered(matches) {
  return matches.filter(
    (m) =>
      (!filterTeam || [m.home_id, m.away_id].includes(filterTeam)) &&
      (!filterRound || String(m.round) === filterRound),
  );
}
function publicCard(m) {
  const totals = frameTotals(m);
  return `<details class="match" id="match-${m.id}"><summary class="match-head"><div><strong>${h(teamName(m.home_id))} <span class="muted">v</span> ${h(teamName(m.away_id))}</strong><div class="match-meta">Round ${m.round} · ${date(m.date)}</div></div><div class="row">${status(m)}<span class="score">${totals.home}–${totals.away}</span></div></summary><div class="match-body">
 ${m.awarded_to ? `<p>Match awarded to ${h(teamName(m.awarded_to))}. League points: ${totals.points.join("–")}. No individual merit results.</p>` : `<p class="muted">Frames won shown above. League points ${totals.complete ? "including win bonus" : "so far"}: <strong>${totals.points.join("–")}</strong>.</p>`}
 ${m.status === "approved" ? `<div class="result-share"><button class="secondary" type="button" data-share-result="${h(m.id)}">Share result</button></div>` : ""}${lineupsPublic(m)}${m.frames
   .filter((f) => f.accepted)
   .map(
     (f) =>
       `<div class="frame"><div class="frame-title"><span>Frame ${f.slot}: ${playerLink(f.home_player)} v ${playerLink(f.away_player)}</span><strong>${f.is_walkover ? "Awarded frame" : f.home_points+"–"+f.away_points}</strong></div><small>Winner: ${h(playerName(f.winner === "home" ? f.home_player : f.away_player))}${f.is_walkover ? " · Counts for merit and handicap appearances" : ""}${f.home_breaks.length ? " · Home breaks: " + h(f.home_breaks.join(", ")) : ""}${f.away_breaks.length ? " · Away breaks: " + h(f.away_breaks.join(", ")) : ""}</small></div>`,
   )
   .join("")}
 ${!m.frames.some((f) => f.accepted) && !m.awarded_to ? '<p class="muted">No mutually approved frames yet.</p>' : ""}</div></details>`;
}
function playerLink(id) {
  return id ? `<a href="player.html?player=${encodeURIComponent(id)}">${h(playerName(id))}</a>` : "No player";
}
function lineupsPublic(m) {
  if (m.lineups.length !== 2) return "";
  return `<div class="lineups">${[m.home_id, m.away_id]
    .map(
      (t) =>
        `<div><h3>${h(teamName(t))}</h3><ol>${m.lineups
          .find((l) => l.team_id === t)
          .player_ids.map(
            (id) =>
              id === null ? '<li>No player</li>' : `<li>${playerLink(id)} <small>(${handicapAt(
                state.players.find((p) => p.id === id),
                state.handicaps,
                m.round,
              )})</small></li>`,
          )
          .join("")}</ol></div>`,
    )
    .join("")}</div>`;
}
function renderFixtures() {
  const games = filtered(state.matches).filter(
    (m) => m.status !== "approved",
  );
  return (
    filters() +
    (games.length
      ? games.map(publicCard).join("")
      : empty(
          "Fixtures will appear here.",
          state.matches.length
            ? "No fixtures match your filters."
            : "The administrator will add the 2026–27 schedule.",
        ))
  );
}
function renderLiveScores() {
  const matches = liveScoreMatches(filtered(state.matches));
  return `<div class="live-heading"><h1>Live Scores</h1><span class="badge live">Auto-updating · agreed frames only</span></div>${filters()}${matches.length ? matches.map(liveScoreCard).join("") : '<section class="card empty"><strong>No matches live yet.</strong><p>Pairings appear when both captains submit their teams.</p></section>'}`;
}
function liveBreakLabel(frame, side) {
  const breaks = agreedBreaks(frame, side);
  return breaks.length ? `<small class="live-breaks">${breaks.length === 1 ? "Break" : "Breaks"}: ${breaks.join(", ")}</small>` : "";
}
function liveScoreCard(match) {
  const totals = frameTotals(match);
  const pairing = slot => {
    const home = match.lineups.find(lineup => lineup.team_id === match.home_id).player_ids[slot - 1];
    const away = match.lineups.find(lineup => lineup.team_id === match.away_id).player_ids[slot - 1];
    const frame = match.frames.find(frame => frame.slot === slot && frame.accepted);
    return `<div class="live-frame"><span class="live-slot" aria-label="Frame ${slot}">${slot}</span><span class="live-player ${frame?.winner === "home" ? "live-frame-winner" : ""}">${h(playerName(home))}${liveBreakLabel(frame, "home")}</span><span class="live-frame-score" aria-label="${frame ? frame.is_walkover ? 'Awarded frame' : `Agreed score ${frame.home_points} to ${frame.away_points}` : 'Frame not yet agreed'}">${frame ? frame.is_walkover ? "Awarded" : `${frame.home_points}–${frame.away_points}` : "—"}</span><span class="live-player live-away ${frame?.winner === "away" ? "live-frame-winner" : ""}">${h(playerName(away))}${liveBreakLabel(frame, "away")}</span></div>`;
  };
  return `<section class="card live-scorecard" aria-label="${h(teamName(match.home_id))} versus ${h(teamName(match.away_id))}"><div class="live-match-meta"><span>Round ${match.round} · ${date(match.date)}</span><span class="badge ${scorecardLocked(match) ? "" : "live"}">${scorecardLocked(match) ? "Confirmed · awaiting approval" : "In progress"}</span></div><div class="live-scoreline"><h2>${h(teamName(match.home_id))}<small>Home</small></h2><strong class="score" aria-label="Match score ${totals.home} to ${totals.away}">${totals.home}–${totals.away}</strong><h2>${h(teamName(match.away_id))}<small>Away</small></h2></div><div class="live-pairings">${Array.from({length:5}, (_, index) => pairing(index + 1)).join("")}</div><p class="live-agreed-count">${match.frames.filter(frame => frame.accepted).length} of 5 frames agreed</p></section>`;
}
function amendmentNotices(match) {
  if (!match.amendments?.length) return "";
  return `<details class="scorecard-amendments" open><summary>Score amendments (${match.amendments.length})</summary>${match.amendments.map(amendment => `<aside class="notice amendment"><strong>Frame ${amendment.slot} amended by ${h(teamName(amendment.team_id))}</strong><ul>${amendmentChanges(amendment).map(change => `<li>${h(change)}</li>`).join("")}</ul><small>${h(new Date(amendment.created_at).toLocaleString("en-GB"))} · ${match.frames.find(frame => frame.slot === amendment.slot)?.accepted ? "Corrected frame accepted by both captains." : "The opposing captain must accept the corrected frame."} Previous full-scorecard confirmations were cleared.</small></aside>`).join("")}</details>`;
}
function renderResults() {
  const games = filtered(state.matches)
    .filter((m) => m.status !== "scheduled")
    .sort((a, b) => b.round - a.round);
  return (
    filters() +
    (games.length
      ? games.map(publicCard).join("")
      : empty(
          "A fresh scorecard.",
          "No results have been entered for the new season.",
        ))
  );
}
function renderBreakTable() {
  const rows = breakTableRows(state.matches, state.players);
  const highest = seasonHighestBreak(rows);
  return `<section class="card"><h1>Break Table</h1>${rows.length ? `<div class="table-scroll"><table><caption class="screen-reader">Players ranked by number of breaks of 25 and over</caption><thead><tr><th scope="col">Pos</th><th scope="col">Player</th><th scope="col">Team</th><th scope="col" title="Number of breaks of 25 and over">25+</th><th scope="col">Breaks</th></tr></thead><tbody>${rows.map(player => `<tr><td>${player.position}</td><td><a href="player.html?player=${encodeURIComponent(player.id)}">${h(player.name)}</a></td><td>${h(teamName(player.team_id))}</td><td class="points">${player.breaks.length}</td><td>${player.breaks.map(value => value === highest ? `<strong class="season-high-break" title="Season’s highest break" aria-label="Season’s highest break: ${value}">${value}</strong>` : String(value)).join(", ")}</td></tr>`).join("")}</tbody></table></div>` : '<p class="muted">No breaks of 25 or more recorded yet.</p>'}</section>`;
}
function renderMerit() {
  const rows = state.merit.filter(
    (p) => !filterTeam || p.team_id === filterTeam,
  );
  return (
    heading(
      "Players & merit.",
      "",
    ) +
    `<div class="toolbar"><label>Team<select id="team-filter">${teamOptions(filterTeam, "All teams")}</select></label><button type="button" class="secondary" data-export="players">Download roster CSV</button></div><section class="card"><h2>Individual merit</h2>${rows.length ? `<div class="table-scroll"><table><thead><tr>${["Pos", "Player", "Team", "P", "W", "L", "±", "25+", "High"].map((x) => `<th>${x}</th>`).join("")}</tr></thead><tbody>${rows.map((p) => `<tr><td>${p.position}${p.tied ? " =" : ""}</td><td><a href="player.html?player=${encodeURIComponent(p.id)}">${h(p.name)}</a></td><td>${h(teamName(p.team_id))}</td>${[p.played, p.won, p.lost, p.diff, p.breaks25, p.high].map((n) => `<td>${n}</td>`).join("")}</tr>`).join("")}</tbody></table></div>` : empty("The season starts here.", "Rankings will appear when match results are approved.")}<p><small>Tie-breaks: wins, win difference, highest break of at least 25, number of 25+ breaks, most matches played, then a playoff.</small></p></section><section class="card"><h2>Registered players & handicaps</h2>${!state.season.ready ? '<p class="warning-text">Proposed carry-forward roster — awaiting administrator verification.</p>' : ""}<div class="table-scroll"><table><thead><tr><th>Player</th><th>Team</th><th>Starting HCP</th><th>Current HCP</th><th>Review</th></tr></thead><tbody>${state.players
      .filter((p) => !filterTeam || p.team_id === filterTeam)
      .map(
        (p) =>
          `<tr><td><a href="player.html?player=${p.id}">${h(p.name)}</a></td><td>${h(teamName(p.team_id))}</td><td>${p.initial_hcp}</td><td>${p.current_hcp}</td><td>${p.is_new && !p.reviewed_at ? "Manual review after 3 matches" : "Tranche review"}</td></tr>`,
      )
      .join("")}</tbody></table></div></section>`
  );
}
function renderPlayer() {
  const id = new URLSearchParams(location.search).get("player");
  const p = state.players.find((p) => p.id === id);
  if (!p)
    return (
      heading("Player profile.", "Choose a player from the roster.") +
      '<a href="merit.html">View players →</a>'
    );
  const rows = state.matches
    .filter((m) => m.status === "approved" && !m.awarded_to)
    .flatMap((m) =>
      m.frames
        .filter((f) => [f.home_player, f.away_player].includes(id))
        .map((f) => ({ m, f })),
    );
  return (
    heading(
      h(p.name),
      h(teamName(p.team_id)) + ` · Current handicap ${p.current_hcp}`,
      '<a href="merit.html">← All players</a>',
    ) +
    `<section class="card"><h2>Approved league frames</h2>${rows.length ? rows.map(({ m, f }) => `<div class="frame"><strong>Round ${m.round} · ${date(m.date)}</strong><p>${h(playerName(f.home_player))} ${f.is_walkover ? "— awarded frame —" : f.home_points+"–"+f.away_points} ${h(playerName(f.away_player))}</p><small>Winner: ${h(playerName(f.winner === "home" ? f.home_player : f.away_player))}</small>${(f.home_player === id ? f.home_breaks : f.away_breaks).length ? `<p class="player-game-breaks"><strong>Breaks:</strong> ${h((f.home_player === id ? f.home_breaks : f.away_breaks).join(", "))}</p>` : ""}</div>`).join("") : empty("No approved appearances yet.", "Frame history will appear here.")}</section><section class="card"><h2>Handicap history</h2><p>Season starting handicap: ${p.initial_hcp}</p>${state.handicaps
      .filter((x) => x.player_id === id)
      .map(
        (x) =>
          `<p><strong>${x.handicap}</strong> from round ${x.effective_round} · ${h(x.reason)}</p>`,
      )
      .join("")}</section>`
  );
}
function login() {
  if (page === "admin.html") return heading("League administration.", "") + `<section class="card login"><h2>Administrator sign in</h2><form data-action="login"><label>Administrator email<input type="email" name="identifier" required autocomplete="username"></label><label>Password<input type="password" name="password" required autocomplete="current-password" minlength="8"></label><button ${!configured ? "disabled" : ""}>Sign in</button></form><details class="section-gap"><summary>Forgot your password?</summary><form data-action="reset"><label>Administrator email<input name="email" type="email" autocomplete="email" required></label><button class="secondary">Send reset link</button></form></details></section>`;
  const usePin=pinStatus.ready && pinStatus.teams.includes(captainLoginTeam);
  return heading("Captain sign in", "") + `<section class="card login"><h2>Your team</h2><form data-action="${usePin ? "captain-pin-login" : "login"}"><label>Team<select id="captain-login-team" name="team" required autocomplete="organization">${teamOptions(captainLoginTeam,"Choose your team")}</select></label>${usePin ? '<label>Four-digit PIN<input class="captain-pin-input" type="password" name="pin" required inputmode="numeric" pattern="[0-9]{4}" minlength="4" maxlength="4" autocomplete="current-password"></label>' : '<label>Team password<input type="password" name="password" required autocomplete="current-password" minlength="8"></label>'}<button ${!configured ? "disabled" : ""}>Sign in</button></form><details class="section-gap"><summary>Forgot your ${usePin ? "PIN" : "password"}?</summary><p>Ask the league administrator to reset your team’s ${usePin ? "PIN" : "password"}.</p></details></section>`;
}
function captainPinManagement() {
  if(!pinStatus.ready)return '<details class="card"><summary>Four-digit team PINs</summary><p>PIN sign-in needs its one-time server setup. Existing team passwords still work.</p></details>';
  return `<details class="card"><summary>Four-digit team PINs</summary><p>Set a team’s PIN to switch it from password sign-in. Captains choose their team and enter four digits.</p><form data-action="captain-pin-set"><label>Team<select id="captain-pin-team" name="team" required>${teamOptions()}</select></label><div class="form-grid"><label>New four-digit PIN<input type="password" name="pin" inputmode="numeric" pattern="[0-9]{4}" minlength="4" maxlength="4" required autocomplete="new-password"></label><label>Repeat PIN<input type="password" name="repeatPin" inputmode="numeric" pattern="[0-9]{4}" minlength="4" maxlength="4" required autocomplete="new-password"></label></div><p><small>Avoid repeated digits, 1234, 4321, 1212 and 2580.</small></p><label><input type="checkbox" required>This replaces the selected team’s existing login.</label><button>Save team PIN</button><button type="button" class="secondary" data-unlock-pin>Unlock sign-in attempts</button></form><p><small>Five failed attempts cause a 15-minute pause; ten cause a one-hour pause. After fifteen, an administrator must unlock or reset the PIN. PINs are never displayed or added to the activity log.</small></p></details>`;
}
function passwordForm() {
  return `<section class="card login"><h2>Set your password</h2><form data-action="password"><label>New password<input type="password" name="password" autocomplete="new-password" required minlength="12"></label><button>Save password</button></form></section>`;
}
function accountBar() {
  return `<div class="toolbar"><span class="badge">${admin() ? "Administrator" : h(teamName(ownTeam())) + " captain"}</span><span class="muted">${h(admin() ? session?.user.email : captainUsername(ownTeam()))}</span><button class="secondary" data-logout>Sign out</button><button class="secondary" data-refresh>Refresh</button>${admin() ? '<a href="admin.html">Administration</a>' : ""}</div>`;
}
function lineupForm(m, t) {
  const l = m.lineups.find((l) => l.team_id === t);
  if (l)
    return `<p class="badge">${h(teamName(t))}: lineup submitted and locked</p>`;
  return `<form data-action="lineup" data-match="${m.id}" data-revision="${m.revision}" data-team="${t}"><h3>${h(teamName(t))}: select your five</h3><p><small>Playing order determines pairings. Your list stays hidden until both teams submit.</small></p>${Array.from(
    { length: 5 },
    (_, i) =>
      `<label>Frame ${i + 1}<select name="player${i + 1}" required>${options(
        state.players.filter((p) => p.team_id === t && p.active),
        "id",
        "name",
      )}</select></label>`,
  ).join(
    "",
  )}<button ${!state.season.ready ? "disabled" : ""}>Submit & lock team</button></form>`;
}
function frameEditor(m, slot, f, hp, ap) {
  return `<form data-action="frame" data-match="${m.id}" data-revision="${m.revision}" data-slot="${slot}"><fieldset ${f && state.scorecard_workflow !== 1 ? 'disabled title="Score corrections need the administrator’s scorecard update."' : ""}><div class="form-grid"><label>${h(playerName(hp))} · HCP ${handicapAt(state.players.find(player => player.id === hp), state.handicaps, m.round)}<input type="number" name="home" required min="0" max="1000" value="${f?.home_points ?? ""}" inputmode="numeric"></label><label>${h(playerName(ap))} · HCP ${handicapAt(state.players.find(player => player.id === ap), state.handicaps, m.round)}<input type="number" name="away" required min="0" max="1000" value="${f?.away_points ?? ""}" inputmode="numeric"></label><label>Home breaks<input name="homeBreaks" value="${h(f?.home_breaks.join(", ") || "")}" placeholder="e.g. 25, 32" inputmode="numeric"></label><label>Away breaks<input name="awayBreaks" value="${h(f?.away_breaks.join(", ") || "")}" placeholder="e.g. 28" inputmode="numeric"></label></div><p><small>Enter final scores including the handicap, and any breaks.</small></p>${admin() ? `<label>Record on behalf of<select name="team" required>${options(state.teams.filter(team => [m.home_id, m.away_id].includes(team.id)), "id", "name", f?.submitted_by || m.home_id)}</select></label>` : ""}<button>${f ? "Save amendment" : "Save frame"}</button></fieldset></form>`;
}
function frameForm(m, slot) {
  const f = m.frames.find(frame => frame.slot === slot);
  if (f?.is_walkover) return `<div class="frame"><h3>Frame ${slot}: awarded to ${h(playerName(f.winner === "home" ? f.home_player : f.away_player))}</h3><p>Counts as a merit win and handicap appearance. No opponent or numerical score was recorded.</p></div>`;
  const hp = m.lineups.find(lineup => lineup.team_id === m.home_id).player_ids[slot - 1];
  const ap = m.lineups.find(lineup => lineup.team_id === m.away_id).player_ids[slot - 1];
  const title = `<div class="frame-title"><h3>Frame ${slot}: ${h(playerName(hp))} v ${h(playerName(ap))}</h3>${f ? `<span class="badge ${f.accepted ? "" : "pending"}">${f.accepted ? "Agreed by both captains" : "Awaiting opposing captain"}</span>` : ""}</div>`;
  if (!f) return `<div class="frame">${title}${frameEditor(m, slot, null, hp, ap)}</div>`;
  const review = `<div class="frame-score-review"><div><strong>${h(playerName(hp))}</strong><span>${f.home_points}</span><small>Breaks: ${h(f.home_breaks.join(", ") || "None")}</small></div><div><strong>${h(playerName(ap))}</strong><span>${f.away_points}</span><small>Breaks: ${h(f.away_breaks.join(", ") || "None")}</small></div></div>`;
  const agree = !f.accepted && (admin() || f.submitted_by !== ownTeam()) ? `<form data-action="accept-frame" data-match="${m.id}" data-revision="${m.revision}" data-slot="${slot}" class="frame-agree">${admin() ? `<input type="hidden" name="team" value="${f.submitted_by === m.home_id ? m.away_id : m.home_id}">` : ""}<p><small>Save your agreement with both the frame score and recorded breaks.</small></p><button>Save &amp; agree</button></form>` : "";
  return `<div class="frame">${title}${review}${!f.accepted ? `<p><small>Saved by ${h(teamName(f.submitted_by))}. Awaiting the other captain’s agreement.</small></p>` : ""}${agree}<details class="frame-edit"><summary>Amend score or breaks</summary>${frameEditor(m, slot, f, hp, ap)}</details></div>`;
}
function substitutionForm(m) {
  return `<details class="section-gap"><summary>Request a substitution</summary><form data-action="substitute" data-match="${m.id}" data-revision="${m.revision}"><label>Team<select name="team" required>${options(
    state.teams.filter((t) => [m.home_id, m.away_id].includes(t.id)),
    "id",
    "name",
  )}</select></label><label>Frame number<input type="number" name="slot" min="1" max="5" required></label><label>Replacement player<select name="player" required>${options(
    state.players.filter(
      (p) => [m.home_id, m.away_id].includes(p.team_id) && p.active,
    ),
    "id",
    "name",
  )}</select></label><button class="secondary">Request opposing captain’s approval</button></form></details>`;
}
function privateCard(m) {
  const totals = frameTotals(m);
  const locked = scorecardLocked(m);
  return `<details class="match" id="match-${m.id}" ${!admin() || location.hash === "#" + m.id ? "open" : ""}><summary class="match-head"><div><strong>${h(teamName(m.home_id))} v ${h(teamName(m.away_id))}</strong><div class="match-meta">Round ${m.round} · ${date(m.date)}</div></div><div class="row">${status(m)}<span class="score">${totals.home}–${totals.away}</span></div></summary><div class="match-body">${amendmentNotices(m)}
 ${
   locked
     ? `<p>Full scorecard confirmed. This scorecard is locked.</p>${lineupsPublic(m)}${m.frames.map(f => `<div class="frame"><strong>Frame ${f.slot}</strong><p>${playerLink(f.home_player)} ${f.is_walkover ? "— awarded frame —" : h(f.home_points)+"–"+h(f.away_points)} ${playerLink(f.away_player)}</p>${f.home_breaks.length ? `<small>Home breaks: ${h(f.home_breaks.join(", "))}</small>` : ""}${f.away_breaks.length ? `<small>Away breaks: ${h(f.away_breaks.join(", "))}</small>` : ""}</div>`).join("")}${admin() && m.status !== "approved" ? `<form data-action="approve" data-match="${m.id}" data-revision="${m.revision}"><button>Approve official result</button></form>` : ""}${admin() ? `<form data-action="reopen" data-match="${m.id}"><label>Reason for reopening<input name="reason" required minlength="5"></label><button class="secondary">Reopen for correction</button></form>` : ""}`
     : `${
         m.awarded_to
           ? `<p>Match awarded to <strong>${h(teamName(m.awarded_to))}</strong>: ${h(m.award_reason)}. League points ${totals.points.join("–")}; no merit wins or losses.</p>`
           : `${admin() ? `<div class="notice">Historical entry: record selections and captain agreements from the original scorecard. All administrator actions are recorded.</div>` : ""}${m.lineups.length === 2 ? lineupsPublic(m) : [...new Set(admin() ? [m.home_id, m.away_id] : [ownTeam()])].map((t) => lineupForm(m, t)).join("")}${m.lineups.length === 2 ? Array.from({ length: 5 }, (_, i) => frameForm(m, i + 1)).join("") : ""}${!admin() && m.lineups.length === 2 ? substitutionForm(m) : ""}`
       }
 ${(m.substitutions || []).map((s) => `<div class="notice">Substitution request: ${h(teamName(s.team_id))}, frame ${s.slot} → ${h(playerName(s.player_id))}${s.proposed_by !== ownTeam() && !admin() ? `<form data-action="accept-substitution" data-match="${m.id}" data-revision="${m.revision}" data-substitution="${s.id}"><button>Approve substitution</button></form>` : ""}</div>`).join("")}
 ${(m.substitutions || []).map((s) => `<form data-action="cancel-substitution" data-match="${m.id}" data-revision="${m.revision}" data-substitution="${s.id}"><button class="secondary">${s.proposed_by === ownTeam() ? "Withdraw" : "Decline"} substitution request</button></form>`).join("")}
 <div class="card section-gap"><h3>Final match confirmation</h3><p>${h(teamName(m.home_id))}: ${m.home_confirmed ? "confirmed" : "awaiting confirmation"}<br>${h(teamName(m.away_id))}: ${m.away_confirmed ? "confirmed" : "awaiting confirmation"}</p>${(admin()
   ? [m.home_id, m.away_id]
   : [ownTeam()]
 )
   .filter((t) => (t === m.home_id ? !m.home_confirmed : !m.away_confirmed))
   .map(
     (t) =>
       `<form data-action="confirm" data-match="${m.id}" data-revision="${m.revision}" data-team="${t}"><label><input type="checkbox" required>I confirm the full scorecard${admin() ? " on behalf of " + h(teamName(t)) : ""}.</label><button ${!totals.complete || (m.substitutions || []).length ? "disabled" : ""}>Confirm ${h(teamName(t))} result</button></form>`,
   )
   .join(
     "",
   )}${admin() && m.home_confirmed && m.away_confirmed ? `<form data-action="approve" data-match="${m.id}" data-revision="${m.revision}"><button>Approve official result</button></form>` : ""}</div>
 ${
   admin()
     ? `<details><summary>Fixture date or walkover</summary><form data-action="reschedule" data-match="${m.id}"><label>Rearranged date<input name="date" type="date" required value="${m.date}"></label><label>Reason<input name="reason" required minlength="5"></label><p><small>The match must be played within its original tranche.</small></p><button class="secondary">Save date</button></form>${
         !m.frames.length
           ? `<form data-action="award" data-match="${m.id}" data-revision="${m.revision}" class="section-gap"><label>Award match to<select name="winner" required>${options(
               state.teams.filter((t) => [m.home_id, m.away_id].includes(t.id)),
               "id",
               "name",
             )}</select></label><label>Reason<input name="reason" required minlength="5"></label><button class="secondary">Record walkover for captain confirmation</button></form>`
           : ""
       }</details>`
     : ""
 }`
 }
 </div></details>`;
}
function renderCaptain() {
  if (!session) return login();
  if (recovery) return passwordForm();
  if (!member())
    return (
      heading(
        "Account awaiting assignment.",
        "You are signed in, but the administrator has not assigned your team or role yet.",
      ) + `<button data-logout>Sign out</button>`
    );
  const games = admin() ? state.matches : nextCaptainFixture(state.matches, ownTeam());
  return (
    heading(admin() ? "Match management." : "Your next match.", "") +
    accountBar() +
    (games.length
      ? games.map(privateCard).join("")
      : empty(
          "No matches awaiting entry.",
          "Your next fixture will appear here when scheduled.",
        ))
  );
}
function renderAdmin() {
  if (!session) return login();
  if (recovery) return passwordForm();
  if (!admin())
    return (
      heading(
        "Administrator access required.",
        "This account does not have administrator permissions.",
      ) + '<a href="captain.html">Return to captain area</a>'
    );
  const pending = state.notifications.filter((n) => !n.resolved_at);
  return (
    heading(
      "Keep the league moving.",
      "Approve results, manage registrations and review new players. Handicap reviews run automatically when every match in a tranche is approved.",
    ) +
    accountBar() +
    captainPinManagement() +
    (state.scorecard_workflow === 1 ? '<p class="badge">Scorecard amendment protection active</p>' : '<div class="notice">Scorecard amendment protection needs the database update installed in Supabase. Live Scores is already available.</div>') +
    '<section class="card"><h2>2025–26 season</h2><p>Archived website and incomplete records from the previous season.</p><a class="button secondary" href="/seasons/2025-26/index.html">View 2025–26 archive</a></section>' +
    `<section class="card"><h2>Season setup</h2><p>${state.season.ready ? "Roster confirmed. Captain selections are open." : "Check the carried-forward player list, starting handicaps and team assignments before opening captain selections."}</p>${state.players
      .filter((p) => p.roster_note)
      .map(
        (p) => `<p class="warning-text">${h(p.name)}: ${h(p.roster_note)}</p>`,
      )
      .join(
        "",
      )}${!state.season.ready ? '<form data-action="ready"><label><input type="checkbox" required>I have checked all starting registrations and handicaps.</label><button>Confirm roster & open selections</button></form>' : ""}<div class="row section-gap"><button class="secondary" data-export="backup">Download league backup</button><button class="secondary" data-export="players">Download roster CSV</button></div></section>
 <section class="card"><h2>New-player reviews <span class="badge">${pending.length} pending</span></h2>${pending.length ? pending.map((n) => `<form data-action="review-player" data-player="${n.player_id}"><p>${h(n.message)} <small>${n.emailed_at ? "Email sent" : "Email awaiting delivery"}</small></p><div class="form-grid"><label>Reviewed handicap<input type="number" name="hcp" min="-28" max="35" required value="${state.players.find((p) => p.id === n.player_id)?.current_hcp ?? 14}"></label><label>Reason<input name="reason" required minlength="5"></label></div><button>Save manual review</button></form>`).join("") : '<p class="muted">No players currently need a manual review. New players are flagged after their third approved league appearance.</p>'}</section>
 <details class="card"><summary>Team logins & password resets</summary><p>Create a team login or replace its password. The captain signs in with the team username; no email inbox is needed.</p><form data-action="captain-account"><label>Team<select name="team" id="captain-account-team" required>${options(state.teams.filter(team => !pinStatus.teams.includes(team.id)), "id", "name")}</select></label><p>Username: <strong id="captain-account-username">Choose a team</strong></p><div class="form-grid"><label>New password<input type="password" name="newPassword" autocomplete="new-password" minlength="12" maxlength="128" required></label><label>Repeat new password<input type="password" name="repeatPassword" autocomplete="new-password" minlength="12" maxlength="128" required></label></div><label><input type="checkbox" required>I understand this will replace the password if the team account already exists.</label><button>Save team login</button></form><p><small>Share the username and password privately with the captain. Passwords are not displayed or stored in the league activity log.</small></p></details>
 <details class="card"><summary>Add a fixture</summary><form data-action="fixture"><div class="form-grid"><label>Round<input type="number" name="round" min="1" max="18" required></label><label>Date<input name="date" type="date" required></label><label>Home team<select name="home" required>${teamOptions()}</select></label><label>Away team<select name="away" required>${teamOptions()}</select></label></div><button>Add fixture</button></form><p><small>Add the actual fixtures. Each team can play once per round. Enter earlier scorecards in round order so handicap reviews apply correctly.</small></p></details>
 <details class="card"><summary>Register a player</summary><form data-action="add-player"><div class="form-grid"><label>Full name<input name="name" required minlength="2" maxlength="120"></label><label>Team<select name="team" required>${teamOptions()}</select></label><label>Starting handicap<input type="number" name="hcp" min="-28" max="35" value="14" required></label></div><label><input type="checkbox" name="new" checked>New to the league — manual review after three appearances</label><button>Register player</button></form></details>
 <details class="card"><summary>Update a registration</summary><form data-action="registration"><label>Player<select name="player" id="registration-player" required>${options(state.players, "id", "name")}</select></label><label>Full name<input name="name" required minlength="2" maxlength="120"></label><label>Team<select name="team" required>${teamOptions()}</select></label><label><input type="checkbox" name="active" checked>Active this season</label><label><input type="checkbox" name="new">New to the league</label><button>Save registration</button></form><p><small>Registration details can be changed here before the player is selected for a match.</small></p></details>
 <details class="card"><summary>Correct a starting handicap</summary><form data-action="initial-hcp"><label>Player<select name="player" required>${options(state.players, "id", "name")}</select></label><label>Starting handicap<input name="hcp" type="number" required min="-28" max="35"></label><button>Save starting handicap</button></form><p><small>Available only before this player is selected for a match.</small></p></details>
 <details class="card"><summary>Add a points adjustment</summary><form data-action="adjustment"><label>Team<select name="team" required>${teamOptions()}</select></label><label>Points (negative for a penalty)<input name="points" type="number" min="-100" max="100" required></label><label>Reason<input name="reason" required minlength="5"></label><button>Record adjustment</button></form></details>
 <section class="card"><h2>Handicap tranche reviews</h2>${[5, 10, 15].map((e) => `<p>Rounds ${e - 4}–${e}: <span class="badge ${state.reviews.some((r) => r.end_round === e) ? "" : "pending"}">${state.reviews.some((r) => r.end_round === e) ? "Completed · effective from round " + (e + 1) : "Waiting for all matches to be approved"}</span></p>`).join("")}<p><small>Rounds 16–18 do not produce a handicap change.</small></p></section>
 <h2>Match scorecards & approvals</h2>${filters()}${filtered(state.matches).map(privateCard).join("") || empty("No fixtures added yet.", "Add the season fixtures above, then enter your existing scorecards.")}
 <details class="card"><summary>Recent activity</summary>${state.audit.map((a) => `<p><strong>${h(a.action.replaceAll("_", " "))}</strong> · ${h(new Date(a.created_at).toLocaleString("en-GB"))}<br><small>Account ${h(a.actor || "system")} ${h(JSON.stringify(a.details))}</small></p>`).join("") || "<p>No activity recorded.</p>"}</details>`
  );
}
function render() {
  const open = [...document.querySelectorAll("details[id][open]")].map(
    (e) => e.id,
  );
  const scroll = window.scrollY;
  const renderers = {
    "index.html": renderHome,
    "fixtures.html": renderFixtures,
    "results.html": renderResults,
    "live.html": renderLiveScores,
    "merit.html": renderMerit,
    "breaks.html": renderBreakTable,
    "player.html": renderPlayer,
    "captain.html": renderCaptain,
    "admin.html": renderAdmin,
  };
  main.innerHTML = commonNotice() + (renderers[page] || renderHome)();
  for (const link of main.querySelectorAll("a[href]")) {
    const href = link.getAttribute("href");
    if (/^(?:[a-z0-9_-]+\.html|(?:seasons|pdfs)\/)/i.test(href)) {
      link.setAttribute("href", `/${href}`);
    }
  }
  for (const id of open) document.getElementById(id)?.setAttribute("open", "");
  window.scrollTo(0, scroll);
}
async function refresh(force = false) {
  const next = await loadSnapshot();
  if (state && page === "captain.html") {
    const known = new Set(state.matches.flatMap(match => (match.amendments || []).map(amendment => amendment.id)));
    for (const amendment of next.matches.flatMap(match => match.amendments || [])) {
      if (!known.has(amendment.id) && !notifiedAmendments.has(amendment.id)) {
        notifiedAmendments.add(amendment.id);
        toast(`Frame ${amendment.slot} amended by ${teamName(amendment.team_id)}. Review the change before accepting the corrected frame.`);
      }
    }
  }
  if (
    !force &&
    (dirty || document.activeElement?.matches("input,select,textarea"))
  ) {
    return;
  }
  if (!force && state && JSON.stringify(next) === JSON.stringify(state)) return;
  state = next;
  render();
}
main.addEventListener("input", (e) => {
  if (e.target.closest("form")) dirty = true;
});
main.addEventListener("change", (e) => {
  if (e.target.id === "captain-login-team") {
    captainLoginTeam = e.target.value;
    try { window.localStorage.setItem("league-captain-team", captainLoginTeam); } catch {}
    dirty = false; render(); return;
  }
  if (e.target.id === "captain-account-team") {
    document.getElementById("captain-account-username").textContent =
      captainUsername(e.target.value) || "Choose a team";
  }
  if (e.target.id === "registration-player") {
    const p = state.players.find((p) => p.id === e.target.value),
      f = e.target.form;
    if (p) {
      f.elements.name.value = p.name;
      f.elements.team.value = p.team_id;
      f.elements.active.checked = p.active;
      f.elements.new.checked = p.is_new;
    }
  }
  if (e.target.id === "team-filter") {
    filterTeam = e.target.value;
    render();
  }
  if (e.target.id === "round-filter") {
    filterRound = e.target.value;
    render();
  }
});
main.addEventListener("click", async (e) => {
  const button = e.target.closest("button");
  if (!button) return;
  try {
    if (button.hasAttribute("data-unlock-pin")) {
      const team = button.closest("form").querySelector('[name="team"]').value;
      if (!team) throw new Error("Choose a team first.");
      button.disabled = true;
      try { await unlockCaptainPin(team); toast("Team PIN sign-in unlocked."); } finally { button.disabled = false; }
      return;
    }
    if (button.hasAttribute("data-ticker-pause")) {
      tickerPaused = !tickerPaused;
      const banner = button.closest(".fixture-banner");
      banner.toggleAttribute("data-paused", tickerPaused);
      button.setAttribute("aria-pressed", String(tickerPaused));
      button.setAttribute("aria-label", `${tickerPaused ? "Resume" : "Pause"} fixture announcements`);
      button.textContent = tickerPaused ? "Play" : "Pause";
      return;
    }
    if (button.dataset.shareResult) {
      if (busy) return;
      busy = true; button.disabled = true;
      try {
        const id = button.dataset.shareResult;
        await refresh(true);
        const match = state.matches.find(match => match.id === id);
        const data = resultCardData(match, state.teams, state.players, state.season.name);
        const trigger = [...main.querySelectorAll("[data-share-result]")].find(button => button.dataset.shareResult === id);
        await showResultCard(data, trigger);
      } finally { busy = false; if (button.isConnected) button.disabled = false; }
      return;
    }
    if (button.dataset.view) {
      tableMode = button.dataset.view;
      render();
    }
    if (button.hasAttribute("data-refresh")) {
      if (dirty && !confirm("Refresh and discard your unsaved entries?"))
        return;
      dirty = false;
      await refresh(true);
      toast("Latest scorecards loaded.");
    }
    if (button.hasAttribute("data-logout")) {
      if (dirty && !confirm("Sign out and discard unsaved entries?")) return;
      const signedOut = await client.auth.signOut({ scope: "local" });
      if (signedOut.error) throw signedOut.error;
      session = null;
      dirty = false;
      await refresh(true);
    }
    if (button.dataset.export) await exportData(button.dataset.export);
  } catch (error) {
    toast(error.message, true);
  }
});
main.addEventListener("submit", async (e) => {
  const form = e.target.closest("form[data-action]");
  if (!form) return;
  e.preventDefault();
  if (busy) return;
  busy = true;
  const buttons = [...form.querySelectorAll("button")];
  buttons.forEach((b) => (b.disabled = true));
  const data = new FormData(form),
    action = form.dataset.action;
  const base = {
    p_match: form.dataset.match,
    p_revision: Number(form.dataset.revision),
  };
  const get = (key) => String(data.get(key) || "");
  let successMessage = "Saved successfully.";
  try {
    switch (action) {
      case "captain-account": {
        if (get("newPassword") !== get("repeatPassword"))
          throw new Error("The two passwords do not match.");
        const result = await manageCaptainAccount(
          get("team"),
          get("newPassword"),
        );
        successMessage = `Team login saved. Username: ${result.username}. Share the password privately with the captain.`;
        break;
      }
      case "captain-pin-login": {
        const result = await signInCaptainPin(get("team"), get("pin"));
        session = result.data.session;
        break;
      }
      case "captain-pin-set": {
        if (get("pin") !== get("repeatPin")) throw new Error("The two PINs do not match.");
        if (!/^\d{4}$/.test(get("pin"))) throw new Error("Enter exactly four digits.");
        await setCaptainPin(get("team"), get("pin"));
        pinStatus = await captainPinStatus();
        successMessage = "Team PIN saved. Share it privately with the captain.";
        break;
      }
      case "login": {
        const result = await client.auth.signInWithPassword({
          email: loginEmail(page === "admin.html" ? get("identifier") : captainUsername(get("team"))),
          password: get("password"),
        });
        if (result.error) throw result.error;
        session = result.data.session;
        break;
      }
      case "reset": {
        const result = await client.auth.resetPasswordForEmail(get("email"), {
          redirectTo: new URL("/captain.html", location.href).href,
        });
        if (result.error) throw result.error;
        toast("If this account exists, a reset link will be emailed.");
        dirty = false;
        return;
      }
      case "password": {
        const result = await client.auth.updateUser({
          password: get("password"),
        });
        if (result.error) throw result.error;
        recovery = false;
        break;
      }
      case "lineup":
        await rpc("submit_lineup", {
          ...base,
          p_players: Array.from({ length: 5 }, (_, i) =>
            get("player" + (i + 1)),
          ),
          p_team: form.dataset.team,
        });
        break;
      case "frame": {
        successMessage = "Score and breaks saved. The other captain must review and save their agreement.";
        const home = number(data, "home"),
          away = number(data, "away");
        if (home === away)
          throw new Error(
            "A completed snooker frame needs a winner. Enter the final score after any respotted black.",
          );
        await rpc("save_frame", {
          ...base,
          p_slot: Number(form.dataset.slot),
          p_home: home,
          p_away: away,
          p_winner: home > away ? "home" : "away",
          p_home_breaks: parseBreaks(get("homeBreaks")),
          p_away_breaks: parseBreaks(get("awayBreaks")),
          p_team: get("team") || null,
        });
        break;
      }
      case "accept-frame":
        successMessage = "Score and breaks agreed by both captains. Live Scores has been updated.";
        await rpc("accept_frame", {
          ...base,
          p_slot: Number(form.dataset.slot),
          p_team: get("team") || null,
        });
        break;
      case "confirm":
        await rpc("confirm_match", { ...base, p_team: form.dataset.team });
        break;
      case "approve":
        await rpc("approve_match", base);
        break;
      case "substitute":
        await rpc("propose_substitution", {
          ...base,
          p_team: get("team"),
          p_slot: number(data, "slot"),
          p_player: get("player"),
        });
        break;
      case "accept-substitution":
        await rpc("accept_substitution", {
          ...base,
          p_substitution: form.dataset.substitution,
        });
        break;
      case "ready":
        await rpc("set_season_ready", { p_season: state.season.id });
        break;
      case "fixture":
        await rpc("create_fixture", {
          p_season: state.season.id,
          p_round: number(data, "round"),
          p_date: get("date"),
          p_home: get("home"),
          p_away: get("away"),
        });
        break;
      case "add-player":
        await rpc("add_player", {
          p_season: state.season.id,
          p_team: get("team"),
          p_name: get("name"),
          p_hcp: number(data, "hcp"),
          p_new: data.has("new"),
        });
        break;
      case "registration":
        await rpc("update_registration", {
          p_player: get("player"),
          p_name: get("name"),
          p_team: get("team"),
          p_active: data.has("active"),
          p_new: data.has("new"),
        });
        break;
      case "cancel-substitution":
        await rpc("cancel_substitution", {
          ...base,
          p_substitution: form.dataset.substitution,
        });
        break;
      case "initial-hcp":
        await rpc("set_initial_handicap", {
          p_player: get("player"),
          p_hcp: number(data, "hcp"),
        });
        break;
      case "review-player":
        await rpc("review_new_player", {
          p_player: form.dataset.player,
          p_hcp: number(data, "hcp"),
          p_reason: get("reason"),
        });
        break;
      case "adjustment":
        await rpc("add_adjustment", {
          p_season: state.season.id,
          p_team: get("team"),
          p_points: number(data, "points"),
          p_reason: get("reason"),
        });
        break;
      case "reschedule":
        await rpc("reschedule_fixture", {
          p_match: base.p_match,
          p_date: get("date"),
          p_reason: get("reason"),
        });
        break;
      case "award":
        await rpc("award_match", {
          ...base,
          p_winner: get("winner"),
          p_reason: get("reason"),
        });
        break;
      case "reopen":
        await rpc("reopen_match", {
          p_match: base.p_match,
          p_reason: get("reason"),
        });
        break;
      default:
        throw new Error("Unknown action");
    }
    dirty = false;
    await refresh(true);
    if (action === "frame" && state.matches.find(match => match.id === base.p_match)?.frames.find(frame => frame.slot === Number(form.dataset.slot))?.accepted) successMessage = "Score and breaks agreed by both captains. Live Scores has been updated.";
    toast(successMessage);
  } catch (error) {
    toast(
      error.message ||
        "Could not save. Your entries are still on screen. Check your connection and try again.",
      true,
    );
  } finally {
    busy = false;
    buttons.forEach((b) => (b.disabled = false));
  }
});
async function exportData(kind) {
  let text, type, name;
  if (kind === "backup") {
    text = JSON.stringify(await rpc("export_league"), null, 2);
    type = "application/json";
    name = "league-2026-27-backup.json";
  } else {
    const cell = (v) => '"' + String(v ?? "").replaceAll('"', '""') + '"';
    text = [
      ["Player", "Team", "Starting handicap", "Current handicap", "New player"],
      ...state.players.map((p) => [
        p.name,
        teamName(p.team_id),
        p.initial_hcp,
        p.current_hcp,
        p.is_new,
      ]),
    ]
      .map((r) => r.map(cell).join(","))
      .join("\r\n");
    type = "text/csv";
    name = "league-2026-27-players.csv";
  }
  const url = URL.createObjectURL(new Blob([text], { type }));
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
window.addEventListener("beforeunload", (e) => {
  if (dirty) {
    e.preventDefault();
    e.returnValue = "";
  }
});
async function boot() {
  try {
    if (["captain.html", "admin.html"].includes(page)) {
      try { pinStatus = await captainPinStatus(); } catch {}
      try { captainLoginTeam = window.localStorage.getItem("league-captain-team") || ""; } catch {}
    }
    filterTeam = new URLSearchParams(location.search).get("team") || "";
    filterRound = new URLSearchParams(location.search).get("round") || "";
    if (client) {
      const result = await client.auth.getSession();
      session = result.data.session;
      client.auth.onAuthStateChange((event, newSession) => {
        session = newSession;
        if (event === "PASSWORD_RECOVERY") recovery = true;
        if (event === "PASSWORD_RECOVERY" || event === "SIGNED_OUT")
          setTimeout(
            () => refresh(true).catch((error) => toast(error.message, true)),
            0,
          );
      });
      // Invitation links also land here and need a password before match-night use.
      if (session && ["invite", "recovery"].includes(authLinkType))
        recovery = true;
    }
    await refresh(true);
    setInterval(() => {
      if (!busy && configured && !document.hidden)
        refresh().catch(() =>
          toast(
            "Live refresh is unavailable. Check your connection; the last loaded results remain visible.",
            true,
          ),
        );
    }, ["live.html", "captain.html"].includes(page) ? 10000 : 20000);
  } catch (error) {
    main.innerHTML =
      heading("Unable to load the season.", "Please try again shortly.") +
      `<div class="notice error">${h(error.message)}</div><button data-refresh>Try again</button>`;
  }
}
boot();
