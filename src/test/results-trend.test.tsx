import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { ResultsTrend } from "@/components/ResultsTrend";
import { cumulativeWinTrend, resultStats } from "@/lib/results";
import type { Match } from "@/lib/queries";
const scores = [
  ["2026-04-19", 2, 0],
  ["2026-04-19", 2, 0],
  ["2026-04-19", 0, 2],
  ["2026-04-20", 2, 1],
  ["2026-04-20", 0, 2],
  ["2026-04-20", 0, 2],
  ["2026-04-21", 2, 0],
  ["2026-04-21", 1, 2],
  ["2026-04-21", 2, 0],
] as const;
const matches: Match[] = scores.map(([date, a, b], i) => ({
  id: String(i),
  team_a_id: "mine",
  team_b_id: "other",
  source_date: date,
  starts_at: null,
  status: "final",
  score_a: a,
  score_b: b,
  data_mode: "real",
  event_id: "event",
  division_id: "division",
  venue_id: null,
  court: null,
  sets: null,
}));
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
function view() {
  return render(
    <ResultsTrend
      teamId="mine"
      teamName="Hurricanes Category 3 Blue"
      eventName="2026 Ontario Championships"
      matches={matches}
      teams={[{ id: "other", name: "Recorded opponent" }]}
      stats={resultStats(matches, "mine")}
      metric="match"
      daily={cumulativeWinTrend(matches, "mine").map((p) => ({
        ...p,
        date: p.sourceDate.slice(5),
      }))}
      expanded
      onToggle={() => {}}
    />,
  );
}
it("defaults to nine cumulative record points with honest ordering, team, event, date range and compact stats", () => {
  view();
  expect(screen.getByRole("heading", { name: "Hurricanes Category 3 Blue" })).toBeInTheDocument();
  expect(screen.getByText("2026 Ontario Championships")).toBeInTheDocument();
  expect(screen.getByText("04/19/2026 – 04/21/2026")).toBeInTheDocument();
  expect(screen.getByRole("heading", { name: "Cumulative win rate" })).toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Daily cumulative" })).not.toBeInTheDocument();
  expect(
    screen.getByRole("img", { name: /Cumulative match win rate by displayed record:/ }),
  ).toBeInTheDocument();
  expect(screen.getByText(/same-day match order is unconfirmed/)).toBeInTheDocument();
  expect(screen.getByText("56%")).toBeInTheDocument();
});
