import type { ComponentType, ReactNode } from "react";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ParentIdentity } from "@/hooks/use-parent-context";
import { parentHousehold } from "./parent-context.fixture";
const mocks = vi.hoisted(() => ({
  rpc: vi.fn(),
  identity: {} as ParentIdentity,
  invalidate: vi.fn(),
  selectRole: vi.fn(),
}));
vi.mock("@tanstack/react-router", () => ({
  createFileRoute: () => (options: unknown) => ({ options }),
  useNavigate: () => vi.fn(),
  Link: ({ children }: { children: ReactNode }) => <a>{children}</a>,
}));
vi.mock("@tanstack/react-query", () => ({
  useSuspenseQuery: () => ({ data: { teams: [] } }),
  useQuery: () => ({ data: null, isPending: false, isError: false }),
  useQueryClient: () => ({ invalidateQueries: mocks.invalidate }),
}));
vi.mock("@/hooks/use-role", () => ({
  useRole: () => ({ ...mocks.identity, requested: "family_friends", selectRole: mocks.selectRole }),
}));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { rpc: mocks.rpc } }));
vi.mock("@/lib/queries", () => ({ competitionQuery: {} }));
vi.mock("@/components/AccountApprovals", () => ({ AccountApprovals: () => null }));
vi.mock("@/components/AppShell", () => ({
  AppShell: ({ children }: { children: ReactNode }) => <main>{children}</main>,
  Card: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  Section: ({ children }: { children: ReactNode }) => <section>{children}</section>,
  btn: { input: "" },
}));
import { Route } from "@/routes/account";
const Account = Route.options.component as ComponentType;
function deferred() {
  let resolve!: (result: unknown) => void;
  const promise = new Promise((resolvePromise) => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
}
const preview = (player: string) => ({
  data: { purpose: "FAMILY", player_name: player, team_name: `${player} team` },
  error: null,
});
async function openConnect() {
  const view = render(<Account />);
  fireEvent.click(screen.getByRole("button", { name: "Friends & Family" }));
  return view;
}
function enter(code: string) {
  fireEvent.change(screen.getByRole("textbox", { name: "Player family code" }), {
    target: { value: code },
  });
}
beforeEach(() => {
  vi.clearAllMocks();
  mocks.invalidate.mockResolvedValue(undefined);
  mocks.identity = {
    user: { id: "parent" },
    role: "family_friends",
    ready: true,
    household: {
      data: { ...parentHousehold(), linkedPlayers: [], familyLinks: [] },
      isPending: false,
      isError: false,
    },
  };
});
afterEach(cleanup);
describe("pairing preview and redemption identity", () => {
  it("ignores a stale response after changing the input and blocks redemption without a fresh preview", async () => {
    const a = deferred();
    mocks.rpc.mockReturnValue(a.promise);
    await openConnect();
    enter("CODE-A");
    fireEvent.click(screen.getByRole("button", { name: "Verify code" }));
    enter("CODE-B");
    await act(async () => a.resolve(preview("Alex")));
    expect(screen.queryByText("Code verified")).not.toBeInTheDocument();
    expect(screen.queryByText("Alex")).not.toBeInTheDocument();
    fireEvent.submit(screen.getByRole("textbox", { name: "Player family code" }).closest("form")!);
    expect(mocks.rpc.mock.calls.map((call) => call[0])).toEqual(["preview_pairing_code"]);
  });
  it("keeps a newer preview when responses arrive out of order and redeems the exact previewed code", async () => {
    const a = deferred();
    const b = deferred();
    mocks.rpc.mockImplementation((name: string, args: { _code: string }) =>
      name === "redeem_code"
        ? Promise.resolve({ error: null })
        : args._code === "CODE-A"
          ? a.promise
          : b.promise,
    );
    await openConnect();
    enter("CODE-A");
    fireEvent.click(screen.getByRole("button", { name: "Verify code" }));
    enter("CODE-B");
    fireEvent.click(screen.getByRole("button", { name: "Verify code" }));
    await act(async () => b.resolve(preview("Blair")));
    expect(screen.getByText("Blair")).toBeInTheDocument();
    await act(async () => a.resolve(preview("Alex")));
    expect(screen.queryByText("Alex")).not.toBeInTheDocument();
    expect(screen.getByText("Blair")).toBeInTheDocument();
    fireEvent.change(screen.getByRole("textbox", { name: "Your name" }), {
      target: { value: "Fixture Parent" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Confirm & continue" }));
    await waitFor(() =>
      expect(mocks.rpc).toHaveBeenCalledWith("redeem_code", {
        _code: "CODE-B",
        _display_name: "Fixture Parent",
        _relationship: "parent",
      }),
    );
    expect(mocks.rpc.mock.calls.filter((call) => call[0] === "redeem_code")).toHaveLength(1);
  });
  it("invalidates an already verified code when input changes", async () => {
    mocks.rpc.mockResolvedValue(preview("Alex"));
    await openConnect();
    enter("CODE-A");
    fireEvent.click(screen.getByRole("button", { name: "Verify code" }));
    await screen.findByText("Code verified");
    enter("CODE-B");
    expect(screen.queryByRole("button", { name: "Confirm & continue" })).not.toBeInTheDocument();
    fireEvent.submit(screen.getByRole("textbox", { name: "Player family code" }).closest("form")!);
    expect(mocks.rpc.mock.calls.filter((call) => call[0] === "redeem_code")).toHaveLength(0);
  });
  it("discards in-flight previews on a role change", async () => {
    const a = deferred();
    mocks.rpc.mockReturnValue(a.promise);
    await openConnect();
    enter("CODE-A");
    fireEvent.click(screen.getByRole("button", { name: "Verify code" }));
    fireEvent.click(screen.getByRole("button", { name: "Choose another role" }));
    fireEvent.click(screen.getByRole("button", { name: /^Player$/ }));
    await act(async () => a.resolve(preview("Alex")));
    expect(screen.queryByText("Code verified")).not.toBeInTheDocument();
    expect(screen.queryByText("Alex")).not.toBeInTheDocument();
  });
  it("discards previews when the account changes or logs out", async () => {
    const a = deferred();
    mocks.rpc.mockReturnValue(a.promise);
    const view = await openConnect();
    enter("CODE-A");
    fireEvent.click(screen.getByRole("button", { name: "Verify code" }));
    mocks.identity = { ...mocks.identity, user: { id: "other-parent" } };
    view.rerender(<Account />);
    await act(async () => a.resolve(preview("Alex")));
    expect(screen.queryByText("Code verified")).not.toBeInTheDocument();
    mocks.identity = { ...mocks.identity, user: null };
    view.rerender(<Account />);
    expect(screen.queryByRole("button", { name: "Confirm & continue" })).not.toBeInTheDocument();
  });
  it("recovers from a failed current preview without allowing a redemption", async () => {
    mocks.rpc.mockRejectedValue(new Error("Fixture preview unavailable"));
    await openConnect();
    enter("CODE-A");
    fireEvent.click(screen.getByRole("button", { name: "Verify code" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Fixture preview unavailable");
    expect(screen.getByRole("button", { name: "Verify code" })).toBeEnabled();
    expect(screen.queryByRole("button", { name: "Confirm & continue" })).not.toBeInTheDocument();
  });
});

it("does not update a different account registration when redemption completes after an account switch", async () => {
  const redemption = deferred();
  mocks.rpc.mockImplementation((name: string) =>
    name === "redeem_code"
      ? redemption.promise
      : Promise.resolve({ data: { purpose: "TEAM", team_name: "Fixture team" }, error: null }),
  );
  const view = render(<Account />);
  fireEvent.click(screen.getByRole("button", { name: /^Player$/ }));
  fireEvent.change(screen.getByRole("textbox", { name: "Team verification code" }), {
    target: { value: "TEAM-CODE" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Verify code" }));
  await screen.findByText("Code verified");
  fireEvent.change(screen.getByRole("textbox", { name: "Player name" }), {
    target: { value: "Fixture Player" },
  });
  fireEvent.change(screen.getByRole("textbox", { name: "Jersey number" }), {
    target: { value: "7" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Confirm & continue" }));
  mocks.selectRole.mockClear();
  mocks.identity = { ...mocks.identity, user: { id: "other-player" } };
  view.rerender(<Account />);
  await act(async () => redemption.resolve({ error: null }));
  expect(
    mocks.rpc.mock.calls.filter((call) => call[0] === "update_player_registration"),
  ).toHaveLength(0);
  expect(mocks.selectRole).not.toHaveBeenCalled();
});
