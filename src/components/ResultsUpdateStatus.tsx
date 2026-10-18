import { useId } from "react";
import { ArrowUpRight, CheckCircle2, Clock3, History, TriangleAlert } from "lucide-react";
import { Card } from "@/components/AppShell";
import { formatDate, TZ } from "@/lib/format";
import { calendarDateSchema, instantSchema } from "@/lib/result-sync/normalize";
import type {
  EventResultSource,
  RecordedResultsSummary,
  ResultSyncState,
} from "@/lib/result-sync/model";
import { eventResultSource, validateOfficialResultsUrl } from "@/lib/result-sync/sources";

export type ResultsUpdateStatusProps = {
  eventId?: string | null;
  dataMode?: "real" | "synthetic" | "all";
  /** Explicit reviewed event binding. Omit to use the checked local catalog. */
  source?: EventResultSource | null;
  /** Only a COMPLETE event/mode summary; omit if current API cannot supply one. */
  summary?: RecordedResultsSummary | null;
  syncState?: ResultSyncState | null;
  automaticUpdates?: "disabled" | "not_configured" | "enabled" | "unknown";
};

function validInstant(value: string | null | undefined): value is string {
  return !!value && instantSchema.safeParse(value).success;
}

export function ResultsUpdateStatus({
  eventId,
  dataMode = "real",
  source: suppliedSource,
  summary,
  syncState,
  automaticUpdates = "disabled",
}: ResultsUpdateStatusProps) {
  const headingId = useId();
  const candidate =
    suppliedSource === undefined ? eventResultSource(eventId, dataMode) : suppliedSource;
  const source =
    candidate && candidate.eventId === eventId && candidate.dataMode === dataMode
      ? candidate
      : null;
  const officialUrl =
    source && dataMode === "real"
      ? validateOfficialResultsUrl(
          source.officialResultsUrl,
          source.provider,
          source.upstreamEventId,
        )
      : null;
  const state =
    source &&
    syncState?.scope.key === source.key &&
    syncState.scope.eventId === eventId &&
    syncState.scope.dataMode === dataMode
      ? syncState
      : null;
  const success = state?.lastSuccess;
  const lastSuccessAt = validInstant(success?.completedAt) ? success.completedAt : null;
  const facts =
    summary && summary.eventId === eventId && summary.dataMode === dataMode ? summary : null;
  const completed = facts?.completedResults ?? success?.completedResults;
  const latestDate = facts ? facts.latestMatchDate : success?.latestMatchDate;
  const matchDate = calendarDateSchema.safeParse(latestDate).success ? latestDate : null;
  const demo = dataMode === "synthetic";
  const failed = state?.lastRun.status === "failed";
  const running = state?.lastRun.status === "running";
  const inactive = automaticUpdates === "disabled" || automaticUpdates === "not_configured";
  const title = demo
    ? "Synthetic demo results"
    : failed
      ? "Results update delayed"
      : inactive
        ? "Historical results"
        : running
          ? "Checking for results"
          : lastSuccessAt
            ? "Results updated"
            : "Update status unavailable";
  const Icon = failed
    ? TriangleAlert
    : running
      ? Clock3
      : lastSuccessAt && !inactive
        ? CheckCircle2
        : History;
  const description = failed
    ? "The latest update failed. Previously recorded results are still available. Check the official results for newer scores."
    : demo
      ? "These are synthetic results for demonstration. They do not confirm official scores."
      : inactive
        ? "Showing recorded results. Check this event's official results for the latest scores."
        : running
          ? "Previously recorded results remain available while this update is checked."
          : lastSuccessAt
            ? "Showing results from the last successful sync. Official results may be newer."
            : "Recorded results remain available. The latest successful sync cannot be confirmed.";

  return (
    <section aria-labelledby={headingId} className="min-w-0">
      <Card className="space-y-4">
        <div className="flex items-start gap-3">
          <Icon
            aria-hidden
            className={`mt-1 size-5 shrink-0 ${failed ? "text-destructive" : "text-primary"}`}
          />
          <div className="min-w-0 space-y-1">
            <h2 id={headingId} className="module-heading">
              {title}
            </h2>
            <p className="text-sm text-muted-foreground" role="status">
              {description}
            </p>
            {(inactive || demo) && (
              <p className="text-sm font-semibold">Automatic updates not enabled</p>
            )}
          </div>
        </div>
        <dl className="grid gap-4 text-sm sm:grid-cols-3">
          <div className="min-w-0">
            <dt className="text-muted-foreground">Recorded results</dt>
            <dd className="mt-1 font-semibold">
              {Number.isInteger(completed) && completed! >= 0
                ? `${completed} completed ${completed === 1 ? "match" : "matches"}`
                : "Not confirmed"}
            </dd>
          </div>
          <div className="min-w-0">
            <dt className="text-muted-foreground">Last successful sync</dt>
            <dd className="mt-1 font-semibold">
              {lastSuccessAt ? (
                <time dateTime={lastSuccessAt}>
                  {new Intl.DateTimeFormat("en-CA", {
                    timeZone: TZ,
                    year: "numeric",
                    month: "short",
                    day: "numeric",
                    hour: "numeric",
                    minute: "2-digit",
                    timeZoneName: "short",
                  }).format(new Date(lastSuccessAt))}
                </time>
              ) : (
                "Not recorded"
              )}
            </dd>
          </div>
          <div className="min-w-0">
            <dt className="text-muted-foreground">Latest match date</dt>
            <dd className="mt-1 font-semibold">
              {matchDate ? (
                <time dateTime={matchDate}>{formatDate(matchDate)}</time>
              ) : (
                "Date to be determined"
              )}
            </dd>
          </div>
        </dl>
        <p className="text-sm text-muted-foreground">
          Scores awaiting an update stay pending and are excluded from win rates.
        </p>
        {officialUrl && source ? (
          <a
            href={officialUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex min-h-11 items-center gap-1 rounded-md font-semibold text-primary underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring"
          >
            Official results · {source.provider === "timu" ? "TIMU" : "AES"}
            <ArrowUpRight aria-hidden className="size-4 shrink-0" />
            <span className="sr-only"> opens in a new tab</span>
          </a>
        ) : !demo ? (
          <p className="text-sm text-muted-foreground">
            {eventId
              ? "Official results link is not configured for this event."
              : "Select an event to view its official results link."}
          </p>
        ) : null}
      </Card>
    </section>
  );
}
