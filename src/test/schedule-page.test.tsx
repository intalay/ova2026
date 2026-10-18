import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { parentHousehold } from "./parent-context.fixture";
import type { ComponentType, ReactNode } from "react";
import { afterEach, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  follows: [] as { target_type: string; target_id: string }[],
  family: false,
  search: {} as Record<string, unknown>,
}));
vi.mock("@tanstack/react-router", () => ({
  useSearch: () => mocks.search,
  useNavigate: () => vi.fn(),
  Link: ({ children }: { children: ReactNode }) => <a>{children}</a>,
  createFileRoute: () => (options: { component: ComponentType }) => ({ options }),
}));
vi.mock("@/components/AppShell", () => ({
  AppShell: ({ children }: { children: ReactNode }) => <main>{children}</main>,
  Section: ({ title, children }: { title: string; children: ReactNode }) => (
    <section aria-label={title}>{children}</section>
  ),
  Card: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  btn: { primary: "", secondary: "" },
}));
vi.mock("@/components/MatchCard", () => ({
  MatchCard: ({ m }: { m: { id: string } }) => <div data-testid="match">{m.id}</div>,
}));
vi.mock("@/hooks/use-role", async () => {
  const { useQuery } = await import("@tanstack/react-query");
  return {
    useRole: () => ({
      user: { id: mocks.family ? "parent" : "test-user" },
      role: mocks.family ? "family_friends" : "general_user",
      ready: true,
      household: useQuery({
        queryKey: ["household"],
        queryFn: async () => ({ ...parentHousehold(), follows: [...mocks.follows] }),
      }),
    }),
  };
});
vi.mock("@/lib/queries", () => ({
  competitionQuery: {
    queryKey: ["competition"],
    queryFn: async () => {
      throw new Error("Competition must be seeded in the test cache");
    },
  },
  myHouseholdQuery: () => ({
    queryKey: ["household"],
    queryFn: async () => ({ follows: [...mocks.follows] }),
  }),
}));
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: () => ({
      insert: async (row: { target_type: string; target_id: string }) => {
        mocks.follows.push(row);
        return {};
      },
    }),
  },
}));
import { Route } from "@/routes/schedule";
const Schedule = Route.options.component as ComponentType;
afterEach(() => {
  cleanup();
  mocks.follows = [];
  mocks.family = false;
  mocks.search = {};
  sessionStorage.clear();
});

it("filters both upcoming matches and calendar dates by either starred team or division and clears the selected day", async () => {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: Infinity } },
  });
  const now = new Date();
  const prefix = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  client.setQueryData(["competition"], {
    teams: [
      { id: "a", name: "Alpha" },
      { id: "b", name: "Beta" },
    ],
    divisions: [{ id: "d", name: "U16" }],
    matches: [
      {
        id: "team-match",
        status: "scheduled",
        team_a_id: "a",
        team_b_id: "c",
        division_id: "other",
        starts_at: null,
        source_date: `${prefix}-10`,
      },
      {
        id: "division-match",
        status: "scheduled",
        team_a_id: "b",
        team_b_id: "c",
        division_id: "d",
        starts_at: null,
        source_date: `${prefix}-11`,
      },
    ],
  });
  client.setQueryData(["household"], { ...parentHousehold(), follows: [] });
  render(
    <QueryClientProvider client={client}>
      <Schedule />
    </QueryClientProvider>,
  );
  fireEvent.click(screen.getByRole("button", { name: "Starred Team" }));
  expect(screen.queryAllByTestId("match")).toHaveLength(0);
  fireEvent.click(screen.getByRole("button", { name: /^Alpha / }));
  await waitFor(() =>
    expect(screen.getAllByTestId("match").map((x) => x.textContent)).toEqual(["team-match"]),
  );
  expect(screen.getByRole("button", { name: `${prefix}-11: no matches` })).toBeDisabled();
  fireEvent.click(screen.getByRole("button", { name: `${prefix}-10: 1 match` }));
  fireEvent.click(screen.getByRole("button", { name: "Divisions" }));
  fireEvent.click(screen.getByRole("button", { name: /^U16 / }));
  await waitFor(() =>
    expect(screen.getAllByTestId("match").map((x) => x.textContent)).toEqual([
      "team-match",
      "division-match",
    ]),
  );
  expect(screen.getByRole("button", { name: `${prefix}-11: 1 match` })).toBeEnabled();
  fireEvent.click(screen.getByRole("button", { name: "All matches" }));
  expect(
    screen.queryByRole("group", { name: "Starred teams and divisions" }),
  ).not.toBeInTheDocument();
  client.clear();
});

it("defaults the real Schedule page to the approved second child's team and permits public All matches", async () => {
  mocks.family = true;
  mocks.search = { player: "child-b", team: "team-b" };
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: Infinity } },
  });
  const date = new Date();
  const day = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-12`;
  client.setQueryData(["competition"], {
    teams: [
      { id: "team-a", name: "Alpha", data_mode: "real" },
      { id: "team-b", name: "Beta", data_mode: "real" },
    ],
    divisions: [],
    matches: [
      {
        id: "first-child",
        status: "scheduled",
        team_a_id: "team-a",
        data_mode: "real",
        starts_at: null,
        source_date: day,
      },
      {
        id: "second-child",
        status: "scheduled",
        team_a_id: "team-b",
        data_mode: "real",
        starts_at: null,
        source_date: day,
      },
      {
        id: "demo",
        status: "scheduled",
        team_a_id: "team-b",
        data_mode: "synthetic",
        starts_at: null,
        source_date: day,
      },
    ],
  });
  client.setQueryData(["household"], parentHousehold());
  render(
    <QueryClientProvider client={client}>
      <Schedule />
    </QueryClientProvider>,
  );
  await waitFor(() =>
    expect(screen.getAllByTestId("match").map((row) => row.textContent)).toEqual(["second-child"]),
  );
  expect(screen.getByRole("button", { name: "Current team" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  expect(screen.getByText(/Linked player: Blair/)).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "All matches" }));
  expect(screen.getAllByTestId("match").map((row) => row.textContent)).toEqual([
    "first-child",
    "second-child",
  ]);
  client.clear();
});
