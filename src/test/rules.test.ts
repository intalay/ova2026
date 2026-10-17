import { describe, expect, it } from "vitest";
import { calendarMonths, formatDateTime, teamLabel } from "@/lib/format";
import { parseRosterCsv } from "@/lib/roster";

describe("calendar range", () => {
  it("shows the current month and the next two months", () => {
    expect(calendarMonths(new Date("2026-10-17T12:00:00Z"))).toEqual([
      { year: 2026, month: 10 }, { year: 2026, month: 11 }, { year: 2026, month: 12 },
    ]);
  });
  it("rolls over the year", () => {
    expect(calendarMonths(new Date("2026-11-20T12:00:00Z")).map((m) => `${m.year}-${m.month}`)).toEqual(["2026-11", "2026-12", "2027-1"]);
  });
});

describe("unknown information is shown as to be determined", () => {
  it("missing opponent", () => expect(teamLabel(null)).toBe("Opponent to be determined"));
  it("missing time keeps the known date", () => expect(formatDateTime(null, "2026-10-18")).toMatch(/Oct.*18.*time to be determined/));
  it("missing date", () => expect(formatDateTime(null, null)).toBe("Date to be determined"));
});

describe("roster import", () => {
  it("rejects duplicate player ids", () => {
    const r = parseRosterCsv("player_id,name\nA1,Sam\nA1,Sam again");
    expect(r.errors).toHaveLength(1);
  });
  it("requires a player_id column", () => {
    expect(parseRosterCsv("name\nSam").errors[0]).toMatch(/player_id/);
  });
});
