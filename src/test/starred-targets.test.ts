import { describe, expect, it } from "vitest";
import {
  STARRED_TARGETS_PAGE_SIZE,
  buildStarredTargets,
  starredDisplayContext,
  starredTargetsPage,
} from "@/lib/starred-targets";
import type { DisplayTeam } from "@/lib/team-display";
const teams: DisplayTeam[] = Array.from({ length: 21 }, (_, i) => ({
  id: `t-${i}`,
  name: `Team ${String(i).padStart(2, "0")}`,
  division_id: "d",
  data_mode: "real",
}));
const divisions = [{ id: "d", name: "Division 1", data_mode: "real" }];
const context = starredDisplayContext({
  events: [{ id: "e", name: "Actual event" }],
  divisions,
  matches: teams.map((t) => ({
    event_id: "e",
    team_a_id: t.id,
    team_b_id: null,
    data_mode: "real",
  })),
});
const options = {
  kind: "team" as const,
  query: "",
  starredOnly: false,
  followed: new Set<string>(),
  page: 0,
};
describe("starred target pagination only", () => {
  it("uses exactly ten for this component, independently of Browse team page size", () => {
    expect(STARRED_TARGETS_PAGE_SIZE).toBe(10);
    const targets = buildStarredTargets(teams, divisions, context);
    expect(
      [0, 1, 2].map((page) => starredTargetsPage(targets, { ...options, page }).rows.length),
    ).toEqual([10, 10, 1]);
    expect(starredTargetsPage(targets, { ...options, page: 2 })).toMatchObject({
      pageIndex: 2,
      pageCount: 3,
      total: 21,
      start: 21,
      end: 21,
    });
  });
  it("clamps a removed final-page item to a valid page without inventing rows", () => {
    const targets = buildStarredTargets(teams, divisions, context);
    expect(
      starredTargetsPage(targets.filter((target) => target.kind === "team").slice(0, 10), {
        ...options,
        page: 3,
      }),
    ).toMatchObject({
      pageIndex: 0,
      pageCount: 1,
      total: 10,
    });
    expect(starredTargetsPage([], { ...options, page: 9 })).toMatchObject({
      rows: [],
      total: 0,
      pageCount: 0,
      start: 0,
      end: 0,
    });
  });
  it("searches safe labels and scopes while stars come only from exact controlled keys", () => {
    const targets = buildStarredTargets(teams, divisions, context);
    const followed = new Set(["team:t-2", "division:d", "team:unavailable"]);
    expect(
      starredTargetsPage(targets, { ...options, starredOnly: true, followed }).rows.map(
        (t) => t.id,
      ),
    ).toEqual(["t-2"]);
    expect(
      starredTargetsPage(targets, {
        ...options,
        kind: "division",
        starredOnly: true,
        followed,
      }).rows.map((t) => t.id),
    ).toEqual(["d"]);
    expect(
      starredTargetsPage(targets, { ...options, query: "actual event team 03" }).rows.map(
        (t) => t.id,
      ),
    ).toEqual(["t-3"]);
  });
  it("derives event labels from actual public match participation, including future matches, and deduplicates", () => {
    const c = starredDisplayContext({
      events: context.events,
      divisions,
      matches: [
        { event_id: "e", team_a_id: "t-0", team_b_id: "t-1", data_mode: "real" },
        { event_id: "e", team_a_id: "t-0", team_b_id: null, data_mode: "real" },
        { event_id: "demo", team_a_id: "t-0", team_b_id: null, data_mode: "synthetic" },
      ],
    });
    expect(c.teamEvents).toEqual([
      { teamId: "t-0", eventId: "e" },
      { teamId: "t-1", eventId: "e" },
    ]);
    expect(
      buildStarredTargets([{ ...teams[0]!, id: "unrelated" }], divisions, c).find(
        (t) => t.kind === "team",
      )?.secondary,
    ).toContain("Event to be determined");
  });
  it("keeps an already-starred anonymous pair manageable but does not add it to club discovery", () => {
    const pair = { ...teams[0]!, id: "team_06112784ba57dd5225cc8298783f89a2", name: "Pair01" };
    const targets = buildStarredTargets([pair], divisions, context);
    expect(starredTargetsPage(targets, options).rows).toEqual([]);
    expect(
      starredTargetsPage(targets, {
        ...options,
        starredOnly: true,
        followed: new Set([`team:${pair.id}`]),
      }).rows[0]?.primary,
    ).toBe("Anonymous pair 01");
  });
  it("keeps source arrays and followed keys unchanged and does not show synthetic records", () => {
    const before = JSON.stringify({ teams, divisions, context });
    const followed = new Set(["team:t-1", "team:old-hidden"]);
    const targets = buildStarredTargets(
      [...teams, { ...teams[0]!, id: "demo", data_mode: "synthetic" }],
      [...divisions, { id: "demo-div", name: "Demo", data_mode: "synthetic" }],
      context,
    );
    starredTargetsPage(targets, { ...options, followed, page: -4 });
    expect(targets.some((t) => t.id.startsWith("demo"))).toBe(false);
    expect(JSON.stringify({ teams, divisions, context })).toBe(before);
    expect([...followed]).toEqual(["team:t-1", "team:old-hidden"]);
  });
});

it("keeps explicitly selected Demo starred candidates isolated from Real defaults", () => {
  const demo = {
    id: "demo-sand",
    name: "Sand & Sky",
    division_id: "demo-div",
    data_mode: "synthetic",
  };
  const real = { id: "real-club", name: "Real club", division_id: "real-div", data_mode: "real" };
  const data = {
    events: [
      { id: "demo-event", name: "Demo event" },
      { id: "real-event", name: "Real event" },
    ],
    divisions: [],
    matches: [
      { event_id: "demo-event", team_a_id: "demo-sand", team_b_id: null, data_mode: "synthetic" },
      { event_id: "real-event", team_a_id: "real-club", team_b_id: null, data_mode: "real" },
    ],
  };
  const realContext = starredDisplayContext(data);
  expect(buildStarredTargets([demo, real], [], realContext).map((t) => t.id)).toEqual([
    "real-club",
  ]);
  const demoContext = starredDisplayContext(data, "synthetic");
  expect(demoContext.teamEvents).toEqual([{ teamId: "demo-sand", eventId: "demo-event" }]);
  expect(buildStarredTargets([demo, real], [], demoContext, "synthetic").map((t) => t.id)).toEqual([
    "demo-sand",
  ]);
});
