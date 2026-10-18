import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";
import { DemoTeamTrend } from "@/components/DemoTeamTrend";
import type { CompetitionData } from "@/lib/queries";
afterEach(cleanup);
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
  expect(screen.getByText(/cannot be calculated/)).toBeInTheDocument();
  expect(screen.queryByRole("img")).not.toBeInTheDocument();
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
