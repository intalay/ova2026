import { Link } from "@tanstack/react-router";
import { MapPin, ArrowUpRight } from "lucide-react";
import type { Match } from "@/lib/queries";
import { formatDateTime, formatDateTimeShort, teamLabel, teamLabelShort, TBD_SHORT } from "@/lib/format";
import { Card, Tbd } from "./AppShell";
import { HomeLine } from './HomeLine';

type Lookup = { teams: { id: string; name: string }[]; events: { id: string; name: string }[]; venues: { id: string; name: string }[] };

export function MatchCard({ m, data, focusTeam, compact = false, fullSchedule = false }: { m: Match; data: Lookup; focusTeam?: string | undefined; compact?: boolean; fullSchedule?: boolean }) {
  const name = (id: string | null) => data.teams.find((t) => t.id === id)?.name ?? null;
  const event = data.events.find((e) => e.id === m.event_id)?.name;
  const venue = data.venues.find((v) => v.id === m.venue_id);
  const final = m.status === "final";
  const won = final && focusTeam && m.score_a !== null && m.score_b !== null ? (focusTeam === m.team_a_id ? m.score_a > m.score_b : m.score_b > m.score_a) : null;
  const pending = !final && (!m.team_b_id || !m.venue_id || !m.starts_at);
  if (compact && !final) return (
    <Card className={`home-match${fullSchedule ? " home-match--linked" : ""}`}>
      {event && <HomeLine className="home-match-event">{event}</HomeLine>}
      <HomeLine className="home-match-teams">
        {name(m.team_a_id) ?? <span className="home-unknown">{teamLabel(null)}</span>}
        <span className="home-match-versus"> vs </span>
        {name(m.team_b_id) ?? <span className="home-unknown">{teamLabel(null)}</span>}
      </HomeLine>
      <HomeLine className={`home-match-date ${m.starts_at ? '' : 'home-unknown'}`}>{formatDateTime(m.starts_at, m.source_date)}</HomeLine>
      <div className="home-match-location"><MapPin aria-hidden className="size-4 shrink-0"/>
        <HomeLine>{venue ? <Link to="/venue/$id" params={{id:venue.id}} className="font-semibold underline underline-offset-4">{venue.name}{m.court ? ` · ${m.court}` : ''}</Link> : <span className="home-unknown">Venue {TBD.toLowerCase()}</span>}</HomeLine>
      </div>
      {fullSchedule && <Link to="/schedule" className="home-match-full">Full schedule<ArrowUpRight aria-hidden className="size-4 shrink-0"/></Link>}
    </Card>
  );
  return (
    <Card className={pending ? "match-pending" : ""}>
      <p className="text-base text-muted-foreground">{event}</p>
      <p className="match-teams mt-1 text-xl font-bold">
        {name(m.team_a_id)} <span className="font-bold text-muted-foreground">vs</span>{" "}

        {m.team_b_id ? name(m.team_b_id) : <Tbd>{teamLabel(null)}</Tbd>}
      </p>
      {final ? (
        <p className="mt-1 text-lg">
          <span className="font-semibold">{m.score_a}–{m.score_b}</span> sets
          {won !== null && <span className={`ml-2 rounded px-2 py-0.5 font-semibold ${won ? "bg-success text-success-foreground" : "bg-secondary text-secondary-foreground"}`}>{won ? "Won" : "Lost"}</span>}
          {m.sets && <span className="ml-2 text-muted-foreground">({m.sets.map((s) => `${s.a}-${s.b}`).join(", ")})</span>}
        </p>
      ) : (
        <p className="match-date mt-1 text-lg">{m.starts_at ? formatDateTime(m.starts_at) : <Tbd>{formatDateTime(null, m.source_date)}</Tbd>}</p>
      )}
      {!final && (
        <p className="mt-1 flex items-center gap-1.5 text-base">
          <MapPin aria-hidden className="size-5" />
          {venue ? (
            <Link to="/venue/$id" params={{ id: venue.id }} className="font-semibold text-primary underline underline-offset-4">
              {venue.name}{m.court ? ` · ${m.court}` : ""}
            </Link>
          ) : <Tbd>Venue {TBD.toLowerCase()}</Tbd>}
        </p>
      )}
    </Card>
  );
}
