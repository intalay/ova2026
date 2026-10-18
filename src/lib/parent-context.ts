import type { AppRole } from "./modules";
import type { Household } from "./queries";

export type BrowseSearch = { player?: string | undefined; team?: string | undefined };
export function validateBrowseSearch(search: Record<string, unknown>): BrowseSearch {
  // Keep malformed supplied values invalid rather than silently selecting another child.
  const id = (value: unknown) =>
    typeof value === "string" && value.length > 0 && value.length <= 200 ? value : "";
  return {
    ...(search["player"] !== undefined ? { player: id(search["player"]) } : {}),
    ...(search["team"] !== undefined ? { team: id(search["team"]) } : {}),
  };
}

export type ParentContext = {
  players: Household["linkedPlayers"];
  player: Household["linkedPlayers"][number] | undefined;
  teamId: string | undefined;
  search: BrowseSearch;
  invalid: boolean;
};

export function resolveParentContext(
  userId: string | undefined,
  role: AppRole,
  household: Household | undefined,
  search: BrowseSearch = {},
  teams: { id: string }[] = [],
): ParentContext {
  const staff = !!userId && !!household?.roles.some((r) => r === "staff" || r === "admin");
  const players =
    !userId || !household
      ? []
      : role === "player"
        ? household.self?.user_id === userId && household.self.status === "verified"
          ? [household.self]
          : []
        : role === "family_friends"
          ? household.linkedPlayers.filter(
              (p) =>
                p.status === "verified" &&
                household.familyLinks.some(
                  (l) =>
                    l.family_user_id === userId && l.player_id === p.id && l.status === "approved",
                ),
            )
          : [];
  const managed = userId && role === "coach" ? (household?.managedTeams ?? []) : [];
  const allowedTeams = staff ? teams.map((t) => t.id) : managed;
  const supplied = search.player !== undefined || search.team !== undefined;
  const invalid = () => ({
    players,
    player: undefined,
    teamId: undefined,
    search: {} as BrowseSearch,
    invalid: supplied,
  });
  if (!userId || !household || role === "general_user") return invalid();
  if (role === "coach") {
    if (
      search.player !== undefined ||
      (search.team !== undefined && !allowedTeams.includes(search.team))
    )
      return invalid();
    const teamId = search.team ?? allowedTeams[0];
    return {
      players,
      player: undefined,
      teamId,
      search: teamId ? { team: teamId } : {},
      invalid: false,
    };
  }
  const player =
    search.player !== undefined
      ? players.find((p) => p.id === search.player)
      : search.team !== undefined
        ? players.find((p) => p.team_id === search.team)
        : players[0];
  if (!player || (search.team !== undefined && search.team !== player.team_id)) return invalid();
  return {
    players,
    player,
    teamId: player.team_id ?? undefined,
    search: { player: player.id, ...(player.team_id ? { team: player.team_id } : {}) },
    invalid: false,
  };
}
