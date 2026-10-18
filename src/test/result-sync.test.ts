import { describe, expect, it } from "vitest";
import { normalizeResultBatch, summarizeRecordedResults } from "@/lib/result-sync/normalize";
import {
  EVENT_RESULT_SOURCES,
  eventResultSource,
  validateOfficialResultsUrl,
} from "@/lib/result-sync/sources";
import { resultStats, resultSetStats } from "@/lib/results";

const source = EVENT_RESULT_SOURCES[0]!;
const row = {
  id: "match_existing_stable_id",
  event_id: source.eventId,
  division_id: "division_existing",
  team_a_id: "team_a",
  team_b_id: "team_b",
  venue_id: null,
  court: null,
  source_date: "2026-04-19",
  starts_at: null,
  status: "final",
  score_a: 2,
  score_b: 0,
  sets: [
    { a: 25, b: 18 },
    { a: 25, b: 22 },
  ],
  data_mode: "real",
};

describe("result normalization", () => {
  it("preserves imported identity, whole dates, set scores and unknown time", () => {
    const normalized = normalizeResultBatch([row, row], source);
    expect(normalized).toEqual([row]);
    expect(normalized[0]?.starts_at).toBeNull();
    expect(summarizeRecordedResults(normalized, source.eventId, "real")).toEqual({
      eventId: source.eventId,
      dataMode: "real",
      completedResults: 1,
      latestMatchDate: "2026-04-19",
    });
  });
  it("keeps pending scores null and out of existing match/set win rates", () => {
    const rows = normalizeResultBatch(
      [
        {
          ...row,
          status: "scheduled",
          score_a: null,
          score_b: null,
          sets: null,
          source_date: null,
        },
      ],
      source,
    );
    expect(rows[0]).toMatchObject({ score_a: null, score_b: null, source_date: null });
    expect(resultStats(rows, "team_a").played).toBe(0);
    expect(resultSetStats(rows, "team_a").played).toBe(0);
    expect(summarizeRecordedResults(rows, source.eventId, "real")).toMatchObject({
      completedResults: 0,
      latestMatchDate: null,
    });
  });
  it.each([
    { source_date: "2026-02-30" },
    { data_mode: "synthetic" },
    { event_id: "unrelated_event" },
    { score_a: null },
    { score_a: 0, score_b: 0, sets: null },
    { score_a: -1 },
    { sets: [{ a: 25, b: 25 }] },
    {
      sets: [
        { a: 18, b: 25 },
        { a: 22, b: 25 },
      ],
    },
    { status: "scheduled", score_a: 0, score_b: 0, sets: null },
    { team_b_id: "team_a" },
    { id: "invalid,id" },
    { starts_at: "2026-04-19" },
  ])("rejects invalid or misleading input: %j", (patch) => {
    expect(() => normalizeResultBatch([{ ...row, ...patch }], source)).toThrow();
  });
  it("rejects conflicting duplicates instead of selecting an arbitrary score", () => {
    expect(() => normalizeResultBatch([row, { ...row, court: "4" }], source)).toThrow(
      "Conflicting duplicate",
    );
  });
  it("does not invent dates or per-set point scores when they are absent", () => {
    const rows = normalizeResultBatch([{ ...row, sets: null, source_date: null }], source);
    expect(rows[0]?.sets).toBeNull();
    expect(summarizeRecordedResults(rows, source.eventId, "real").latestMatchDate).toBeNull();
  });
});

describe("event-specific official links", () => {
  it("uses each event's own approved display binding with no example fallback", () => {
    for (const item of EVENT_RESULT_SOURCES) {
      expect(eventResultSource(item.eventId, item.dataMode)).toEqual(item);
      expect(
        validateOfficialResultsUrl(item.officialResultsUrl, item.provider, item.upstreamEventId),
      ).toBe(item.officialResultsUrl);
    }
    expect(eventResultSource("unmapped", "real")).toBeNull();
    expect(eventResultSource(source.eventId, "synthetic")).toBeNull();
    expect(eventResultSource(source.eventId, "all")).toBeNull();
    expect(eventResultSource(source.eventId, "real", [source, source])).toBeNull();
  });
  it.each([
    "javascript:alert(1)",
    "http://www.timu.ca/scoreboards/results.php?tid=3960",
    "https://127.0.0.1/scoreboards/results.php?tid=3960",
    "https://www.timu.ca.evil.test/scoreboards/results.php?tid=3960",
    "https://user:secret@www.timu.ca/scoreboards/results.php?tid=3960",
    "https://www.timu.ca:8443/scoreboards/results.php?tid=3960",
    "https://www.timu.ca/redirect?tid=3960",
    "https://www.timu.ca/scoreboards/results.php?tid=9999",
    "https://www.timu.ca/scoreboards/results.php?tid=3960&url=https://evil.test",
    "https://www.timu.ca/scoreboards/results.php?tid=3960&tid=3960",
    "https://www.timu.ca/scoreboards/results.php?tid=3960#other",
    " https://www.timu.ca/scoreboards/results.php?tid=3960",
  ])("rejects unsafe/unbound link: %s", (url) => {
    expect(validateOfficialResultsUrl(url, "timu", "3960")).toBeNull();
  });
  it("accepts exact AES event/division paths and rejects another event or API path", () => {
    const root = "https://results.advancedeventsystems.com/event/PTAwMDAwNDY1Mjk90";
    expect(
      validateOfficialResultsUrl(`${root}/divisions/225168/overview`, "aes", "PTAwMDAwNDY1Mjk90"),
    ).toBe(`${root}/divisions/225168/overview`);
    expect(validateOfficialResultsUrl(root, "aes", "different_event")).toBeNull();
    expect(
      validateOfficialResultsUrl(`${root}?redirect=https://evil.test`, "aes", "PTAwMDAwNDY1Mjk90"),
    ).toBeNull();
    expect(
      validateOfficialResultsUrl(
        "https://results.advancedeventsystems.com/api/secret",
        "aes",
        "PTAwMDAwNDY1Mjk90",
      ),
    ).toBeNull();
  });
});
