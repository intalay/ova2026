import { createFileRoute } from "@tanstack/react-router";
import { useQuery, queryOptions } from "@tanstack/react-query";
import { useState } from "react";
import { ChevronLeft, ChevronRight, ChartNoAxesCombined } from "lucide-react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { AppShell, Section, Card, btn, Tbd } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { competitionQuery, type Match } from "@/lib/queries";
import { getResultsFilters, getResultsPage, getTeamResultsHistory } from "@/lib/results.functions";
import { resultStats, resultSetStats, filterResultsRange, latestCompletedEvent, cumulativeWinTrend, RESULTS_PAGE_SIZE } from "@/lib/results";
import { useRole } from "@/hooks/use-role";
import { formatDate, formatDateMDY, formatDateTime, formatMonthDay } from "@/lib/format";
import { AMANDA_PREVIEW_TEAM, amandaPreviewMatches, previewOpponentName } from "@/lib/amanda-results-preview";

type DataMode = "all" | "real" | "synthetic";
type ResultsSelection = {
  page: number;
  period: "recent" | "history";
  dataMode: DataMode;
  eventId: string;
  teamId: string;
  dateFrom: string;
  dateTo: string;
};
const initialSelection: ResultsSelection = {
  page: 1,
  period: "history",
  dataMode: "real",
  eventId: "",
  teamId: "",
  dateFrom: "",
  dateTo: "",
};
const pageQuery = (selection: ResultsSelection) => {
  const input = {
    page: selection.page,
    pageSize: RESULTS_PAGE_SIZE,
    period: selection.period,
    dataMode: selection.dataMode,
    ...(selection.eventId ? { eventId: selection.eventId } : {}),
    ...(selection.teamId ? { teamId: selection.teamId } : {}),
    ...(selection.dateFrom ? { dateFrom: selection.dateFrom } : {}),
    ...(selection.dateTo ? { dateTo: selection.dateTo } : {}),
  };
  return queryOptions({
    queryKey: ["results-page", input],
    queryFn: () => getResultsPage({ data: input }),
  });
};
const filtersQuery = (dataMode: DataMode) =>
  queryOptions({
    queryKey: ["results-filters", dataMode],
    queryFn: () => getResultsFilters({ data: { dataMode } }),
  });
const sourceLabel = (mode: string) =>
  mode === "real" ? "Real source" : mode === "synthetic" ? "Synthetic demo" : "Source unknown";

export const Route = createFileRoute("/results")({
  head: () => ({
    meta: [
      { title: "Results — OVA Companion" },
      {
        name: "description",
        content: "Volleyball match results, recorded history and confirmed placements.",
      },
      { property: "og:title", content: "OVA volleyball results" },
      {
        property: "og:description",
        content: "Browse recorded match results and your linked team history.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  // Loader data is serialized into the SSR payload, so the browser's first render
  // starts from exactly the same public results page and filter options as the server.
  loader: async ({ context }) => {
    const [, page, filters] = await Promise.all([
      context.queryClient.ensureQueryData(competitionQuery),
      context.queryClient.ensureQueryData(pageQuery(initialSelection)).catch(() => null),
      context.queryClient.ensureQueryData(filtersQuery("real")).catch(() => null),
    ]);
    return { page, filters };
  },
  component: Results,
});

function Results() {
  const { role, household } = useRole();
  const hh = household.data;
  const loaded = Route.useLoaderData();
  const developmentPreview = import.meta.env.DEV && import.meta.env.MODE !== "test";
  const [draft, setSelection] = useState(initialSelection);
  const [teamChosen, setTeamChosen] = useState(false);
  const [eventChosen, setEventChosen] = useState(false);
  const [search, setSearch] = useState("");
  const [expanded, setExpanded] = useState(developmentPreview);
  const [metric, setMetric] = useState<"match" | "set">("match");
  const filters = useQuery({
    ...filtersQuery(draft.dataMode),
    initialData: () => draft.dataMode === "real" ? loaded.filters ?? undefined : undefined,
  });
  // Only exact public source IDs may seed the browsing context. Async identity
  // reads never replace a team or filter the person has already chosen.
  const householdIds = role === "coach" ? hh?.managedTeams ?? [] : role === "player" ?
    (hh?.self?.team_id ? [hh.self.team_id] : []) : role === "family_friends" ?
    hh?.linkedPlayers.flatMap(player => player.team_id ? [player.team_id] : []) ?? [] : [];
  const mappedTeam = householdIds.find(id => filters.data?.teams.some(team => team.id === id && team.data_mode === draft.dataMode));
  const team = draft.teamId || (!teamChosen ? mappedTeam ?? "" : "");
  const teamRecord = filters.data?.teams.find(option => option.id === team && option.data_mode === draft.dataMode);
  const teamMode = teamRecord?.data_mode;
  const fixtureSelected = developmentPreview && draft.dataMode === "synthetic" && team === AMANDA_PREVIEW_TEAM.id;
  const history = useQuery({
    queryKey: ["team-results-history", team, teamMode],
    enabled: !!team && (teamMode === "real" || teamMode === "synthetic"),
    queryFn: () => {
      if (!team || (teamMode !== "real" && teamMode !== "synthetic")) throw new Error("Team source unavailable");
      return getTeamResultsHistory({ data: { teamId: team, dataMode: teamMode } });
    },
  });
  // DEV simulation stays explicit and outside public/query caches.
  const simulatedTeam = fixtureSelected && filters.isSuccess && (!teamRecord || history.isSuccess && !history.data.matches.length);
  const completeMatches = ((simulatedTeam ? amandaPreviewMatches : history.data?.matches ?? []) as Match[])
    .filter(match => (match.team_a_id === team || match.team_b_id === team) && match.data_mode === draft.dataMode);
  const defaultEvent = team && !eventChosen ? latestCompletedEvent(completeMatches, filters.data?.events ?? []) : "";
  const selection = { ...draft, teamId: team, eventId: eventChosen ? draft.eventId : defaultEvent };
  const changeFilters = (patch: Partial<Omit<ResultsSelection, "page">>) => {
    setEventChosen(true); setTeamChosen(true);
    setSelection(current => ({ ...current, teamId: team, eventId: selection.eventId, ...patch, page: 1 }));
  };
  const chooseTeam = (teamId: string) => {
    setTeamChosen(true); setEventChosen(false);
    setSelection(current => ({ ...current, teamId, eventId: "", page: 1 }));
  };
  const validDateRange = !selection.dateFrom || !selection.dateTo || selection.dateFrom <= selection.dateTo;
  const waitingForEvent = !!team && !eventChosen && !simulatedTeam && history.isPending && !!teamRecord;
  const results = useQuery({
    ...pageQuery(selection), enabled: validDateRange && !waitingForEvent,
    initialData: () => !team && draft === initialSelection ? loaded.page ?? undefined : undefined,
  });
  const teamLoading = filters.isPending || (!simulatedTeam && !!team && history.isPending);
  const teamError = !!team && (filters.isError || !simulatedTeam && (history.isError || !teamRecord));
  const displayMode = draft.dataMode;
  const finals = filterResultsRange(completeMatches.filter(match => match.status === "final" &&
    (match.team_a_id === team || match.team_b_id === team) && match.data_mode === displayMode), selection)
    .sort((a, b) => (b.source_date ?? "").localeCompare(a.source_date ?? ""));
  const stats = team && validDateRange && !teamLoading && !teamError ? (metric === "set" ? resultSetStats : resultStats)(finals, team) : null;
  const winTrend = cumulativeWinTrend(finals, team, metric).map(point => ({ ...point, date: formatMonthDay(point.sourceDate) }));
  const placement = (history.data?.rankings ?? [])
    .filter(r => r.team_id === team && r.final_confirmed && r.data_mode === displayMode && (!selection.eventId || r.event_id === selection.eventId))
    .map(r => ({ eventId: r.event_id, event: filters.data?.events.find(event => event.id === r.event_id)?.name ?? "Event to be determined",
      date: filters.data?.events.find(event => event.id === r.event_id)?.end_date ?? "", rank: r.rank, field: r.field_size }))
    .filter(r => r.date && filterResultsRange([{ source_date: r.date, event_id: r.eventId } as Match], selection).length)
    .sort((a, b) => a.date.localeCompare(b.date));
  const totalPages = Math.ceil((results.data?.total ?? 0) / RESULTS_PAGE_SIZE);
  const publicLookup = filters.data
    ? { teams: filters.data.teams, events: filters.data.events }
    : null;
  const availableTeams = filters.data?.teams.filter(option => option.data_mode === draft.dataMode);
  const teamOptionLabel = (option: NonNullable<typeof filters.data>["teams"][number]) => {
    const division = filters.data?.divisions.find((d) => d.id === option.division_id)?.name;
    const eventNames = filters.data?.teamEvents
      .filter((relation) => relation.teamId === option.id)
      .map((relation) => filters.data?.events.find((event) => event.id === relation.eventId)?.name)
      .filter(Boolean);
    const context = [...new Set([division, ...(eventNames ?? [])].filter(Boolean))];
    const sameEntryLabels = filters.data?.teams.filter(other => other.name === option.name && other.division_id === option.division_id);
    const suffix = (sameEntryLabels?.length ?? 0) > 1 && !eventNames?.length ? ` [${option.id.slice(-6)}]` : "";
    return `${option.name}${suffix}${context.length ? ` · ${context.join(" · ")}` : ""} · ${sourceLabel(option.data_mode)}`;
  };
  const publicLoading = results.isPending || filters.isPending || waitingForEvent;
  const publicError = results.isError || filters.isError;

  return (
    <AppShell title="Results" sourceLabel="Sources labeled per result">
      <Section title="Browse results">
        <label className="block font-semibold">Search teams
          <input type="search" className={btn.input} value={search} onChange={event => setSearch(event.target.value)} placeholder="Team, division or event" />
        </label>
        <label className="block font-semibold">Browse team
          <select className={btn.input} value={team} disabled={!filters.data || filters.isError} onChange={event => chooseTeam(event.target.value)}>
            <option value="">All teams · public historical results</option>
            {availableTeams?.filter(option => option.id === team || teamOptionLabel(option).toLowerCase().includes(search.toLowerCase())).map(option =>
              <option key={option.id} value={option.id}>{teamOptionLabel(option)}</option>)}
            {developmentPreview && draft.dataMode === "synthetic" && !availableTeams?.some(option => option.id === AMANDA_PREVIEW_TEAM.id) &&
              <option value={AMANDA_PREVIEW_TEAM.id}>{AMANDA_PREVIEW_TEAM.name} · Local synthetic preview</option>}
          </select>
        </label>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <label className="block font-semibold">
            Period
            <select
              className={btn.input}
              value={selection.period}
              onChange={(e) =>
                changeFilters({ period: e.target.value as ResultsSelection["period"] })
              }
            >
              <option value="recent">Last 3 months</option>
              <option value="history">Historical results · all dates</option>
            </select>
          </label>
          <label className="block font-semibold">
            Results source
            <select
              className={btn.input}
              value={selection.dataMode}
              onChange={(e) =>
                changeFilters({ dataMode: e.target.value as DataMode, eventId: "", teamId: "" })
              }
            >
              <option value="real">Recorded results</option>
              <option value="synthetic">Demo · Synthetic only</option>
            </select>
          </label>
          <details className="space-y-3 sm:col-span-2 lg:col-span-3"><summary className="cursor-pointer font-semibold">Event and date filters</summary>
          <label className="block font-semibold">
            Event
            <select
              className={btn.input}
              value={selection.eventId}
              disabled={!filters.data || filters.isError}
              onChange={(e) => changeFilters({ eventId: e.target.value })}
            >
              <option value="">All events</option>
              {filters.data?.events.map((event) => (
                <option key={event.id} value={event.id}>
                  {event.name} · {sourceLabel(event.data_mode)}
                </option>
              ))}
            </select>
          </label>
          <label className="block font-semibold">
            From date
            <input
              className={btn.input}
              type="date"
              value={selection.dateFrom}
              max={selection.dateTo || undefined}
              onChange={(e) => changeFilters({ dateFrom: e.target.value })}
            />
          </label>
          <label className="block font-semibold">
            To date
            <input
              className={btn.input}
              type="date"
              value={selection.dateTo}
              min={selection.dateFrom || undefined}
              onChange={(e) => changeFilters({ dateTo: e.target.value })}
            />
          </label>
          </details>
        </div>
      </Section>
      {team ? <Section title="Team statistics">
          <label className="block font-semibold">Win rate metric
            <select className={btn.input} value={metric} onChange={event => setMetric(event.target.value as "match" | "set")}>
              <option value="match">Match win rate</option><option value="set">Set win rate</option>
            </select>
          </label>
          {!validDateRange ? <p>Choose a valid date range to view statistics.</p> :
          teamError ? (
            <>
              <p role="alert">Could not load complete team history and source information.</p>
              <Button
                variant="outline"
                onClick={() => {
                  if (filters.isError || (teamMode !== "real" && teamMode !== "synthetic"))
                    void filters.refetch();
                  if (history.isError) void history.refetch();
                }}
              >
                Try team history again
              </Button>
            </>
          ) : teamLoading ? (
            <p role="status">Loading complete team history…</p>
          ) : (
            <>
              {stats && stats.played > 0 && (
                <div className="results-stats grid grid-cols-2">
                  {[
                    [metric === "set" ? "Sets won" : "Wins", stats.wins],
                    [metric === "set" ? "Sets lost" : "Losses", stats.losses],
                    ["Win rate", stats.winRate === null ? "—" : stats.winRate + "%"],
                    ["Loss rate", stats.lossRate === null ? "—" : stats.lossRate + "%"],
                  ].map(([label, value]) => (
                    <div key={label} className="results-stat">
                      <p className="results-stat-label">{label}</p>
                      <p className={`results-stat-value${value === "—" ? " results-stat-missing" : ""}`}>
                        {typeof value === "string" && value.endsWith("%") ? <>{value.slice(0, -1)}<span className="results-stat-percent">%</span></> : value}
                      </p>
                    </div>
                  ))}
                </div>
              )}
              {stats && stats.played === 0 && <p>No decided scores are available for statistics in this range.</p>}
              <p className="text-sm text-muted-foreground">
                {simulatedTeam ? "Synthetic preview · Not saved. " : ""}
                {sourceLabel(displayMode ?? "")} · {simulatedTeam ? "Simulated final matches" : "Recorded final matches in the selected range"} for this team from the
                same source mode. Rates exclude missing scores and tied results. Source labels do
                not confirm official standings.
              </p>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <caption className="mb-3 text-left font-semibold">Team match history</caption>
                  <thead className="border-b">
                    <tr>
                      <th className="py-3">Date</th>
                      <th>Opponent</th>
                      <th>Score</th>
                      <th>Result</th>
                    </tr>
                  </thead>
                  <tbody>
                    {finals.map((m) => {
                      const mine = m.team_a_id === team ? m.score_a : m.score_b;
                      const other = m.team_a_id === team ? m.score_b : m.score_a;
                      return (
                        <tr key={m.id} className="border-b">
                          <td className="py-4 pr-3">{formatDateMDY(m.source_date)}</td>
                          <td className="pr-3">
                            {filters.data?.teams.find(
                              (t) => t.id === (m.team_a_id === team ? m.team_b_id : m.team_a_id),
                            )?.name ?? (simulatedTeam ? previewOpponentName(m) : "Opponent to be determined")}
                          </td>
                          <td className="pr-3">
                            {mine ?? "—"}–{other ?? "—"}
                          </td>
                          <td>
                            {mine === null || other === null
                              ? "To be determined"
                              : mine > other
                                ? "Won"
                                : mine < other
                                  ? "Lost"
                                  : "Tied"}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                {!finals.length && (
                  <p className="py-4">
                    No recorded matches for this team in the selected range.
                  </p>
                )}
              </div>
            </>
          )}
          <Button variant="outline" aria-expanded={expanded} onClick={() => setExpanded(!expanded)}>
            <ChartNoAxesCombined aria-hidden />
            {expanded ? "Hide results trend" : "View results trend"}
          </Button>
          {expanded && validDateRange && (
            <div className="space-y-4">
              {validDateRange && !teamLoading && !teamError && winTrend.length > 0 && (
                <>
                  <p>Cumulative {metric} win rate in selected range{simulatedTeam ? " · Simulated" : ""}</p>
                  {winTrend.length === 1 && <p>{winTrend[0]?.date} · {winTrend[0]?.winRate}%</p>}
                  <div className="h-64 min-w-0" role="img" aria-label={`Cumulative ${metric} win rate in selected range: ${winTrend.map((point) => point.winRate === null ? "TBD" : `${point.winRate}%`).join(", ")}`}>
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={winTrend} margin={{ top: 12, right: 20, bottom: 8, left: 0 }}>
                        <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
                        <XAxis dataKey="date" stroke="var(--muted-foreground)" />
                        <YAxis domain={[0, 100]} unit="%" width={48} stroke="var(--muted-foreground)" />
                        <Tooltip formatter={(value) => [`${value}%`, "Win rate"]} />
                        <Line dataKey="winRate" stroke="var(--chart-1)" strokeWidth={3} dot={{ r: 4 }} isAnimationActive={false} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </>
              )}
              {validDateRange && !teamLoading && !teamError && !winTrend.length && <p>No dated, decided results in this period. No win-rate data available.</p>}
              {teamError ? (
                <p>Complete team history is unavailable. Retry team history to view placements.</p>
              ) : teamLoading ? (
                <p role="status">Loading confirmed placements…</p>
              ) : placement.length ? (
                <>
                  <div className="h-64" aria-hidden>
                    <ResponsiveContainer>
                      <LineChart data={placement}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="event" />
                        <YAxis reversed allowDecimals={false} />
                        <Tooltip />
                        <Line
                          dataKey="rank"
                          stroke="var(--chart-1)"
                          strokeWidth={3}
                          isAnimationActive={false}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                  <ul className="space-y-2">
                    {placement.map((p) => (
                      <li key={p.eventId}>
                        {p.event}: {p.rank} of {p.field ?? "field size to be determined"}
                      </li>
                    ))}
                  </ul>
                </>
              ) : (
                <p>
                  No confirmed final placements in this period. Missing months are not plotted as
                  zero.
                </p>
              )}
            </div>
          )}
        </Section> : <p className="text-sm text-muted-foreground">Select a team to view statistics and trends for the same results range.</p>}
      <Section title="All results">
        {!validDateRange ? (
          <p role="alert">From date must be on or before To date.</p>
        ) : publicError ? (
          <>
            <p role="alert">
              {filters.isError
                ? "Could not load result filters and names."
                : "Could not load results."}
            </p>
            <Button
              variant="outline"
              onClick={() => {
                if (results.isError) void results.refetch();
                if (filters.isError) void filters.refetch();
              }}
            >
              Try again
            </Button>
          </>
        ) : publicLoading ? (
          <p role="status">Loading results…</p>
        ) : results.data?.matches.length && publicLookup ? (
          <ul className="space-y-3">
            {results.data.matches.map((m) => {
              const nameA = publicLookup.teams.find((t) => t.id === m.team_a_id)?.name ?? null;
              const nameB = m.team_b_id
                ? (publicLookup.teams.find((t) => t.id === m.team_b_id)?.name ?? null)
                : null;
              const event = publicLookup.events.find((e) => e.id === m.event_id)?.name;
              const played = m.status === "final";
              const score =
                played && m.score_a !== null && m.score_b !== null
                  ? `${m.score_a}–${m.score_b}`
                  : null;
              return (
                <li key={m.id} className="result-row">
                  <div className="flex flex-wrap items-center justify-center gap-2">
                    <span className="result-row-badge">{played ? "Final" : "Scheduled"}</span>
                    <span className="result-row-badge">{sourceLabel(m.data_mode)}</span>
                  </div>
                  <div className="result-row-grid">
                    <span className="result-row-team">
                      {nameA ?? <Tbd>Team to be determined</Tbd>}
                    </span>
                    <span
                      className="result-row-score"
                      style={
                        played && score === null
                          ? {
                              fontSize: "1rem",
                              lineHeight: 1.25,
                              maxWidth: "6rem",
                              overflowWrap: "anywhere",
                              textAlign: "center",
                              whiteSpace: "normal",
                            }
                          : undefined
                      }
                    >
                      {played ? (
                        (score ?? <Tbd>To be determined</Tbd>)
                      ) : m.starts_at ? (
                        formatDateTime(m.starts_at)
                      ) : (
                        <Tbd>{formatDateTime(null, m.source_date)}</Tbd>
                      )}
                    </span>
                    <span className="result-row-team result-row-team--right">
                      {nameB ?? <Tbd>Team to be determined</Tbd>}
                    </span>
                  </div>
                  {played&&m.score_a!==null&&m.score_b!==null&&m.score_a+m.score_b>0?(()=>{const total=m.score_a+m.score_b;const pctA=Math.round(m.score_a/total*100);return <div className="result-row-hp" role="img" aria-label={`Score split ${m.score_a} to ${m.score_b}`}><span className="result-row-hp-track"><span className="result-row-hp-fill result-row-hp-fill--a" style={{width:`${pctA}%`}}/></span><span className="result-row-hp-track"><span className="result-row-hp-fill result-row-hp-fill--b" style={{width:`${100-pctA}%`}}/></span></div>;})():null}
                  <SetDetails match={m as Match} />
                  <p className="result-row-meta">
                    {event ?? "Event to be determined"} · {formatDate(m.source_date)}
                  </p>
                </li>
              );
            })}
          </ul>
        ) : (
          <Card>
            {selection.dataMode === "real"
              ? "No recorded real results match this selection. Adjust the event, team or dates to browse other historical results."
              : selection.period === "recent"
                ? "No published or connected results match these filters in the last three months. Choose historical results to browse older matches."
                : "No recorded demo results match these filters."}
          </Card>
        )}
        {validDateRange && !publicError && !publicLoading && results.data && (
          <p className="text-sm text-muted-foreground">
            {results.data.total.toLocaleString("en-CA")} recorded results
          </p>
        )}
        {validDateRange && !publicError && !publicLoading && totalPages > 0 && (
          <div className="flex items-center justify-center gap-4">
            <Button
              variant="outline"
              size="icon"
              aria-label="Previous results page"
              disabled={selection.page === 1}
              onClick={() => setSelection((current) => ({ ...current, page: current.page - 1 }))}
            >
              <ChevronLeft aria-hidden />
            </Button>
            <p aria-live="polite" className="text-sm font-semibold">
              Page {selection.page} of {totalPages}
            </p>
            <Button
              variant="outline"
              size="icon"
              aria-label="Next results page"
              disabled={selection.page >= totalPages}
              onClick={() => setSelection((current) => ({ ...current, page: current.page + 1 }))}
            >
              <ChevronRight aria-hidden />
            </Button>
          </div>
        )}
      </Section>
    </AppShell>
  );
}


function SetDetails({ match }: { match: Match }) {
  return <details className="mt-3 w-full max-w-2xl text-left text-sm">
    <summary className="cursor-pointer font-semibold">Set details</summary>
    {match.sets?.length ? <table className="mt-2 w-full text-left"><caption className="mb-2 text-left text-muted-foreground">Recorded set points · Team A / Team B</caption>
      <thead><tr><th className="pb-2 pr-4">Set</th><th className="pb-2 pr-4">Team A</th><th className="pb-2">Team B</th></tr></thead>
      <tbody>{match.sets.map((set, index) => <tr key={index}><td>{index + 1}</td><td>{set.a ?? "—"}</td><td>{set.b ?? "—"}</td></tr>)}</tbody>
    </table> : <p className="mt-2 text-muted-foreground">Per-set point scores are not recorded. The match score shows sets won.</p>}
  </details>;
}
