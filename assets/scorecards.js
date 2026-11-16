export const scorecardLocked = match => match.status === "approved" || (match.home_confirmed && match.away_confirmed);
export function liveScoreMatches(matches) {
  return matches.filter(match => match.status !== "approved" && match.lineups.length === 2)
    .sort((a, b) => a.date.localeCompare(b.date) || a.round - b.round || a.id.localeCompare(b.id));
}
export function amendmentChanges(amendment) {
  const before = amendment.before_frame, after = amendment.after_frame, changes = [];
  if (before.home_points !== after.home_points || before.away_points !== after.away_points) changes.push(`Score: ${before.home_points}–${before.away_points} → ${after.home_points}–${after.away_points}`);
  for (const side of ["home", "away"]) {
    const oldBreaks = before[side + "_breaks"] || [], newBreaks = after[side + "_breaks"] || [];
    if (JSON.stringify(oldBreaks) !== JSON.stringify(newBreaks)) changes.push(`${side === "home" ? "Home" : "Away"} breaks: ${oldBreaks.join(", ") || "none"} → ${newBreaks.join(", ") || "none"}`);
  }
  return changes;
}
