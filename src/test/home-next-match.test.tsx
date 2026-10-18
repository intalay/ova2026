vi.mock("@/hooks/use-team-announcements", () => ({
  useTeamAnnouncements: () => ({ data: [], isError: false }),
}));
vi.mock("@/hooks/use-home-data-mode", () => ({
  useHomeDataMode: () => ({ mode: mocks.homeMode, setMode: vi.fn(), ready: true }),
}));
import type { ComponentType, ReactNode } from "react";
import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { Match } from "@/lib/queries";
const mocks = vi.hoisted(() => ({
  matches: [] as Match[],
  role: "coach",
  demoPlayer: false,
  homeMode: "real",
}));
vi.mock("@tanstack/react-router", () => ({
  useSearch: () => ({}),
  useNavigate: () => () => {},
  createFileRoute: () => (options: unknown) => ({ options }),
  Link: ({
    to,
    params,
    children,
    ...rest
  }: {
    to: string;
    params?: { id: string };
    children: ReactNode;
  }) => (
    <a {...rest} href={to.replace("$id", params?.id ?? "")}>
      {children}
    </a>
  ),
}));
vi.mock("@tanstack/react-query", () => ({
  useSuspenseQuery: () => ({
    data: {
      teams: [
        { id: "mine", name: "My team" },
        { id: "other", name: "Opponents" },
        ...(mocks.demoPlayer
          ? [{ id: "demo-sand", name: "Sand & Sky", data_mode: "synthetic" }]
          : []),
      ],
      events: [{ id: "event", name: "Actual event" }],
      venues: [
        { id: "known-venue", name: "Known venue", address: "Recorded address" },
        {
          id: "demo-venue",
          name: "Demo venue",
          address: "Recorded demo address",
          data_mode: "synthetic",
        },
      ],
      matches: mocks.matches,
      announcements: [],
      rankings: [],
      divisions: [],
    },
  }),
}));
vi.mock("@/lib/queries", () => ({ competitionQuery: {} }));
vi.mock("@/hooks/use-role", () => ({
  useRole: () => ({
    role: mocks.role,
    household: {
      data: {
        roles: [],
        familyLinks: [],
        managedTeams: ["mine"],
        linkedPlayers: [],
        self: mocks.demoPlayer
          ? {
              id: "demo-player",
              user_id: "review-user",
              display_name: "Alex",
              team_id: "demo-sand",
              status: "verified",
              data_mode: "synthetic",
            }
          : null,
        profile: null,
      },
    },
    user: { id: "review-user" },
  }),
}));
vi.mock("@/components/AppShell", () => ({
  AppShell: ({ children }: { children: ReactNode }) => <main>{children}</main>,
  Section: ({ title, children }: { title: string; children: ReactNode }) => (
    <section aria-label={title}>{children}</section>
  ),
  Card: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  Tbd: ({ children }: { children: ReactNode }) => <span>{children}</span>,
  MoreLink: ({ to, children }: { to: string; children: ReactNode }) => <a href={to}>{children}</a>,
}));
vi.mock("@/components/HomeLine", () => ({
  HomeLine: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));
vi.mock("@/components/AnnouncementCarousel", () => ({ AnnouncementCarousel: () => null }));
vi.mock("@/components/LotteryModule", () => ({ LotteryModule: () => null }));
import { Route } from "@/routes/index";
const Home = Route.options.component as ComponentType;
const match = (patch: Partial<Match> = {}): Match => ({
  id: "match",
  event_id: "event",
  division_id: "division",
  team_a_id: "mine",
  team_b_id: "other",
  venue_id: null,
  source_date: "2026-10-17",
  starts_at: null,
  court: null,
  status: "scheduled",
  score_a: null,
  score_b: null,
  sets: null,
  data_mode: "real",
  ...patch,
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  mocks.matches = [];
  mocks.role = "coach";
  mocks.demoPlayer = false;
  mocks.homeMode = "real";
});
describe("independent next-match DOM regression", () => {
  it("renders Toronto today with unknown time, isolates real/team records and supplies no venue navigation", () => {
    vi.setSystemTime(new Date("2026-10-18T02:00:00Z"));
    mocks.matches = [
      match(),
      match({ id: "demo", data_mode: "synthetic", venue_id: "known-venue" }),
      match({ id: "other-team", team_a_id: "other", team_b_id: null, venue_id: "known-venue" }),
    ];
    render(<Home />);
    const next = within(screen.getByRole("region", { name: "Next Match" }));
    expect(next.getAllByText("Actual event")).toHaveLength(1);
    expect(next.getByText(/Oct 17.*time TBD/)).toBeInTheDocument();
    expect(next.getByText("Venue TBD")).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Venue" })).toHaveTextContent(
      "Venue to be determined",
    );
    expect(
      screen.getAllByRole("link").some((a) => a.getAttribute("href")?.startsWith("/venue/")),
    ).toBe(false);
  });
  it("renders a recorded venue link when the unique upcoming match has one", () => {
    vi.setSystemTime(new Date("2026-10-18T02:00:00Z"));
    mocks.matches = [match({ venue_id: "known-venue", starts_at: "2026-10-18T03:00:00Z" })];
    render(<Home />);
    expect(
      within(screen.getByRole("region", { name: "Next Match" })).getByRole("link", {
        name: "Known venue",
      }),
    ).toHaveAttribute("href", "/venue/known-venue");
    expect(within(screen.getByRole("region", { name: "Venue" })).getByRole("link")).toHaveAttribute(
      "href",
      "/venue/known-venue",
    );
  });
  it("does not use a historical final as next match or venue", () => {
    vi.setSystemTime(new Date("2026-10-18T02:00:00Z"));
    mocks.matches = [
      match({
        status: "final",
        source_date: "2026-04-19",
        venue_id: "known-venue",
        score_a: 2,
        score_b: 0,
      }),
    ];
    render(<Home />);
    expect(screen.getByRole("region", { name: "Next Match" })).toHaveTextContent(
      "No upcoming match is published.",
    );
    expect(screen.getByRole("region", { name: "Venue" })).toHaveTextContent(
      "Venue to be determined",
    );
  });
});

it("restores explicitly labelled homepage Demo cards without adding them to real Results", () => {
  vi.setSystemTime(new Date("2026-10-18T02:00:00Z"));
  mocks.role = "general_user";
  mocks.homeMode = "synthetic";
  mocks.matches = [
    match({ id: "demo-upcoming", data_mode: "synthetic" }),
    match({
      id: "demo-result",
      data_mode: "synthetic",
      status: "final",
      score_a: 2,
      score_b: 1,
      source_date: "2026-10-10",
    }),
  ];
  render(<Home />);
  expect(screen.getByRole("region", { name: "Upcoming matches" })).toHaveTextContent(
    "Demo match · Illustrative schedule",
  );
  expect(screen.getByRole("region", { name: "Recent Competition Results" })).toHaveTextContent(
    "Demo result · Not real results",
  );
});

it("keeps the verified demo player Alex attached to the exact Sand & Sky ID on homepage", () => {
  vi.setSystemTime(new Date("2026-10-18T02:00:00Z"));
  mocks.role = "player";
  mocks.demoPlayer = true;
  mocks.homeMode = "synthetic";
  mocks.matches = [match({ id: "alex-demo", data_mode: "synthetic", team_a_id: "demo-sand" })];
  render(<Home />);
  expect(screen.getByRole("heading", { name: "Alex" })).toBeInTheDocument();
  expect(screen.getByRole("region", { name: "Information" })).toHaveTextContent("Sand & Sky");
  expect(screen.getByText(/Demo homepage · Illustrative/)).toBeInTheDocument();
  expect(screen.getByRole("region", { name: "Next Match" })).toHaveTextContent(
    "Demo match · Illustrative schedule",
  );
});

it("Fan default shows every future real match without selecting a team, and no demo records", () => {
  vi.setSystemTime(new Date("2026-10-18T02:00:00Z"));
  mocks.role = "general_user";
  mocks.matches = [
    ...Array.from({ length: 5 }, (_, i) =>
      match({ id: `future-${i}`, team_a_id: "other", team_b_id: null }),
    ),
    match({ id: "demo", data_mode: "synthetic" }),
    match({ id: "past", source_date: "2026-04-19" }),
  ];
  render(<Home />);
  expect(
    within(screen.getByRole("region", { name: "Upcoming matches" })).getAllByText("Actual event"),
  ).toHaveLength(5);
  expect(screen.queryByText(/Demo match/)).not.toBeInTheDocument();
});
it("does not silently switch to Demo for a bound synthetic player in Real mode", () => {
  vi.setSystemTime(new Date("2026-10-18T02:00:00Z"));
  mocks.role = "player";
  mocks.demoPlayer = true;
  mocks.matches = [
    match({ id: "demo", data_mode: "synthetic", team_a_id: "demo-sand" }),
    match({ id: "real", team_a_id: "other" }),
  ];
  render(<Home />);
  expect(screen.getByRole("heading", { name: "Alex" })).toBeInTheDocument();
  expect(screen.getByRole("status")).toHaveTextContent("no recorded real competition data");
  expect(screen.getByRole("region", { name: "Next Match" })).toHaveTextContent(
    "No upcoming match is published.",
  );
  expect(screen.queryByText(/Demo match/)).not.toBeInTheDocument();
});
it("real Fan empty state cannot fall back to synthetic schedules or historical finals", () => {
  vi.setSystemTime(new Date("2026-10-18T02:00:00Z"));
  mocks.role = "general_user";
  mocks.matches = [
    match({ data_mode: "synthetic" }),
    match({ id: "final", status: "final", source_date: "2026-04-19" }),
  ];
  render(<Home />);
  expect(screen.getByRole("region", { name: "Upcoming matches" })).toHaveTextContent(
    "No upcoming match is published.",
  );
});

it("shows source-linked Fan event overviews without any match records or team selection", () => {
  vi.setSystemTime(new Date("2026-10-18T12:00:00Z"));
  mocks.role = "general_user";
  mocks.matches = [];
  render(<Home />);
  const events = within(screen.getByRole("region", { name: "Upcoming events" }));
  expect(events.getAllByRole("link")).toHaveLength(3);
  expect(events.getByRole("heading", { name: "Fall Classic · Event 1" })).toBeInTheDocument();
  expect(events.getByText(/not the complete OVA calendar/)).toBeInTheDocument();
  expect(screen.getByRole("region", { name: "Upcoming matches" })).toHaveTextContent(
    "No upcoming match is published.",
  );
});

it("keeps a clearly marked Demo venue directory when next-match order is ambiguous, without inventing the next location", () => {
  vi.setSystemTime(new Date("2026-10-18T02:00:00Z"));
  mocks.role = "general_user";
  mocks.homeMode = "synthetic";
  mocks.matches = [
    match({
      id: "known",
      data_mode: "synthetic",
      venue_id: "demo-venue",
      starts_at: "2026-10-18T13:00:00Z",
    }),
    match({ id: "unknown-time", data_mode: "synthetic", source_date: "2026-10-18" }),
  ];
  render(<Home />);
  const venue = within(screen.getByRole("region", { name: "Venue" }));
  expect(venue.getByText(/do not confirm the venue of your next match/)).toBeInTheDocument();
  expect(venue.getByRole("link")).toHaveAttribute("href", "/venue/demo-venue");
  expect(venue.getByText("Demo venue · Illustrative record")).toBeInTheDocument();
});
it("preserves the recorded Demo venue directory after all simulated fixtures are past", () => {
  vi.setSystemTime(new Date("2026-12-18T12:00:00Z"));
  mocks.role = "general_user";
  mocks.homeMode = "synthetic";
  mocks.matches = [];
  render(<Home />);
  expect(within(screen.getByRole("region", { name: "Venue" })).getByRole("link")).toHaveAttribute(
    "href",
    "/venue/demo-venue",
  );
});
