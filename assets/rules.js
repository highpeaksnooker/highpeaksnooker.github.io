export function teamPoints(home, away, complete = true) {
  return [
    home + (complete && home > away ? 2 : 0),
    away + (complete && away > home ? 3 : 0),
  ];
}
export function nextHandicap(handicap, wins, losses) {
  return Math.max(
    -28,
    Math.min(
      35,
      handicap + (wins - losses >= 2 ? -7 : wins - losses <= -2 ? 7 : 0),
    ),
  );
}
export function handicapAt(player, history, round) {
  return (
    history
      .filter((h) => h.player_id === player.id && h.effective_round <= round)
      .sort((a, b) => b.effective_round - a.effective_round)[0]?.handicap ??
    player.initial_hcp
  );
}
export function parseBreaks(value) {
  if (!value.trim()) return [];
  const values = value
    .split(/[,\s]+/)
    .filter(Boolean)
    .map(Number);
  if (values.some((n) => !Number.isInteger(n) || n < 1 || n > 147))
    throw new Error("Enter breaks from 1 to 147, separated by commas.");
  return values;
}
export function frameTotals(match) {
  const frames = match.frames.filter((f) => f.accepted);
  const home = frames.filter((f) => f.winner === "home").length;
  const away = frames.filter((f) => f.winner === "away").length;
  const points = match.awarded_to
    ? [
        match.awarded_to === match.home_id ? 7 : 0,
        match.awarded_to === match.away_id ? 8 : 0,
      ]
    : teamPoints(home, away, frames.length === 5);
  return {
    home,
    away,
    points,
    complete: frames.length === 5 || Boolean(match.awarded_to),
  };
}
