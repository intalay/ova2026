import { competitionDate } from "./next-match";

/** Source-checked event overviews, independent of team fixtures and Results. */
export type EventOverview = {
  id: string;
  name: string;
  startsOn: string;
  endsOn: string;
  divisions: string;
  location: string;
  officialUrl: string;
};
export const OFFICIAL_EVENT_OVERVIEWS: readonly EventOverview[] = [
  {
    id: "ova-17ug-fall-classic-2026",
    name: "17U Girls Fall Classic",
    startsOn: "2026-10-31",
    endsOn: "2026-11-01",
    divisions: "17U Girls · 24 teams",
    location: "Burlington · Alton Recreation Centre / Corpus Christi CSS / Notre Dame CSS",
    officialUrl: "https://www.ontariovolleyball.org/event/show/588388607?dy=1&mth=11&yr=2026",
  },
  {
    id: "ova-fall-classic-event-1-2026",
    name: "Fall Classic · Event 1",
    startsOn: "2026-11-06",
    endsOn: "2026-11-07",
    divisions: "16U Girls · Division 1: 48 teams · Division 2: 48 teams",
    location: "Cohere Centre, Ottawa · 4899 Uplands Dr, Ottawa, ON K1V 2N6",
    officialUrl: "https://www.ontariovolleyball.org/fall-classic",
  },
  {
    id: "ova-fall-classic-event-2-2026",
    name: "Fall Classic · Event 2",
    startsOn: "2026-11-07",
    endsOn: "2026-11-08",
    divisions: "18U Girls: 48 teams · 16U Boys: 24 teams · 18U Boys: 24 teams",
    location: "Cohere Centre, Ottawa · 4899 Uplands Dr, Ottawa, ON K1V 2N6",
    officialUrl: "https://www.ontariovolleyball.org/fall-classic",
  },
  {
    id: "ova-17ub-fall-classic-2026",
    name: "17U Boys Fall Classic",
    startsOn: "2026-11-14",
    endsOn: "2026-11-15",
    divisions: "17U Boys · Top 24 teams",
    location: "Venue to be determined",
    officialUrl: "https://www.ontariovolleyball.org/news_article/show/1362866",
  },
  {
    id: "ova-18ub-challenge-cup-2026",
    name: "18U Boys Challenge Cup",
    startsOn: "2026-12-12",
    endsOn: "2026-12-12",
    divisions: "18U Boys",
    location: "Venue to be determined",
    officialUrl: "https://www.ontariovolleyball.org/news_article/show/1362866",
  },
  {
    id: "ova-18ug-challenge-cup-2026",
    name: "18U Girls Challenge Cup",
    startsOn: "2026-12-13",
    endsOn: "2026-12-13",
    divisions: "18U Girls",
    location: "Venue to be determined",
    officialUrl: "https://www.ontariovolleyball.org/news_article/show/1362866",
  },
];
export function upcomingEventOverviews(now = new Date()) {
  const today = competitionDate(now);
  return OFFICIAL_EVENT_OVERVIEWS.filter((event) => event.endsOn >= today).sort((a, b) =>
    a.startsOn.localeCompare(b.startsOn),
  );
}
