import { frameTotals } from './rules.js';

export function londonDate(now = new Date()) {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-GB', {timeZone:'Europe/London',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(now).map(part => [part.type,part.value]));
  return `${parts.year}-${parts.month}-${parts.day}`;
}
export function upcomingFixtures(matches, today = londonDate()) {
  const upcoming = matches.filter(match => match.date >= today && match.status !== 'approved' && !match.awarded_to && !(match.home_confirmed && match.away_confirmed))
    .sort((a,b) => a.date.localeCompare(b.date) || a.round-b.round || a.id.localeCompare(b.id));
  if (!upcoming.length) return [];
  return upcoming.filter(match => match.date === upcoming[0].date);
}
export function seasonHighestBreak(rows) {
  return rows.reduce((highest, player) => Math.max(highest, ...player.breaks), 0);
}
export function resultCardData(match, teams, players, season = '2026–27') {
  if (!match || match.status !== 'approved') throw new Error('Only approved results can be shared.');
  const frames = match.frames.filter(frame => frame.accepted).sort((a,b) => a.slot-b.slot);
  if (!match.awarded_to && frames.length !== 5) throw new Error('This result does not have five agreed frames.');
  const teamName = id => teams.find(team => team.id === id)?.name || id;
  const playerName = id => id ? players.find(player => player.id === id)?.name || 'Unknown player' : 'No player';
  const totals = frameTotals(match);
  const breaks = [];
  for (const frame of frames) {
    if (frame.is_walkover) continue;
    for (const side of ['home','away']) {
      const values = (frame[side+'_breaks'] || []).filter(value => Number.isInteger(value) && value >= 25 && value <= 147).sort((a,b) => b-a);
      if (values.length) breaks.push({player:playerName(frame[side+'_player']),values});
    }
  }
  const home = teamName(match.home_id), away = teamName(match.away_id);
  return {
    home,away,date:match.date,round:match.round,season,homeFrames:totals.home,awayFrames:totals.away,
    points:totals.points,award:match.awarded_to ? teamName(match.awarded_to) : null,
    frames:frames.map(frame => ({slot:frame.slot,home:playerName(frame.home_player),away:playerName(frame.away_player),homeScore:frame.home_points,awayScore:frame.away_points,winner:frame.winner,awarded:Boolean(frame.is_walkover)})),breaks,
    filename:`high-peak-${home}-${away}-${match.date}.png`.normalize('NFKD').replace(/[^a-zA-Z0-9.-]+/g,'-').toLowerCase()
  };
}
