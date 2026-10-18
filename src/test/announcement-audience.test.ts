import { describe, expect, it } from "vitest";
import { canManageAnnouncement, canPublishToAudience } from "@/lib/announcement-audience";
describe("announcement audience authorization guard", () => {
  it("requires actual signed-in staff permission for the explicit null community audience", () => {
    expect(canPublishToAudience("staff", true, [], null)).toBe(true);
    expect(canPublishToAudience(undefined, true, [], null)).toBe(false);
    expect(canPublishToAudience("coach", false, ["team-a"], null)).toBe(false);
    expect(canPublishToAudience("staff", true, [], undefined)).toBe(false);
  });
  it("requires both author and managed team for non-staff editing", () => {
    expect(
      canManageAnnouncement("coach", false, ["team-a"], { author_id: "coach", team_id: "team-a" }),
    ).toBe(true);
    for (const announcement of [
      { author_id: "other-coach", team_id: "team-a" },
      { author_id: "coach", team_id: "team-b" },
      { author_id: "coach", team_id: null },
    ]) {
      expect(canManageAnnouncement("coach", false, ["team-a"], announcement)).toBe(false);
    }
    expect(canManageAnnouncement("staff", true, [], { author_id: "coach", team_id: null })).toBe(
      true,
    );
  });
});
