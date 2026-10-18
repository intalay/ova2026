import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { renderToString } from "react-dom/server";
import { DemoTeamTrend } from "@/components/DemoTeamTrend";
import type { CompetitionData } from "@/lib/queries";
import { amandaPreviewMatches } from "@/lib/amanda-results-preview";
beforeEach(() =>
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  ),
);
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});
it("keeps Alex on demo-sand and cannot borrow unrelated real or Demo final scores", () => {
  const data = {
    teams: [{ id: "demo-sand", name: "Sand & Sky", data_mode: "synthetic" }],
    matches: [
      {
        id: "scheduled",
        team_a_id: "demo-sand",
        team_b_id: "demo-sun",
        data_mode: "synthetic",
        status: "scheduled",
        score_a: null,
        score_b: null,
      },
      {
        id: "wrong-mode",
        team_a_id: "demo-sand",
        team_b_id: "other",
        data_mode: "real",
        status: "final",
        score_a: 2,
        score_b: 0,
      },
      {
        id: "other-demo-team",
        team_a_id: "demo-north",
        team_b_id: "other",
        data_mode: "synthetic",
        status: "final",
        score_a: 2,
        score_b: 0,
      },
    ],
  } as unknown as CompetitionData;
  const original = structuredClone(data);
  render(<DemoTeamTrend data={data} />);
  expect(screen.getByRole("heading", { name: "Alex · Sand & Sky" })).toBeInTheDocument();
  expect(screen.getByText("0 completed matches · 1 scheduled records")).toBeInTheDocument();
  expect(screen.getByText(/4 existing fixture matches/)).toBeInTheDocument();
  expect(
    screen.getByRole("img", {
      name: "Cumulative match win rate by displayed record: 100%, 50%, 67%, 75%",
    }),
  ).toBeInTheDocument();
  expect(screen.getByText("75%")).toBeInTheDocument();
  expect(data).toEqual(original);
});
it("does not infer a Demo identity from a team with the same name or missing explicit source flag", () => {
  const data = {
    teams: [{ id: "different", name: "Sand & Sky", data_mode: "synthetic" }],
    matches: [],
  } as unknown as CompetitionData;
  const { container } = render(<DemoTeamTrend data={data} />);
  expect(container).toBeEmptyDOMElement();
});
it("uses stored synthetic finals instead of appending fixtures and keeps sources unchanged", () => {
  const data = {
    teams: [{ id: "demo-sand", name: "Sand & Sky", data_mode: "synthetic" }],
    matches: [{ ...amandaPreviewMatches[0], id: "stored-final", score_a: 0, score_b: 2 }],
  } as unknown as CompetitionData;
  const original = structuredClone(data);
  render(<DemoTeamTrend data={data} />);
  expect(screen.getByText("1 completed matches · 0 scheduled records")).toBeInTheDocument();
  expect(
    screen.getByRole("img", {
      name: "Cumulative match win rate by displayed record: 0%",
    }),
  ).toBeInTheDocument();
  expect(screen.queryByText(/4 existing fixture matches/)).not.toBeInTheDocument();
  expect(data).toEqual(original);
});
it("requires the exact synthetic team flag even for the confirmed demo-sand ID", () => {
  const data = {
    teams: [{ id: "demo-sand", name: "Sand & Sky", data_mode: "real" }],
    matches: [],
  } as unknown as CompetitionData;
  const { container } = render(<DemoTeamTrend data={data} />);
  expect(container).toBeEmptyDOMElement();
});

it("keeps the server and first hydration markup empty even when public Demo rows are prefetched", () => {
  const data = {
    teams: [{ id: "demo-sand", name: "Sand & Sky", data_mode: "synthetic" }],
    matches: [],
  } as unknown as CompetitionData;
  expect(renderToString(<DemoTeamTrend data={data} />)).toBe("");
});
