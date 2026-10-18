import { describe, expect, it } from "vitest";
import {
  AMANDA_PREVIEW_TEAM,
  amandaPreviewLatest,
  amandaPreviewMatches,
  amandaPreviewStats,
  amandaPreviewTrend,
  isPreviewMatch,
  previewOpponentName,
} from "@/lib/amanda-results-preview";

describe("Amanda's isolated preview", () => {
  it("keeps all preview matches synthetic and attached to the existing demo team", () => {
    expect(AMANDA_PREVIEW_TEAM.id).toBe("demo-sand");
    expect(amandaPreviewMatches).toHaveLength(4);
    for (const match of amandaPreviewMatches) {
      expect(match.data_mode).toBe("synthetic");
      expect(match.team_a_id).toBe("demo-sand");
      expect(match.id.startsWith("preview-")).toBe(true);
    }
  });
  it("derives statistics and trend from the same four matches", () => {
    expect(amandaPreviewStats).toEqual({ played: 4, wins: 3, losses: 1, winRate: 75, lossRate: 25 });
    expect(amandaPreviewTrend.map((point) => point.winRate)).toEqual([100, 50, 67, 75]);
  });
  it("keeps set scores consistent with the recorded set count", () => {
    for (const match of amandaPreviewMatches) {
      const sets = match.sets ?? [];
      expect(sets.length).toBe((match.score_a ?? 0) + (match.score_b ?? 0));
      expect(sets.filter((s) => s.a > s.b).length).toBe(match.score_a);
      expect(sets.filter((s) => s.b > s.a).length).toBe(match.score_b);
    }
  });
  it("exposes the newest fixture as the homepage latest result", () => {
    expect(amandaPreviewLatest.id).toBe("preview-amanda-3");
    expect(amandaPreviewLatest.source_date).toBe("2026-10-11");
    expect(amandaPreviewLatest.score_a).toBe(2);
    expect(amandaPreviewLatest.score_b).toBe(0);
    expect(isPreviewMatch(amandaPreviewLatest)).toBe(true);
    expect(previewOpponentName(amandaPreviewLatest)).toBe("Demo opponent 4");
  });
});
