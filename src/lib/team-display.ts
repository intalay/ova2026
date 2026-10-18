import { REVIEWED_TEAM_DISPLAY_ALIASES, type TeamDisplayAlias } from "./team-display-aliases";

export type DisplayTeam = {
  id: string;
  name: string;
  division_id: string | null;
  data_mode: string;
};
export type TeamDisplayContext = {
  divisions: readonly { id: string; name: string }[];
  events: readonly { id: string; name: string }[];
  teamEvents: readonly { teamId: string; eventId: string }[];
};
const reviewed = (team: DisplayTeam): TeamDisplayAlias | undefined =>
  team.data_mode === "real" && Object.hasOwn(REVIEWED_TEAM_DISPLAY_ALIASES, team.id)
    ? REVIEWED_TEAM_DISPLAY_ALIASES[team.id]
    : undefined;

// This registry classifies only audited IDs. A club named "Pair01" is not hidden by its name.
export function isAnonymousPair(team: DisplayTeam): boolean {
  return reviewed(team)?.kind === "anonymous_pair";
}
export function teamDisplayName(team: DisplayTeam): string {
  return reviewed(team)?.publicName ?? team.name.replace(/\s*\[entry\s+[^\]]+\]\s*$/i, "").trim();
}
export function clubTeamOptions<T extends DisplayTeam>(teams: readonly T[]): T[] {
  return teams.filter(
    (team) =>
      !isAnonymousPair(team) &&
      !/^(?:entry(?:\s*#?\s*\d+)?|tbd|tbc|unknown|unnamed(?: team)?|team to be determined)$/i.test(
        teamDisplayName(team),
      ),
  );
}

// Anonymous pairs remain available within their actual public event; no data/ID changes.
export function eventPairOptions<T extends DisplayTeam>(
  teams: readonly T[],
  eventId: string,
  context: TeamDisplayContext,
): T[] {
  if (!eventId) return [];
  const participants = new Set(
    context.teamEvents.filter((p) => p.eventId === eventId).map((p) => p.teamId),
  );
  return teams.filter((team) => isAnonymousPair(team) && participants.has(team.id));
}

export function teamPresentation(team: DisplayTeam, context: TeamDisplayContext) {
  const alias = reviewed(team);
  const primary = teamDisplayName(team);
  const division = context.divisions.find((d) => d.id === team.division_id)?.name;
  // Follow actual match participation. Sharing a division alone never assigns an event.
  const eventIds = new Set(
    context.teamEvents.filter((p) => p.teamId === team.id).map((p) => p.eventId),
  );
  const events = [
    ...new Set(context.events.filter((e) => eventIds.has(e.id)).map((e) => e.name)),
  ].sort();
  const entryLabel = alias?.kind === "team_entry" ? `Team entry #${alias.entryNumber}` : "";
  const source =
    team.data_mode === "real"
      ? "Real source"
      : team.data_mode === "synthetic"
        ? "Synthetic demo"
        : "Source unknown";
  const secondary = [
    ...new Set(
      [
        division ?? "Division to be determined",
        ...(events.length ? events : ["Event to be determined"]),
        entryLabel,
        source,
      ].filter(Boolean),
    ),
  ].join(" · ");
  return {
    primary,
    secondary,
    full: `${primary} · ${secondary}`,
    entryLabel,
    kind: alias?.kind ?? "named_team",
    anonymous: alias?.kind === "anonymous_pair",
  };
}

// Callers pass clubTeamOptions(...) or an event's eventPairOptions(...) explicitly.
export function searchTeamOptions<T extends DisplayTeam>(
  teams: readonly T[],
  query: string,
  context: TeamDisplayContext,
): T[] {
  const words = query.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
  return teams.filter((team) => {
    const label = teamPresentation(team, context).full.toLocaleLowerCase();
    return words.every((word) => label.includes(word));
  });
}
