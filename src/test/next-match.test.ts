import { describe, expect, it } from "vitest";
import { competitionDate, selectUpcomingMatches } from "@/lib/next-match";
import type { Match } from "@/lib/queries";
const now = new Date("2026-10-18T02:00:00Z"); // Still Oct 17 in Toronto.
const match = (id: string, patch: Partial<Match> = {}): Match => ({
  id,
  event_id: "event",
  division_id: "division",
  team_a_id: "mine",
  team_b_id: "other",
  status: "scheduled",
  source_date: null,
  starts_at: null,
  venue_id: null,
  court: null,
  score_a: null,
  score_b: null,
  sets: null,
  data_mode: "real",
  ...patch,
});
describe("next match uses recorded instants or Toronto calendar dates", () => {
  it("does not treat past date-only, final, cancelled, unknown or other/demo team records as next", () => {
    const rows = [
      match("old", { source_date: "2026-03-01" }),
      match("unknown"),
      match("bad", { source_date: "2026-02-30" }),
      match("final", { status: "final", source_date: "2026-10-19" }),
      match("cancelled", { status: "cancelled", source_date: "2026-10-19" }),
      match("other", { team_a_id: "not-mine", source_date: "2026-10-19" }),
      match("demo", { data_mode: "synthetic", source_date: "2026-10-19" }),
    ];
    expect(selectUpcomingMatches(rows, { teamId: "mine", now }).nextMatches).toEqual([]);
    expect(
      selectUpcomingMatches([match("arbitrary", { source_date: "2026-10-19" })], { now }).upcoming,
    ).toEqual([]);
  });
  it("retains Toronto today and future dates without inventing a start time or same-day match order", () => {
    expect(competitionDate(now)).toBe("2026-10-17");
    const result = selectUpcomingMatches(
      [
        match("future", { source_date: "2026-10-18" }),
        match("today-b", { source_date: "2026-10-17" }),
        match("today-a", { source_date: "2026-10-17" }),
      ],
      { teamId: "mine", now },
    );
    expect(result.nextMatches.map((m) => m.id)).toEqual(["today-b", "today-a"]);
    expect(result.nextMatches.every((m) => m.starts_at === null)).toBe(true);
    expect(result.ambiguous).toBe(true);
    expect(result.upcoming.map((m) => m.id)).toEqual(["today-b", "today-a", "future"]);
  });
  it("compares valid start timestamps by instant, including offsets and year boundaries", () => {
    const result = selectUpcomingMatches(
      [
        match("later", { starts_at: "2026-10-18T01:30:00-04:00" }),
        match("past", { starts_at: "2026-10-17T20:00:00-04:00" }),
        match("next", { starts_at: "2026-10-17T23:00:00-04:00" }),
        match("next-year", { starts_at: "2027-01-01T12:00:00Z" }),
      ],
      { teamId: "mine", now },
    );
    expect(result.upcoming.map((m) => m.id)).toEqual(["next", "later", "next-year"]);
    expect(result.nextMatches.map((m) => m.id)).toEqual(["next"]);
    expect(result.ambiguous).toBe(false);
  });
  it("does not rank known times ahead of unresolved matches on the same day", () => {
    const rows = [
      match("known", { starts_at: "2026-10-18T03:00:00Z" }),
      match("unknown-time", { starts_at: "invalid", source_date: "2026-10-17" }),
    ];
    const result = selectUpcomingMatches(rows, { teamId: "mine", now });
    expect(result.nextMatches).toHaveLength(2);
    expect(result.ambiguous).toBe(true);
    expect(result.nextMatches[1]?.starts_at).toBeNull();
  });
});

it("allows explicit homepage Demo display without changing the real-only default", () => {
  const demo = match("explicit-home-demo", { data_mode: "synthetic", source_date: "2026-10-19" });
  const now = new Date("2026-10-18T12:00:00Z");
  expect(selectUpcomingMatches([demo], { teamId: "mine", now }).upcoming).toHaveLength(0);
  expect(
    selectUpcomingMatches([demo], { teamId: "mine", now, dataMode: "synthetic" }).upcoming.map(
      (row) => row.id,
    ),
  ).toEqual(["explicit-home-demo"]);
});

describe("October 20 Sand & Sky Demo simulation", () => {
  const simulation = match("demo-sand-oct20-2026-1400", {
    event_id: "demo-beach-oct20-2026",
    division_id: "demo-beach",
    team_a_id: "demo-sand",
    team_b_id: "demo-sun",
    source_date: "2026-10-20",
    starts_at: "2026-10-20T18:00:00Z",
    data_mode: "synthetic",
  });
  const before = new Date("2026-10-19T16:00:00Z");

  it("shows the scheduled simulation in Demo at 2pm Toronto on October 20", () => {
    const result = selectUpcomingMatches([simulation], {
      teamId: "demo-sand", dataMode: "synthetic", now: before,
    });
    expect(result.nextMatches).toEqual([simulation]);
    expect(competitionDate(new Date(simulation.starts_at ?? ""))).toBe("2026-10-20");
    expect(new Intl.DateTimeFormat("en-GB", {
      timeZone: "America/Toronto", hour: "2-digit", minute: "2-digit",
    }).format(new Date(simulation.starts_at ?? ""))).toBe("14:00");
  });

  it("excludes the simulation from real upcoming matches", () => {
    expect(selectUpcomingMatches([simulation], {
      teamId: "demo-sand", dataMode: "real", now: before,
    }).upcoming).toEqual([]);
  });
});
