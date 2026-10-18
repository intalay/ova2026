import type { Match } from "./queries";
export function recentResults(matches: Match[], now = new Date()) {
 const start = new Date(now); start.setUTCMonth(start.getUTCMonth() - 3);
 return matches.filter(m => { const date = m.starts_at ?? m.source_date; return m.status === "final" && date && new Date(date) >= start && new Date(date) <= now; }).sort((a,b)=>(b.starts_at??b.source_date??"").localeCompare(a.starts_at??a.source_date??""));
}
export function resultStats(matches: Match[], team: string) {
 const recorded = matches.filter(m => m.status === "final" && (m.team_a_id === team || m.team_b_id === team) && m.score_a !== null && m.score_b !== null && m.score_a !== m.score_b);
 const wins=recorded.filter(m => m.score_a !== null && m.score_b !== null && (m.team_a_id === team ? m.score_a>m.score_b : m.score_b>m.score_a)).length;
 return { played: recorded.length, wins, losses: recorded.length-wins, winRate: recorded.length ? Math.round(wins/recorded.length*100):null, lossRate: recorded.length ? Math.round((recorded.length-wins)/recorded.length*100):null };
}
export const RESULTS_PAGE_SIZE=6;

// Whole dates are indivisible when historical start times are unknown.
export function cumulativeWinTrend(matches: Match[], team: string) {
 const dated = matches.filter(m => m.source_date && m.status === "final" &&
   (m.team_a_id === team || m.team_b_id === team) &&
   typeof m.score_a === "number" && typeof m.score_b === "number" && m.score_a !== m.score_b);
 const days = [...new Set(dated.map(m => m.source_date))].filter((d): d is string => !!d).sort();
 let wins = 0, losses = 0;
 return days.map(sourceDate => {
   const daily = resultStats(dated.filter(m => m.source_date === sourceDate), team);
   wins += daily.wins; losses += daily.losses;
   return { sourceDate, wins, losses, dailyWins: daily.wins, dailyLosses: daily.losses,
     winRate: Math.round(wins / (wins + losses) * 100) };
 });
}