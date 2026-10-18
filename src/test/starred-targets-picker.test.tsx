import { useState } from "react";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  StarredTargetsPicker,
  type StarredTargetsPickerProps,
} from "@/components/StarredTargetsPicker";
import { starredDisplayContext } from "@/lib/starred-targets";
const teams = Array.from({ length: 21 }, (_, i) => ({
  id: `t-${i}`,
  name: `Club ${String(i).padStart(2, "0")}`,
  division_id: "d-0",
  data_mode: "real",
}));
const divisions = Array.from({ length: 12 }, (_, i) => ({
  id: `d-${i}`,
  name: `Division ${String(i).padStart(2, "0")}`,
  data_mode: "real",
}));
const context = starredDisplayContext({
  divisions,
  events: [{ id: "e", name: "Actual event" }],
  matches: teams.map((team) => ({
    event_id: "e",
    team_a_id: team.id,
    team_b_id: null,
    data_mode: "real",
  })),
});
function fixture(patch: Partial<StarredTargetsPickerProps> = {}) {
  const onToggle = vi.fn();
  const props = { teams, divisions, context, followed: new Set<string>(), onToggle, ...patch };
  return { ...render(<StarredTargetsPicker {...props} />), onToggle, props };
}
const rows = () => within(screen.getByRole("list", { name: "Star teams" })).getAllByRole("button");
afterEach(() => {
  cleanup();
  localStorage.clear();
});
describe("ten-at-a-time starred targets", () => {
  it("renders ten real team rows, page/total and no native team dropdown or fabricated stars", () => {
    fixture();
    expect(rows()).toHaveLength(10);
    expect(rows().every((row) => row.getAttribute("aria-pressed") === "false")).toBe(true);
    expect(screen.getByRole("status")).toHaveTextContent("21 teams · Showing 1–10");
    expect(screen.getByText("Page 1 of 3")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Previous" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Next" })).toBeEnabled();
    expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
  });
  it("moves through 10/10/1 rows with previous and next", () => {
    fixture();
    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    expect(rows()).toHaveLength(10);
    expect(rows()[0]).toHaveTextContent("Club 10");
    expect(screen.getByText("Page 2 of 3")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    expect(rows()).toHaveLength(1);
    expect(rows()[0]).toHaveTextContent("Club 20");
    expect(screen.getByRole("button", { name: "Next" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Previous" }));
    expect(rows()[0]).toHaveTextContent("Club 10");
  });
  it("resets pagination for search and clear, without toggling any star", () => {
    const { onToggle } = fixture();
    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    fireEvent.change(screen.getByRole("searchbox", { name: "Search teams" }), {
      target: { value: "Club 20" },
    });
    expect(screen.getByText("Page 1 of 1")).toBeInTheDocument();
    expect(rows()).toHaveLength(1);
    fireEvent.click(screen.getByRole("button", { name: "Clear starred search" }));
    expect(screen.getByText("Page 1 of 3")).toBeInTheDocument();
    expect(onToggle).not.toHaveBeenCalled();
  });
  it("resets pagination on team/division and Starred only filters", () => {
    fixture({ followed: new Set(["team:t-20"]) });
    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    fireEvent.click(screen.getByRole("button", { name: "Divisions" }));
    expect(
      within(screen.getByRole("list", { name: "Star divisions" })).getAllByRole("button"),
    ).toHaveLength(10);
    expect(screen.getByText("Page 1 of 2")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Teams" }));
    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    fireEvent.click(screen.getByRole("button", { name: "Starred only" }));
    expect(screen.getByText("Page 1 of 1")).toBeInTheDocument();
    expect(rows()[0]).toHaveTextContent("Club 20");
    expect(screen.getByRole("status")).toHaveTextContent("1 team · Showing 1–1");
  });
  it("delegates the original kind/id and waits for controlled persistence before showing a star", async () => {
    const { onToggle, rerender, props } = fixture();
    fireEvent.click(rows()[0]!);
    await waitFor(() => expect(onToggle).toHaveBeenCalledExactlyOnceWith("team", "t-0"));
    expect(rows()[0]).toHaveAttribute("aria-pressed", "false");
    rerender(<StarredTargetsPicker {...props} followed={new Set(["team:t-0"])} />);
    expect(rows()[0]).toHaveAttribute("aria-pressed", "true");
  });
  it("preserves a guest-style saved Set across remounts and pages with isolated storage fixtures", async () => {
    function Controlled() {
      const [followed, setFollowed] = useState(
        () => new Set<string>(JSON.parse(localStorage.getItem("isolated-star-fixture") ?? "[]")),
      );
      return (
        <StarredTargetsPicker
          teams={teams}
          divisions={divisions}
          context={context}
          followed={followed}
          onToggle={(kind, id) => {
            const key = `${kind}:${id}`;
            const next = new Set(followed);
            if (next.has(key)) next.delete(key);
            else next.add(key);
            localStorage.setItem("isolated-star-fixture", JSON.stringify([...next]));
            setFollowed(next);
          }}
        />
      );
    }
    const view = render(<Controlled />);
    fireEvent.click(rows()[0]!);
    await waitFor(() => expect(rows()[0]).toHaveAttribute("aria-pressed", "true"));
    view.unmount();
    render(<Controlled />);
    expect(rows()[0]).toHaveAttribute("aria-pressed", "true");
    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    fireEvent.click(screen.getByRole("button", { name: "Previous" }));
    expect(rows()[0]).toHaveAttribute("aria-pressed", "true");
  });
  it("clamps a removed last item back to a populated page and restores keyboard focus", async () => {
    function Controlled() {
      const [followed, setFollowed] = useState(
        new Set(teams.slice(0, 11).map((t) => `team:${t.id}`)),
      );
      return (
        <StarredTargetsPicker
          teams={teams}
          divisions={divisions}
          context={context}
          followed={followed}
          onToggle={(kind, id) => {
            const next = new Set(followed);
            next.delete(`${kind}:${id}`);
            setFollowed(next);
          }}
        />
      );
    }
    render(<Controlled />);
    fireEvent.click(screen.getByRole("button", { name: "Starred only" }));
    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    expect(rows()).toHaveLength(1);
    act(() => rows()[0]!.focus());
    fireEvent.click(rows()[0]!);
    await waitFor(() => expect(screen.getByText("Page 1 of 1")).toBeInTheDocument());
    expect(rows()).toHaveLength(10);
    await waitFor(() => expect(rows()[0]).toHaveFocus());
  });
  it("shows a truthful empty state after removing the last saved item", async () => {
    function Controlled() {
      const [followed, setFollowed] = useState(new Set(["team:t-0"]));
      return (
        <StarredTargetsPicker
          teams={teams}
          divisions={divisions}
          context={context}
          followed={followed}
          onToggle={() => setFollowed(new Set())}
        />
      );
    }
    render(<Controlled />);
    fireEvent.click(screen.getByRole("button", { name: "Starred only" }));
    act(() => rows()[0]!.focus());
    fireEvent.click(rows()[0]!);
    expect(await screen.findByText(/No starred teams in this view/)).toBeInTheDocument();
    expect(
      screen.queryByRole("navigation", { name: "Starred items pages" }),
    ).not.toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("0 teams");
    await waitFor(() =>
      expect(screen.getByRole("searchbox", { name: "Search teams" })).toHaveFocus(),
    );
  });
  it("prevents duplicate pending toggles and leaves actual state unchanged on an error", async () => {
    let reject!: (error: Error) => void;
    const pending = new Promise<void>((_, no) => {
      reject = no;
    });
    const onToggle = vi.fn(() => pending);
    fixture({ onToggle });
    fireEvent.click(rows()[0]!);
    fireEvent.click(rows()[0]!);
    expect(onToggle).toHaveBeenCalledTimes(1);
    expect(rows().every((row) => row.hasAttribute("disabled"))).toBe(true);
    await act(async () => reject(new Error("Fixture save rejected")));
    expect(screen.getByRole("alert")).toHaveTextContent("Could not update this star");
    expect(rows()[0]).toHaveAttribute("aria-pressed", "false");
    expect(rows()[0]).toBeEnabled();
  });
  it("supports row arrows, Home/End and PageUp/PageDown without trapping Tab", () => {
    fixture();
    act(() => rows()[0]!.focus());
    fireEvent.keyDown(rows()[0]!, { key: "ArrowDown" });
    expect(rows()[1]).toHaveFocus();
    fireEvent.keyDown(rows()[1]!, { key: "End" });
    expect(rows()[9]).toHaveFocus();
    fireEvent.keyDown(rows()[9]!, { key: "PageDown" });
    expect(screen.getByText("Page 2 of 3")).toBeInTheDocument();
    expect(rows()[0]).toHaveFocus();
    fireEvent.keyDown(rows()[0]!, { key: "PageUp" });
    expect(screen.getByText("Page 1 of 3")).toBeInTheDocument();
    expect(fireEvent.keyDown(rows()[0]!, { key: "Tab" })).toBe(true);
  });
  it("keeps safe same-scope Defensa labels separately toggleable", async () => {
    const a = {
      id: "team_b940a6810962dd4623faf766a5c1f413",
      name: "Defensa [entry c1f413]",
      division_id: "d-0",
      data_mode: "real",
    };
    const b = { ...a, id: "team_e446e8aedaeb6dcc7aad1f037cf4a2e0", name: "Defensa [entry f4a2e0]" };
    const { onToggle } = fixture({
      teams: [a, b],
      context: {
        ...context,
        teamEvents: [
          { teamId: a.id, eventId: "e" },
          { teamId: b.id, eventId: "e" },
        ],
      },
    });
    expect(rows()).toHaveLength(2);
    expect(rows()[0]).toHaveTextContent("Team entry #1");
    expect(rows()[1]).toHaveTextContent("Team entry #2");
    expect(screen.queryByText(/c1f413|f4a2e0/)).not.toBeInTheDocument();
    fireEvent.click(rows()[1]!);
    await waitFor(() => expect(onToggle).toHaveBeenCalledExactlyOnceWith("team", b.id));
  });
  it("retains an already-starred anonymous pair for unstar management without discovering anonymous candidates", async () => {
    const pair = { ...teams[0]!, id: "team_06112784ba57dd5225cc8298783f89a2", name: "Pair01" };
    const { onToggle } = fixture({ teams: [pair], followed: new Set([`team:${pair.id}`]) });
    expect(screen.getByRole("status")).toHaveTextContent("0 teams");
    fireEvent.click(screen.getByRole("button", { name: "Starred only" }));
    expect(rows()[0]).toHaveTextContent("Anonymous pair 01");
    fireEvent.click(rows()[0]!);
    await waitFor(() => expect(onToggle).toHaveBeenCalledExactlyOnceWith("team", pair.id));
  });
  it("keeps a clear no-results search and does not prune unavailable saved IDs", () => {
    const followed = new Set(["team:unavailable", "division:removed"]);
    fixture({ followed });
    fireEvent.change(screen.getByRole("searchbox", { name: "Search teams" }), {
      target: { value: "not-in-source" },
    });
    expect(screen.getByRole("status")).toHaveTextContent("0 teams");
    expect(screen.getByText(/No teams found/)).toBeInTheDocument();
    expect([...followed]).toEqual(["team:unavailable", "division:removed"]);
  });
});

it("retains loaded stars and cannot toggle while persistence is unavailable", () => {
  const { onToggle, rerender, props } = fixture({
    disabled: true,
    followed: new Set(["team:t-0"]),
  });
  expect(rows()[0]).toHaveAttribute("aria-pressed", "true");
  expect(rows().every((row) => row.hasAttribute("disabled"))).toBe(true);
  fireEvent.click(rows()[0]!);
  expect(onToggle).not.toHaveBeenCalled();
  rerender(<StarredTargetsPicker {...props} disabled={false} />);
  expect(rows()[0]).toBeEnabled();
  expect(rows()[0]).toHaveAttribute("aria-pressed", "true");
});
