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
  const highest = Math.max(0, ...rows.map(row => row.breaks[0]));
  const compare = (a,b) => Number(b.breaks[0] === highest)-Number(a.breaks[0] === highest) || b.breaks.length-a.breaks.length || b.breaks[0]-a.breaks[0];
  rows.sort((a,b) => compare(a,b) || a.name.localeCompare(b.name));
  return rows.map((row,index) => ({...row, position: index && compare(row,rows[index-1]) === 0 ? rows.slice(0,index).findIndex(other => compare(other,row) === 0)+1 : index+1}));
}

export function rankMerit(rows) {
  const compare = (a,b) => b.won-a.won || (b.won-b.lost)-(a.won-a.lost) || b.breaks25-a.breaks25 || b.high-a.high;
  const ranked = rows.map(row => ({...row,diff:row.won-row.lost})).sort((a,b) => compare(a,b) || a.name.localeCompare(b.name));
  for(let index=0;index<ranked.length;index++) {
    ranked[index].position = index && compare(ranked[index-1],ranked[index]) === 0 ? ranked[index-1].position : index+1;
    ranked[index].tied = (index>0 && compare(ranked[index-1],ranked[index]) === 0) || (index+1<ranked.length && compare(ranked[index],ranked[index+1]) === 0);
  }
  return ranked;
}
