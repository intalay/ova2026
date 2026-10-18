import { type AnchorHTMLAttributes, type ComponentType, type ReactNode } from "react";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { parentHousehold } from "./parent-context.fixture";
import type { Household, Match } from "@/lib/queries";
import type { BrowseSearch } from "@/lib/parent-context";

const mocks = vi.hoisted(() => ({
  user: null as { id: string } | null,
  role: "general_user" as string,
  household: undefined as Household | undefined,
  search: {} as Record<string, unknown>,
  navigate: vi.fn(),
  mutate: vi.fn(),
}));
vi.mock("@tanstack/react-router", () => ({
  createFileRoute: () => (options: unknown) => ({ options }),
  useSearch: () => mocks.search,
  useNavigate: () => mocks.navigate,
  Link: ({
    to,
    params,
    search,
    children,
    ...rest
  }: AnchorHTMLAttributes<HTMLAnchorElement> & {
    to: string;
    params?: { id: string };
    search?: BrowseSearch;
  }) => (
    <a {...rest} href={to.replace("$id", params?.id ?? "")} data-search={JSON.stringify(search)}>
      {children}
    </a>
  ),
}));
vi.mock("@/hooks/use-role", () => ({
  useRole: () => ({
    user: mocks.user,
    role: mocks.role,
    ready: true,
    household: { data: mocks.household, isPending: false, isError: false },
  }),
}));
vi.mock("@/components/AppShell", () => ({
  AppShell: ({ children }: { children: ReactNode }) => <main>{children}</main>,
  Section: ({ title, children }: { title: string; children: ReactNode }) => (
    <section aria-label={title}>{children}</section>
  ),
  Card: ({ children, className = "" }: { children: ReactNode; className?: string }) => (
    <div className={`app-card ${className}`}>{children}</div>
  ),
  Tbd: ({ children }: { children: ReactNode }) => <span>{children}</span>,
  btn: { primary: "selected-original-button", secondary: "unselected-original-button" },
}));
vi.mock("@/lib/queries", () => ({
  competitionQuery: {
    queryKey: ["competition"],
    queryFn: async () => {
      throw new Error("Seed the local test cache");
    },
  },
}));
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: (...args: unknown[]) => {
      mocks.mutate(...args);
      throw new Error("No real service access in UI fixtures");
    },
  },
}));
import { Route } from "@/routes/schedule";
import { MatchCard } from "@/components/MatchCard";
const Schedule = Route.options.component as ComponentType;
const clients: QueryClient[] = [];
const scheduled = (patch: Partial<Match> = {}): Match => ({
  id: "published-match",
  event_id: "event",
  division_id: "division",
  team_a_id: "team-b",
  team_b_id: "opponent",
  venue_id: "venue",
  source_date: "2026-10-19",
  starts_at: "2026-10-19T15:00:00Z",
  court: "Court 2",
  status: "scheduled",
  score_a: null,
  score_b: null,
  sets: null,
  data_mode: "real",
  ...patch,
});
function mount(matches: Match[]) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: Infinity } },
  });
  clients.push(client);
  client.setQueryData(["competition"], {
    teams: [
      { id: "team-a", name: "Alpha", data_mode: "real" },
      { id: "team-b", name: "Beta", data_mode: "real" },
      { id: "opponent", name: "Opponents", data_mode: "real" },
      { id: "demo-team", name: "Demo club", data_mode: "synthetic" },
    ],
    divisions: [{ id: "division", name: "U16", data_mode: "real" }],
    events: [{ id: "event", name: "Recorded tournament", data_mode: "real" }],
    venues: [{ id: "venue", name: "Recorded venue", data_mode: "real" }],
    matches,
    rankings: [],
    announcements: [],
  });
  return render(
    <QueryClientProvider client={client}>
      <Schedule />
    </QueryClientProvider>,
  );
}
beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-10-18T04:00:00Z"));
  mocks.user = null;
  mocks.role = "general_user";
  mocks.household = undefined;
  mocks.search = {};
  vi.clearAllMocks();
  sessionStorage.clear();
  localStorage.removeItem("ova-guest-stars");
});
afterEach(() => {
  cleanup();
  clients.splice(0).forEach((client) => client.clear());
  vi.useRealTimers();
});

it("keeps the calendar, month navigation and original pending-card styling when all stored real matches are historical", () => {
  const view = mount([
    scheduled({
      id: "historical",
      status: "final",
      source_date: "2026-04-19",
      starts_at: null,
      score_a: 2,
      score_b: 0,
    }),
  ]);
  expect(screen.getByRole("button", { name: "All matches" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  expect(screen.getByRole("button", { name: "All matches" })).toHaveClass(
    "selected-original-button",
  );
  expect(screen.getByRole("button", { name: "Next month" })).toBeEnabled();
  expect(screen.getByText("October 2026")).toBeInTheDocument();
  expect(screen.getByText(/All times are in Toronto/)).toBeInTheDocument();
  expect(screen.queryByText("Recorded tournament")).not.toBeInTheDocument();
  expect(view.container.querySelector(".glass-list .match-pending")).toHaveTextContent(
    "No matches published for this selection.",
  );
  expect(screen.getByRole("link", { name: "View recorded results" })).toHaveAttribute(
    "href",
    "/results",
  );
  fireEvent.click(screen.getByRole("button", { name: "Next month" }));
  expect(screen.getByText("November 2026")).toBeInTheDocument();
});

it("keeps Demo out of cards, date counts and starred selectors without adding a fake future fixture", () => {
  mount([scheduled({ id: "demo", data_mode: "synthetic", team_a_id: "demo-team" })]);
  expect(screen.getByRole("button", { name: "2026-10-19: no matches" })).toBeDisabled();
  expect(screen.queryByText("Recorded tournament")).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Choose teams & divisions" }));
  expect(screen.getByRole("group", { name: "Starred teams and divisions" })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: /^Beta / })).toBeInTheDocument();
  expect(screen.queryByRole("button", { name: /^Demo club / })).not.toBeInTheDocument();
  expect(mocks.mutate).not.toHaveBeenCalled();
});

it("restores real date counts and preserves actual event, time, court and venue link cards", () => {
  const view = mount([scheduled(), scheduled({ id: "second", starts_at: "2026-10-19T18:00:00Z" })]);
  const date = screen.getByRole("button", { name: "2026-10-19: 2 matches" });
  expect(date).toBeEnabled();
  expect(within(date).getByText("2")).toBeInTheDocument();
  expect(screen.getAllByText("Recorded tournament")).toHaveLength(2);
  expect(view.container.querySelectorAll(".glass-list .app-card.match-pending")).toHaveLength(0);
  expect(screen.getAllByText(/Beta/)).toHaveLength(2);
  expect(screen.getAllByRole("link", { name: "Recorded venue · Court 2" })[0]).toHaveAttribute(
    "href",
    "/venue/venue",
  );
  fireEvent.click(date);
  expect(screen.getByRole("region", { name: "Matches on 2026-10-19" })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Show all dates" })).toBeInTheDocument();
});

it("keeps Toronto midnight date placement and explicit time/venue TBD", () => {
  mount([
    scheduled({ id: "previous-local-date", starts_at: "2026-10-20T02:00:00Z" }),
    scheduled({ id: "unknown", starts_at: null, venue_id: null, court: null }),
  ]);
  expect(screen.getByRole("button", { name: "2026-10-19: 2 matches" })).toBeEnabled();
  expect(screen.getByRole("button", { name: "2026-10-20: no matches" })).toBeDisabled();
  expect(screen.getByText(/time TBD/)).toBeInTheDocument();
  expect(screen.getByText("Venue TBD")).toBeInTheDocument();
});

it("keeps a complete MatchCard outside Schedule on its original default appearance", () => {
  const view = render(
    <MatchCard
      m={scheduled()}
      data={{
        teams: [
          { id: "team-b", name: "Beta" },
          { id: "opponent", name: "Opponents" },
        ],
        events: [{ id: "event", name: "Recorded tournament" }],
        venues: [{ id: "venue", name: "Recorded venue" }],
      }}
    />,
  );
  expect(view.container.querySelector(".app-card")).not.toHaveClass("match-pending");
  expect(screen.getByRole("link", { name: "Recorded venue · Court 2" })).toHaveAttribute(
    "href",
    "/venue/venue",
  );
});

it("preserves the second approved child and requires explicit All matches to browse another team's published match", async () => {
  mocks.user = { id: "parent" };
  mocks.role = "family_friends";
  mocks.household = parentHousehold();
  mocks.search = { player: "child-b", team: "team-b" };
  mount([scheduled({ team_a_id: "team-a" })]);
  await waitFor(() =>
    expect(screen.getByRole("button", { name: "Current team" })).toHaveAttribute(
      "aria-pressed",
      "true",
    ),
  );
  expect(screen.getByText(/Linked player: Blair/)).toBeInTheDocument();
  expect(screen.queryByText("Recorded tournament")).not.toBeInTheDocument();
  expect(screen.getByRole("link", { name: "View recorded results" })).toHaveAttribute(
    "data-search",
    JSON.stringify({ player: "child-b", team: "team-b" }),
  );
  fireEvent.click(screen.getByRole("button", { name: "Browse all matches" }));
  expect(screen.getByText("Recorded tournament")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Current team" })).toHaveClass(
    "unselected-original-button",
  );
  expect(screen.getByRole("button", { name: "All matches" })).toHaveClass(
    "selected-original-button",
  );
  expect(mocks.search).toEqual({ player: "child-b", team: "team-b" });
});

it("does not silently switch an invalid child/team to another child", async () => {
  mocks.user = { id: "parent" };
  mocks.role = "family_friends";
  mocks.household = parentHousehold();
  mocks.search = { player: "child-b", team: "team-a" };
  mount([scheduled({ team_a_id: "team-a" })]);
  await screen.findByText("Choose an approved player or team to view their schedule.");
  expect(screen.queryByText("Recorded tournament")).not.toBeInTheDocument();
  expect(screen.queryByText(/Linked player:/)).not.toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Browse all matches" })).not.toBeInTheDocument();
  expect(mocks.mutate).not.toHaveBeenCalled();
});

it.each([{ team_b_id: null }, { venue_id: null }, { starts_at: null }])(
  "uses original dark pending style only when a required schedule detail is missing: %o",
  (missing) => {
    const view = mount([scheduled(), scheduled({ id: "pending-detail", ...missing })]);
    const cards = view.container.querySelectorAll(".glass-list .app-card");
    expect(cards).toHaveLength(2);
    expect(cards[0]).not.toHaveClass("match-pending");
    expect(cards[1]).toHaveClass("match-pending");
  },
);
