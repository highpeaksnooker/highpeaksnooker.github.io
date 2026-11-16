export function nextCaptainFixture(matches, teamId) {
  return matches
    .filter(match => [match.home_id, match.away_id].includes(teamId)
      && match.status !== "approved"
      && !match.awarded_to
      && !(match.home_confirmed && match.away_confirmed))
    .sort((a, b) => a.date.localeCompare(b.date) || a.round - b.round || a.id.localeCompare(b.id))
    .slice(0, 1);
}
