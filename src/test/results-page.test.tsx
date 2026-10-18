vi.mock("@/hooks/use-home-data-mode", () => ({
  useHomeDataMode: () => ({ mode: "real", setMode: mocks.homeMode, ready: true }),
}));
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import type { ComponentType, ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  homeMode: vi.fn(),
  page: vi.fn(),
  filters: vi.fn(),
  history: vi.fn(),
  role: "general_user",
  householdLoaded: true,
  contextSearch: {} as Record<string, unknown>,
  family: false,
}));

vi.mock("@tanstack/react-router", () => ({
  useSearch: () => mocks.contextSearch,
  useNavigate: () => vi.fn(),
  // Loader prefetch is absent in unit tests, so the page starts from its query mocks.
  createFileRoute: () => (options: { component: ComponentType }) => ({
    options,
    useLoaderData: () => ({ page: null, filters: null }),
  }),
  Link: ({ children }: { children: ReactNode }) => <span>{children}</span>,
}));
vi.mock("@/components/AppShell", () => ({
  AppShell: ({
    title,
    sourceLabel,
    children,
  }: {
    title: string;
    sourceLabel: string;
    children: ReactNode;
  }) => (
    <main>
      <h1>{title}</h1>
      <p>{sourceLabel}</p>
      {children}
    </main>
  ),
  Section: ({ title, children }: { title: string; children: ReactNode }) => (
    <section aria-label={title}>
      <h2>{title}</h2>
      {children}
    </section>
  ),
  Card: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  Tbd: ({ children }: { children: ReactNode }) => <span>{children}</span>,
  btn: { input: "" },
}));
vi.mock("@/lib/queries", () => ({
  competitionQuery: { queryKey: ["competition"], queryFn: async () => competition },
}));
vi.mock("@/lib/results.functions", () => ({
  getResultsPage: mocks.page,
  getResultsFilters: mocks.filters,
  getTeamResultsHistory: mocks.history,
}));
vi.mock("@/hooks/use-role", () => ({
  useRole: () => ({
    role: mocks.role,
    user: mocks.role === "general_user" ? null : { id: mocks.family ? "parent" : "test-user" },
    ready: true,
    household: {
      data: mocks.householdLoaded
        ? mocks.family
          ? parentHousehold()
          : {
              managedTeams: ["team-a", "team-b"],
              linkedPlayers: [],
              self: null,
              roles: [],
              familyLinks: [],
            }
        : undefined,
      isPending: !mocks.householdLoaded,
      isError: false,
    },
  }),
}));

import { parentHousehold } from "./parent-context.fixture";
import { Route } from "@/routes/results";
const ResultsPage = Route.options.component as ComponentType;
const match = (overrides = {}) => ({
  id: "match-1",
  event_id: "event-real",
  division_id: "division",
  team_a_id: "team-a",
  team_b_id: "team-b",
  venue_id: null,
  starts_at: null,
  source_date: "2026-03-15",
  court: null,
  status: "final",
  score_a: 2,
  score_b: 1,
  sets: null,
  data_mode: "real",
  ...overrides,
});
const metadata = {
  teams: [
    { id: "team-a", name: "Alpha", division_id: "division", data_mode: "real" },
    { id: "team-b", name: "Beta", division_id: "division", data_mode: "real" },
    { id: "team-c", name: "Alpha", division_id: "division", data_mode: "real" },
    { id: "demo-team", name: "Alpha", division_id: "demo-division", data_mode: "synthetic" },
  ],
  events: [
    {
      id: "event-real",
      name: "March historical event",
      start_date: "2026-03-15",
      end_date: "2026-03-15",
      data_mode: "real",
    },
    {
      id: "event-demo",
      name: "Demonstration event",
      start_date: "2026-10-15",
      end_date: "2026-10-15",
      data_mode: "synthetic",
    },
    {
      id: "event-later",
      name: "May historical event",
      start_date: "2026-05-15",
      end_date: "2026-05-15",
      data_mode: "real",
    },
    {
      id: "event-placement",
      name: "Unconfirmed placement event",
      start_date: new Date().toISOString().slice(0, 10),
      end_date: new Date().toISOString().slice(0, 10),
      data_mode: "real",
    },
  ],
  divisions: [
    { id: "division", name: "U16", data_mode: "real" },
    { id: "demo-division", name: "U18", data_mode: "synthetic" },
  ],
  teamEvents: [
    { teamId: "team-a", eventId: "event-real" },
    { teamId: "team-b", eventId: "event-real" },
    { teamId: "team-c", eventId: "event-later" },
    { teamId: "demo-team", eventId: "event-demo" },
  ],
};
// Public and family lookups must not rely on this deliberately incomplete legacy query.
const competition = {
  teams: [],
  events: [],
  divisions: [],
  venues: [],
  matches: [],
  rankings: [],
  announcements: [],
};
const defaultRequest = { page: 1, pageSize: 6, period: "history", dataMode: "real" };
const clients: QueryClient[] = [];
let rerenderPage: () => void;
function renderPage(seedDefault = false) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: Infinity } },
  });
  clients.push(client);
  client.setQueryData(["competition"], competition);
  if (seedDefault)
    client.setQueryData(["results-page", defaultRequest], {
      matches: [match({ id: "cached-default" })],
      total: 7,
    });
  const view = render(
    <QueryClientProvider client={client}>
      <ResultsPage />
    </QueryClientProvider>,
  );
  rerenderPage = () =>
    view.rerender(
      <QueryClientProvider client={client}>
        <ResultsPage />
      </QueryClientProvider>,
    );
  return client;
}
function change(label: string, value: string) {
  if (label === "Browse team") {
    if (!value) {
      fireEvent.click(screen.getByRole("button", { name: "All teams" }));
      return;
    }
    const entry = metadata.teams.find((t) => t.id === value)!;
    fireEvent.change(screen.getByLabelText("Search teams"), { target: { value: entry.name } });
    const options = within(screen.getByRole("listbox", { name: "Matching teams" })).getAllByRole(
      "option",
    );
    const sameName = metadata.teams.filter((t) => t.name === entry.name && t.data_mode === "real");
    fireEvent.click(options[sameName.findIndex((t) => t.id === value)]!);
    return;
  }
  fireEvent.change(screen.getByLabelText(label), { target: { value } });
}
async function loaded() {
  await screen.findByText("Page 1 of 2");
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  );
  vi.unstubAllEnvs();
  sessionStorage.clear();
  mocks.contextSearch = {};
  mocks.family = false;
  mocks.role = "general_user";
  mocks.householdLoaded = true;
  mocks.page.mockImplementation(async () => ({ matches: [match()], total: 7 }));
  mocks.filters.mockImplementation(async ({ data }: { data: { dataMode: string } }) => ({
    teams: metadata.teams.filter(
      (row) => data.dataMode === "all" || row.data_mode === data.dataMode,
    ),
    events: metadata.events.filter(
      (row) => data.dataMode === "all" || row.data_mode === data.dataMode,
    ),
    divisions: metadata.divisions.filter(
      (row) => data.dataMode === "all" || row.data_mode === data.dataMode,
    ),
    teamEvents: metadata.teamEvents.filter((relation) =>
      metadata.events.some(
        (event) =>
          event.id === relation.eventId &&
          (data.dataMode === "all" || event.data_mode === data.dataMode),
      ),
    ),
  }));
  mocks.history.mockImplementation(async () => ({ matches: [match()], rankings: [] }));
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  clients.splice(0).forEach((client) => client.clear());
});

describe("Results history page", () => {
  it("uses the approved second child's actual team without replacing it with the first child", async () => {
    mocks.role = "family_friends";
    mocks.family = true;
    mocks.contextSearch = { player: "child-b", team: "team-b" };
    renderPage();
    await loaded();
    await waitFor(() =>
      expect(screen.getByRole("group", { name: "Browse team" })).toHaveAttribute(
        "data-team-id",
        "team-b",
      ),
    );
    expect(screen.getByText(/Linked player: Blair/)).toBeInTheDocument();
    expect(mocks.history).toHaveBeenLastCalledWith({
      data: { teamId: "team-b", dataMode: "real" },
    });
    change("Search teams", "May historical");
    fireEvent.click(
      within(screen.getByRole("listbox", { name: "Matching teams" })).getByRole("option", {
        name: /Alpha.*May historical/,
      }),
    );
    await waitFor(() =>
      expect(screen.getByRole("group", { name: "Browse team" })).toHaveAttribute(
        "data-team-id",
        "team-c",
      ),
    );
    expect(mocks.contextSearch).toEqual({ player: "child-b", team: "team-b" });
  });
  it("keeps an invalid child-team parameter unassociated while allowing explicit public browsing", async () => {
    mocks.role = "family_friends";
    mocks.family = true;
    mocks.contextSearch = { player: "child-b", team: "team-a" };
    renderPage();
    await loaded();
    expect(
      screen.getByText(/This player or team selection is no longer available/),
    ).toBeInTheDocument();
    expect(screen.getByRole("group", { name: "Browse team" })).toHaveAttribute("data-team-id", "");
    expect(mocks.history).not.toHaveBeenCalled();
    change("Browse team", "team-c");
    await waitFor(() =>
      expect(screen.getByRole("group", { name: "Browse team" })).toHaveAttribute(
        "data-team-id",
        "team-c",
      ),
    );
  });

  it("never displays synthetic rows returned alongside recorded public results", async () => {
    mocks.page.mockResolvedValue({
      matches: [
        match(),
        match({ id: "hidden-demo", data_mode: "synthetic", team_a_id: "demo-team" }),
      ],
      total: 1,
    });
    renderPage();
    await screen.findByText("Page 1 of 1");
    expect(screen.getAllByRole("listitem")).toHaveLength(1);
    expect(screen.queryByText("Synthetic demo", { selector: "span" })).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Results source")).not.toBeInTheDocument();
  });

  it.each(["Escape", "Tab"])(
    "keeps the current team's attribution after an unselected search closes with %s",
    async (key) => {
      renderPage();
      await loaded();
      change("Browse team", "team-a");
      await waitFor(() =>
        expect(screen.getByRole("group", { name: "Browse team" })).toHaveAttribute(
          "data-team-id",
          "team-a",
        ),
      );
      change("Search teams", "Beta");
      fireEvent.keyDown(screen.getByLabelText("Search teams"), { key });
      expect(screen.queryByRole("listbox", { name: "Matching teams" })).not.toBeInTheDocument();
      expect(
        within(screen.getByRole("group", { name: "Browse team" })).getByText("Alpha", {
          exact: true,
        }),
      ).toBeInTheDocument();
      expect(screen.getByRole("group", { name: "Browse team" })).toHaveAttribute(
        "data-team-id",
        "team-a",
      );
      expect(screen.getByLabelText("Search teams")).toHaveValue("Beta");
    },
  );

  it("opens the white listbox and navigates distinct same-name teams with arrows and Enter", async () => {
    renderPage();
    await loaded();
    change("Search teams", "Alpha");
    const input = screen.getByLabelText("Search teams");
    expect(input).toHaveAttribute("role", "combobox");
    expect(input).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByRole("listbox", { name: "Matching teams" })).toBeInTheDocument();
    fireEvent.keyDown(input, { key: "ArrowDown" });
    expect(input).toHaveAttribute("aria-activedescendant", expect.stringMatching(/-teams-0$/));
    fireEvent.keyDown(input, { key: "ArrowUp" });
    expect(input).toHaveAttribute("aria-activedescendant", expect.stringMatching(/-teams-1$/));
    fireEvent.keyDown(input, { key: "Enter" });
    await waitFor(() =>
      expect(screen.getByRole("group", { name: "Browse team" })).toHaveAttribute(
        "data-team-id",
        "team-c",
      ),
    );
    expect(input).toHaveValue("");
    expect(input).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByRole("listbox", { name: "Matching teams" })).not.toBeInTheDocument();
  });

  it("shows candidates with trimmed case-insensitive words and selects the exact source entry", async () => {
    renderPage();
    await loaded();
    change("Search teams", "  ALPHA   u16  ");
    const suggestions = screen.getByRole("listbox", { name: "Matching teams" });
    expect(screen.getByText("2 results · Showing 1–2")).toBeInTheDocument();
    expect(within(suggestions).getAllByRole("option")).toHaveLength(2);
    fireEvent.click(within(suggestions).getByRole("option", { name: /May historical event/ }));
    await waitFor(() =>
      expect(screen.getByRole("group", { name: "Browse team" })).toHaveAttribute(
        "data-team-id",
        "team-c",
      ),
    );
    expect(screen.getByLabelText("Search teams")).toHaveValue("");
    await waitFor(() =>
      expect(mocks.history).toHaveBeenLastCalledWith({
        data: { teamId: "team-c", dataMode: "real" },
      }),
    );
  });
  it("supports Enter selection and honest feedback instead of a stale team as a search result", async () => {
    renderPage();
    await loaded();
    change("Search teams", "beta");
    fireEvent.keyDown(screen.getByLabelText("Search teams"), { key: "ArrowDown" });
    fireEvent.keyDown(screen.getByLabelText("Search teams"), { key: "Enter" });
    await waitFor(() =>
      expect(screen.getByRole("group", { name: "Browse team" })).toHaveAttribute(
        "data-team-id",
        "team-b",
      ),
    );
    change("Search teams", "not-a-recorded-team");
    const suggestions = screen.getByRole("listbox", { name: "Matching teams" });
    expect(screen.getByText(/No teams found/)).toBeInTheDocument();
    expect(within(suggestions).queryByRole("option")).not.toBeInTheDocument();
    fireEvent.keyDown(screen.getByLabelText("Search teams"), { key: "Enter" });
    expect(screen.getByRole("group", { name: "Browse team" })).toHaveAttribute(
      "data-team-id",
      "team-b",
    );
    fireEvent.keyDown(screen.getByLabelText("Search teams"), { key: "Escape" });
    expect(screen.queryByRole("listbox", { name: "Matching teams" })).not.toBeInTheDocument();
  });

  it("uses one public browsing context for team, list, statistics and event filters without association writes", async () => {
    mocks.role = "coach";
    mocks.history.mockImplementation(async ({ data }: { data: { teamId: string } }) => ({
      matches: [match({ team_a_id: data.teamId })],
      rankings: [],
    }));
    renderPage();
    await loaded();
    expect(screen.getByRole("group", { name: "Browse team" })).toHaveAttribute(
      "data-team-id",
      "team-a",
    );
    expect(screen.getByLabelText("Event")).toHaveValue("event-real");
    change("Browse team", "team-c");
    await waitFor(() =>
      expect(mocks.history).toHaveBeenLastCalledWith({
        data: { teamId: "team-c", dataMode: "real" },
      }),
    );
    await waitFor(() =>
      expect(mocks.page).toHaveBeenLastCalledWith({
        data: { ...defaultRequest, teamId: "team-c", eventId: "event-real" },
      }),
    );
    change("Browse team", "team-b");
    await waitFor(() =>
      expect(mocks.history).toHaveBeenLastCalledWith({
        data: { teamId: "team-b", dataMode: "real" },
      }),
    );
    await waitFor(() =>
      expect(mocks.page).toHaveBeenLastCalledWith({
        data: { ...defaultRequest, teamId: "team-b", eventId: "event-real" },
      }),
    );
    expect(screen.queryByLabelText("Team")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Results team")).not.toBeInTheDocument();
  });

  it("hides Demo source controls and fixtures even in development preview", async () => {
    vi.stubEnv("MODE", "development");
    renderPage();
    await loaded();
    expect(screen.queryByLabelText("Results source")).not.toBeInTheDocument();
    expect(
      screen.queryByRole("option", { name: /Local synthetic preview/ }),
    ).not.toBeInTheDocument();
    change("Search teams", "Demonstration");
    expect(screen.getByText(/No teams found/)).toBeInTheDocument();
    expect(mocks.filters).toHaveBeenCalledWith({ data: { dataMode: "real" } });
  });

  it("defaults to real historical results and shows complete independent names, source and source date", async () => {
    renderPage();
    await loaded();
    expect(mocks.page).toHaveBeenCalledWith({ data: defaultRequest });
    expect(screen.getByLabelText("Period")).toHaveValue("history");
    expect(screen.queryByLabelText("Results source")).not.toBeInTheDocument();
    const result = within(screen.getByRole("listitem"));
    expect(result.getByText("Alpha", { selector: "span" })).toBeInTheDocument();
    expect(result.getByText("Beta", { selector: "span" })).toBeInTheDocument();
    expect(result.getByText("Final")).toBeInTheDocument();
    expect(result.getByText("2–1")).toBeInTheDocument();
    expect(screen.getByText("7 recorded results")).toBeInTheDocument();
    expect(result.getByText(/March historical event · .*Mar 15, 2026/)).toBeInTheDocument();
    expect(result.getAllByText(/Mar 15, 2026/)).toHaveLength(1);
    expect(screen.getByText("Real source", { selector: "span" })).toBeInTheDocument();
    expect(screen.queryByRole("listbox", { name: "Matching teams" })).not.toBeInTheDocument();
    expect(screen.getByLabelText("Previous results page")).toBeDisabled();
    expect(screen.queryByRole("region", { name: "Team statistics" })).not.toBeInTheDocument();
    expect(screen.getByRole("group", { name: "Browse team" })).toHaveAttribute("data-team-id", "");
    expect(mocks.history).not.toHaveBeenCalled();
  });

  it("renders final rows with source labels and explicit unknown teams, scores, event and date", async () => {
    mocks.page.mockResolvedValue({
      matches: [
        match(),
        match({
          id: "missing-final",
          team_a_id: "unknown-team",
          team_b_id: null,
          event_id: "unknown-event",
          score_a: null,
          score_b: null,
          source_date: null,
          data_mode: "real",
        }),
      ],
      total: 2,
    });
    renderPage();
    await screen.findByText("Page 1 of 1");
    const rows = screen.getAllByRole("listitem");
    const recorded = within(rows[0]!);
    expect(recorded.getByText("Real source")).toBeInTheDocument();
    expect(recorded.getByText("Final")).toBeInTheDocument();
    expect(recorded.getByText("Alpha")).toBeInTheDocument();
    expect(recorded.getByText("Beta")).toBeInTheDocument();
    expect(recorded.getByText("2–1")).toBeInTheDocument();
    expect(recorded.getByText("2–1")).not.toHaveAttribute("style");
    expect(recorded.getByRole("img", { name: "Score split 2 to 1" })).toBeInTheDocument();
    expect(recorded.getAllByText(/Mar 15, 2026/)).toHaveLength(1);
    const unknown = within(rows[1]!);
    expect(unknown.getByText("Real source")).toBeInTheDocument();
    expect(unknown.getAllByText("Team to be determined")).toHaveLength(2);
    expect(unknown.getByText("To be determined")).toBeInTheDocument();
    expect(unknown.getByText("To be determined").parentElement).toHaveStyle({
      fontSize: "1rem",
      maxWidth: "6rem",
      overflowWrap: "anywhere",
      whiteSpace: "normal",
    });
    expect(unknown.getByText("Event to be determined · Date to be determined")).toBeInTheDocument();
    expect(unknown.queryByRole("img", { name: /Score split/ })).not.toBeInTheDocument();
    expect(rows[1]).not.toHaveTextContent(/unknown-team|unknown-event|null|undefined/);
  });

  it("preserves scheduled row time formatting and honest missing-time fallbacks", async () => {
    mocks.page.mockResolvedValue({
      matches: [
        match({ id: "scheduled-known", status: "scheduled", starts_at: "2026-03-15T18:00:00Z" }),
        match({ id: "scheduled-time-unknown", status: "scheduled", data_mode: "real" }),
        match({ id: "scheduled-date-unknown", status: "scheduled", source_date: null }),
      ],
      total: 3,
    });
    renderPage();
    await screen.findByText("Page 1 of 1");
    const rows = screen.getAllByRole("listitem");
    const scheduled = within(rows[0]!);
    expect(scheduled.getByText("Scheduled")).toBeInTheDocument();
    expect(scheduled.getByText("Real source")).toBeInTheDocument();
    expect(scheduled.getByText(/Mar 15.*2:00/)).toBeInTheDocument();
    expect(scheduled.queryByText("2–1")).not.toBeInTheDocument();
    expect(within(rows[1]!).getByText(/time to be determined/)).toBeInTheDocument();
    expect(within(rows[1]!).getByText("Real source")).toBeInTheDocument();
    expect(within(rows[2]!).getByText("Date to be determined")).toBeInTheDocument();
  });

  it("keeps same-name source IDs distinct while searching team, event and division labels", async () => {
    renderPage();
    await loaded();
    change("Search teams", "Alpha");
    const teams = within(screen.getByRole("listbox", { name: "Matching teams" }));
    expect(teams.getByRole("option", { name: /Alpha.*March historical/ })).toBeInTheDocument();
    expect(teams.getByRole("option", { name: /Alpha.*May historical/ })).toBeInTheDocument();
    change("Search teams", "May historical");
    expect(teams.queryByRole("option", { name: /March historical/ })).not.toBeInTheDocument();
    change("Browse team", "team-c");
    await waitFor(() =>
      expect(mocks.page).toHaveBeenLastCalledWith({
        data: { ...defaultRequest, teamId: "team-c" },
      }),
    );
    change("Event", "event-later");
    await waitFor(() =>
      expect(mocks.page).toHaveBeenLastCalledWith({
        data: { ...defaultRequest, eventId: "event-later", teamId: "team-c" },
      }),
    );
    expect(screen.getByRole("group", { name: "Browse team" })).toHaveAttribute(
      "data-team-id",
      "team-c",
    );
    expect(teams.queryByRole("option", { name: /Synthetic demo/ })).not.toBeInTheDocument();
  });

  it("uses complete filter keys and resets every changed public filter to page one", async () => {
    const client = renderPage(true);
    await loaded();
    const steps = [
      ["Period", "recent", { period: "recent" }],
      ["Event", "event-real", { eventId: "event-real" }],
      ["Browse team", "team-b", { teamId: "team-b" }],
      ["From date", "2026-03-01", { dateFrom: "2026-03-01" }],
      ["To date", "2026-05-31", { dateTo: "2026-05-31" }],
    ] as const;
    let expected = { ...defaultRequest };
    for (const [label, value, patch] of steps) {
      fireEvent.click(screen.getByLabelText("Next results page"));
      await screen.findByText("Page 2 of 2");
      expect(screen.getByLabelText("Next results page")).toBeDisabled();
      change(label, value);
      expected = { ...expected, ...patch };
      await screen.findByText("Page 1 of 2");
      expect(mocks.page).toHaveBeenLastCalledWith({ data: expected });
    }
    expect(
      client
        .getQueryCache()
        .getAll()
        .filter((query) => query.queryKey[0] === "results-page").length,
    ).toBeGreaterThan(5);
  });

  it("retains real browsing when a household is attached only to a synthetic team", async () => {
    mocks.role = "coach";
    const original = [...metadata.teams];
    // This existing household ID remains unchanged, but is not public real metadata.
    metadata.teams[0] = { ...metadata.teams[0]!, data_mode: "synthetic" };
    metadata.teams[1] = { ...metadata.teams[1]!, data_mode: "synthetic" };
    try {
      renderPage();
      await loaded();
      expect(screen.getByRole("group", { name: "Browse team" })).toHaveAttribute(
        "data-team-id",
        "",
      );
      expect(screen.queryByRole("region", { name: "Team statistics" })).not.toBeInTheDocument();
      change("Browse team", "team-c");
      await waitFor(() =>
        expect(screen.getByRole("group", { name: "Browse team" })).toHaveAttribute(
          "data-team-id",
          "team-c",
        ),
      );
    } finally {
      metadata.teams.splice(0, metadata.teams.length, ...original);
    }
  });

  it("shows an honest empty real selection without switching to demo", async () => {
    mocks.page.mockResolvedValue({ matches: [], total: 0 });
    renderPage();
    expect(
      await screen.findByText(/No recorded real results match this selection/),
    ).toBeInTheDocument();
    expect(screen.queryByLabelText("Results source")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Next results page")).not.toBeInTheDocument();
  });

  it("rejects reversed date ranges locally and recovers with a valid inclusive range", async () => {
    renderPage();
    await loaded();
    change("From date", "2026-05-31");
    await waitFor(() =>
      expect(mocks.page).toHaveBeenLastCalledWith({
        data: { ...defaultRequest, dateFrom: "2026-05-31" },
      }),
    );
    const before = mocks.page.mock.calls.length;
    change("To date", "2026-03-01");
    expect(screen.getByRole("alert")).toHaveTextContent("From date must be on or before To date.");
    expect(mocks.page).toHaveBeenCalledTimes(before);
    expect(screen.queryByLabelText("Next results page")).not.toBeInTheDocument();
    change("To date", "2026-05-31");
    await loaded();
    expect(mocks.page).toHaveBeenLastCalledWith({
      data: { ...defaultRequest, dateFrom: "2026-05-31", dateTo: "2026-05-31" },
    });
  });

  it("surfaces result errors and retries without presenting them as empty history", async () => {
    mocks.page.mockRejectedValueOnce(new Error("source unavailable"));
    renderPage();
    expect(await screen.findByRole("alert")).toHaveTextContent("Could not load results.");
    expect(screen.queryByText(/No recorded/)).not.toBeInTheDocument();
    fireEvent.click(
      within(screen.getByRole("region", { name: "All results" })).getByRole("button", {
        name: "Try again",
      }),
    );
    await loaded();
    expect(mocks.page).toHaveBeenCalledTimes(2);
  });

  it("withholds result cards when complete metadata cannot load and retries it", async () => {
    mocks.filters.mockRejectedValue(new Error("metadata unavailable"));
    renderPage();
    expect(
      await within(screen.getByRole("region", { name: "All results" })).findByRole("alert"),
    ).toHaveTextContent("Could not load result filters and names.");
    expect(screen.queryByText(/March historical event/, { selector: "p" })).not.toBeInTheDocument();
    expect(screen.getByLabelText("Event")).toBeDisabled();
    mocks.filters.mockResolvedValue(metadata);
    fireEvent.click(
      within(screen.getByRole("region", { name: "All results" })).getByRole("button", {
        name: "Try again",
      }),
    );
    await loaded();
    expect(screen.getByText(/March historical event/, { selector: "p" })).toBeInTheDocument();
  });

  it("applies the same selected range to history, statistics and trends and excludes unconfirmed placements and cross-source rows", async () => {
    mocks.role = "coach";
    mocks.history.mockImplementation(async ({ data }: { data: { teamId: string } }) => ({
      matches: [
        match({ id: "real", team_a_id: data.teamId }),
        match({
          id: "other-mode",
          team_a_id: data.teamId,
          data_mode: "synthetic",
          score_a: 0,
          score_b: 2,
        }),
        match({
          id: "other-event",
          team_a_id: data.teamId,
          event_id: "event-later",
          source_date: "2026-05-15",
          score_a: 0,
          score_b: 2,
        }),
      ],
      rankings: [
        {
          id: "unconfirmed",
          team_id: data.teamId,
          event_id: "event-later",
          rank: 1,
          field_size: 9,
          data_mode: "real",
          final_confirmed: false,
        },
      ],
    }));
    renderPage();
    await loaded();
    expect(screen.getByLabelText("Event")).toHaveValue("event-later");
    const section = within(screen.getByRole("region", { name: "Team statistics" }));
    await section.findByRole("table");
    expect(section.getAllByRole("row")).toHaveLength(2);
    expect(section.getByText("Lost")).toBeInTheDocument();
    change("Event", "event-real");
    await waitFor(() => expect(section.getByText("Won")).toBeInTheDocument());
    change("From date", "2026-04-01");
    expect(
      await section.findByText("No recorded matches for this team in the selected range."),
    ).toBeInTheDocument();
    fireEvent.click(section.getByRole("button", { name: "View results trend" }));
    fireEvent.click(section.getByRole("button", { name: "Daily cumulative" }));
    expect(section.getByText(/No dated, decided results/)).toBeInTheDocument();
    expect(section.getByText(/No confirmed final placements/)).toBeInTheDocument();
    expect(section.queryByRole("img", { name: /Cumulative/ })).not.toBeInTheDocument();
  });

  it("does not display zero statistics or empty placements when family history is incomplete", async () => {
    mocks.role = "coach";
    mocks.history.mockRejectedValue(new Error("history unavailable"));
    renderPage();
    await loaded();
    const household = within(screen.getByRole("region", { name: "Team statistics" }));
    expect(await household.findByRole("alert")).toHaveTextContent(
      "Could not load complete team history",
    );
    expect(household.queryByText("Wins")).not.toBeInTheDocument();
    expect(
      household.queryByText("No recorded matches for this team in the selected range."),
    ).not.toBeInTheDocument();
    fireEvent.click(household.getByRole("button", { name: "View results trend" }));
    expect(household.getByText(/Complete team history is unavailable/)).toBeInTheDocument();
    expect(household.queryByText(/No confirmed final placements/)).not.toBeInTheDocument();
  });
  it("does not replace a manually selected team or filters when household data arrives later", async () => {
    mocks.role = "coach";
    mocks.householdLoaded = false;
    renderPage();
    await loaded();
    expect(screen.getByRole("group", { name: "Browse team" })).toHaveAttribute("data-team-id", "");
    change("Browse team", "team-c");
    change("Event", "event-later");
    change("From date", "2026-05-01");
    mocks.householdLoaded = true;
    rerenderPage();
    expect(screen.getByRole("group", { name: "Browse team" })).toHaveAttribute(
      "data-team-id",
      "team-c",
    );
    expect(screen.getByLabelText("Event")).toHaveValue("event-later");
    expect(screen.getByLabelText("From date")).toHaveValue("2026-05-01");
    await waitFor(() =>
      expect(mocks.page).toHaveBeenLastCalledWith({
        data: {
          ...defaultRequest,
          teamId: "team-c",
          eventId: "event-later",
          dateFrom: "2026-05-01",
        },
      }),
    );
  });
  it("uses the exact match/set denominators and resets the range cumulative curve after date filtering", async () => {
    const scores = [
      ["2026-04-19", 0, 2],
      ["2026-04-19", 2, 0],
      ["2026-04-19", 2, 0],
      ["2026-04-20", 2, 1],
      ["2026-04-20", 0, 2],
      ["2026-04-20", 0, 2],
      ["2026-04-21", 2, 0],
      ["2026-04-21", 1, 2],
      ["2026-04-21", 2, 0],
    ] as const;
    mocks.history.mockResolvedValue({
      matches: scores.map(([date, a, b], index) =>
        match({ id: String(index), source_date: date, score_a: a, score_b: b }),
      ),
      rankings: [],
    });
    renderPage();
    await loaded();
    change("Browse team", "team-a");
    const section = within(await screen.findByRole("region", { name: "Team statistics" }));
    await section.findByText("5");
    fireEvent.click(section.getByRole("button", { name: "View results trend" }));
    expect(
      section.getByRole("img", { name: /Cumulative match win rate by displayed record:/ }),
    ).toBeInTheDocument();
    fireEvent.click(section.getByRole("button", { name: "Daily cumulative" }));
    expect(
      section.getByRole("img", {
        name: "Cumulative match win rate in selected range: 67%, 50%, 56%",
      }),
    ).toBeInTheDocument();
    change("Win rate metric", "set");
    expect(section.getByText("11")).toBeInTheDocument();
    expect(section.getByText("9")).toBeInTheDocument();
    expect(
      section.getByRole("img", {
        name: "Cumulative set win rate in selected range: 67%, 46%, 55%",
      }),
    ).toBeInTheDocument();
    change("From date", "2026-04-20");
    change("To date", "2026-04-21");
    change("Win rate metric", "match");
    expect(
      section.getByRole("img", { name: "Cumulative match win rate in selected range: 33%, 50%" }),
    ).toBeInTheDocument();
    expect(section.getAllByRole("row")).toHaveLength(7);
    await waitFor(() =>
      expect(mocks.page).toHaveBeenLastCalledWith({
        data: {
          ...defaultRequest,
          teamId: "team-a",
          eventId: "event-real",
          dateFrom: "2026-04-20",
          dateTo: "2026-04-21",
        },
      }),
    );
  });
  it("expands recorded per-set point scores and clearly explains missing set details", async () => {
    mocks.page.mockResolvedValue({
      matches: [
        match({
          sets: [
            { a: 25, b: 20 },
            { a: 18, b: 25 },
            { a: 15, b: 12 },
          ],
        }),
        match({ id: "aggregate-only" }),
      ],
      total: 2,
    });
    renderPage();
    await screen.findByText("Page 1 of 1");
    const rows = screen.getAllByRole("listitem");
    fireEvent.click(within(rows[0]!).getByText("Set details"));
    expect(within(rows[0]!).getByRole("table")).toHaveTextContent("25");
    expect(within(rows[0]!).getByRole("table")).toHaveTextContent("15");
    fireEvent.click(within(rows[1]!).getByText("Set details"));
    expect(within(rows[1]!).getByText(/Per-set point scores are not recorded/)).toBeInTheDocument();
  });

  it("freezes public pagination against late household team/event defaults", async () => {
    sessionStorage.clear();
    mocks.contextSearch = {};
    mocks.family = false;
    mocks.role = "general_user";
    mocks.householdLoaded = false;
    mocks.page.mockImplementation(
      async ({ data }: { data: { page: number; teamId?: string } }) => ({
        matches: data.teamId
          ? data.page > 1
            ? []
            : [match()]
          : Array.from({ length: data.page === 1 ? 6 : 1 }, (_, i) =>
              match({ id: `public-${data.page}-${i}` }),
            ),
        total: data.teamId ? 1 : 7,
      }),
    );
    renderPage();
    await loaded();
    fireEvent.click(screen.getByRole("button", { name: "Next results page" }));
    await screen.findByText("Page 2 of 2");
    mocks.role = "coach";
    mocks.householdLoaded = true;
    rerenderPage();
    await waitFor(() =>
      expect(screen.getByRole("group", { name: "Browse team" })).toHaveAttribute(
        "data-team-id",
        "",
      ),
    );
    expect(screen.getByLabelText("Event")).toHaveValue("");
    expect(mocks.history).not.toHaveBeenCalled();
    expect(mocks.page).toHaveBeenLastCalledWith({ data: { ...defaultRequest, page: 2 } });
    const marker = screen.getByText("Page 2 of 2");
    const [, current, total] = marker.textContent!.match(/Page (\d+) of (\d+)/)!;
    expect(Number(current)).toBeLessThanOrEqual(Number(total));
  });
});

it("the Homepage data dropdown cannot switch historical queries to Demo", async () => {
  renderPage();
  await loaded();
  change("Homepage data", "synthetic");
  expect(mocks.homeMode).toHaveBeenCalledWith("synthetic");
  expect(screen.getByText(/Changes the homepage only/)).toBeInTheDocument();
  expect(mocks.page.mock.calls.every(([request]) => request.data.dataMode === "real")).toBe(true);
  expect(mocks.filters.mock.calls.every(([request]) => request.data.dataMode === "real")).toBe(
    true,
  );
});
