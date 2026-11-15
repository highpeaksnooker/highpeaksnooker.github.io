// Slots are fixed by the published draw; null in the first round means a bye.
// Later unresolved feeders remain pending and never count as byes.
export function buildBracket(competition, results = competition.confirmed_results || []) {
  const rounds = [], count = Math.log2(competition.slots.length);
  if (!Number.isInteger(count)) throw new Error('Invalid knockout draw size.');
  for (let round = 0; round < count; round++) {
    const ties = [];
    for (let slot = 0; slot < competition.slots.length / 2 ** (round + 1); slot++) {
      const sides = round === 0
        ? competition.slots.slice(slot * 2, slot * 2 + 2).map(id => ({ id, resolved: true }))
        : rounds[round - 1].slice(slot * 2, slot * 2 + 2).map(t => ({ id: t.winner, resolved: t.resolved }));
      const [home, away] = sides;
      const record = results.find(r => r.competition_id === competition.id && r.round === round + 1 && r.slot === slot + 1);
      const bye = home.resolved && away.resolved && Boolean(home.id) !== Boolean(away.id);
      const valid = home.id && away.id && [home.id, away.id].includes(record?.winner_id);
      const winner = bye ? home.id || away.id : valid ? record.winner_id : null;
      ties.push({ round: round + 1, slot: slot + 1, home: home.id, away: away.id,
        homeResolved: home.resolved, awayResolved: away.resolved, bye,
        winner, loser: valid ? (winner === home.id ? away.id : home.id) : null,
        resolved: Boolean(winner) || (home.resolved && away.resolved && !home.id && !away.id),
        editable: Boolean(home.id && away.id), revision: record?.revision ?? 0 });
    }
    rounds.push(ties);
  }
  return rounds;
}

export const roundNames = ['Round 1', 'Last 16', 'Quarter-finals', 'Semi-finals', 'Final'];
