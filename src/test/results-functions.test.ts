import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createClient: vi.fn(),
  loadResultsPage: vi.fn(),
  loadResultsFilters: vi.fn(),
  loadTeamResultsHistory: vi.fn(),
}));

// Exercise the actual server-function validators/handlers without TanStack's
// request transport, database access or credentials from the host environment.
vi.mock("@tanstack/react-start", () => ({
  createServerFn: () => ({
    inputValidator: (validate: (input: unknown) => unknown) => ({
      handler:
        (handler: (context: { data: unknown }) => Promise<unknown>) =>
        async ({ data }: { data: unknown }) =>
          handler({ data: validate(data) }),
    }),
  }),
}));
vi.mock("@supabase/supabase-js", () => ({ createClient: mocks.createClient }));
vi.mock("@/lib/results-query", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/results-query")>()),
  loadResultsPage: mocks.loadResultsPage,
  loadResultsFilters: mocks.loadResultsFilters,
  loadTeamResultsHistory: mocks.loadTeamResultsHistory,
}));

import { getResultsFilters, getResultsPage, getTeamResultsHistory } from "@/lib/results.functions";

const client = { from: vi.fn() };
beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("SUPABASE_URL", "https://results.invalid");
  vi.stubEnv("SUPABASE_PUBLISHABLE_KEY", "sb_publishable_results_test");
  vi.stubEnv("SUPABASE_ANON_KEY", "anon_results_test");
  vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "sb_secret_not_used");
  mocks.createClient.mockReturnValue(client);
  mocks.loadResultsPage.mockResolvedValue({ matches: [], total: 0 });
  mocks.loadResultsFilters.mockResolvedValue({
    events: [],
    teams: [],
    divisions: [],
    teamEvents: [],
  });
  mocks.loadTeamResultsHistory.mockResolvedValue({ matches: [], rankings: [] });
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("public Results server functions", () => {
  it("validates and delegates history/real defaults using the public key only", async () => {
    expect(await getResultsPage({ data: { page: 1, pageSize: 6 } })).toEqual({
      matches: [],
      total: 0,
    });
    expect(mocks.loadResultsPage).toHaveBeenCalledWith(client, {
      page: 1,
      pageSize: 6,
      period: "history",
      dataMode: "real",
    });
    expect(mocks.createClient).toHaveBeenCalledWith(
      "https://results.invalid",
      "sb_publishable_results_test",
      {
        auth: { persistSession: false, autoRefreshToken: false },
        global: { fetch: expect.any(Function) },
      },
    );
    expect(client.from).not.toHaveBeenCalled();
  });
  it("passes filters and team history through separate validated handlers", async () => {
    await getResultsFilters({ data: { dataMode: "real" } });
    await getTeamResultsHistory({ data: { teamId: "team_001", dataMode: "synthetic" } });
    expect(mocks.loadResultsFilters).toHaveBeenCalledWith(client, { dataMode: "real" });
    expect(mocks.loadTeamResultsHistory).toHaveBeenCalledWith(client, {
      teamId: "team_001",
      dataMode: "synthetic",
    });
    expect(mocks.loadResultsPage).not.toHaveBeenCalled();
  });
  it("rejects invalid dates and OR-grammar identifiers before creating any client", async () => {
    await expect(
      getResultsPage({ data: { page: 1, pageSize: 6, dateFrom: "2026-02-30" } }),
    ).rejects.toThrow();
    await expect(
      getTeamResultsHistory({ data: { teamId: "t,status.eq.final", dataMode: "real" } }),
    ).rejects.toThrow();
    expect(mocks.createClient).not.toHaveBeenCalled();
  });
  it("uses the anon fallback without ever consulting service-role credentials", async () => {
    vi.stubEnv("SUPABASE_PUBLISHABLE_KEY", undefined);
    await getResultsPage({ data: { page: 1, pageSize: 6 } });
    expect(mocks.createClient.mock.calls[0]?.slice(0, 2)).toEqual([
      "https://results.invalid",
      "anon_results_test",
    ]);
  });
  it.each(["missing-key", "missing-url", "secret-key"])(
    "reports %s instead of creating a privileged or unconfigured client",
    async (failure) => {
      if (failure === "missing-key") {
        vi.stubEnv("SUPABASE_PUBLISHABLE_KEY", undefined);
        vi.stubEnv("SUPABASE_ANON_KEY", undefined);
      } else if (failure === "missing-url") vi.stubEnv("SUPABASE_URL", undefined);
      else vi.stubEnv("SUPABASE_PUBLISHABLE_KEY", "sb_secret_not_public");
      await expect(getResultsPage({ data: { page: 1, pageSize: 6 } })).rejects.toThrow(
        "Results source unavailable",
      );
      expect(mocks.createClient).not.toHaveBeenCalled();
    },
  );
  it("sets the public apikey and removes opaque-key bearer auth in its read-only transport", async () => {
    await getResultsPage({ data: { page: 1, pageSize: 6 } });
    const transport = mocks.createClient.mock.calls[0]?.[2].global.fetch as typeof fetch;
    const fetchMock = vi.fn().mockResolvedValue(new Response("{}", { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    await transport("https://results.invalid/rest/v1/matches", {
      headers: { Authorization: "Bearer sb_publishable_results_test", "x-client-test": "retained" },
    });
    const headers = fetchMock.mock.calls[0]?.[1].headers as Headers;
    expect(headers.get("apikey")).toBe("sb_publishable_results_test");
    expect(headers.has("Authorization")).toBe(false);
    expect(headers.get("x-client-test")).toBe("retained");
  });
});

