import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useSuspenseQuery, queryOptions } from "@tanstack/react-query";
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
import { resultStats, RESULTS_PAGE_SIZE } from "@/lib/results";
import { useRole } from "@/hooks/use-role";
import { formatDate, formatDateTime } from "@/lib/format";
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
  period: "recent",
  dataMode: "all",
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
      context.queryClient.ensureQueryData(filtersQuery("all")).catch(() => null),
    ]);
    return { page, filters };
  },
  component: Results,
});

function Results() {
  const { data } = useSuspenseQuery(competitionQuery);
  const { role, household } = useRole();
  const hh = household.data;
  const developmentPreview = import.meta.env.DEV && import.meta.env.MODE !== "test";
  const teamIds =
    role === "coach"
      ? (hh?.managedTeams ?? [])
      : role === "player"
        ? hh?.self?.team_id
          ? [hh.self.team_id]
          : []
        : role === "family_friends"
          ? (hh?.linkedPlayers.flatMap((p) => (p.team_id ? [p.team_id] : [])) ?? [])
          : [];
  const [chosen, setChosen] = useState("");
  const selectableTeams = teamIds.length ? [...new Set(teamIds)] : developmentPreview ? [AMANDA_PREVIEW_TEAM.id] : [];
  const team = selectableTeams.includes(chosen) ? chosen : selectableTeams[0];
  const [expanded, setExpanded] = useState(developmentPreview);
  const [months, setMonths] = useState(3);
  const [selection, setSelection] = useState(initialSelection);
  const loaded = Route.useLoaderData();
  const changeFilters = (patch: Partial<Omit<ResultsSelection, "page">>) =>
    setSelection((current) => ({ ...current, ...patch, page: 1 }));
  const validDateRange =
    !selection.dateFrom || !selection.dateTo || selection.dateFrom <= selection.dateTo;
  const results = useQuery({
    ...pageQuery(selection),
    enabled: validDateRange,
    initialData: () => (selection === initialSelection ? (loaded.page ?? undefined) : undefined),
  });
  const filters = useQuery({
    ...filtersQuery(selection.dataMode),
    initialData: () => (selection.dataMode === "all" ? (loaded.filters ?? undefined) : undefined),
  });
  // Household history has its own source lookup and query; public filters never change it.
  const householdFilters = useQuery({
    ...filtersQuery("all"),
    enabled: !!team,
    initialData: () => loaded.filters ?? undefined,
  });
  const teamRecord = householdFilters.data?.teams.find((t) => t.id === team);
  const teamMode = teamRecord?.data_mode;
  const history = useQuery({
    queryKey: ["team-results-history", team, teamMode],
    enabled: !!team && (teamMode === "real" || teamMode === "synthetic"),
    queryFn: () => {
      if (!team || (teamMode !== "real" && teamMode !== "synthetic"))
        throw new Error("Team source unavailable");
      return getTeamResultsHistory({ data: { teamId: team, dataMode: teamMode } });
    },
  });
  // Local fixtures only fill an empty synthetic team; never replace real history or a failed read.
  const simulatedTeam = developmentPreview && team === AMANDA_PREVIEW_TEAM.id &&
    householdFilters.isSuccess && (!teamRecord || (teamMode === "synthetic" && history.isSuccess && !history.data.matches.length));
  const teamLoading = householdFilters.isPending || (!simulatedTeam && history.isPending);
  const teamError =
    !simulatedTeam && (householdFilters.isError ||
    history.isError ||
    (!householdFilters.isPending && teamMode !== "real" && teamMode !== "synthetic"));
  const displayMode = simulatedTeam ? "synthetic" : teamMode;
  const finals = (simulatedTeam ? amandaPreviewMatches : history.data?.matches ?? [])
    .filter(
      (m) =>
        m.status === "final" &&
        (m.team_a_id === team || m.team_b_id === team) &&
        m.data_mode === displayMode,
    )
    .sort((a, b) => (b.source_date ?? "").localeCompare(a.source_date ?? ""));
  const stats =
    team && !teamLoading && !teamError ? resultStats(finals as unknown as Match[], team) : null;
  const start = new Date();
  start.setMonth(start.getMonth() - months);
  const chronological = [...finals].reverse();
  const winTrend = chronological.map((match, index) => ({
    date: formatDate(match.source_date),
    winRate: resultStats(chronological.slice(0, index + 1) as Match[], team ?? "").winRate,
    sourceDate: match.source_date,
  })).filter((point) => point.sourceDate && new Date(point.sourceDate) >= start);
  const placement = (history.data?.rankings ?? [])
    .filter((r) => r.team_id === team && r.final_confirmed && r.data_mode === teamMode)
    .map((r) => ({
      event: householdFilters.data?.events.find((e) => e.id === r.event_id)?.name ?? r.event_id,
      date: householdFilters.data?.events.find((e) => e.id === r.event_id)?.start_date ?? "",
      rank: r.rank,
      field: r.field_size,
    }))
    .filter((r) => r.date && new Date(r.date) >= start)
    .sort((a, b) => a.date.localeCompare(b.date));
  const totalPages = Math.ceil((results.data?.total ?? 0) / RESULTS_PAGE_SIZE);
  const publicLookup = filters.data
    ? { teams: filters.data.teams, events: filters.data.events }
    : null;
  const eventTeamIds = new Set(
    filters.data?.teamEvents
      .filter((relation) => relation.eventId === selection.eventId)
      .map((relation) => relation.teamId),
  );
  const availableTeams = filters.data?.teams.filter(
    (option) => !selection.eventId || eventTeamIds.has(option.id),
  );
  const teamOptionLabel = (option: NonNullable<typeof filters.data>["teams"][number]) => {
    const division = filters.data?.divisions.find((d) => d.id === option.division_id)?.name;
    const eventNames = filters.data?.teamEvents
      .filter((relation) => relation.teamId === option.id)
      .map((relation) => filters.data?.events.find((event) => event.id === relation.eventId)?.name)
      .filter(Boolean);
    return `${option.name}${division ? ` · ${division}` : ""}${eventNames?.length ? ` · ${eventNames.join(", ")}` : ""} · ${sourceLabel(option.data_mode)}`;
  };
  const publicLoading = results.isPending || filters.isPending;
  const publicError = results.isError || filters.isError;

  return (
    <AppShell title="Results" sourceLabel="Sources labeled per result">
      {team && (role !== "general_user" || developmentPreview) && (
        <Section title="Your team">
          <label className="block font-semibold">
            Team
            <select className={btn.input} value={team} onChange={(e) => setChosen(e.target.value)}>
              {selectableTeams.map((id) => (
                <option key={id} value={id}>
                  {householdFilters.data?.teams.find((t) => t.id === id)?.name ??
                    data.teams.find((t) => t.id === id)?.name ??
                    (id === AMANDA_PREVIEW_TEAM.id ? AMANDA_PREVIEW_TEAM.name : "Team to be determined")}
                </option>
              ))}
            </select>
          </label>
          {teamError ? (
            <>
              <p role="alert">Could not load complete team history and source information.</p>
              <Button
                variant="outline"
                onClick={() => {
                  if (householdFilters.isError || (teamMode !== "real" && teamMode !== "synthetic"))
                    void householdFilters.refetch();
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
              {stats && (
                <div className="results-stats grid grid-cols-2">
                  {[
                    ["Wins", stats.wins],
                    ["Losses", stats.losses],
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
              <p className="text-sm text-muted-foreground">
                {simulatedTeam ? "Synthetic preview · Not saved. " : ""}
                {sourceLabel(displayMode ?? "")} · {simulatedTeam ? "Simulated final matches" : "All recorded final matches"} for this team from the
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
                          <td className="py-4 pr-3">{formatDate(m.source_date)}</td>
                          <td className="pr-3">
                            {householdFilters.data?.teams.find(
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
                    No published or connected results are available for this team yet.
                  </p>
                )}
              </div>
            </>
          )}
          <Button variant="outline" aria-expanded={expanded} onClick={() => setExpanded(!expanded)}>
            <ChartNoAxesCombined aria-hidden />
            {expanded ? "Hide results trend" : "View results trend"}
          </Button>
          {expanded && (
            <div className="space-y-4">
              <label className="block font-semibold">
                Trend period
                <select
                  className={btn.input}
                  value={months}
                  onChange={(e) => setMonths(Number(e.target.value))}
                >
                  {Array.from({ length: 11 }, (_, i) => i + 2).map((m) => (
                    <option key={m} value={m}>
                      Last {m} months
                    </option>
                  ))}
                </select>
              </label>
              {!teamLoading && !teamError && winTrend.length > 0 && (
                <>
                  <p>Cumulative win rate{simulatedTeam ? " · Simulated" : ""}</p>
                  <div className="h-64 min-w-0" role="img" aria-label={`Cumulative win rate: ${winTrend.map((point) => point.winRate === null ? "TBD" : `${point.winRate}%`).join(", ")}`}>
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={winTrend} margin={{ top: 12, right: 20, bottom: 8, left: 0 }}>
                        <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
                        <XAxis dataKey="date" stroke="var(--muted-foreground)" />
                        <YAxis domain={[0, 100]} unit="%" width={48} stroke="var(--muted-foreground)" />
                        <Tooltip formatter={(value) => [`${value}%`, "Win rate"]} />
                        <Line dataKey="winRate" stroke="var(--chart-1)" strokeWidth={3} isAnimationActive={false} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </>
              )}
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
                      <li key={p.event}>
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
        </Section>
      )}
      <Section title="All results">
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
            Data source
            <select
              className={btn.input}
              value={selection.dataMode}
              onChange={(e) =>
                changeFilters({ dataMode: e.target.value as DataMode, eventId: "", teamId: "" })
              }
            >
              <option value="all">All sources · labeled separately</option>
              <option value="real">Real source</option>
              <option value="synthetic">Synthetic demo</option>
            </select>
          </label>
          <label className="block font-semibold">
            Event
            <select
              className={btn.input}
              value={selection.eventId}
              disabled={!filters.data || filters.isError}
              onChange={(e) => changeFilters({ eventId: e.target.value, teamId: "" })}
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
            Results team
            <select
              className={btn.input}
              value={selection.teamId}
              disabled={!filters.data || filters.isError}
              onChange={(e) => changeFilters({ teamId: e.target.value })}
            >
              <option value="">All teams</option>
              {availableTeams?.map((option) => (
                <option key={option.id} value={option.id}>
                  {teamOptionLabel(option)}
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
        </div>
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
              ? "No visible real-source historical results match these filters. Real history may not have been imported yet. You can select Synthetic demo to explore demonstration results."
              : selection.period === "recent"
                ? "No published or connected results match these filters in the last three months. Choose historical results to browse older matches."
                : "No published or connected historical results match these filters."}
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

