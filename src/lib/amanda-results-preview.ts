import type { Match } from "./queries";
import { resultStats } from "./results";

export const AMANDA_PREVIEW_TEAM = { id: "demo-sand", name: "Sand & Sky" };
// Isolated fixtures; never persisted or inserted into shared query caches.
export const amandaPreviewMatches: Match[] = [
  ["2026-09-12", 2, 0], ["2026-09-20", 1, 2],
  ["2026-10-03", 2, 1], ["2026-10-11", 2, 0],
].map(([date, mine, other], index) => ({
  id: `preview-amanda-${index}`, event_id: "preview-only", division_id: "preview-only",
  team_a_id: AMANDA_PREVIEW_TEAM.id, team_b_id: `preview-opponent-${index + 1}`,
  venue_id: null, source_date: String(date), starts_at: null, court: null,
  status: "final", score_a: Number(mine), score_b: Number(other), sets: null, data_mode: "synthetic",
}));
export const amandaPreviewStats = resultStats(amandaPreviewMatches, AMANDA_PREVIEW_TEAM.id);
export const amandaPreviewTrend = amandaPreviewMatches.map((match, index) => ({
  date: match.source_date?.slice(5),
  winRate: resultStats(amandaPreviewMatches.slice(0, index + 1), AMANDA_PREVIEW_TEAM.id).winRate,
}));