import { expect, it } from "vitest";
import { OFFICIAL_EVENT_OVERVIEWS, upcomingEventOverviews } from "@/lib/upcoming-events";
it("includes source-linked event overviews even with no team fixtures", () => {
  expect(upcomingEventOverviews(new Date("2026-10-18T12:00:00Z"))).toHaveLength(6);
  expect(
    OFFICIAL_EVENT_OVERVIEWS.every((event) =>
      event.officialUrl.startsWith("https://www.ontariovolleyball.org/"),
    ),
  ).toBe(true);
  expect(OFFICIAL_EVENT_OVERVIEWS.map((event) => event.startsOn)).toEqual([
    "2026-10-31",
    "2026-11-06",
    "2026-11-07",
    "2026-11-14",
    "2026-12-12",
    "2026-12-13",
  ]);
});
it("retains ongoing date-only events through their Toronto end date, and drops past events", () => {
  expect(upcomingEventOverviews(new Date("2026-11-08T18:00:00Z")).map((event) => event.id)).toEqual(
    [
      "ova-fall-classic-event-2-2026",
      "ova-17ub-fall-classic-2026",
      "ova-18ub-challenge-cup-2026",
      "ova-18ug-challenge-cup-2026",
    ],
  );
  expect(upcomingEventOverviews(new Date("2026-12-14T18:00:00Z"))).toEqual([]);
});
