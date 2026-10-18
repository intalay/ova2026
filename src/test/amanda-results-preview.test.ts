import { describe, expect, it } from "vitest";
import { AMANDA_PREVIEW_TEAM, amandaPreviewMatches, amandaPreviewStats, amandaPreviewTrend } from "@/lib/amanda-results-preview";

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
});