import type { Match } from "./queries";

import { torontoToday } from "./format";
export const competitionDate = torontoToday;
function validDate(value: string | null): value is string {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

/** A date-only fixture is a candidate for that Toronto date, never a fabricated instant. */
export function selectUpcomingMatches(
  matches: Match[],
  {
    teamId,
    publicBrowse = false,
    now = new Date(),
  }: { teamId?: string | null | undefined; publicBrowse?: boolean; now?: Date } = {},
) {
  if (!publicBrowse && !teamId) return { upcoming: [], nextMatches: [], ambiguous: false };
  const today = competitionDate(now);
  const candidates = matches.flatMap<{ match: Match; day: string; instant: number | null }>(
    (match) => {
      if (
        match.status !== "scheduled" ||
        match.data_mode !== "real" ||
        (teamId && match.team_a_id !== teamId && match.team_b_id !== teamId)
      )
        return [];
      const instant = match.starts_at ? Date.parse(match.starts_at) : NaN;
      if (Number.isFinite(instant)) {
        if (instant < now.getTime()) return [];
        return [{ match, day: competitionDate(new Date(instant)), instant }];
      }
      if (!validDate(match.source_date) || match.source_date < today) return [];
      return [{ match: { ...match, starts_at: null }, day: match.source_date, instant: null }];
    },
  );
  const unknownDays = new Set(
    candidates.filter((candidate) => candidate.instant === null).map((candidate) => candidate.day),
  );
  candidates.sort(
    (a, b) =>
      a.day.localeCompare(b.day) ||
      (!unknownDays.has(a.day) && a.instant !== null && b.instant !== null
        ? a.instant - b.instant
        : 0),
  );
  const firstDay = candidates.filter((candidate) => candidate.day === candidates[0]?.day);
  const unresolvedDay = firstDay.some((candidate) => candidate.instant === null);
  const next = unresolvedDay
    ? firstDay
    : firstDay.filter((candidate) => candidate.instant === firstDay[0]?.instant);
  return {
    upcoming: candidates.map((candidate) => candidate.match),
    nextMatches: next.map((candidate) => candidate.match),
    ambiguous: next.length > 1,
  };
}
