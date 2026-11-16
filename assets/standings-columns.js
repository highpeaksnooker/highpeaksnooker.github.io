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
