import { type ComponentType, type ReactNode, type AnchorHTMLAttributes } from "react";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
type FixturePlayer = {
  id: string;
  status?: string;
  display_name?: string;
  team_id?: string;
  jersey_number?: string;
  review_note?: string | null;
};
type FixtureHousehold = {
  self: FixturePlayer | null;
  managedTeams: string[];
  roles: string[];
  linkedPlayers: FixturePlayer[];
  familyLinks: { id: string; player_id: string; status: string }[];
  visiblePlayers: FixturePlayer[];
  profile: { display_name: string };
  follows: unknown[];
};
const mocks = vi.hoisted(() => ({
  user: null as { id: string; email: string } | null,
  requested: "general_user" as "general_user" | "player" | "coach" | "family_friends",
  hh: {} as FixtureHousehold,
  rpc: vi.fn(),
  selectRole: vi.fn(),
  navigate: vi.fn(),
  signUp: vi.fn(),
  signIn: vi.fn(),
  signOut: vi.fn(),
  coachRequest: null as { id: string; status: string } | null,
}));
vi.mock("@tanstack/react-router", () => ({
  createFileRoute: () => (options: { component: ComponentType }) => ({ options }),
  useNavigate: () => mocks.navigate,
  Link: ({ to, children, ...rest }: AnchorHTMLAttributes<HTMLAnchorElement> & { to: string }) => (
    <a href={to} {...rest}>
      {children}
    </a>
  ),
}));
vi.mock("@/hooks/use-role", () => ({
  useRole: () => ({
    user: mocks.user,
    ready: true,
    requested: mocks.requested,
    selectRole: mocks.selectRole,
    signOut: mocks.signOut,
    household: { data: mocks.hh, isPending: false, isError: false },
  }),
}));
vi.mock("@/components/AppShell", () => ({
  AppShell: ({ children }: { children: ReactNode }) => <main>{children}</main>,
  Section: ({ title, children }: { title: string; children: ReactNode }) => (
    <section aria-label={title}>
      <h2>{title}</h2>
      {children}
    </section>
  ),
  Card: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  btn: { input: "" },
}));
vi.mock("@/components/AccountApprovals", () => ({ AccountApprovals: () => null }));
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    rpc: (...args: unknown[]) => mocks.rpc(...args),
    auth: {
      signUp: (...a: unknown[]) => mocks.signUp(...a),
      signInWithPassword: (...a: unknown[]) => mocks.signIn(...a),
    },
    from: () => ({
      select: () => ({
        eq: () => ({
          abortSignal: () => ({
            maybeSingle: async () => ({ data: mocks.coachRequest, error: null }),
          }),
        }),
      }),
    }),
  },
}));
vi.mock("@/lib/queries", () => ({
  competitionQuery: {
    queryKey: ["competition"],
    queryFn: async () => ({
      teams: [
        { id: "team-A", name: "Team A", data_mode: "real" },
        { id: "team-B", name: "Team B", data_mode: "real" },
      ],
    }),
  },
}));
import { Route } from "@/routes/account";
const Account = Route.options.component as ComponentType;
function mount() {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: Infinity }, mutations: { retry: false } },
  });
  qc.setQueryData(["competition"], {
    teams: [
      { id: "team-A", name: "Team A", data_mode: "real" },
      { id: "team-B", name: "Team B", data_mode: "real" },
    ],
  });
  return {
    qc,
    ...render(
      <QueryClientProvider client={qc}>
        <Account />
      </QueryClientProvider>,
    ),
  };
}
const user = { id: "user-a", email: "audit@invalid.test" };
beforeEach(() => {
  mocks.user = null;
  mocks.requested = "general_user";
  mocks.hh = {
    self: null,
    managedTeams: [],
    roles: [],
    linkedPlayers: [],
    familyLinks: [],
    profile: { display_name: "Audit" },
    follows: [],
    visiblePlayers: [],
  };
  mocks.coachRequest = null;
  vi.clearAllMocks();
  mocks.rpc.mockResolvedValue({ data: null, error: null });
  mocks.signUp.mockResolvedValue({ data: { session: null }, error: null });
  mocks.signOut.mockResolvedValue({ error: null });
  mocks.selectRole.mockImplementation((role: typeof mocks.requested) => {
    mocks.requested = role;
  });
  sessionStorage.clear();
});
afterEach(cleanup);
describe("Account identities and review feedback — local component and RPC transport simulation", () => {
  it("keeps invitation labels on a newly pending child without granting an approved connection", async () => {
    mocks.user = user;
    mocks.rpc.mockImplementation(async (method: string) => {
      if (method === "preview_pairing_code")
        return {
          data: { purpose: "FAMILY", player_name: "Blair", team_name: "Team B" },
          error: null,
        };
      mocks.hh.familyLinks = [{ id: "new-link", player_id: "bound-child", status: "pending" }];
      return {
        data: { purpose: "FAMILY", player_id: "bound-child", status: "pending" },
        error: null,
      };
    });
    mount();
    fireEvent.click(screen.getByRole("button", { name: "Friends & Family" }));
    fireEvent.change(screen.getByLabelText("Player family code"), {
      target: { value: "LOCAL-FAMILY" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Verify code" }));
    await screen.findByText("Code verified");
    fireEvent.change(screen.getByLabelText("Your name"), { target: { value: "Fixture Parent" } });
    fireEvent.click(screen.getByRole("button", { name: "Confirm & continue" }));
    await screen.findByText("Player ID: bound-child");
    expect(screen.getByText("Blair")).toBeInTheDocument();
    expect(screen.getByText("Team B")).toBeInTheDocument();
    expect(screen.getByText("Pending player approval")).toBeInTheDocument();
    expect(screen.getByText("Name and team from your invitation preview")).toBeInTheDocument();
    expect(mocks.hh.linkedPlayers).toEqual([]);
    expect(screen.queryByRole("button", { name: "Open my homepage" })).not.toBeInTheDocument();
  });
  it("recovers from a failed redemption without approving a child or losing the retry action", async () => {
    mocks.user = user;
    mocks.rpc.mockImplementation((method: string) =>
      method === "preview_pairing_code"
        ? Promise.resolve({
            data: { purpose: "FAMILY", player_name: "Blair", team_name: "Team B" },
            error: null,
          })
        : Promise.reject(new Error("Fixture redemption offline")),
    );
    mount();
    fireEvent.click(screen.getByRole("button", { name: "Friends & Family" }));
    fireEvent.change(screen.getByLabelText("Player family code"), {
      target: { value: "LOCAL-FAMILY" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Verify code" }));
    await screen.findByText("Code verified");
    fireEvent.change(screen.getByLabelText("Your name"), { target: { value: "Fixture Parent" } });
    fireEvent.click(screen.getByRole("button", { name: "Confirm & continue" }));
    await screen.findByText("Fixture redemption offline");
    expect(screen.getByRole("button", { name: "Confirm & continue" })).toBeEnabled();
    expect(mocks.hh.familyLinks).toEqual([]);
  });
  it("keeps the unified pairing-code entry scoped to each approved identity on a multi-role account", async () => {
    mocks.user = user;
    mocks.hh.self = { id: "self", status: "verified" };
    mocks.hh.managedTeams = ["team-A"];
    mocks.rpc.mockResolvedValue({
      data: { code: "LOCAL-CODE", expires_at: "2026-11-01T00:00:00Z" },
      error: null,
    });
    mount();
    for (const label of ["Coach", "Player"]) {
      fireEvent.click(screen.getByRole("button", { name: "Manage identities & connections" }));
      fireEvent.click(screen.getByRole("button", { name: label }));
      fireEvent.click(screen.getByRole("button", { name: "Manage pairing codes & approvals" }));
      fireEvent.click(screen.getByRole("button", { name: "Generate verification code" }));
      await screen.findByText("LOCAL-CODE");
    }
    expect(mocks.rpc.mock.calls).toEqual([
      ["create_team_code", { _team: "team-A" }],
      ["create_family_code", { _player: "self" }],
    ]);
  });
  it("does not show a late generated code under a newly selected team", async () => {
    mocks.user = user;
    mocks.hh.managedTeams = ["team-A", "team-B"];
    let finish!: (result: unknown) => void;
    mocks.rpc.mockReturnValue(
      new Promise((resolve) => {
        finish = resolve;
      }),
    );
    mount();
    fireEvent.click(screen.getByRole("button", { name: "Generate verification code" }));
    fireEvent.change(screen.getByLabelText("Team"), { target: { value: "team-B" } });
    await act(async () =>
      finish({
        data: { code: "OLD-TEAM-A-CODE", expires_at: "2026-11-01T00:00:00Z" },
        error: null,
      }),
    );
    expect(screen.queryByText("OLD-TEAM-A-CODE")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Generate verification code" })).toBeEnabled();
  });
  it("preserves guest sign-in, staff and Fan Plaza entry points", () => {
    mount();
    for (const label of ["Player", "Friends & Family", "Coach"])
      expect(screen.getByRole("button", { name: label })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /OVA Staff/ })).toHaveAttribute("href", "/staff");
    expect(screen.getByRole("link", { name: /Fan Plaza/ })).toHaveAttribute("href", "/");
  });
  it.each(["player", "coach"])(
    "verified %s can choose another identity and use a family invitation",
    async (kind) => {
      mocks.user = user;
      if (kind === "player") mocks.hh.self = { id: "self", status: "verified" };
      else mocks.hh.managedTeams = ["team-A"];
      mocks.rpc.mockResolvedValue({
        data: { purpose: "FAMILY", player_name: "Blair", team_name: "Team B" },
        error: null,
      });
      mount();
      expect(
        screen.getByRole("button", { name: "Generate verification code" }),
      ).toBeInTheDocument();
      fireEvent.click(screen.getByRole("button", { name: "Manage identities & connections" }));
      fireEvent.click(screen.getByRole("button", { name: "Friends & Family" }));
      fireEvent.change(screen.getByLabelText("Player family code"), {
        target: { value: "FAMILY-CODE" },
      });
      fireEvent.click(screen.getByRole("button", { name: "Verify code" }));
      await screen.findByText("Code verified");
      expect(screen.getByText("Blair")).toBeInTheDocument();
      expect(mocks.rpc).toHaveBeenCalledWith("preview_pairing_code", { _code: "FAMILY-CODE" });
      expect(
        mocks.rpc.mock.calls.some(
          (c) => c[0] === "create_team_code" || c[0] === "create_family_code",
        ),
      ).toBe(false);
    },
  );
  it("an existing coach can apply to a second team through the existing reviewed RPC", async () => {
    mocks.user = user;
    mocks.hh.managedTeams = ["team-A"];
    mocks.coachRequest = { id: "r", status: "approved" };
    mount();
    fireEvent.click(screen.getByRole("button", { name: "Manage identities & connections" }));
    fireEvent.click(screen.getByRole("button", { name: "Coach" }));
    fireEvent.click(screen.getByRole("button", { name: "Apply to another team" }));
    await screen.findByRole("button", { name: "Submit coach application" });
    fireEvent.change(screen.getByLabelText("Coach name"), { target: { value: "Fixture Coach" } });
    fireEvent.change(screen.getByLabelText("Certification number"), {
      target: { value: "CERT-LOCAL" },
    });
    fireEvent.change(screen.getByLabelText("Registered team"), { target: { value: "team-B" } });
    fireEvent.click(screen.getByRole("button", { name: "Submit coach application" }));
    await waitFor(() =>
      expect(mocks.rpc).toHaveBeenCalledWith("submit_coach_application", {
        _team: "team-B",
        _coach_name: "Fixture Coach",
        _certification_number: "CERT-LOCAL",
      }),
    );
    expect(mocks.hh.managedTeams).toEqual(["team-A"]);
  });
  it("an existing player can apply for coach access without changing its approved player identity", async () => {
    mocks.user = user;
    mocks.hh.self = { id: "self", status: "verified" };
    mount();
    fireEvent.click(screen.getByRole("button", { name: "Manage identities & connections" }));
    fireEvent.click(screen.getByRole("button", { name: "Coach" }));
    await screen.findByRole("button", { name: "Submit coach application" });
    expect(mocks.rpc).not.toHaveBeenCalled();
    expect(mocks.hh.self.status).toBe("verified");
  });
  it("selects all three existing identities while keeping one pairing-code entry", () => {
    mocks.user = user;
    mocks.hh.self = { id: "self", status: "verified" };
    mocks.hh.managedTeams = ["team-A"];
    mocks.hh.linkedPlayers = [{ id: "child", display_name: "Child B", team_id: "team-B" }];
    mount();
    fireEvent.click(screen.getByRole("button", { name: "Manage identities & connections" }));
    for (const label of ["Player", "Friends & Family", "Coach"]) {
      fireEvent.click(screen.getByRole("button", { name: label }));
      expect(screen.getByRole("button", { name: "Open my homepage" })).toBeInTheDocument();
      fireEvent.click(screen.getByRole("button", { name: "Choose another role" }));
    }
    expect(mocks.rpc).not.toHaveBeenCalled();
    expect(mocks.hh.managedTeams).toEqual(["team-A"]);
  });
  it.each([null, "Correct your jersey"])(
    "rejected player can resubmit with review note %s through the safe registration RPC",
    async (note) => {
      mocks.user = user;
      mocks.hh.self = {
        id: "self",
        status: "rejected",
        display_name: "Fixture Player",
        jersey_number: "7",
        review_note: note,
      };
      mount();
      fireEvent.click(screen.getByRole("button", { name: "Player" }));
      expect(screen.getByLabelText("Name")).toHaveValue("Fixture Player");
      expect(screen.getByLabelText("Jersey number")).toHaveValue("7");
      expect(screen.queryByRole("button", { name: "Open my homepage" })).not.toBeInTheDocument();
      fireEvent.change(screen.getByLabelText("Jersey number"), { target: { value: "12" } });
      fireEvent.click(screen.getByRole("button", { name: "Resubmit profile" }));
      await waitFor(() =>
        expect(mocks.rpc).toHaveBeenCalledWith("update_player_registration", {
          _name: "Fixture Player",
          _jersey: "12",
        }),
      );
      expect(mocks.hh.self.status).toBe("rejected");
      expect(mocks.rpc.mock.calls).toHaveLength(1);
    },
  );
  it("a failed player resubmission keeps the correction form and gives a retry", async () => {
    mocks.user = user;
    mocks.hh.self = {
      id: "self",
      status: "rejected",
      display_name: "Fixture Player",
      jersey_number: "7",
      review_note: null,
    };
    mocks.rpc.mockRejectedValue(new Error("Fixture offline"));
    mount();
    fireEvent.click(screen.getByRole("button", { name: "Player" }));
    fireEvent.click(screen.getByRole("button", { name: "Resubmit profile" }));
    await screen.findByText("Fixture offline");
    expect(screen.getByRole("button", { name: "Resubmit profile" })).toBeEnabled();
  });
  it("keeps every mixed child status with distinct player and team labels, even on the verified code dashboard", () => {
    mocks.user = user;
    mocks.hh.self = { id: "self", status: "verified" };
    mocks.hh.visiblePlayers = [
      { id: "a", display_name: "Approved Child", team_id: "team-A" },
      { id: "b", display_name: "Pending Child", team_id: "team-B" },
      { id: "c", display_name: "Rejected Child", team_id: "team-A" },
    ];
    mocks.hh.linkedPlayers = [mocks.hh.visiblePlayers[0]!];
    mocks.hh.familyLinks = [
      { id: "la", player_id: "a", status: "approved" },
      { id: "lb", player_id: "b", status: "pending" },
      { id: "lc", player_id: "c", status: "rejected" },
    ];
    mount();
    for (const text of [
      "Approved Child",
      "Pending Child",
      "Rejected Child",
      "Approved",
      "Pending player approval",
      "Request rejected",
      "Player ID: a",
      "Player ID: b",
      "Player ID: c",
      "Team B · Team ID: team-B",
    ])
      expect(screen.getByText(text)).toBeInTheDocument();
  });
  it("distinguishes RLS-hidden pending/rejected children by exact player ID and never invents their team", () => {
    mocks.user = user;
    mocks.hh.familyLinks = [
      { id: "la", player_id: "hidden-A", status: "pending" },
      { id: "lb", player_id: "hidden-B", status: "rejected" },
    ];
    mount();
    expect(screen.getByText("Player ID: hidden-A")).toBeInTheDocument();
    expect(screen.getByText("Player ID: hidden-B")).toBeInTheDocument();
    expect(screen.getAllByText("Team to be determined")).toHaveLength(2);
    expect(screen.getByRole("button", { name: "Friends & Family" })).toBeInTheDocument();
  });
  it.each(["player", "coach"] as const)(
    "a tampered requested %s role cannot expose a generator or approved homepage",
    (role) => {
      mocks.user = user;
      mocks.requested = role;
      mount();
      expect(
        screen.queryByRole("button", { name: "Generate verification code" }),
      ).not.toBeInTheDocument();
      fireEvent.click(screen.getByRole("button", { name: role === "player" ? "Player" : "Coach" }));
      expect(screen.queryByRole("button", { name: "Open my homepage" })).not.toBeInTheDocument();
      expect(mocks.rpc).not.toHaveBeenCalled();
    },
  );
  it("normal Account sign-out invokes the shared auth cleanup", async () => {
    mocks.user = user;
    mocks.hh.self = { id: "self", status: "verified" };
    mount();
    fireEvent.click(screen.getByRole("button", { name: "Sign out" }));
    await waitFor(() => expect(mocks.signOut).toHaveBeenCalledTimes(1));
    expect(mocks.selectRole).toHaveBeenCalledWith("general_user");
  });
});
