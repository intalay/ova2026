import type { Match } from "./queries";

/** Dates are real; display indices deliberately do not claim within-day chronology. */
export function matchResultSeries(
  matches: Match[],
  teamId: string,
  metric: "match" | "set" = "match",
  dataMode: "real" | "synthetic" = "real",
) {
  let wins = 0;
  let losses = 0;
  return matches
    .filter(
      (match) =>
        match.status === "final" &&
        match.data_mode === dataMode &&
        (match.team_a_id === teamId || match.team_b_id === teamId),
    )
    .map((match, sourceIndex) => ({ match, sourceIndex }))
    .sort(
      (a, b) =>
        (a.match.source_date ?? "9999").localeCompare(b.match.source_date ?? "9999") ||
        a.sourceIndex - b.sourceIndex,
    )
    .map(({ match }, index) => {
      const own = match.team_a_id === teamId ? match.score_a : match.score_b;
      const other = match.team_a_id === teamId ? match.score_b : match.score_a;
      const known =
        typeof own === "number" &&
        Number.isFinite(own) &&
        typeof other === "number" &&
        Number.isFinite(other);
      if (known && own !== other) {
        wins += metric === "set" ? own : Number(own > other);
        losses += metric === "set" ? other : Number(own < other);
      }
      return {
        id: match.id,
        label: `M${index + 1}`,
        date: match.source_date,
        opponentId: match.team_a_id === teamId ? match.team_b_id : match.team_a_id,
        score: known ? `${own}–${other}` : "Score unrecorded",
        cumulativeWinRate:
          known && own !== other && wins + losses > 0
            ? Math.round((100 * wins) / (wins + losses))
            : null,
        result: !known ? "Unknown" : own > other ? "Won" : own < other ? "Lost" : "Tied",
      };
    });
}
