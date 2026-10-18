import { QueryClient } from "@tanstack/react-query";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ from: vi.fn() }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { from: mocks.from } }));
import { myHouseholdQuery, teamAnnouncementsQuery } from "@/lib/queries";

type RecordRow = { id: string; [key: string]: unknown };
let tables: Record<string, RecordRow[]>;
let signals: AbortSignal[];
let filters: { table: string; field: string; value: unknown }[];
let qc: QueryClient;
beforeEach(() => {
  tables = {};
  signals = [];
  filters = [];
  qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  mocks.from.mockImplementation((table: string) => {
    const tests: ((row: RecordRow) => boolean)[] = [];
    let single = false;
    let signal: AbortSignal | undefined;
    const chain = {
      select: () => chain,
      eq: (field: string, value: unknown) => {
        filters.push({ table, field, value });
        tests.push((row) => row[field] === value);
        return chain;
      },
      not: (field: string, _operator: string, value: unknown) => {
        tests.push((row) => row[field] !== value);
        return chain;
      },
      order: () => chain,
      range: () => chain,
      abortSignal: (value: AbortSignal) => {
        signal = value;
        signals.push(value);
        return chain;
      },
      maybeSingle: () => {
        single = true;
        return chain;
      },
      then: (resolve: (value: unknown) => unknown, reject: (error: unknown) => unknown) =>
        Promise.resolve()
          .then(() => {
            signal?.throwIfAborted();
            const rows = (tables[table] ?? []).filter((row) => tests.every((test) => test(row)));
            return { data: single ? (rows[0] ?? null) : rows, count: rows.length, error: null };
          })
          .then(resolve, reject),
    };
    return chain;
  });
});
afterEach(() => qc.clear());

it("stores private published rows under a user-specific query, passes abort signal and excludes global announcements", async () => {
  tables["announcements"] = [
    { id: "global", team_id: null, status: "published" },
    { id: "private-A", team_id: "A", status: "published" },
    { id: "draft", team_id: "A", status: "draft" },
  ];
  const a = teamAnnouncementsQuery("account-A");
  const b = teamAnnouncementsQuery("account-B");
  expect(a.queryKey).not.toEqual(b.queryKey);
  expect(teamAnnouncementsQuery(undefined).enabled).toBe(false);
  const rows = await qc.fetchQuery(a);
  expect(rows.map((row) => row.id)).toEqual(["private-A"]);
  expect(signals).toHaveLength(1);
  expect(signals[0]?.aborted).toBe(false);
  expect(qc.getQueryData(b.queryKey)).toBeUndefined();
  expect(qc.getQueryData(["competition", "public"])).toBeUndefined();
});
it("isolates household reads by account, keeps unapproved children out of authorized linked players and supplies abort signals to all reads", async () => {
  tables["players"] = [
    { id: "player-A", user_id: "account-A", status: "verified" },
    { id: "pending", status: "verified" },
    { id: "approved", status: "verified" },
  ];
  tables["family_links"] = [
    { id: "link-1", family_user_id: "account-A", player_id: "pending", status: "pending" },
    { id: "link-2", family_user_id: "account-A", player_id: "approved", status: "approved" },
    { id: "link-3", family_user_id: "account-B", player_id: "player-A", status: "approved" },
  ];
  tables["managed_teams"] = [
    { id: "managed-A", user_id: "account-A", team_id: "A" },
    { id: "managed-B", user_id: "account-B", team_id: "B" },
  ];
  const a = await qc.fetchQuery(myHouseholdQuery("account-A"));
  expect(a.self?.id).toBe("player-A");
  expect(a.linkedPlayers.map((p) => p.id)).toEqual(["approved"]);
  expect(a.familyLinks.map((l) => l.id)).toEqual(["link-1", "link-2"]);
  expect(a.managedTeams).toEqual(["A"]);
  expect(signals).toHaveLength(6);
  expect(signals.every((s) => s === signals[0])).toBe(true);
  expect(qc.getQueryData(myHouseholdQuery("account-B").queryKey)).toBeUndefined();
  expect(filters).toContainEqual({
    table: "family_links",
    field: "family_user_id",
    value: "account-A",
  });
});
