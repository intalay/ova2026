import { Link } from "@tanstack/react-router";
import { MapPin } from "lucide-react";
import type { Match } from "@/lib/queries";
import { formatDateTime, teamLabel, TBD } from "@/lib/format";
import { Card, Tbd } from "./AppShell";

type Lookup = { teams: { id: string; name: string }[]; events: { id: string; name: string }[]; venues: { id: string; name: string }[] };

export function MatchCard({ m, data, focusTeam }: { m: Match; data: Lookup; focusTeam?: string | undefined }) {
  const name = (id: string | null) => data.teams.find((t) => t.id === id)?.name ?? null;
  const event = data.events.find((e) => e.id === m.event_id)?.name;
  const venue = data.venues.find((v) => v.id === m.venue_id);
  const final = m.status === "final";
  const won = final && focusTeam && m.score_a !== null && m.score_b !== null ? (focusTeam === m.team_a_id ? m.score_a > m.score_b : m.score_b > m.score_a) : null;
  return (
    <Card>
      <p className="text-base text-muted-foreground">{event}</p>
      <p className="mt-1 text-xl font-bold">
        {name(m.team_a_id)} <span className="font-normal text-muted-foreground">vs</span>{" "}
        {m.team_b_id ? name(m.team_b_id) : <Tbd>{teamLabel(null)}</Tbd>}
      </p>
      {final ? (
        <p className="mt-1 text-lg">
          <span className="font-bold">{m.score_a}–{m.score_b}</span> sets
          {won !== null && <span className={`ml-2 rounded px-2 py-0.5 font-bold ${won ? "bg-success text-success-foreground" : "bg-secondary text-secondary-foreground"}`}>{won ? "Won" : "Lost"}</span>}
          {m.sets && <span className="ml-2 text-muted-foreground">({m.sets.map((s) => `${s.a}-${s.b}`).join(", ")})</span>}
        </p>
      ) : (
        <p className="mt-1 text-lg">{m.starts_at ? formatDateTime(m.starts_at) : <Tbd>{formatDateTime(null, m.source_date)}</Tbd>}</p>
      )}
      {!final && (
        <p className="mt-1 flex items-center gap-1.5 text-base">
          <MapPin aria-hidden className="size-5" />
          {venue ? (
            <Link to="/venue/$id" params={{ id: venue.id }} className="font-bold text-primary underline underline-offset-4">
              {venue.name}{m.court ? ` · ${m.court}` : ""}
            </Link>
          ) : <Tbd>Venue {TBD.toLowerCase()}</Tbd>}
        </p>
      )}
    </Card>
  );
}
