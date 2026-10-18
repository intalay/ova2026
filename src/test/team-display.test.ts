import { describe, expect, it } from "vitest";
import {
  clubTeamOptions,
  eventPairOptions,
  isAnonymousPair,
  searchTeamOptions,
  teamDisplayName,
  teamPresentation,
  type DisplayTeam,
  type TeamDisplayContext,
} from "@/lib/team-display";
const eventId = "event_070bb34b268b3e11e73be5e4c6444b77";
const divisionId = "division_b2fa55d41edc118b8a04650638faaaae";
const defensaA: DisplayTeam = {
  id: "team_b940a6810962dd4623faf766a5c1f413",
  name: "Defensa [entry c1f413]",
  division_id: divisionId,
  data_mode: "real",
};
const defensaB: DisplayTeam = {
  id: "team_e446e8aedaeb6dcc7aad1f037cf4a2e0",
  name: "Defensa [entry f4a2e0]",
  division_id: divisionId,
  data_mode: "real",
};
const pair: DisplayTeam = {
  id: "team_06112784ba57dd5225cc8298783f89a2",
  name: "Pair01",
  division_id: "division_808e802f89811dd2d4fcfd439c6ef1ab",
  data_mode: "real",
};
const pairEventId = "event_9167b2df9d2ea0ff914bf71186663eb4";
const context: TeamDisplayContext = {
  divisions: [
    { id: divisionId, name: "6v6 Girls Division 2" },
    { id: pair.division_id!, name: "15U Girls Premier" },
  ],
  events: [
    { id: eventId, name: "2026 Ontario Championships - Event 2" },
    { id: pairEventId, name: "MyTeam 15U Girls Premier — May 16, 2026" },
  ],
  teamEvents: [
    { teamId: defensaA.id, eventId },
    { teamId: defensaB.id, eventId },
    { teamId: pair.id, eventId: pairEventId },
  ],
};
describe("reviewed team display and simple search", () => {
  it("shows the confirmed club name and moves machine entry suffixes to a clear secondary identifier", () => {
    const label = teamPresentation(defensaA, context);
    expect(label.primary).toBe("Defensa");
    expect(label.secondary).toBe(
      "6v6 Girls Division 2 · 2026 Ontario Championships - Event 2 · Team entry #1 · Real source",
    );
    expect(label.full).not.toContain("c1f413");
    expect(label.full).not.toContain("[entry");
  });
  it("keeps same-name same-event same-division entries separately identifiable without merging IDs", () => {
    const a = teamPresentation(defensaA, context);
    const b = teamPresentation(defensaB, context);
    expect(a.primary).toBe(b.primary);
    expect(a.entryLabel).toBe("Team entry #1");
    expect(b.entryLabel).toBe("Team entry #2");
    expect(a.full).not.toBe(b.full);
    expect(
      searchTeamOptions([defensaA, defensaB], "defensa division 2", context).map((t) => t.id),
    ).toEqual([defensaA.id, defensaB.id]);
    expect(
      teamPresentation(defensaA, { ...context, teamEvents: [...context.teamEvents].reverse() })
        .entryLabel,
    ).toBe(a.entryLabel);
  });
  it("excludes only audited anonymous pair IDs from ordinary club candidates", () => {
    const realClub = { ...pair, id: "unreviewed-club-with-a-valid-name" };
    expect(isAnonymousPair(realClub)).toBe(false);
    expect(teamDisplayName(realClub)).toBe("Pair01");
    expect(clubTeamOptions([pair, realClub, defensaA]).map((t) => t.id)).toEqual([
      realClub.id,
      defensaA.id,
    ]);
  });
  it("retains anonymous pair event results with a clear label and the same stable ID", () => {
    expect(teamDisplayName(pair)).toBe("Anonymous pair 01");
    expect(eventPairOptions([pair, defensaA], pairEventId, context).map((t) => t.id)).toEqual([
      pair.id,
    ]);
    expect(eventPairOptions([pair], eventId, context)).toEqual([]);
    expect(eventPairOptions([pair], "", context)).toEqual([]);
    expect(teamPresentation(pair, context).full).toBe(
      "Anonymous pair 01 · 15U Girls Premier · MyTeam 15U Girls Premier — May 16, 2026 · Real source",
    );
  });
  it("uses only reviewed safe labels even if a known pair carries a changed raw label", () => {
    expect(teamDisplayName({ ...pair, name: "Unreviewed original personal label" })).toBe(
      "Anonymous pair 01",
    );
  });
  it("does not interpret unknown Entry-like text or copied synthetic IDs as reviewed real aliases", () => {
    const unknown = { ...defensaA, id: "unreviewed-entry" };
    expect(teamPresentation(unknown, context).primary).toBe("Defensa");
    expect(teamPresentation(unknown, context).entryLabel).toBe("");
    expect(isAnonymousPair({ ...pair, data_mode: "synthetic" })).toBe(false);
    expect(teamDisplayName({ ...pair, data_mode: "synthetic" })).toBe("Pair01");
  });
  it("searches by safe name plus actual event and division without exposing hidden hash tokens", () => {
    expect(
      searchTeamOptions([defensaA, defensaB], "DEFENSA   championships division 2", context),
    ).toEqual([defensaA, defensaB]);
    expect(searchTeamOptions([defensaA], "c1f413", context)).toEqual([]);
    expect(searchTeamOptions([defensaA, defensaB], "team entry #2", context)).toEqual([defensaB]);
  });
  it("does not assign unrelated teams to an event merely because they share a division", () => {
    const unrelated = { ...defensaA, id: "unrelated" };
    expect(teamPresentation(unrelated, context).secondary).toContain("Event to be determined");
    expect(teamPresentation(unrelated, context).secondary).not.toContain("Ontario Championships");
    expect(eventPairOptions([pair], pairEventId, { ...context, teamEvents: [] })).toEqual([]);
  });
  it("leaves stored team objects, all IDs and input arrays unchanged", () => {
    const teams = Object.freeze([Object.freeze({ ...defensaA }), Object.freeze({ ...pair })]);
    const before = JSON.stringify(teams);
    clubTeamOptions(teams);
    searchTeamOptions(teams, "", context);
    eventPairOptions(teams, pairEventId, context);
    teamPresentation(teams[0]!, context);
    expect(JSON.stringify(teams)).toBe(before);
    expect(searchTeamOptions(teams, "", context)).toHaveLength(2);
  });
});

it("omits nameless Entry placeholders from club choices without removing input records", () => {
  const rows = [{ ...defensaA, id: "unreviewed", name: "Entry 42" }, defensaA];
  expect(clubTeamOptions(rows)).toEqual([defensaA]);
  expect(rows).toHaveLength(2);
});
