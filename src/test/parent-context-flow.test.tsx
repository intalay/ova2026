vi.mock("@/hooks/use-team-announcements", () => ({
  useTeamAnnouncements: () => ({ data: [], isError: false }),
}));
vi.mock("@/hooks/use-home-data-mode", () => ({
  useHomeDataMode: () => ({ mode: "real", setMode: vi.fn(), ready: true }),
}));
import type { FunctionComponent, ReactNode } from "react";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  createRootRoute,
  createRoute,
  createRouter,
  createMemoryHistory,
  RouterProvider,
  Outlet,
  Link,
} from "@tanstack/react-router";
import { parentHousehold } from "./parent-context.fixture";
import { useParentContext, type ParentIdentity } from "@/hooks/use-parent-context";
import { validateBrowseSearch } from "@/lib/parent-context";
import { useRole } from "@/hooks/use-role";
const mocks = vi.hoisted(() => ({
  identity: {} as ParentIdentity,
  data: {} as Record<string, unknown>,
  update: vi.fn(),
  insert: vi.fn(),
  rpc: vi.fn(),
  signedUrl: vi.fn(),
  listeners: new Set<() => void>(),
}));
vi.mock("@tanstack/react-query", () => ({
  useSuspenseQuery: () => ({ data: mocks.data }),
  useQueryClient: () => ({ invalidateQueries: vi.fn() }),
}));
vi.mock("@/lib/queries", () => ({ competitionQuery: {} }));
vi.mock("@/hooks/use-role", async () => {
  const { useSyncExternalStore } = await import("react");
  return {
    useRole: () =>
      useSyncExternalStore(
        (listener) => {
          mocks.listeners.add(listener);
          return () => {
            mocks.listeners.delete(listener);
          };
        },
        () => mocks.identity,
      ),
  };
});
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: () => ({
      update: (payload: unknown) => {
        mocks.update(payload);
        return { eq: async () => ({ error: null }) };
      },
      insert: mocks.insert,
    }),
    rpc: mocks.rpc,
    storage: { from: () => ({ createSignedUrl: mocks.signedUrl }) },
  },
}));
vi.mock("@/components/AppShell", () => ({
  AppShell: ({ children }: { children: ReactNode }) => <main>{children}</main>,
  Section: ({
    title,
    children,
    link,
  }: {
    title: string;
    children: ReactNode;
    link?: ReactNode;
  }) => (
    <section aria-label={title}>
      {link}
      {children}
    </section>
  ),
  Card: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  Tbd: ({ children }: { children: ReactNode }) => <span>{children}</span>,
  MoreLink: ({
    to,
    search,
    children,
  }: {
    to: string;
    search?: Record<string, string>;
    children: ReactNode;
  }) => (
    <Link to={to} search={search ?? {}}>
      {children}
    </Link>
  ),
  btn: { input: "" },
}));
vi.mock("@/components/HomeLine", () => ({
  HomeLine: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));
vi.mock("@/components/LotteryModule", () => ({ LotteryModule: () => null }));
import { Route as HomeRoute } from "@/routes/index";
import { Route as AnnouncementsRoute } from "@/routes/announcements";
const Home = HomeRoute.options.component as FunctionComponent;
const Announcements = AnnouncementsRoute.options.component as FunctionComponent;
const teams = [
  { id: "team-a", name: "Aces", data_mode: "real" },
  { id: "team-b", name: "Blazers", data_mode: "real" },
  { id: "private-other", name: "Private other", data_mode: "real" },
];
function IntegrationStub() {
  const context = useParentContext(useRole(), teams);
  return (
    <>
      <p>
        Browsing: {context.player?.display_name ?? "none"} · {context.teamId ?? "none"}
      </p>
      <Link to="/" search={context.search}>
        Return home
      </Link>
    </>
  );
}
function routerAt(url = "/") {
  const root = createRootRoute({ component: Outlet });
  const routeTree = root.addChildren([
    createRoute({
      getParentRoute: () => root,
      path: "/",
      validateSearch: validateBrowseSearch,
      component: Home,
    }),
    createRoute({
      getParentRoute: () => root,
      path: "/announcements",
      validateSearch: validateBrowseSearch,
      component: Announcements,
    }),
    ...["/results", "/schedule"].map((path) =>
      createRoute({
        getParentRoute: () => root,
        path,
        validateSearch: validateBrowseSearch,
        component: IntegrationStub,
      }),
    ),
  ]);
  return createRouter({
    routeTree,
    history: createMemoryHistory({ initialEntries: [url] }),
    defaultPendingMinMs: 0,
  });
}
const announcement = (id: string, team_id: string | null) => ({
  id,
  team_id,
  title: `${id} title`,
  body: `${id} content`,
  author_id: "staff",
  status: "published",
  pinned_at: "2026-10-18T00:00:00Z",
  published_at: "2026-10-18T00:00:00Z",
  media_urls: team_id
    ? [
        {
          path: `${team_id}/staff/private.pdf`,
          name: "Private attachment",
          type: "application/pdf",
        },
      ]
    : [],
  data_mode: "real",
});
beforeEach(() => {
  sessionStorage.clear();
  vi.clearAllMocks();
  mocks.insert.mockResolvedValue({ error: null });
  mocks.signedUrl.mockResolvedValue({ data: { signedUrl: "https://fixture.invalid/private.pdf" } });
  mocks.identity = {
    user: { id: "parent" },
    role: "family_friends",
    ready: true,
    household: { data: parentHousehold(), isPending: false, isError: false },
  } as ParentIdentity;
  mocks.data = {
    teams,
    matches: [],
    events: [],
    venues: [],
    divisions: [],
    rankings: [],
    announcements: [
      announcement("A private", "team-a"),
      announcement("B private", "team-b"),
      announcement("Other private", "private-other"),
      announcement("Community", null),
    ],
  };
});
afterEach(cleanup);
describe("local parent navigation and announcement regression", () => {
  it("keeps the second child for preview links, full announcements, result/schedule links, back and refresh", async () => {
    const router = routerAt();
    const view = render(<RouterProvider router={router} />);
    const playerSelect = await screen.findByRole("combobox", { name: "Player" });
    fireEvent.change(playerSelect, { target: { value: "child-b" } });
    await waitFor(() =>
      expect(router.state.location.search).toEqual({ player: "child-b", team: "team-b" }),
    );
    const preview = within(screen.getByRole("region", { name: "Team announcements" }));
    expect(preview.getAllByRole("link")[0]!.getAttribute("href")).toContain("player=child-b");
    expect(
      preview
        .getAllByRole("link")
        .every((link) => link.getAttribute("href")?.includes("team=team-b")),
    ).toBe(true);
    fireEvent.click(screen.getByRole("link", { name: "View all" }));
    expect(await screen.findByText("Blair · Blazers")).toBeInTheDocument();
    expect(screen.getByText("B private content")).toBeInTheDocument();
    expect(screen.queryByText("A private content")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("link", { name: "Schedule" }));
    expect(await screen.findByText("Browsing: Blair · team-b")).toBeInTheDocument();
    await act(async () => {
      router.history.back();
    });
    expect(await screen.findByText("B private content")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("link", { name: "Results" }));
    expect(await screen.findByText("Browsing: Blair · team-b")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("link", { name: "Return home" }));
    await waitFor(() =>
      expect(screen.getByRole("combobox", { name: "Player" })).toHaveValue("child-b"),
    );
    const href = router.state.location.href;
    view.unmount();
    render(<RouterProvider router={routerAt(href)} />);
    await waitFor(() =>
      expect(screen.getByRole("combobox", { name: "Player" })).toHaveValue("child-b"),
    );
  });
  it("restores validated session context through a plain home navigation", async () => {
    sessionStorage.setItem(
      "ova-browse:parent:family_friends",
      JSON.stringify({ player: "child-b", team: "team-b" }),
    );
    render(<RouterProvider router={routerAt("/announcements")} />);
    expect(await screen.findByText("Blair · Blazers")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("link", { name: "Back to homepage" }));
    await waitFor(() =>
      expect(screen.getByRole("combobox", { name: "Player" })).toHaveValue("child-b"),
    );
  });
  it.each(["?player=child-b&team=team-a", "?team=private-other", "?player=unlinked"])(
    "rejects forged private context %s without falling back to first child",
    async (search) => {
      render(<RouterProvider router={routerAt(`/announcements${search}`)} />);
      expect(await screen.findByText(/selection is no longer available/)).toBeInTheDocument();
      expect(screen.queryByText("A private content")).not.toBeInTheDocument();
      expect(screen.queryByText("B private content")).not.toBeInTheDocument();
      expect(screen.queryByText("Other private content")).not.toBeInTheDocument();
      expect(screen.getByText("Community content")).toBeInTheDocument();
      expect(mocks.signedUrl).not.toHaveBeenCalled();
    },
  );
  it.each(["pending", "rejected"])(
    "rejects %s family links with no attachment request",
    async (status) => {
      mocks.identity.household.data!.familyLinks[1]!.status = status;
      render(<RouterProvider router={routerAt("/announcements?player=child-b&team=team-b")} />);
      expect(await screen.findByText(/selection is no longer available/)).toBeInTheDocument();
      expect(screen.queryByText("B private content")).not.toBeInTheDocument();
      expect(mocks.signedUrl).not.toHaveBeenCalled();
    },
  );
  it("does not expose a previous household after logout or a failed household read", async () => {
    mocks.identity = { ...mocks.identity, user: null, role: "general_user" };
    const view = render(
      <RouterProvider router={routerAt("/announcements?player=child-b&team=team-b")} />,
    );
    expect(await screen.findByText("Community content")).toBeInTheDocument();
    expect(screen.queryByText("B private content")).not.toBeInTheDocument();
    view.unmount();
    mocks.identity = {
      ...mocks.identity,
      user: { id: "parent" },
      role: "family_friends",
      household: { ...mocks.identity.household, isError: true },
    };
    render(<RouterProvider router={routerAt("/announcements?player=child-b&team=team-b")} />);
    expect(await screen.findByText("Community content")).toBeInTheDocument();
    expect(screen.queryByText("B private content")).not.toBeInTheDocument();
  });
  it("preserves null when staff edits a community announcement and does not choose first team", async () => {
    mocks.data["announcements"] = [
      announcement("A private", "team-a"),
      { ...announcement("Community", null), author_id: "original-staff", data_mode: "synthetic" },
    ];
    mocks.identity = {
      ...mocks.identity,
      user: { id: "staff" },
      role: "coach",
      household: {
        ...mocks.identity.household,
        data: { ...parentHousehold(), roles: ["staff"], managedTeams: [] },
      },
    };
    render(<RouterProvider router={routerAt("/announcements?team=team-b")} />);
    await screen.findByText("Community content");
    const card = screen.getByText("Community content").parentElement!;
    fireEvent.click(within(card).getByRole("button", { name: "Edit" }));
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText("OVA community")).toBeInTheDocument();
    fireEvent.change(within(dialog).getByRole("textbox", { name: "Title" }), {
      target: { value: "Updated community title" },
    });
    fireEvent.click(within(dialog).getByRole("button", { name: "Publish announcement" }));
    await waitFor(() =>
      expect(mocks.update).toHaveBeenCalledWith(
        expect.objectContaining({
          title: "Updated community title",
          team_id: null,
          author_id: "original-staff",
          data_mode: "synthetic",
        }),
      ),
    );
  });
  it("does not give coaches community editing, pinning or publishing controls", async () => {
    mocks.identity = {
      ...mocks.identity,
      user: { id: "staff" },
      role: "coach",
      household: {
        ...mocks.identity.household,
        data: { ...parentHousehold(), roles: [], managedTeams: ["team-b"] },
      },
    };
    render(<RouterProvider router={routerAt("/announcements?team=team-b")} />);
    await screen.findByText("Community content");
    expect(
      within(screen.getByText("Community content").parentElement!).queryByRole("button"),
    ).not.toBeInTheDocument();
    expect(screen.queryByRole("option", { name: "OVA community" })).not.toBeInTheDocument();
    expect(mocks.update).not.toHaveBeenCalled();
  });
});

it("does not show private attachments while the current household is pending", async () => {
  mocks.identity.household.isPending = true;
  render(<RouterProvider router={routerAt("/announcements?player=child-b&team=team-b")} />);
  await screen.findByText("Community content");
  expect(screen.queryByText("B private content")).not.toBeInTheDocument();
  expect(mocks.signedUrl).not.toHaveBeenCalled();
});

it("rechecks a removed family approval on an already mounted announcement page", async () => {
  const router = routerAt("/announcements?player=child-b&team=team-b");
  render(<RouterProvider router={router} />);
  await screen.findByText("Blair · Blazers");
  mocks.signedUrl.mockClear();
  mocks.identity = {
    ...mocks.identity,
    household: {
      ...mocks.identity.household,
      data: {
        ...parentHousehold(),
        familyLinks: parentHousehold().familyLinks.filter((link) => link.player_id !== "child-b"),
      },
    },
  };
  await act(async () => {
    mocks.listeners.forEach((listener) => listener());
  });
  await waitFor(() => expect(screen.queryByText("B private content")).not.toBeInTheDocument());
  expect(screen.getByText(/selection is no longer available/)).toBeInTheDocument();
  expect(screen.getByRole("combobox", { name: "Player" })).toHaveValue("");
  expect(mocks.signedUrl).not.toHaveBeenCalled();
});

it("carries the second child on the compact full-schedule match link", async () => {
  vi.setSystemTime(new Date("2026-10-18T12:00:00Z"));
  mocks.data["matches"] = [
    {
      id: "fixture-next",
      team_a_id: "team-b",
      team_b_id: "team-a",
      event_id: "fixture-event",
      division_id: "fixture-division",
      venue_id: null,
      source_date: "2026-10-19",
      starts_at: null,
      court: null,
      status: "scheduled",
      score_a: null,
      score_b: null,
      sets: null,
      data_mode: "real",
    },
  ];
  render(<RouterProvider router={routerAt("/?player=child-b&team=team-b")} />);
  const link = await screen.findByRole("link", { name: "Full schedule" });
  expect(link.getAttribute("href")).toBe("/schedule?player=child-b&team=team-b");
  vi.useRealTimers();
});

it("publishes a new explicit community audience only with existing staff permission", async () => {
  mocks.identity = {
    ...mocks.identity,
    user: { id: "staff" },
    role: "coach",
    household: {
      ...mocks.identity.household,
      data: { ...parentHousehold(), roles: ["staff"], managedTeams: [] },
    },
  };
  render(<RouterProvider router={routerAt("/announcements?team=team-b")} />);
  const selector = await screen.findByRole("combobox", { name: "Team" });
  fireEvent.change(selector, { target: { value: "__community__" } });
  fireEvent.click(screen.getByRole("button", { name: "Add a new announcement" }));
  const dialog = await screen.findByRole("dialog");
  fireEvent.change(within(dialog).getByRole("textbox", { name: "Title" }), {
    target: { value: "Community fixture" },
  });
  fireEvent.change(within(dialog).getByRole("textbox", { name: "Message" }), {
    target: { value: "Isolated mock only" },
  });
  fireEvent.click(within(dialog).getByRole("button", { name: "Publish announcement" }));
  await waitFor(() =>
    expect(mocks.insert).toHaveBeenCalledWith(
      expect.objectContaining({ team_id: null, author_id: "staff" }),
    ),
  );
});
