import { describe, expect, it } from "vitest";
import { publicCompetition } from "@/lib/public-competition";
import type { CompetitionData } from "@/lib/queries";

describe("public competition visibility", () => {
  it("hides explicit synthetic records without deleting, renaming or merging same-name real records", () => {
    const rows = Object.freeze([
      Object.freeze({ id: "recorded", name: "Demo named real team", data_mode: "real" }),
      Object.freeze({ id: "hidden", name: "Demo named real team", data_mode: "synthetic" }),
      Object.freeze({ id: "unknown", name: "Unknown mode" }),
    ]);
    const stored = Object.freeze(
      Object.fromEntries(
        ["teams", "divisions", "events", "matches", "rankings", "venues", "announcements"].map(
          (key) => [key, rows],
        ),
      ),
    ) as unknown as CompetitionData;
    const visible = publicCompetition(stored);
    for (const key of [
      "teams",
      "divisions",
      "events",
      "matches",
      "rankings",
      "venues",
      "announcements",
    ] as const) {
      expect(visible[key].map((row) => row.id)).toEqual(["recorded", "unknown"]);
      expect(stored[key]).toHaveLength(3);
      expect(visible[key][0]).toBe(stored[key][0]);
    }
  });
});
