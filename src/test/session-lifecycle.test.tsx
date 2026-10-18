import { useState } from "react";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider, useQuery } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  event: undefined as unknown as (event: string, session: unknown) => void,
  getUser: vi.fn(),
  signOut: vi.fn(),
  subscribe: vi.fn(),
  unsubscribe: vi.fn(),
  read: vi.fn(),
}));
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth: {
      getUser: mocks.getUser,
      signOut: mocks.signOut,
      onAuthStateChange: (callback: typeof mocks.event) => {
        mocks.subscribe();
        mocks.event = callback;
        return { data: { subscription: { unsubscribe: mocks.unsubscribe } } };
      },
    },
  },
}));
import { HOME_DATA_MODE_KEY } from "@/lib/home-data-mode";
import { SessionProvider, useSessionUser } from "@/hooks/use-session";
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((r) => {
    resolve = r;
  });
  return { promise, resolve };
}
function View() {
  const { user, ready, signOut } = useSessionUser();
  const [draft, setDraft] = useState("");
  const privateData = useQuery({
    queryKey: ["team-announcements", user?.id],
    enabled: !!user,
    queryFn: ({ signal }) => mocks.read(user?.id, signal),
    retry: false,
  });
  return (
    <main>
      <p>{ready ? (user?.id ?? "guest") : "checking"}</p>
      <p>{privateData.data ?? "no private data"}</p>
      <input aria-label="Draft" value={draft} onChange={(e) => setDraft(e.target.value)} />
      <button
        onClick={() => {
          void signOut().catch(() => {});
        }}
      >
        Sign out
      </button>
    </main>
  );
}
let qc: QueryClient;
function mount(children = <View />) {
  qc = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: Infinity } } });
  return render(
    <QueryClientProvider client={qc}>
      <SessionProvider>{children}</SessionProvider>
    </QueryClientProvider>,
  );
}
beforeEach(() => {
  vi.clearAllMocks();
  sessionStorage.clear();
  mocks.getUser.mockResolvedValue({ data: { user: { id: "account-A" } }, error: null });
  mocks.signOut.mockResolvedValue({ error: null });
  mocks.read.mockImplementation(async (id) => `PRIVATE ${id}`);
});
afterEach(() => {
  cleanup();
  qc?.clear();
});
describe("one auth lifecycle for every identity consumer (local Auth events only)", () => {
  it("shares one subscription and initialization across multiple hook consumers", async () => {
    function Other() {
      return <p>{useSessionUser().ready ? "other ready" : "other checking"}</p>;
    }
    mount(
      <>
        <View />
        <Other />
      </>,
    );
    await screen.findByText("account-A");
    await screen.findByText("other ready");
    expect(mocks.getUser).toHaveBeenCalledTimes(1);
    expect(mocks.subscribe).toHaveBeenCalledTimes(1);
  });
  it("immediately removes all private caches and local context on a cross-tab SIGNED_OUT, even offline", async () => {
    mount();
    await screen.findByText("PRIVATE account-A");
    for (const key of [
      ["household", "account-A"],
      ["identity-approvals", "account-A"],
      ["coach-request", "account-A"],
      ["staff-coach-requests", "account-A"],
      ["competition"],
    ])
      qc.setQueryData(key, { private: true });
    qc.setQueryData(["competition", "public"], { announcements: ["public"] });
    qc.getMutationCache().build(qc, { mutationKey: ["private-mutation"] });
    sessionStorage.setItem("ova-browse:account-A:coach", "team-A");
    sessionStorage.setItem("ova-family-preview:account-A:child", "private name");
    sessionStorage.setItem("ova-role", "coach");
    fireEvent.change(screen.getByLabelText("Draft"), { target: { value: "old private draft" } });
    mocks.read.mockRejectedValue(new Error("offline"));
    act(() => mocks.event("SIGNED_OUT", null));
    await screen.findByText("guest");
    expect(screen.queryByText("PRIVATE account-A")).not.toBeInTheDocument();
    expect(screen.getByLabelText("Draft")).toHaveValue("");
    expect(
      qc
        .getQueryCache()
        .getAll()
        .filter((q) => q.state.data && q.queryKey[1] !== "public"),
    ).toEqual([]);
    expect(qc.getQueryData(["competition", "public"])).toEqual({ announcements: ["public"] });
    expect(Object.keys(sessionStorage)).toEqual([HOME_DATA_MODE_KEY]);
    expect(JSON.parse(sessionStorage.getItem(HOME_DATA_MODE_KEY)!)).toEqual({
      owner: null,
      mode: "real",
    });
    expect(qc.getMutationCache().getAll()).toEqual([]);
    act(() => mocks.event("TOKEN_REFRESHED", { user: { id: "account-A" } }));
    expect(screen.getByText("guest")).toBeInTheDocument();
  });
  it.each(["SIGNED_OUT", "SIGNED_IN"])(
    "does not let late getUser override a newer %s event",
    async (event) => {
      const initial = deferred<{ data: { user: { id: string } } }>();
      mocks.getUser.mockReturnValue(initial.promise);
      mount();
      expect(screen.getByText("checking")).toBeInTheDocument();
      act(() => mocks.event(event, event === "SIGNED_IN" ? { user: { id: "account-B" } } : null));
      await act(async () => initial.resolve({ data: { user: { id: "old-account" } } }));
      expect(screen.getByText(event === "SIGNED_IN" ? "account-B" : "guest")).toBeInTheDocument();
      expect(screen.queryByText("old-account")).not.toBeInTheDocument();
    },
  );
  it("drops a late A query after switching directly A to B and cannot repopulate A on a later sign-in", async () => {
    const old = deferred<string>();
    let oldSignal!: AbortSignal;
    mocks.read.mockImplementation((id, signal) => {
      if (id === "account-A") {
        oldSignal = signal;
        return old.promise;
      }
      return Promise.resolve(`PRIVATE ${id}`);
    });
    mount();
    await screen.findByText("account-A");
    await waitFor(() => expect(oldSignal).toBeDefined());
    act(() => mocks.event("SIGNED_IN", { user: { id: "account-B" } }));
    await screen.findByText("PRIVATE account-B");
    expect(oldSignal.aborted).toBe(true);
    mocks.read.mockResolvedValue("FRESH PRIVATE A");
    act(() => mocks.event("SIGNED_IN", { user: { id: "account-A" } }));
    await screen.findByText("FRESH PRIVATE A");
    await act(async () => old.resolve("LATE PRIVATE A"));
    expect(qc.getQueryData(["team-announcements", "account-A"])).toBe("FRESH PRIVATE A");
    expect(screen.queryByText("LATE PRIVATE A")).not.toBeInTheDocument();
  });
  it("retains the same account query and draft during token refresh", async () => {
    mount();
    await screen.findByText("PRIVATE account-A");
    fireEvent.change(screen.getByLabelText("Draft"), { target: { value: "current draft" } });
    act(() => mocks.event("TOKEN_REFRESHED", { user: { id: "account-A" } }));
    expect(screen.getByLabelText("Draft")).toHaveValue("current draft");
    expect(mocks.read).toHaveBeenCalledTimes(1);
  });
  it.each([false, true])(
    "local sign-out clears identity before the network finishes (network failure: %s)",
    async (fails) => {
      const result = deferred<{ error: Error | null }>();
      mocks.signOut.mockReturnValue(result.promise);
      mount();
      await screen.findByText("PRIVATE account-A");
      fireEvent.click(screen.getByRole("button", { name: "Sign out" }));
      await screen.findByText("guest");
      expect(qc.getQueryData(["team-announcements", "account-A"])).toBeUndefined();
      await act(async () => result.resolve({ error: fails ? new Error("offline") : null }));
      act(() => mocks.event("TOKEN_REFRESHED", { user: { id: "account-A" } }));
      expect(screen.getByText("guest")).toBeInTheDocument();
      act(() => mocks.event("SIGNED_IN", { user: { id: "account-B" } }));
      await screen.findByText("account-B");
    },
  );
  it("fails closed when initial getUser rejects and unsubscribes on unmount", async () => {
    mocks.getUser.mockRejectedValue(new Error("offline"));
    const view = mount();
    await screen.findByText("guest");
    expect(mocks.read).not.toHaveBeenCalled();
    view.unmount();
    expect(mocks.unsubscribe).toHaveBeenCalledTimes(1);
    act(() => mocks.event("SIGNED_IN", { user: { id: "after-unmount" } }));
    expect(qc.getQueryData(["team-announcements", "after-unmount"])).toBeUndefined();
  });
});

it("preserves a same-owner homepage mode on ordinary refresh but resets on logout and account switches", async () => {
  vi.resetModules();
  const { useHomeDataMode } = await import("@/hooks/use-home-data-mode");
  const { SessionProvider: FreshSessionProvider, useSessionUser: useFreshSession } =
    await import("@/hooks/use-session");
  sessionStorage.setItem(
    HOME_DATA_MODE_KEY,
    JSON.stringify({ owner: "account-A", mode: "synthetic" }),
  );
  sessionStorage.setItem("ova-startup-played:v1", "1");
  function ModeView() {
    const identity = useFreshSession();
    const home = useHomeDataMode(identity);
    return (
      <>
        <p>{identity.ready ? (identity.user?.id ?? "guest") : "checking"}</p>
        <p>Home mode: {home.mode}</p>
        <button onClick={() => home.setMode("synthetic")}>Demo homepage</button>
      </>
    );
  }
  qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={qc}>
      <FreshSessionProvider>
        <ModeView />
      </FreshSessionProvider>
    </QueryClientProvider>,
  );
  await screen.findByText("account-A");
  await screen.findByText("Home mode: synthetic");
  act(() => mocks.event("TOKEN_REFRESHED", { user: { id: "account-A" } }));
  expect(screen.getByText("Home mode: synthetic")).toBeInTheDocument();
  act(() => mocks.event("SIGNED_OUT", null));
  expect(screen.getByText("Home mode: real")).toBeInTheDocument();
  expect(sessionStorage.getItem("ova-startup-played:v1")).toBe("1");
  act(() => mocks.event("SIGNED_IN", { user: { id: "account-A" } }));
  fireEvent.click(screen.getByRole("button", { name: "Demo homepage" }));
  expect(screen.getByText("Home mode: synthetic")).toBeInTheDocument();
  act(() => mocks.event("SIGNED_IN", { user: { id: "account-B" } }));
  expect(screen.getByText("Home mode: real")).toBeInTheDocument();
});
