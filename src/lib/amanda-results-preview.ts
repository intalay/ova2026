import type { Match } from "./queries";
import { resultStats } from "./results";

export const AMANDA_PREVIEW_TEAM = { id: "demo-sand", name: "Sand & Sky" };
export const PREVIEW_EVENT_NAME = "Demo league play";

// Isolated fixtures; never persisted or inserted into shared query caches.
const PREVIEW_FIXTURES: [string, number, number, { a: number; b: number }[]][] = [
  ["2026-09-12", 2, 0, [{ a: 25, b: 18 }, { a: 25, b: 21 }]],
  ["2026-09-20", 1, 2, [{ a: 25, b: 22 }, { a: 20, b: 25 }, { a: 18, b: 25 }]],
  ["2026-10-03", 2, 1, [{ a: 25, b: 19 }, { a: 22, b: 25 }, { a: 25, b: 17 }]],
  ["2026-10-11", 2, 0, [{ a: 25, b: 23 }, { a: 25, b: 19 }]],
];

export const amandaPreviewMatches: Match[] = PREVIEW_FIXTURES.map(
  ([date, mine, other, sets], index) => ({
    id: `preview-amanda-${index}`, event_id: "preview-only", division_id: "preview-only",
    team_a_id: AMANDA_PREVIEW_TEAM.id, team_b_id: `preview-opponent-${index + 1}`,
    venue_id: null, source_date: date, starts_at: null, court: null,
    status: "final", score_a: mine, score_b: other, sets, data_mode: "synthetic",
  }),
);

export const isPreviewMatch = (match: Match): boolean => match.id.startsWith("preview-amanda-");
export const previewOpponentName = (match: Match): string =>
  `Demo opponent ${Number(match.id.split("-").at(-1)) + 1}`;

/** Newest fixture; the homepage shows it in development only when no real final exists. */
export const amandaPreviewLatest: Match = [...amandaPreviewMatches]
  .filter((m) => m.status === "final")
  .sort((a, b) => (b.source_date ?? "").localeCompare(a.source_date ?? ""))[0];

export const amandaPreviewStats = resultStats(amandaPreviewMatches, AMANDA_PREVIEW_TEAM.id);
export const amandaPreviewTrend = amandaPreviewMatches.map((match, index) => ({
  date: match.source_date?.slice(5),
  winRate: resultStats(amandaPreviewMatches.slice(0, index + 1), AMANDA_PREVIEW_TEAM.id).winRate,
}));
