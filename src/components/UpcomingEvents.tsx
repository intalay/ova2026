import { useId, useState } from "react";
import { Card } from "@/components/AppShell";
import { formatDateMDY } from "@/lib/format";
import type { EventOverview } from "@/lib/upcoming-events";

export function UpcomingEvents({
  events,
  mode,
}: {
  events: readonly EventOverview[];
  mode: string;
}) {
  const ordered = [...events].sort((a, b) => a.startsOn.localeCompare(b.startsOn));
  const listKey = JSON.stringify([mode, ordered]);
  return <EventList key={listKey} events={ordered} />;
}
function EventList({ events }: { events: readonly EventOverview[] }) {
  const [expanded, setExpanded] = useState(false);
  const listId = useId();
  return (
    <>
      <div id={listId} className="grid gap-3">
        {(expanded ? events : events.slice(0, 3)).map((event) => (
          <Card key={event.id}>
            <h3 className="text-xl font-semibold">{event.name}</h3>
            <p className="font-semibold">
              {formatDateMDY(event.startsOn)}
              {event.endsOn !== event.startsOn && <> – {formatDateMDY(event.endsOn)}</>}
            </p>
            <p>{event.divisions}</p>
            <p>{event.location}</p>
            <a
              className="mt-2 inline-flex underline"
              href={event.officialUrl}
              target="_blank"
              rel="noopener noreferrer"
            >
              Official event details
              <span className="sr-only"> for {event.name} (opens in a new tab)</span>
            </a>
          </Card>
        ))}
        {!events.length && <Card>No upcoming event overview is recorded.</Card>}
      </div>
      {events.length > 3 && (
        <button
          type="button"
          className="mx-auto mt-3 flex min-h-12 min-w-12 items-center justify-center rounded-full border focus-visible:outline-2 focus-visible:outline-offset-2"
          aria-label={expanded ? "Show fewer upcoming events" : "Show more upcoming events"}
          aria-expanded={expanded}
          aria-controls={listId}
          onClick={() => setExpanded(!expanded)}
        >
          <span aria-hidden="true">{expanded ? "▲" : "▼"}</span>
        </button>
      )}
    </>
  );
}
