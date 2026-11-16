export function breakTableRows(matches, players) {
  const byPlayer = new Map();
  for (const match of matches) {
    if (match.status !== "approved" || match.awarded_to) continue;
    for (const frame of match.frames) {
      if (!frame.accepted || frame.is_walkover) continue;
      for (const side of ["home", "away"]) {
        const id = frame[side + "_player"];
        if (!id) continue;
        const breaks = (frame[side + "_breaks"] || []).filter(value => Number.isInteger(value) && value >= 25);
        if (breaks.length) byPlayer.set(id, [...(byPlayer.get(id) || []), ...breaks]);
      }
    }
  }
  const rows = players.filter(player => byPlayer.has(player.id)).map(player => ({ ...player, breaks: byPlayer.get(player.id).sort((a, b) => b - a) }));
  rows.sort((a, b) => b.breaks.length - a.breaks.length || b.breaks[0] - a.breaks[0] || a.name.localeCompare(b.name));
  return rows.map((row, index) => ({ ...row, position: index && row.breaks.length === rows[index - 1].breaks.length ? rows.findIndex(other => other.breaks.length === row.breaks.length) + 1 : index + 1 }));
}
