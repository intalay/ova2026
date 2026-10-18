import type { CompetitionData } from "./queries";

// A presentation projection: never mutate stored records or household IDs.
// Only explicit synthetic competition rows are hidden; unrelated content stays.
export function publicCompetition(data: CompetitionData): CompetitionData {
  return {
    ...data,
    teams: (data.teams ?? []).filter((row) => row.data_mode !== "synthetic"),
    divisions: (data.divisions ?? []).filter((row) => row.data_mode !== "synthetic"),
    events: (data.events ?? []).filter((row) => row.data_mode !== "synthetic"),
    matches: (data.matches ?? []).filter((row) => row.data_mode !== "synthetic"),
    rankings: (data.rankings ?? []).filter((row) => row.data_mode !== "synthetic"),
    venues: (data.venues ?? []).filter((row) => row.data_mode !== "synthetic"),
    announcements: (data.announcements ?? []).filter((row) => row.data_mode !== "synthetic"),
  };
}
