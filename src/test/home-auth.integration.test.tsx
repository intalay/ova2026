import type { ComponentType, ReactNode } from "react";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  event: undefined as unknown as (event: string, session: unknown) => void,
  offline: false,
}));
vi.mock("@tanstack/react-router", () => ({
  createFileRoute: () => (options: { component: ComponentType }) => ({ options }),
  useSearch: () => ({}),
  useNavigate: () => vi.fn(),
  Link: ({ children }: { children: ReactNode }) => <a>{children}</a>,
}));
vi.mock("@/components/AppShell", () => ({
  AppShell: ({ children }: { children: ReactNode }) => <main>{children}</main>,
  Section: ({ children }: { children: ReactNode }) => <section>{children}</section>,
  MoreLink: ({ children }: { children: ReactNode }) => <a>{children}</a>,
  Card: ({ children }: { children: ReactNode }) => <article>{children}</article>,
  btn: { input: "" },
}));
vi.mock("@/components/ui/dialog", () => ({
  Dialog: () => null,
  DialogContent: () => null,
  DialogTitle: () => null,
  DialogDescription: () => null,
}));
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth: {
      getUser: async () => ({ data: { user: { id: "account-A" } }, error: null }),
      onAuthStateChange: (callback: typeof mocks.event) => {
        mocks.event = callback;
        return { data: { subscription: { unsubscribe: () => {} } } };
      },
    },
    from: (table: string) => {
      const tests: ((row: Record<string, unknown>) => boolean)[] = [];
      let signal: AbortSignal;
      let single = false;
      const rows: Record<string, unknown>[] =
        table === "managed_teams"
          ? [
              { user_id: "account-A", team_id: "A" },
              { user_id: "account-B", team_id: "B" },
            ]
          : table === "announcements"
            ? ["A", "B"].map((team) => ({
                id: `private-${team}`,
                title: `Team ${team} secret`,
                body: `PRIVATE TEAM ${team}`,
                author_id: `account-${team}`,
                team_id: team,
                status: "published",
                pinned_at: null,
                published_at: new Date().toISOString(),
                expires_at: null,
                media_urls: [
                  { path: `${team}/photo`, name: `Private ${team} photo`, type: "image/png" },
                ],
              }))
            : [];
      const chain = {
        select: () => chain,
        order: () => chain,
        range: () => chain,
        eq: (field: string, value: unknown) => {
          tests.push((row) => row[field] === value);
          return chain;
        },
        not: (field: string, _operator: string, value: unknown) => {
          tests.push((row) => row[field] !== value);
          return chain;
        },
        abortSignal: (value: AbortSignal) => {
          signal = value;
          return chain;
        },
        maybeSingle: () => {
          single = true;
          return chain;
        },
        then: (resolve: (value: unknown) => unknown, reject: (reason: unknown) => unknown) =>
          Promise.resolve()
            .then(() => {
              signal?.throwIfAborted();
              if (mocks.offline) throw new Error("Fixture offline");
              const data = rows.filter((row) => tests.every((test) => test(row)));
              return { data: single ? (data[0] ?? null) : data, count: data.length, error: null };
            })
            .then(resolve, reject),
      };
      return chain;
    },
    storage: {
      from: () => ({
        createSignedUrl: async (path: string) => ({
          data: { signedUrl: `https://local.invalid/${path}` },
        }),
      }),
    },
  },
}));
vi.mock("@/components/HomeLine", () => ({
  HomeLine: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));
vi.mock("@/components/LotteryModule", () => ({ LotteryModule: () => null }));
vi.mock("@/components/AnnouncementCarousel", () => ({
  AnnouncementCarousel: ({ items }: { items: { id: string; body: string }[] }) => (
    <div>
      {items.map((item) => (
        <p key={item.id}>{item.body}</p>
      ))}
    </div>
  ),
}));
import { RoleProvider, useRole } from "@/hooks/use-role";
import { competitionQuery } from "@/lib/queries";
import { Route } from "@/routes/index";
const Home = Route.options.component as ComponentType;
function View() {
  const { selectRole } = useRole();
  return (
    <>
      <button onClick={() => selectRole("coach")}>Use coach identity</button>
      <Home />
    </>
  );
}
let qc: QueryClient;
beforeEach(() => {
  sessionStorage.clear();
  sessionStorage.setItem("ova-role", "coach");
  mocks.offline = false;
});
afterEach(() => {
  cleanup();
  qc.clear();
});
function mount() {
  qc = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: Infinity } } });
  qc.setQueryData(competitionQuery.queryKey, {
    matches: [],
    rankings: [],
    events: [],
    divisions: [],
    venues: [],
    teams: [
      {
        id: "A",
        name: "Team A",
        data_mode: "real",
        division_id: null,
        organization: null,
        season: "fixture",
      },
      {
        id: "B",
        name: "Team B",
        data_mode: "real",
        division_id: null,
        organization: null,
        season: "fixture",
      },
    ],
    announcements: [
      {
        id: "global",
        title: "OVA public update",
        body: "PUBLIC COMMUNITY",
        team_id: null,
        author_id: "staff",
        status: "published",
        published_at: new Date().toISOString(),
        pinned_at: null,
        created_at: new Date().toISOString(),
        data_mode: "real",
        location_name: null,
        pinned: false,
        media_urls: [],
      },
    ],
  });
  return render(
    <QueryClientProvider client={qc}>
      <RoleProvider>
        <View />
      </RoleProvider>
    </QueryClientProvider>,
  );
}
it("Home bridge removes the private preview after cross-tab sign-out while public content stays available offline", async () => {
  mount();
  await screen.findByText("PRIVATE TEAM A");
  mocks.offline = true;
  act(() => mocks.event("SIGNED_OUT", null));
  await screen.findByText("PUBLIC COMMUNITY");
  expect(screen.queryByText("PRIVATE TEAM A")).not.toBeInTheDocument();
  expect(qc.getQueryData(["team-announcements", "account-A"])).toBeUndefined();
  expect(qc.getQueryData(["household", "account-A"])).toBeUndefined();
});
it("Home bridge never carries A's selected team or content into account B", async () => {
  mount();
  await screen.findByText("PRIVATE TEAM A");
  act(() => mocks.event("SIGNED_IN", { user: { id: "account-B" } }));
  expect(screen.queryByText("PRIVATE TEAM A")).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Use coach identity" }));
  await screen.findByText("PRIVATE TEAM B");
  expect(screen.queryByText("PRIVATE TEAM A")).not.toBeInTheDocument();
  expect(screen.getByText("Team B", { selector: "h3" })).toBeInTheDocument();
});
