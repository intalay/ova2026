import type { Household } from "@/lib/queries";
export const parentHousehold = (): Household =>
  ({
    self: null,
    roles: ["family_friends"],
    managedTeams: [],
    follows: [],
    profile: null,
    linkedPlayers: [
      {
        id: "child-a",
        user_id: "player-a",
        display_name: "Alex",
        team_id: "team-a",
        status: "verified",
      },
      {
        id: "child-b",
        user_id: "player-b",
        display_name: "Blair",
        team_id: "team-b",
        status: "verified",
      },
    ],
    familyLinks: [
      { id: "link-a", family_user_id: "parent", player_id: "child-a", status: "approved" },
      { id: "link-b", family_user_id: "parent", player_id: "child-b", status: "approved" },
      {
        id: "other-guardian",
        family_user_id: "guardian",
        player_id: "child-b",
        status: "approved",
      },
    ],
    visiblePlayers: [],
  }) as unknown as Household;
