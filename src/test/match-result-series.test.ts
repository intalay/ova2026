import { expect, it } from "vitest";
import { matchResultSeries } from "@/lib/match-result-series";
import type { Match } from "@/lib/queries";
const m = (patch: Partial<Match> = {}): Match => ({
  id: "a",
  event_id: "e",
  division_id: "d",
  team_a_id: "mine",
  team_b_id: "opponent",
  venue_id: null,
  source_date: "2026-04-19",
  starts_at: null,
  court: null,
  status: "final",
  score_a: 2,
  score_b: 0,
  sets: null,
  data_mode: "real",
  ...patch,
});
it("keeps each real match, reads scores from the selected team side and never invents cumulative order", () => {
  const input = [
    m({ id: "late", source_date: "2026-04-20" }),
    m({ id: "away", team_a_id: "opponent", team_b_id: "mine", score_a: 2, score_b: 1 }),
    m({ id: "unknown", score_a: null }),
    m({ id: "demo", data_mode: "synthetic" }),
    m({ id: "unrelated", team_a_id: "other" }),
    m({ id: "scheduled", status: "scheduled" }),
  ];
  const copy = structuredClone(input);
  const rows = matchResultSeries(input, "mine");
  expect(rows.map((r) => [r.id, r.score, r.cumulativeWinRate, r.result])).toEqual([
    ["away", "1–2", 0, "Lost"],
    ["unknown", "Score unrecorded", null, "Unknown"],
    ["late", "2–0", 50, "Won"],
  ]);
  expect(rows.map((r) => r.label)).toEqual(["M1", "M2", "M3"]);
  expect(input).toEqual(copy);
});
it("preserves existing within-day listing order instead of treating IDs as match timestamps", () => {
  expect(matchResultSeries([m({ id: "z" }), m({ id: "a" })], "mine").map((r) => r.id)).toEqual([
    "z",
    "a",
  ]);
});
it("keeps a known tie distinct from a missing score and retains unknown dates honestly", () => {
  const rows = matchResultSeries(
    [
      m({ id: "tie", score_a: 1, score_b: 1 }),
      m({ id: "missing", score_a: null, score_b: 2, source_date: null }),
    ],
    "mine",
  );
  expect(rows[0]).toMatchObject({ result: "Tied", cumulativeWinRate: null });
  expect(rows[1]).toMatchObject({ date: null, result: "Unknown", cumulativeWinRate: null });
});
