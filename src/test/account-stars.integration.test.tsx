// Local Auth + persistence fixtures. No browser identity or real database validation is claimed.
import type { ComponentType, ReactNode } from "react";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

type Follow = { user_id: string; target_type: string; target_id: string };
const mocks = vi.hoisted(() => ({
  account: "account-A" as string | null,
  event: undefined as unknown as (event: string, session: unknown) => void,
  follows: [] as Follow[],
  writes: [] as { op: string; owner: string | null; payload: unknown }[],
  authGate: null as Promise<void> | null,
  readGate: null as Promise<void> | null,
  failRead: false,
  failWrite: false,
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
  Card: ({ children }: { children: ReactNode }) => <article>{children}</article>,
  btn: { primary: "", secondary: "" },
}));
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth: {
      getUser: async () => {
        if (mocks.authGate) await mocks.authGate;
        return { data: { user: mocks.account ? { id: mocks.account } : null }, error: null };
      },
      onAuthStateChange: (callback: typeof mocks.event) => {
        mocks.event = callback;
        return { data: { subscription: { unsubscribe: () => {} } } };
      },
      signOut: async () => {
        mocks.account = null;
        return { error: null };
      },
    },
    from: (table: string) => {
      const predicates: ((row: Record<string, unknown>) => boolean)[] = [];
      let signal: AbortSignal | undefined;
      let single = false;
      let op = "read";
      let payload: Follow | undefined;
      const chain = {
        select: () => chain,
        order: () => chain,
        range: () => chain,
        eq: (key: string, value: unknown) => {
          predicates.push((row) => row[key] === value);
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
        insert: (value: Follow) => {
          op = "insert";
          payload = value;
          return chain;
        },
        delete: () => {
          op = "delete";
          return chain;
        },
        then: (resolve: (value: unknown) => unknown, reject: (error: unknown) => unknown) =>
          Promise.resolve()
            .then(async () => {
              if (table === "follows" && op === "read" && mocks.readGate) await mocks.readGate;
              signal?.throwIfAborted();
              if (op !== "read") {
                if (table !== "follows") throw Error("Unexpected fixture write");
                mocks.writes.push({ op, owner: mocks.account, payload });
                if (mocks.failWrite)
                  return { data: null, error: { message: "Fixture write denied" } };
                if (op === "insert") {
                  if (payload?.user_id !== mocks.account)
                    return { data: null, error: { message: "Owner mismatch" } };
                  if (
                    mocks.follows.some(
                      (r) =>
                        r.user_id === payload!.user_id &&
                        r.target_type === payload!.target_type &&
                        r.target_id === payload!.target_id,
                    )
                  )
                    return { data: null, error: { message: "Duplicate" } };
                  mocks.follows.push({ ...payload! });
                } else
                  mocks.follows = mocks.follows.filter(
                    (row) => row.user_id !== mocks.account || !predicates.every((p) => p(row)),
                  );
                return { data: null, error: null };
              }
              if (mocks.failRead) return { data: null, error: { message: "Fixture offline" } };
              const rows: Record<string, unknown>[] =
                table === "follows"
                  ? mocks.follows.filter((r) => r.user_id === mocks.account)
                  : table === "profiles"
                    ? [{ id: mocks.account, display_name: "Local fixture" }]
                    : [];
              const data = rows.filter((row) => predicates.every((p) => p(row)));
              return { data: single ? (data[0] ?? null) : data, error: null, count: data.length };
            })
            .then(resolve, reject),
      };
      return chain;
    },
  },
}));
import { RoleProvider } from "@/hooks/use-role";
import { useSessionUser } from "@/hooks/use-session";
import { competitionQuery } from "@/lib/queries";
import { Route } from "@/routes/schedule";
const Schedule = Route.options.component as ComponentType;
function View() {
  const { user, ready, signOut } = useSessionUser();
  return (
    <>
      <p data-testid="identity">{ready ? (user?.id ?? "guest") : "checking"}</p>
      <button onClick={() => void signOut()}>Fixture sign out</button>
      <Schedule />
    </>
  );
}
let qc: QueryClient;
function mount() {
  qc = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: Infinity } } });
  qc.setQueryData(competitionQuery.queryKey, {
    teams: [
      {
        id: "alpha",
        name: "Fixture Alpha",
        data_mode: "real",
        division_id: "division",
        organization: null,
        season: "fixture",
      },
      {
        id: "beta",
        name: "Fixture Beta",
        data_mode: "real",
        division_id: "division",
        organization: null,
        season: "fixture",
      },
    ],
    divisions: [
      {
        id: "division",
        name: "Fixture division",
        data_mode: "real",
        discipline: "indoor",
        season: "fixture",
      },
    ],
    events: [],
    matches: [],
    rankings: [],
    venues: [],
    announcements: [],
  });
  return render(
    <QueryClientProvider client={qc}>
      <RoleProvider>
        <View />
      </RoleProvider>
    </QueryClientProvider>,
  );
}
const alpha = () =>
  within(screen.getByRole("list", { name: "Star teams" })).getByRole("button", {
    name: /Fixture Alpha/,
  });
function openStars() {
  fireEvent.click(screen.getByRole("button", { name: "Starred Team" }));
}
async function ready() {
  await waitFor(() => expect(alpha()).toBeEnabled());
}
function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((r) => {
    resolve = r;
  });
  return { promise, resolve };
}
async function signIn(account: string) {
  mocks.account = account;
  act(() => mocks.event("SIGNED_IN", { user: { id: account } }));
  await waitFor(() => expect(screen.getByTestId("identity")).toHaveTextContent(account));
  openStars();
  await ready();
}
beforeEach(() => {
  sessionStorage.clear();
  localStorage.clear();
  mocks.account = "account-A";
  mocks.follows = [];
  mocks.writes = [];
  mocks.authGate = null;
  mocks.readGate = null;
  mocks.failRead = false;
  mocks.failWrite = false;
});
afterEach(() => {
  cleanup();
  qc?.clear();
});
describe("account stars across real application hooks with local-only service fixtures", () => {
  it("saves team and division to A, survives a fresh cache/remount, and unstars without leaving duplicates", async () => {
    let view = mount();
    openStars();
    await ready();
    fireEvent.click(alpha());
    await waitFor(() => expect(alpha()).toHaveAttribute("aria-pressed", "true"));
    fireEvent.click(screen.getByRole("button", { name: "Divisions" }));
    const division = () =>
      within(screen.getByRole("list", { name: "Star divisions" })).getByRole("button", {
        name: /Fixture division/,
      });
    fireEvent.click(division());
    await waitFor(() => expect(division()).toHaveAttribute("aria-pressed", "true"));
    expect(mocks.follows).toHaveLength(2);
    expect(mocks.follows.every((f) => f.user_id === "account-A")).toBe(true);
    view.unmount();
    qc.clear();
    view = mount();
    openStars();
    await ready();
    expect(alpha()).toHaveAttribute("aria-pressed", "true");
    fireEvent.click(alpha());
    await waitFor(() => expect(alpha()).toHaveAttribute("aria-pressed", "false"));
    expect(mocks.follows).toEqual([
      { user_id: "account-A", target_type: "division", target_id: "division" },
    ]);
    view.unmount();
  });
  it("keeps A stars on the service across logout/login and never displays them as B stars", async () => {
    mount();
    openStars();
    await ready();
    fireEvent.click(alpha());
    await waitFor(() => expect(alpha()).toHaveAttribute("aria-pressed", "true"));
    fireEvent.click(screen.getByRole("button", { name: "Fixture sign out" }));
    await waitFor(() => expect(screen.getByTestId("identity")).toHaveTextContent("guest"));
    await signIn("account-B");
    expect(alpha()).toHaveAttribute("aria-pressed", "false");
    expect(mocks.follows).toEqual([
      { user_id: "account-A", target_type: "team", target_id: "alpha" },
    ]);
    fireEvent.click(alpha());
    await waitFor(() => expect(alpha()).toHaveAttribute("aria-pressed", "true"));
    await signIn("account-A");
    expect(alpha()).toHaveAttribute("aria-pressed", "true");
    fireEvent.click(alpha());
    await waitFor(() => expect(alpha()).toHaveAttribute("aria-pressed", "false"));
    expect(mocks.follows).toEqual([
      { user_id: "account-B", target_type: "team", target_id: "alpha" },
    ]);
  });
  it("cannot create guest stars before verified auth finishes", async () => {
    const gate = deferred();
    mocks.authGate = gate.promise;
    mount();
    openStars();
    expect(alpha()).toBeDisabled();
    fireEvent.click(alpha());
    expect(mocks.writes).toEqual([]);
    expect(localStorage.getItem("ova-guest-stars")).toBeNull();
    await act(async () => gate.resolve());
    await ready();
    fireEvent.click(alpha());
    await waitFor(() => expect(alpha()).toHaveAttribute("aria-pressed", "true"));
    expect(mocks.follows[0]?.user_id).toBe("account-A");
  });
  it("does not insert or overwrite while existing remote stars are still loading", async () => {
    mocks.follows = [{ user_id: "account-A", target_type: "team", target_id: "alpha" }];
    const gate = deferred();
    mocks.readGate = gate.promise;
    mount();
    openStars();
    await waitFor(() => expect(screen.getByTestId("identity")).toHaveTextContent("account-A"));
    expect(alpha()).toBeDisabled();
    fireEvent.click(alpha());
    expect(mocks.writes).toEqual([]);
    await act(async () => {
      mocks.readGate = null;
      gate.resolve();
    });
    await ready();
    expect(alpha()).toHaveAttribute("aria-pressed", "true");
    expect(mocks.writes).toEqual([]);
    expect(mocks.follows).toHaveLength(1);
  });
  it("disables writes on failed household read and retains saved rows", async () => {
    mocks.follows = [{ user_id: "account-A", target_type: "team", target_id: "alpha" }];
    mocks.failRead = true;
    mount();
    openStars();
    await waitFor(() => expect(qc.getQueryState(["household", "account-A"])?.status).toBe("error"));
    expect(alpha()).toBeDisabled();
    fireEvent.click(alpha());
    expect(mocks.writes).toEqual([]);
    expect(mocks.follows).toHaveLength(1);
  });
  it("cancels an unfinished A load before B can display or change its stars", async () => {
    mocks.follows = [
      { user_id: "account-A", target_type: "team", target_id: "alpha" },
      { user_id: "account-B", target_type: "team", target_id: "beta" },
    ];
    const gate = deferred();
    mocks.readGate = gate.promise;
    mount();
    openStars();
    await waitFor(() => expect(screen.getByTestId("identity")).toHaveTextContent("account-A"));
    mocks.account = "account-B";
    act(() => mocks.event("SIGNED_IN", { user: { id: "account-B" } }));
    await waitFor(() => expect(screen.getByTestId("identity")).toHaveTextContent("account-B"));
    openStars();
    expect(alpha()).toBeDisabled();
    await act(async () => {
      mocks.readGate = null;
      gate.resolve();
    });
    await ready();
    expect(alpha()).toHaveAttribute("aria-pressed", "false");
    expect(
      within(screen.getByRole("list", { name: "Star teams" })).getByRole("button", {
        name: /Fixture Beta/,
      }),
    ).toHaveAttribute("aria-pressed", "true");
    expect(qc.getQueryData(["household", "account-A"])).toBeUndefined();
    expect(mocks.writes).toEqual([]);
  });
  it("reports save denial without inventing a saved star or deleting old rows", async () => {
    mocks.failWrite = true;
    mount();
    openStars();
    await ready();
    fireEvent.click(alpha());
    await waitFor(() => expect(screen.getByRole("alert")).toBeInTheDocument());
    expect(alpha()).toHaveAttribute("aria-pressed", "false");
    expect(mocks.follows).toEqual([]);
  });
});
