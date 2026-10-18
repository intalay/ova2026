import {
  isAnonymousPair,
  teamPresentation,
  type DisplayTeam,
  type TeamDisplayContext,
} from "./team-display";

export const STARRED_TARGETS_PAGE_SIZE = 10;
export type StarredTargetKind = "team" | "division";
export type StarredDivision = { id: string; name: string; data_mode: string };
export type StarredTarget = {
  id: string;
  kind: StarredTargetKind;
  primary: string;
  secondary: string;
  anonymous: boolean;
};

// Public match participation is the only event association used for display.
export function starredDisplayContext(
  data: {
    events: TeamDisplayContext["events"];
    divisions: TeamDisplayContext["divisions"];
    matches: readonly {
      event_id: string;
      team_a_id: string;
      team_b_id: string | null;
      data_mode: string;
    }[];
  },
  dataMode: "real" | "synthetic" = "real",
): TeamDisplayContext {
  const seen = new Set<string>();
  const teamEvents: { teamId: string; eventId: string }[] = [];
  for (const match of data.matches) {
    if (
      dataMode === "synthetic" ? match.data_mode !== "synthetic" : match.data_mode === "synthetic"
    )
      continue;
    for (const teamId of [match.team_a_id, match.team_b_id]) {
      if (!teamId) continue;
      const key = JSON.stringify([teamId, match.event_id]);
      if (!seen.has(key)) {
        seen.add(key);
        teamEvents.push({ teamId, eventId: match.event_id });
      }
    }
  }
  return { events: data.events, divisions: data.divisions, teamEvents };
}

export function buildStarredTargets(
  teams: readonly DisplayTeam[],
  divisions: readonly StarredDivision[],
  context: TeamDisplayContext,
  dataMode: "real" | "synthetic" = "real",
): StarredTarget[] {
  const publicTeams = teams.filter((team) =>
    dataMode === "synthetic" ? team.data_mode === "synthetic" : team.data_mode !== "synthetic",
  );
  const teamDivisions = new Map(publicTeams.map((team) => [team.id, team.division_id]));
  const targets: StarredTarget[] = publicTeams.map((team) => {
    const label = teamPresentation(team, context);
    return {
      id: team.id,
      kind: "team",
      primary: label.primary,
      secondary: label.secondary,
      anonymous: isAnonymousPair(team),
    };
  });
  for (const division of divisions) {
    if (
      dataMode === "synthetic"
        ? division.data_mode !== "synthetic"
        : division.data_mode === "synthetic"
    )
      continue;
    const eventIds = new Set(
      context.teamEvents
        .filter((link) => teamDivisions.get(link.teamId) === division.id)
        .map((link) => link.eventId),
    );
    const eventNames = [
      ...new Set(
        context.events.filter((event) => eventIds.has(event.id)).map((event) => event.name),
      ),
    ].sort();
    targets.push({
      id: division.id,
      kind: "division",
      primary: division.name,
      secondary: `Division · ${eventNames.length ? eventNames.join(" · ") : "Event to be determined"}`,
      anonymous: false,
    });
  }
  return targets.sort(
    (a, b) =>
      a.primary.localeCompare(b.primary) ||
      a.secondary.localeCompare(b.secondary) ||
      a.id.localeCompare(b.id),
  );
}

export function starredTargetsPage(
  targets: readonly StarredTarget[],
  options: {
    kind: StarredTargetKind;
    query: string;
    starredOnly: boolean;
    followed: ReadonlySet<string>;
    page: number;
  },
) {
  const words = options.query.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
  const filtered = targets.filter(
    (target) =>
      target.kind === options.kind &&
      (options.starredOnly
        ? options.followed.has(`${target.kind}:${target.id}`)
        : !target.anonymous) &&
      words.every((word) =>
        `${target.primary} ${target.secondary}`.toLocaleLowerCase().includes(word),
      ),
  );
  const pageCount = Math.ceil(filtered.length / STARRED_TARGETS_PAGE_SIZE);
  const requested = Number.isFinite(options.page) ? Math.max(0, Math.floor(options.page)) : 0;
  const pageIndex = Math.min(requested, Math.max(0, pageCount - 1));
  return {
    rows: filtered.slice(
      pageIndex * STARRED_TARGETS_PAGE_SIZE,
      (pageIndex + 1) * STARRED_TARGETS_PAGE_SIZE,
    ),
    total: filtered.length,
    pageCount,
    pageIndex,
    start: filtered.length ? pageIndex * STARRED_TARGETS_PAGE_SIZE + 1 : 0,
    end: Math.min((pageIndex + 1) * STARRED_TARGETS_PAGE_SIZE, filtered.length),
  };
}
