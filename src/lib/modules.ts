export type AppRole = "general_user" | "player" | "family_friends" | "coach";
export type ModuleKey = "information" | "announcement" | "schedule" | "map" | "results" | "fifty_fifty" | "shopping" | "explore" | "account";
type ModuleConfig = { visible: boolean; variant: string; actions: string[]; order: number };
const common = { schedule: { visible: true, variant: "next_match", actions: ["read"], order: 3 }, map: { visible: true, variant: "venue", actions: ["read"], order: 4 }, results: { visible: true, variant: "team_results", actions: ["read"], order: 5 }, fifty_fifty: { visible: true, variant: "official_draw", actions: ["visit"], order: 6 }, shopping: { visible: true, variant: "catalog", actions: ["visit"], order: 7 }, explore: { visible: true, variant: "official_sources", actions: ["visit"], order: 8 }, account: { visible: true, variant: "identity", actions: ["sign_in"], order: 9 } };
export const MODULES: Record<AppRole, Record<ModuleKey, ModuleConfig>> = {
 general_user: { ...common, information: { visible: false, variant: "none", actions: [], order: 1 }, announcement: { visible: true, variant: "reader", actions: ["read"], order: 2 }, results: { ...common.results, variant: "all_results" } },
 player: { ...common, information: { visible: true, variant: "registered_team", actions: ["read"], order: 1 }, announcement: { visible: true, variant: "reader", actions: ["read"], order: 2 } },
 family_friends: { ...common, information: { visible: true, variant: "linked_player", actions: ["read"], order: 1 }, announcement: { visible: true, variant: "reader", actions: ["read"], order: 2 } },
 coach: { ...common, information: { visible: true, variant: "registered_team", actions: ["read"], order: 1 }, announcement: { visible: true, variant: "publisher", actions: ["read", "publish"], order: 2 } },
};
export const ROLE_LABELS: Record<AppRole, string> = { general_user: "Fan Plaza", player: "Player", family_friends: "Family & Friends", coach: "HI,\nCOACH" };
export function authorizedRole(requested: AppRole, household: { self: unknown; linkedPlayers: unknown[]; managedTeams: string[]; roles: string[] } | undefined): AppRole {
 if (requested === "general_user" || !household) return "general_user";
  if (requested === "player" && household.self && typeof household.self === 'object' && 'status' in household.self && household.self.status === 'verified') return requested;
 if (requested === "family_friends" && household.linkedPlayers.length) return requested;
 if (requested === "coach" && (household.managedTeams.length || household.roles.some(r => r === "staff" || r === "admin"))) return requested;
 return "general_user";
}