import { describe, expect, it } from "vitest";
import { resolveParentContext, validateBrowseSearch } from "@/lib/parent-context";
import { parentHousehold } from "./parent-context.fixture";
const teams = [{ id: "team-a" }, { id: "team-b" }, { id: "private-other" }];
describe("approved parent browsing context", () => {
  it("resolves the second child and its exact team, including a second family member", () => {
    const household = parentHousehold();
    const parent = resolveParentContext("parent", "family_friends", household, {
      player: "child-b",
      team: "team-b",
    });
    expect(parent.player?.display_name).toBe("Blair");
    expect(parent.search).toEqual({ player: "child-b", team: "team-b" });
    const guardian = resolveParentContext("guardian", "family_friends", household, {
      player: "child-b",
    });
    expect(guardian.players.map((p) => p.id)).toEqual(["child-b"]);
    expect(guardian.teamId).toBe("team-b");
  });
  it("does not fall back to another child for forged, mismatched, revoked or malformed parameters", () => {
    const household = parentHousehold();
    for (const search of [
      { player: "unlinked" },
      { team: "private-other" },
      { player: "child-b", team: "team-a" },
      validateBrowseSearch({ player: ["child-b"] }),
      validateBrowseSearch({ team: null }),
      { player: "" },
    ]) {
      expect(resolveParentContext("parent", "family_friends", household, search)).toMatchObject({
        invalid: true,
        player: undefined,
        teamId: undefined,
      });
    }
    household.familyLinks[1]!.status = "rejected";
    expect(
      resolveParentContext("parent", "family_friends", household, { player: "child-b" }),
    ).toMatchObject({ invalid: true, player: undefined, teamId: undefined });
  });
  it("excludes pending links, other households and unverified players even if returned in linkedPlayers", () => {
    const household = parentHousehold();
    household.familyLinks[1]!.status = "pending";
    expect(
      resolveParentContext("parent", "family_friends", household).players.map((p) => p.id),
    ).toEqual(["child-a"]);
    household.linkedPlayers[0]!.status = "pending";
    expect(resolveParentContext("parent", "family_friends", household).players).toEqual([]);
    expect(
      resolveParentContext("stranger", "family_friends", parentHousehold(), { team: "team-b" })
        .teamId,
    ).toBeUndefined();
  });
  it("rechecks logout, public role and account switching without granting access from stored IDs", () => {
    for (const user of [undefined, "stranger"])
      expect(
        resolveParentContext(user, "family_friends", parentHousehold(), { player: "child-b" })
          .teamId,
      ).toBeUndefined();
    expect(
      resolveParentContext("parent", "general_user", parentHousehold(), { team: "team-b" }).teamId,
    ).toBeUndefined();
  });
  it("keeps coach/player selection within current authoritative associations", () => {
    const household = parentHousehold();
    household.managedTeams = ["team-b"];
    expect(resolveParentContext("coach", "coach", household, { team: "team-b" }).teamId).toBe(
      "team-b",
    );
    expect(resolveParentContext("coach", "coach", household, { team: "team-a" }).invalid).toBe(
      true,
    );
    household.self = household.linkedPlayers[1]!;
    expect(
      resolveParentContext("player-b", "player", household, { player: "child-b" }).teamId,
    ).toBe("team-b");
    expect(
      resolveParentContext("player-a", "player", household, { player: "child-b" }).invalid,
    ).toBe(true);
    household.self.status = "pending";
    expect(resolveParentContext("player-b", "player", household).teamId).toBeUndefined();
  });
  it("accepts staff teams only from existing team records and actual staff roles", () => {
    const household = parentHousehold();
    household.roles = ["staff"];
    expect(
      resolveParentContext("staff", "coach", household, { team: "private-other" }, teams).teamId,
    ).toBe("private-other");
    expect(
      resolveParentContext("staff", "coach", household, { team: "missing" }, teams).invalid,
    ).toBe(true);
    household.roles = [];
    expect(
      resolveParentContext("staff", "coach", household, { team: "private-other" }, teams).invalid,
    ).toBe(true);
  });
});
