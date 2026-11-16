import {frameTotals} from './rules.js';

// The 21 September 2026 AGM records Tintwistle 1 as the previous-season winners.
const startingHolders = Object.freeze({'2026-27':'tintwistle1'});
export function travellersPrize(matches, {seasonId='2026-27', startingHolder=startingHolders[seasonId], teamCount=10, lastRound=18} = {}) {
  if (!startingHolder) return null;
  const season = matches.filter(match => !match.season_id || match.season_id === seasonId);
  const byDate = new Map();
  for (const match of season) {
    if (!byDate.has(match.date)) byDate.set(match.date, []);
    byDate.get(match.date).push(match);
  }
  let holder = startingHolder, nextFixture = null, blocked = null;
  const journey = [{holder:startingHolder, starting:true}];
  for (const date of [...byDate.keys()].sort()) {
    const fixtures = byDate.get(date).filter(match => [match.home_id,match.away_id].includes(holder));
    if (!fixtures.length) continue;
    // Dates, rather than round numbers, determine the journey after rearrangements.
    // If the holder plays twice on one date, do not invent an order we do not know.
    if (fixtures.length > 1) {blocked={date,reason:'order'};break;}
    const match = fixtures[0];
    if (match.status !== 'approved') {nextFixture=match;break;}
    const totals = frameTotals(match);
    if (!totals.complete || (!match.awarded_to && totals.home === totals.away)) {blocked={date,reason:'result'};break;}
    const winner = match.awarded_to || (totals.home > totals.away ? match.home_id : match.away_id);
    if (winner !== holder) {
      const score = match.awarded_to ? 'Awarded win' : winner === match.home_id ? `${totals.home}–${totals.away}` : `${totals.away}–${totals.home}`;
      journey.push({holder:winner,previous:holder,matchId:match.id,round:match.round,date:match.date,score});
      holder=winner;
    }
  }
  const seasonComplete = !blocked && !nextFixture && season.length === lastRound * teamCount / 2 && season.every(match => match.status === 'approved');
  return {holder,startingHolder,journey,nextFixture,blocked,seasonComplete};
}
