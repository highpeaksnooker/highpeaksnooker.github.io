// Split the same accepted match results used by the official/provisional table.
export function homeAwayTotals(matches, provisional = false) {
  const totals = new Map();
  const team = id => {
    if (!totals.has(id)) totals.set(id, { home: 0, away: 0, framesHome: 0, framesAway: 0, bonus: 0 });
    return totals.get(id);
  };
  for (const match of matches) {
    if (!provisional && match.status !== "approved") continue;
    const frames = match.frames.filter(frame => frame.accepted);
    const awarded = Boolean(match.awarded_to);
    const homeFrames = awarded ? (match.awarded_to === match.home_id ? 5 : 0) : frames.filter(frame => frame.winner === "home").length;
    const awayFrames = awarded ? (match.awarded_to === match.away_id ? 5 : 0) : frames.filter(frame => frame.winner === "away").length;
    const home = team(match.home_id), away = team(match.away_id);
    home.framesHome += homeFrames;
    away.framesAway += awayFrames;
    if (frames.length === 5 || awarded) {
      home.home++;
      away.away++;
      if (homeFrames > awayFrames) home.bonus += 2;
      if (awayFrames > homeFrames) away.bonus += 3;
    }
  }
  return totals;
}

// Rank the official and provisional table using the same results as its columns.
export function rankStandings(rows, matches, provisional = false) {
  const splits = homeAwayTotals(matches, provisional);
  const groups = new Map();
  for (const row of rows) {
    const split = splits.get(row.id);
    const ranked = { ...row, bonus: split?.bonus || 0, h2h_points: 0 };
    const key = JSON.stringify([row.points, ranked.bonus, row.ff]);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(ranked);
  }
  for (const group of groups.values()) {
    if (group.length < 2) continue;
    const ids = new Set(group.map(row => row.id));
    const meetings = matches.filter(match => (provisional || match.status === 'approved') && ids.has(match.home_id) && ids.has(match.away_id) && (match.awarded_to || match.frames.filter(frame => frame.accepted).length === 5));
    // All tied teams must have met both home and away before this decides rank.
    const complete = group.every(home => group.every(away => home.id === away.id || meetings.some(match => match.home_id === home.id && match.away_id === away.id)));
    if (!complete) continue;
    for (const match of meetings) {
      const frames = match.frames.filter(frame => frame.accepted);
      const home = match.awarded_to ? (match.awarded_to === match.home_id ? 5 : 0) : frames.filter(frame => frame.winner === 'home').length;
      const away = match.awarded_to ? (match.awarded_to === match.away_id ? 5 : 0) : frames.filter(frame => frame.winner === 'away').length;
      group.find(row => row.id === match.home_id).h2h_points += home + (home > away ? 2 : 0);
      group.find(row => row.id === match.away_id).h2h_points += away + (away > home ? 3 : 0);
    }
  }
  const compare = (a, b) => b.points-a.points || b.bonus-a.bonus || b.ff-a.ff || b.h2h_points-a.h2h_points;
  const ranked = [...groups.values()].flat().sort((a,b) => compare(a,b) || a.name.localeCompare(b.name));
  for(let index=0;index<ranked.length;index++) {
    ranked[index].position = index && compare(ranked[index-1],ranked[index]) === 0 ? ranked[index-1].position : index+1;
    ranked[index].tied = (index > 0 && compare(ranked[index-1],ranked[index]) === 0) || (index+1 < ranked.length && compare(ranked[index],ranked[index+1]) === 0);
  }
  return ranked;
}
