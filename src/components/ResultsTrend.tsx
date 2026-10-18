import { useId, useState } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { matchResultSeries } from "@/lib/match-result-series";
import type { Match } from "@/lib/queries";
import { formatDateMDY } from "@/lib/format";

type Stats = { played: number; wins: number; losses: number; winRate: number | null };
type DailyPoint = { date: string; sourceDate: string; winRate: number | null };
type Props = {
  dataMode?: "real" | "synthetic";
  teamId: string;
  teamName: string;
  eventName: string;
  matches: Match[];
  teams: { id: string; name: string }[];
  stats: Stats | null;
  metric: "match" | "set";
  daily: DailyPoint[];
  expanded: boolean;
  onToggle: () => void;
};
type TooltipRow = ReturnType<typeof matchResultSeries>[number] & { opponent: string };
function MatchTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: { payload: TooltipRow }[];
}) {
  const row = payload?.[0]?.payload;
  if (!active || !row) return null;
  return (
    <div className="max-w-72 rounded-xl border bg-card p-4 text-sm shadow-lg">
      <p className="font-semibold">
        {row.label} · {row.date ? formatDateMDY(row.date) : "Date unrecorded"}
      </p>
      <p className="mt-1">vs {row.opponent}</p>
      <p className="mt-2 text-lg font-semibold">
        {row.score} · {row.result} · {row.cumulativeWinRate ?? "—"}%
      </p>
    </div>
  );
}
export function ResultsTrend({
  dataMode = "real",
  teamId,
  teamName,
  eventName,
  matches,
  teams,
  stats,
  metric,
  daily,
  expanded,
  onToggle,
}: Props) {
  const [view, setView] = useState<"matches" | "daily">("matches");
  const gradient = useId().replace(/:/g, "");
  const rows = matchResultSeries(matches, teamId, metric, dataMode).map((row) => ({
    ...row,
    opponent: teams.find((team) => team.id === row.opponentId)?.name ?? "Opponent to be determined",
  }));
  const dates = rows
    .map((row) => row.date)
    .filter((date): date is string => !!date)
    .sort();
  return (
    <div className="rounded-2xl border border-border bg-card p-5 sm:p-7" data-results-performance>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-widest text-primary">
            {dataMode === "real"
              ? "Real match performance"
              : "Demo match performance · Synthetic records"}
          </p>
          <h3 className="mt-2 text-2xl font-semibold sm:text-3xl">{teamName}</h3>
          <p className="mt-2 max-w-3xl text-sm text-muted-foreground">{eventName}</p>
          <p className="mt-1 text-sm text-muted-foreground">
            {dates.length
              ? `${formatDateMDY(dates[0])}${dates.at(-1) !== dates[0] ? ` – ${formatDateMDY(dates.at(-1)!)}` : ""}`
              : "Dates unrecorded"}
          </p>
        </div>
        <button
          type="button"
          className="rounded-full border px-4 py-2 text-sm font-semibold"
          aria-expanded={expanded}
          onClick={onToggle}
        >
          {expanded ? "Hide results trend" : "View results trend"}
        </button>
      </div>
      {stats && stats.played > 0 && (
        <dl className="my-6 grid grid-cols-2 gap-5 border-y py-5 sm:grid-cols-4">
          {[
            [metric === "set" ? "Sets played" : "Matches", stats.played],
            [metric === "set" ? "Sets won" : "Wins", stats.wins],
            [metric === "set" ? "Sets lost" : "Losses", stats.losses],
            ["Win rate", stats.winRate === null ? "—" : `${stats.winRate}%`],
          ].map(([label, value]) => (
            <div key={label}>
              <dt className="text-sm text-muted-foreground">{label}</dt>
              <dd className="mt-1 text-3xl font-semibold tabular-nums sm:text-4xl">{value}</dd>
            </div>
          ))}
        </dl>
      )}
      {stats?.played === 0 && (
        <p className="my-5 text-sm text-muted-foreground">
          No decided scores are available for statistics in this range.
        </p>
      )}
      {expanded && (
        <>
          <div className="my-5 flex flex-wrap gap-2" role="group" aria-label="Results chart view">
            <button
              type="button"
              aria-pressed={view === "matches"}
              onClick={() => setView("matches")}
              className={`rounded-full border px-4 py-2 text-sm font-semibold ${view === "matches" ? "bg-primary text-primary-foreground" : "bg-card"}`}
            >
              Per-match cumulative · {rows.length}
            </button>
            <button
              type="button"
              aria-pressed={view === "daily"}
              onClick={() => setView("daily")}
              className={`rounded-full border px-4 py-2 text-sm font-semibold ${view === "daily" ? "bg-primary text-primary-foreground" : "bg-card"}`}
            >
              Daily cumulative
            </button>
          </div>
          {view === "matches" ? (
            <>
              <h4 className="text-lg font-semibold">Cumulative win rate by displayed record</h4>
              <p className="mt-1 text-sm text-muted-foreground">
                Each point adds one recorded match. Within each date, records follow stored listing
                order. Match times and same-day playing order are unconfirmed; this is not a
                confirmed match chronology.
              </p>
              {rows.some((row) => row.cumulativeWinRate !== null) ? (
                <div className="mt-5 overflow-x-auto">
                  <div
                    className="h-72"
                    style={{ minWidth: Math.max(360, rows.length * 48) }}
                    role="img"
                    aria-label={`Cumulative ${metric} win rate by displayed record: ${rows.map((row) => (row.cumulativeWinRate === null ? "TBD" : `${row.cumulativeWinRate}%`)).join(", ")}`}
                  >
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={rows} margin={{ top: 16, right: 20, bottom: 16, left: 12 }}>
                        <defs>
                          <linearGradient id={`${gradient}-records`} x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="var(--teal)" stopOpacity={0.28} />
                            <stop offset="100%" stopColor="var(--teal)" stopOpacity={0.025} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid
                          vertical={false}
                          stroke="var(--border)"
                          strokeDasharray="4 5"
                        />
                        <XAxis
                          dataKey="label"
                          tickLine={false}
                          axisLine={false}
                          tick={{ fontSize: 13 }}
                        />
                        <YAxis
                          domain={[0, 100]}
                          ticks={[0, 25, 50, 75, 100]}
                          unit="%"
                          width={62}
                          tickLine={false}
                          axisLine={false}
                          tick={{ fontSize: 13 }}
                        />
                        <Tooltip content={<MatchTooltip />} />
                        <Area
                          type="linear"
                          dataKey="cumulativeWinRate"
                          stroke="var(--teal)"
                          strokeWidth={3}
                          fill={`url(#${gradient}-records)`}
                          dot={{ r: 5, fill: "var(--teal)", stroke: "var(--card)", strokeWidth: 2 }}
                          isAnimationActive={false}
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              ) : (
                <p className="py-7 text-muted-foreground">
                  No decided scores in this range. Missing scores are not plotted as zero.
                </p>
              )}
              <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-xs text-muted-foreground">
                {rows.map((row) => (
                  <span key={row.id}>
                    {row.label} · {row.date ? row.date.slice(5).replace("-", "/") : "Date TBD"} ·{" "}
                    {row.score} · {row.result}
                  </span>
                ))}
              </div>
            </>
          ) : (
            <>
              <h4 className="text-lg font-semibold">
                Cumulative {metric} win rate in selected range
              </h4>
              <p className="mt-1 text-sm text-muted-foreground">
                One point per completed date. Same-day results are combined because match order is
                unconfirmed.
              </p>
              {daily.length ? (
                <div
                  className="mt-5 h-72 min-w-0"
                  role="img"
                  aria-label={`Cumulative ${metric} win rate in selected range: ${daily.map((point) => (point.winRate === null ? "TBD" : `${point.winRate}%`)).join(", ")}`}
                >
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={daily} margin={{ top: 14, right: 20, bottom: 12, left: 12 }}>
                      <defs>
                        <linearGradient id={gradient} x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="var(--teal)" stopOpacity={0.28} />
                          <stop offset="100%" stopColor="var(--teal)" stopOpacity={0.025} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid
                        vertical={false}
                        stroke="var(--border)"
                        strokeDasharray="4 5"
                      />
                      <XAxis
                        dataKey="date"
                        tickLine={false}
                        axisLine={false}
                        tick={{ fontSize: 13 }}
                      />
                      <YAxis
                        domain={[0, 100]}
                        ticks={[0, 25, 50, 75, 100]}
                        width={62}
                        unit="%"
                        tickLine={false}
                        axisLine={false}
                        tick={{ fontSize: 13 }}
                      />
                      <Tooltip formatter={(value) => [`${value}%`, "Win rate"]} />
                      <Area
                        type="linear"
                        dataKey="winRate"
                        fill={`url(#${gradient})`}
                        stroke="var(--teal)"
                        strokeWidth={3}
                        dot={{ r: 5, fill: "var(--teal)", stroke: "var(--card)", strokeWidth: 2 }}
                        isAnimationActive={false}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <p className="py-7 text-muted-foreground">
                  No dated, decided results in this period. No win-rate data available.
                </p>
              )}
            </>
          )}
        </>
      )}
    </div>
  );
}
