import { describe, expect, it } from "vitest";
import {
  loadResultsFilters,
  loadResultsPage,
  loadTeamResultsHistory,
  resultsPageSchema,
  teamResultsHistorySchema,
} from "@/lib/results-query";

import { mockClient, type Row } from "./results-client";

function match(id: string, fields: Partial<Row> = {}): Row {
  return {
    id,
    event_id: "event_real",
    division_id: "division_real",
    team_a_id: "team_a",
    team_b_id: "team_b",
    source_date: "2026-03-14",
    starts_at: null,
    venue_id: null,
    court: null,
    status: "final",
    score_a: 2,
    score_b: 1,
    sets: null,
    data_mode: "real",
    ...fields,
  };
}
const now = new Date("2026-10-17T12:00:00.000Z");

describe("Results input validation", () => {
  it("defaults to history/real and accepts valid leap dates and safe text IDs", () => {
    expect(resultsPageSchema.parse({ page: 1, pageSize: 6 })).toMatchObject({
      period: "history",
      dataMode: "real",
    });
    expect(
      resultsPageSchema.parse({
        page: 1,
        pageSize: 6,
        dateFrom: "2024-02-29",
        teamId: "timu-team_01",
      }).dateFrom,
    ).toBe("2024-02-29");
  });
  it.each([
    "2026-02-29",
    "2026-02-30",
    "2026-04-31",
    "2026-13-01",
    "2026-3-01",
    "0000-01-01",
    "not-a-date",
  ])("rejects the invalid calendar date %s", (dateFrom) => {
    expect(() => resultsPageSchema.parse({ page: 1, pageSize: 6, dateFrom })).toThrow();
  });
  it("rejects reversed dates, unsafe identifiers, invalid modes and unbounded pages", () => {
    const base = { page: 1, pageSize: 6 };
    for (const extra of [
      { dateFrom: "2026-05-01", dateTo: "2026-03-01" },
      { teamId: "team_a,status.neq.final" },
      { teamId: "a)" },
      { eventId: "bad.id" },
      { teamId: "x".repeat(201) },
      { dataMode: "unknown" },
      { period: "forever" },
      { page: Number.MAX_SAFE_INTEGER },
      { pageSize: 51 },
      { page: 0 },
      { page: 1.5 },
    ])
      expect(resultsPageSchema.safeParse({ ...base, ...extra }).success).toBe(false);
    expect(teamResultsHistorySchema.safeParse({ teamId: "team_a", dataMode: "all" }).success).toBe(
      false,
    );
  });
});

describe("public Results page query", () => {
  it("reads old real matches by default without silently including demo or applying a recent window", async () => {
    const { client, calls } = mockClient({ matches: [match("historical-real"), match("demo", { data_mode: "synthetic" })] });
    const result = await loadResultsPage(client, { page: 1, pageSize: 6 }, now);
    expect(result.matches.map(row => row.id)).toEqual(["historical-real"]);
    expect(calls[0]?.operations).toContainEqual({ method: "eq", args: ["data_mode", "real"] });
    expect(calls[0]?.operations.some(operation => operation.method === "gte")).toBe(false);
  });
  it("preserves an explicitly selected inclusive recent window and all source modes", async () => {
    const { client, calls } = mockClient({
      matches: [
        match("old"),
        match("start", { source_date: "2026-07-17" }),
        match("end", { source_date: "2026-10-17", data_mode: "synthetic" }),
        match("future", { source_date: "2026-10-18" }),
        match("unknown", { source_date: null }),
        match("unfinished", { source_date: "2026-09-01", status: "scheduled" }),
      ],
    });
    const result = await loadResultsPage(client, { page: 1, pageSize: 6, period: "recent", dataMode: "all" }, now);
    expect(result.matches.map((row) => row.id)).toEqual(["end", "start"]);
    expect(result.total).toBe(2);
    expect(calls[0]?.operations).toContainEqual({
      method: "gte",
      args: ["source_date", "2026-07-17"],
    });
    expect(calls[0]?.operations).not.toContainEqual({ method: "eq", args: ["data_mode", "all"] });
  });
  it("applies mode/event/team A-or-B/inclusive source dates before exact count and pagination", async () => {
    const { client, calls } = mockClient({
      matches: [
        match("a-start", { source_date: "2026-03-01" }),
        match("b-end", { source_date: "2026-05-31", team_a_id: "opponent", team_b_id: "team_a" }),
        match("wrong-mode", { data_mode: "synthetic" }),
        match("wrong-event", { event_id: "other" }),
        match("wrong-team", { team_a_id: "other", team_b_id: "another" }),
        match("too-early", { source_date: "2026-02-28" }),
        match("too-late", { source_date: "2026-06-01" }),
        match("unfinished", { status: "scheduled" }),
      ],
    });
    const result = await loadResultsPage(
      client,
      {
        page: 2,
        pageSize: 1,
        period: "history",
        dataMode: "real",
        eventId: "event_real",
        teamId: "team_a",
        dateFrom: "2026-03-01",
        dateTo: "2026-05-31",
      },
      now,
    );
    expect(result.matches.map((row) => row.id)).toEqual(["a-start"]);
    expect(result.total).toBe(2);
    expect(calls[0]?.operations).toEqual([
      { method: "select", args: ["*", { count: "exact" }] },
      { method: "eq", args: ["status", "final"] },
      { method: "eq", args: ["data_mode", "real"] },
      { method: "eq", args: ["event_id", "event_real"] },
      { method: "or", args: ["team_a_id.eq.team_a,team_b_id.eq.team_a"] },
      { method: "gte", args: ["source_date", "2026-03-01"] },
      { method: "lte", args: ["source_date", "2026-05-31"] },
      { method: "order", args: ["source_date", { ascending: false, nullsFirst: false }] },
      { method: "order", args: ["id", { ascending: true }] },
      { method: "range", args: [1, 1] },
    ]);
  });
  it("history keeps original source dates, unknown start/venue values and stable null-last ordering", async () => {
    const { client } = mockClient({
      matches: [match("z"), match("b-unknown", { source_date: null }), match("a")],
    });
    const result = await loadResultsPage(client, { page: 1, pageSize: 6, period: "history" }, now);
    expect(result.matches.map((row) => row.id)).toEqual(["a", "z", "b-unknown"]);
    expect(result.matches[0]).toMatchObject({
      source_date: "2026-03-14",
      starts_at: null,
      venue_id: null,
    });
  });
  it("returns the final partial page across all 1,836 historical matches", async () => {
    const rows = Array.from({ length: 1836 }, (_, index) =>
      match(`match_${String(index).padStart(4, "0")}`),
    );
    const { client } = mockClient({ matches: rows });
    const result = await loadResultsPage(
      client,
      { page: 37, pageSize: 50, period: "history", dataMode: "real" },
      now,
    );
    expect(result.total).toBe(1836);
    expect(result.matches).toHaveLength(36);
    expect(result.matches.at(-1)?.id).toBe("match_1835");
    expect(
      await loadResultsPage(client, { page: 38, pageSize: 50, period: "history" }, now),
    ).toEqual({ matches: [], total: 1836 });
  });
  it.each(["missing-count", "early-empty", "short-page", "query-error"])(
    "fails explicitly for %s instead of reporting a complete empty result",
    async (failure) => {
      const { client } = mockClient(
        { matches: [match("a"), match("b")] },
        {
          response: (_table, _from, response) => ({
            ...response,
            count: failure === "missing-count" ? null : response.count,
            data:
              failure === "early-empty"
                ? []
                : failure === "short-page"
                  ? (response.data?.slice(0, 1) ?? null)
                  : response.data,
            error: failure === "query-error" ? { message: "private database detail" } : null,
          }),
        },
      );
      await expect(
        loadResultsPage(client, { page: 1, pageSize: 6, period: "history" }, now),
      ).rejects.toThrow(/try again/i);
    },
  );
  it("handles a genuinely empty dataset and validates before querying", async () => {
    const { client, calls } = mockClient({});
    expect(await loadResultsPage(client, { page: 1, pageSize: 6, period: "history" }, now)).toEqual(
      { matches: [], total: 0 },
    );
    await expect(
      loadResultsPage(client, { page: 1, pageSize: 6, teamId: "a,b" }, now),
    ).rejects.toThrow();
    expect(calls).toHaveLength(1);
  });
});

describe("complete Results filters", () => {
  it("distinguishes same-name same-division entries through deduplicated two-sided match participation", async () => {
    const { client, calls } = mockClient({
      teams: [
        { id: "team_march", name: "Same team", division_id: "division_real", data_mode: "real" },
        { id: "team_may", name: "Same team", division_id: "division_real", data_mode: "real" },
      ],
      matches: [
        match("march", { event_id: "event_march", team_a_id: "team_march", team_b_id: "opponent" }),
        match("march_duplicate", {
          event_id: "event_march",
          team_a_id: "opponent",
          team_b_id: "team_march",
        }),
        match("may", { event_id: "event_may", team_a_id: "team_may", team_b_id: null }),
        match("not_final", {
          event_id: "event_future",
          team_a_id: "team_march",
          status: "scheduled",
        }),
      ],
    });
    const result = await loadResultsFilters(client, { dataMode: "real" });
    expect(result.teamEvents).toEqual([
      { teamId: "team_march", eventId: "event_march" },
      { teamId: "opponent", eventId: "event_march" },
      { teamId: "team_may", eventId: "event_may" },
    ]);
    expect(result.teams).toHaveLength(2);
    expect(calls.find((call) => call.table === "matches")?.operations).toEqual([
      { method: "select", args: ["id,event_id,team_a_id,team_b_id", { count: "exact" }] },
      { method: "eq", args: ["status", "final"] },
      { method: "eq", args: ["data_mode", "real"] },
      { method: "order", args: ["id", { ascending: true }] },
      { method: "range", args: [0, 499] },
    ]);
  });
  it("keeps participation mode-specific and reads all 1,836 matches before deduplication", async () => {
    const matches = Array.from({ length: 1836 }, (_, index) =>
      match(`match_${String(index).padStart(4, "0")}`, {
        event_id: `event_${index % 3}`,
        team_a_id: `team_${index % 467}`,
        team_b_id: null,
      }),
    );
    const { client, calls } = mockClient({
      matches: [
        ...matches,
        match("demo", { event_id: "event_demo", team_a_id: "team_demo", data_mode: "synthetic" }),
      ],
    });
    const real = await loadResultsFilters(client, { dataMode: "real" });
    const expected = new Set(
      matches.map((row) => JSON.stringify([row["team_a_id"], row["event_id"]])),
    );
    expect(
      new Set(
        real.teamEvents.map((relation) => JSON.stringify([relation.teamId, relation.eventId])),
      ),
    ).toEqual(expected);
    expect(real.teamEvents.some((relation) => relation.teamId === "team_demo")).toBe(false);
    expect(
      calls.filter((call) => call.table === "matches").map((call) => call.operations.at(-1)?.args),
    ).toEqual([
      [0, 499],
      [500, 999],
      [1000, 1499],
      [1500, 1999],
    ]);
    const demo = await loadResultsFilters(client, { dataMode: "synthetic" });
    expect(demo.teamEvents).toEqual([
      { teamId: "team_demo", eventId: "event_demo" },
      { teamId: "team_b", eventId: "event_demo" },
    ]);
    const all = await loadResultsFilters(client, { dataMode: "all" });
    expect(all.teamEvents).toHaveLength(expected.size + 2);
  });
  it("reads every metadata table beyond 1,000 rows and requests only public display fields", async () => {
    const makeRows = (kind: string, length: number) =>
      Array.from({ length }, (_, index) => ({
        id: `${kind}_${String(index).padStart(4, "0")}`,
        name: `${kind} ${index}`,
        data_mode: "real",
        division_id: "division_0",
        start_date: "2026-03-01",
        end_date: "2026-05-31",
        secret: "not selected",
      }));
    const { client, calls } = mockClient({
      events: makeRows("event", 1001),
      teams: makeRows("team", 1836),
      divisions: makeRows("division", 1002),
    });
    const result = await loadResultsFilters(client, { dataMode: "real" });
    expect([result.events.length, result.teams.length, result.divisions.length]).toEqual([
      1001, 1836, 1002,
    ]);
    expect(result.teams.at(-1)?.id).toBe("team_1835");
    expect(result.events[0]).not.toHaveProperty("secret");
    expect(result.teams[0]).toHaveProperty("division_id");
    for (const call of calls) {
      expect(call.operations).toContainEqual({ method: "eq", args: ["data_mode", "real"] });
      expect(call.operations).toContainEqual({
        method: "order",
        args: ["id", { ascending: true }],
      });
      expect(call.operations.at(-1)?.method).toBe("range");
    }
    expect(
      calls.filter((call) => call.table === "teams").map((call) => call.operations.at(-1)?.args),
    ).toEqual([
      [0, 499],
      [500, 999],
      [1000, 1499],
      [1500, 1999],
    ]);
  });
  it("continues after a lower server row cap and keeps modes separate on all tables", async () => {
    const teams = Array.from({ length: 467 }, (_, index) => ({
      id: `team_${index}`,
      name: "Team",
      division_id: null,
      data_mode: "real",
    }));
    const { client, calls } = mockClient(
      { teams: [...teams, { id: "demo", data_mode: "synthetic" }], events: [], divisions: [] },
      { serverLimit: 100 },
    );
    const result = await loadResultsFilters(client, { dataMode: "real" });
    expect(result.teams).toHaveLength(467);
    expect(result.teams.some((team) => team.id === "demo")).toBe(false);
    expect(calls.filter((call) => call.table === "teams")).toHaveLength(5);
  });
  it("supports synthetic-only and all-mode catalogues without relabelling rows", async () => {
    const { client } = mockClient({
      teams: [
        { id: "real", name: "Real", division_id: null, data_mode: "real" },
        { id: "demo", name: "Demo", division_id: null, data_mode: "synthetic" },
      ],
    });
    expect(
      (await loadResultsFilters(client, { dataMode: "synthetic" })).teams.map((row) => row.id),
    ).toEqual(["demo"]);
    expect(
      (await loadResultsFilters(client, { dataMode: "all" })).teams.map((row) => row.data_mode),
    ).toEqual(["synthetic", "real"]);
  });
  it.each(["missing-count", "early-empty", "count-changed", "duplicate-id", "query-error"])(
    "rejects %s in metadata instead of silently truncating",
    async (failure) => {
      const teams = Array.from({ length: 600 }, (_, index) => ({
        id: `team_${String(index).padStart(4, "0")}`,
        data_mode: "real",
      }));
      const { client } = mockClient(
        { teams },
        {
          response: (table, from, response) => {
            if (table !== "teams") return response;
            if (failure === "missing-count") return { ...response, count: null };
            if (failure === "query-error")
              return { ...response, error: { message: "not exposed" } };
            if (from === 0) return response;
            if (failure === "early-empty") return { ...response, data: [] };
            if (failure === "count-changed") return { ...response, count: 601 };
            return { ...response, data: [teams[0]!] };
          },
        },
      );
      await expect(loadResultsFilters(client, { dataMode: "real" })).rejects.toThrow(/try again/i);
    },
  );
});

describe("independent team Results history", () => {
  it("loads all 1,836 team finals plus all placements without mixing team, mode or unconfirmed semantics", async () => {
    const matches = Array.from({ length: 1836 }, (_, index) =>
      match(
        `match_${String(index).padStart(4, "0")}`,
        index % 2 ? { team_a_id: "opponent", team_b_id: "team_a" } : {},
      ),
    );
    const rankings = Array.from({ length: 1001 }, (_, index) => ({
      id: `ranking_${String(index).padStart(4, "0")}`,
      team_id: "team_a",
      event_id: "event_real",
      division_id: "division_real",
      data_mode: "real",
      rank: 2,
      field_size: 9,
      final_confirmed: false,
    }));
    const { client, calls } = mockClient({
      matches: [
        ...matches,
        match("demo", { data_mode: "synthetic" }),
        match("unfinished", { status: "scheduled" }),
        match("other", { team_a_id: "other", team_b_id: "another" }),
      ],
      rankings: [
        ...rankings,
        { id: "demo", team_id: "team_a", data_mode: "synthetic" },
        { id: "other", team_id: "other", data_mode: "real" },
      ],
    });
    const result = await loadTeamResultsHistory(client, { teamId: "team_a", dataMode: "real" });
    expect(result.matches).toHaveLength(1836);
    expect(result.rankings).toHaveLength(1001);
    expect(result.rankings.every((ranking) => ranking.final_confirmed === false)).toBe(true);
    expect(result.matches.at(-1)?.source_date).toBe("2026-03-14");
    for (const call of calls) {
      expect(call.operations).toContainEqual({ method: "eq", args: ["data_mode", "real"] });
      expect(call.operations.some((operation) => operation.method === "gte")).toBe(false);
      if (call.table === "matches")
        expect(call.operations).toContainEqual({ method: "eq", args: ["status", "final"] });
      else expect(call.operations).toContainEqual({ method: "eq", args: ["team_id", "team_a"] });
    }
  });
});

