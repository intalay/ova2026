import { useState } from "react";
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { TeamPicker, type TeamPickerProps } from "@/components/TeamPicker";
import type { DisplayTeam, TeamDisplayContext } from "@/lib/team-display";
const teams: DisplayTeam[] = Array.from({ length: 50 }, (_, i) => ({
  id: `club-${i}`,
  name: `Volleyball Club ${String(i).padStart(2, "0")}`,
  division_id: i < 25 ? "div-a" : "div-b",
  data_mode: "real",
}));
const context: TeamDisplayContext = {
  divisions: [
    { id: "div-a", name: "15U Girls Division 1" },
    { id: "div-b", name: "16U Girls Division 2" },
  ],
  events: [
    { id: "event-a", name: "Spring Cup" },
    { id: "event-b", name: "Summer Championship" },
  ],
  teamEvents: teams.map((team, i) => ({
    teamId: team.id,
    eventId: i < 25 ? "event-a" : "event-b",
  })),
};
function fixture(patch: Partial<TeamPickerProps> = {}) {
  const onChange = vi.fn();
  const props = { teams, context, value: "", onChange, ...patch };
  return { ...render(<TeamPicker {...props} />), onChange, props };
}
function type(text: string) {
  const input = screen.getByRole("combobox", { name: "Search teams" });
  fireEvent.change(input, { target: { value: text } });
  return input;
}
afterEach(cleanup);
describe("browsable team picker", () => {
  it("opens all discoverable teams without typing and pages with keyboard selection", () => {
    const { onChange } = fixture({ compact: true });
    const input = screen.getByRole("combobox", { name: "Search teams" });
    fireEvent.focus(input);
    expect(screen.getAllByRole("option")).toHaveLength(10);
    expect(screen.getByText("Page 1 of 5")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Next teams" }));
    expect(screen.getByText("Page 2 of 5")).toBeInTheDocument();
    fireEvent.keyDown(input, { key: "ArrowDown" });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(onChange).toHaveBeenCalledWith("club-10");
    expect(screen.getByRole("group", { name: "Browse team" })).toBeInTheDocument();
  });

  it("starts with concise guidance and no recommendations or native team dropdown", () => {
    fixture();
    expect(screen.getByText("All teams")).toBeInTheDocument();
    expect(screen.getByText(/Search closed/)).toBeInTheDocument();
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
    expect(screen.queryAllByRole("option")).toHaveLength(0);
    expect(screen.getAllByRole("combobox")).toHaveLength(1);
    expect(screen.getByRole("combobox")).toHaveAttribute("aria-expanded", "false");
  });
  it("shows exact counts and at most ten candidates with name first and scope second", () => {
    const { onChange } = fixture();
    type("volleyball");
    expect(screen.getByRole("status")).toHaveTextContent("50 results · Showing 1–10");
    const list = screen.getByRole("listbox", { name: "Matching teams" });
    expect(within(list).getAllByRole("option")).toHaveLength(10);
    expect(within(list).getByText("Volleyball Club 00")).toBeInTheDocument();
    expect(within(list).getAllByText(/15U Girls Division 1 · Spring Cup/)).toHaveLength(10);
    expect(onChange).not.toHaveBeenCalled();
  });
  it("pages instead of appending hundreds of options, then resets pagination for a new query", () => {
    fixture();
    type("volleyball");
    fireEvent.click(screen.getByRole("button", { name: "Next teams" }));
    expect(screen.getByRole("status")).toHaveTextContent("Showing 11–20");
    expect(screen.getByText("Volleyball Club 10")).toBeInTheDocument();
    expect(screen.queryByText("Volleyball Club 00")).not.toBeInTheDocument();
    expect(screen.getAllByRole("option")).toHaveLength(10);
    type("Club 00");
    expect(screen.getByRole("status")).toHaveTextContent("1 result · Showing 1–1");
    expect(screen.getAllByRole("option")).toHaveLength(1);
  });
  it("filters by actual event participation and division without changing the selected team", () => {
    const { onChange } = fixture({ value: "club-1" });
    fireEvent.click(screen.getByRole("button", { name: "Search filters" }));
    fireEvent.change(screen.getByRole("combobox", { name: "Event" }), {
      target: { value: "event-b" },
    });
    expect(screen.getByRole("status")).toHaveTextContent("25 results");
    expect(screen.getByRole("combobox", { name: "Division" })).toHaveTextContent(
      "16U Girls Division 2",
    );
    expect(screen.getByRole("combobox", { name: "Division" })).not.toHaveTextContent(
      "15U Girls Division 1",
    );
    fireEvent.change(screen.getByRole("combobox", { name: "Division" }), {
      target: { value: "div-b" },
    });
    type("Club 30");
    expect(within(screen.getByRole("listbox")).getByText("Volleyball Club 30")).toBeInTheDocument();
    expect(onChange).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Clear filters" }));
    expect(screen.getByRole("combobox", { name: "Event" })).toHaveValue("");
  });
  it("selects the original ID with arrows and Enter and exposes only an existing active descendant", () => {
    const { onChange } = fixture();
    const input = type("club");
    input.focus();
    fireEvent.keyDown(input, { key: "ArrowDown" });
    const activeId = input.getAttribute("aria-activedescendant")!;
    expect(document.getElementById(activeId)).toHaveRole("option");
    expect(document.getElementById(activeId)).toHaveTextContent("Volleyball Club 00");
    fireEvent.keyDown(input, { key: "ArrowDown" });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(onChange).toHaveBeenCalledExactlyOnceWith("club-1");
    expect(input).toHaveAttribute("aria-expanded", "false");
    expect(input).not.toHaveAttribute("aria-activedescendant");
  });
  it("does not submit or select from typing Enter before choosing a candidate", () => {
    const { onChange } = fixture();
    const input = type("club");
    expect(fireEvent.keyDown(input, { key: "Enter" })).toBe(false);
    expect(onChange).not.toHaveBeenCalled();
    fireEvent.keyDown(input, { key: "ArrowDown", isComposing: true });
    fireEvent.keyDown(input, { key: "Enter", isComposing: true });
    expect(onChange).not.toHaveBeenCalled();
  });
  it("dismisses on Escape and Tab without trapping focus or losing query or selection", () => {
    const { onChange } = fixture({ value: "club-20" });
    const input = type("club");
    input.focus();
    fireEvent.keyDown(input, { key: "Escape" });
    expect(input).toHaveValue("club");
    expect(input).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
    fireEvent.blur(input);
    fireEvent.focus(input);
    expect(input).toHaveAttribute("aria-expanded", "true");
    expect(fireEvent.keyDown(input, { key: "Tab" })).toBe(true);
    expect(input).toHaveAttribute("aria-expanded", "false");
    expect(onChange).not.toHaveBeenCalled();
  });
  it("closes suggestions when focus leaves the component", () => {
    fixture();
    const input = type("club");
    input.focus();
    const outside = document.createElement("button");
    document.body.append(outside);
    act(() => outside.focus());
    expect(input).toHaveAttribute("aria-expanded", "false");
    outside.remove();
  });
  it("selects a pointer candidate without turning the query into a selection before the click", () => {
    function Controlled() {
      const [value, setValue] = useState("club-20");
      return <TeamPicker teams={teams} context={context} value={value} onChange={setValue} />;
    }
    render(<Controlled />);
    type("club 03");
    expect(screen.getByText("Volleyball Club 20")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("option"));
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
    expect(screen.getByText("Volleyball Club 03")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "All teams" }));
    expect(screen.getByText("All teams")).toBeInTheDocument();
  });
  it("clears the query back to the first browse page and keeps all public data unchanged", () => {
    const before = JSON.stringify({ teams, context });
    fixture();
    type("club");
    fireEvent.click(screen.getByRole("button", { name: "Clear team search" }));
    expect(screen.getByRole("combobox")).toHaveValue("");
    expect(screen.getByRole("listbox")).toBeInTheDocument();
    expect(screen.getAllByRole("option")).toHaveLength(10);
    expect(JSON.stringify({ teams, context })).toBe(before);
  });
  it("has an actionable no-results state without fabricated suggestions", () => {
    const { onChange } = fixture();
    type("not-a-recorded-team");
    expect(screen.getByRole("status")).toHaveTextContent("No teams found");
    expect(screen.queryAllByRole("option")).toHaveLength(0);
    expect(onChange).not.toHaveBeenCalled();
  });
  it("handles loading and failed reads, with retry and no misleading candidate count", () => {
    const { rerender, props } = fixture({ loading: true });
    expect(screen.getByRole("combobox")).toBeDisabled();
    expect(screen.getByRole("status")).toHaveTextContent("Loading teams");
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
    const retry = vi.fn();
    rerender(<TeamPicker {...props} loading={false} error onRetry={retry} />);
    expect(screen.getByRole("alert")).toHaveTextContent("Teams could not be loaded");
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(retry).toHaveBeenCalledOnce();
  });
  it("does not choose another team for a missing or synthetic selected ID", () => {
    const { onChange } = fixture({
      value: "missing",
      teams: [...teams, { ...teams[0]!, id: "demo", name: "Demo only", data_mode: "synthetic" }],
    });
    expect(screen.getByText("Selected team unavailable")).toBeInTheDocument();
    type("Demo only");
    expect(screen.queryAllByRole("option")).toHaveLength(0);
    expect(onChange).not.toHaveBeenCalled();
  });
  it("uses safe labels and keeps same-event Defensa entries separately selectable", () => {
    const division = "division_b2fa55d41edc118b8a04650638faaaae";
    const a = {
      id: "team_b940a6810962dd4623faf766a5c1f413",
      name: "Defensa [entry c1f413]",
      division_id: division,
      data_mode: "real",
    };
    const b = { ...a, id: "team_e446e8aedaeb6dcc7aad1f037cf4a2e0", name: "Defensa [entry f4a2e0]" };
    const { onChange } = fixture({
      teams: [a, b],
      context: {
        divisions: [{ id: division, name: "6v6 Girls Division 2" }],
        events: [{ id: "e", name: "Ontario Championships" }],
        teamEvents: [
          { teamId: a.id, eventId: "e" },
          { teamId: b.id, eventId: "e" },
        ],
      },
    });
    type("Defensa");
    expect(screen.getAllByRole("option")).toHaveLength(2);
    expect(screen.getByText(/Team entry #1/)).toBeInTheDocument();
    expect(screen.getByText(/Team entry #2/)).toBeInTheDocument();
    expect(screen.queryByText(/c1f413|f4a2e0/)).not.toBeInTheDocument();
    fireEvent.click(screen.getAllByRole("option")[1]!);
    expect(onChange).toHaveBeenCalledExactlyOnceWith(b.id);
  });
  it("hides known anonymous pairs from club search while retaining an event-only entry and an existing selection", () => {
    const pair = {
      id: "team_06112784ba57dd5225cc8298783f89a2",
      name: "Pair01",
      division_id: "beach",
      data_mode: "real",
    };
    const ctx = {
      divisions: [...context.divisions, { id: "beach", name: "15U Girls Premier" }],
      events: [...context.events, { id: "myteam", name: "MyTeam May 16" }],
      teamEvents: [...context.teamEvents, { teamId: pair.id, eventId: "myteam" }],
    };
    const { onChange } = fixture({
      teams: [...teams, pair],
      context: ctx,
      eventId: "myteam",
      value: pair.id,
    });
    expect(screen.getByText("Anonymous pair 01")).toBeInTheDocument();
    type("pair");
    expect(screen.queryAllByRole("option")).toHaveLength(0);
    fireEvent.click(screen.getByRole("button", { name: "Anonymous pairs in this event (1)" }));
    const group = screen.getByRole("group", { name: "Anonymous pairs in this event" });
    fireEvent.click(within(group).getByRole("button", { name: /Anonymous pair 01/ }));
    expect(onChange).toHaveBeenCalledExactlyOnceWith(pair.id);
  });
  it("keeps long names and context as separate wrapping text instead of truncating the identity", () => {
    const long = { ...teams[0]!, name: "A very long recorded volleyball club name ".repeat(5) };
    fixture({
      teams: [long],
      context: {
        ...context,
        events: [{ id: "event-a", name: "A very long official event name ".repeat(5) }],
      },
    });
    type("recorded");
    expect(within(screen.getByRole("option")).getByText(long.name.trim())).toBeInTheDocument();
    expect(screen.getByRole("option")).toHaveTextContent("A very long official event name");
  });
});
