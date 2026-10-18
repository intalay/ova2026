import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Section } from "./AppShell";
import { AMANDA_PREVIEW_TEAM, amandaPreviewMatches, amandaPreviewStats, amandaPreviewTrend } from "@/lib/amanda-results-preview";
import { formatDate } from "@/lib/format";

export function AmandaResultsPreview() {
  const stats = amandaPreviewStats;
  const metrics = [
    { label: "Wins", value: stats.wins }, { label: "Losses", value: stats.losses },
    { label: "Win rate", value: stats.winRate, percent: true },
    { label: "Loss rate", value: stats.lossRate, percent: true },
  ];
  return (
    <Section title="Amanda · Team preview">
      <p>{AMANDA_PREVIEW_TEAM.name} · Synthetic preview · Not saved</p>
      <p className="text-sm text-muted-foreground">Four invented matches for preview only. Not official results or placements.</p>
      <div className="results-stats grid grid-cols-2">
        {metrics.map(({ label, value, percent }) => (
          <div key={label} className="results-stat">
            <p className="results-stat-label">{label}</p>
            <p className="results-stat-value">{value}{percent && <span className="results-stat-percent">%</span>}</p>
          </div>
        ))}
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <caption className="mb-3 text-left">Simulated match history</caption>
          <thead className="border-b"><tr><th className="py-3">Date</th><th>Opponent</th><th>Score</th><th>Result</th></tr></thead>
          <tbody>{[...amandaPreviewMatches].reverse().map((match) => (
            <tr key={match.id} className="border-b">
              <td className="py-4 pr-3">{formatDate(match.source_date)}</td>
              <td className="pr-3">Demo opponent {Number(match.id.split("-").at(-1)) + 1}</td>
              <td className="pr-3">{match.score_a}–{match.score_b}</td>
              <td>{(match.score_a ?? 0) > (match.score_b ?? 0) ? "Won" : "Lost"}</td>
            </tr>
          ))}</tbody>
        </table>
      </div>
      <p>Cumulative win rate · Simulated</p>
      <div className="h-64 min-w-0" role="img" aria-label="Simulated cumulative win rate: 100%, 50%, 67%, 75%">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={amandaPreviewTrend} margin={{ top: 12, right: 20, bottom: 8, left: 0 }}>
            <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="date" stroke="var(--muted-foreground)" />
            <YAxis domain={[0, 100]} unit="%" width={48} stroke="var(--muted-foreground)" />
            <Tooltip formatter={(value) => [`${value}%`, "Win rate"]} />
            <Line dataKey="winRate" stroke="var(--chart-1)" strokeWidth={3} isAnimationActive={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </Section>
  );
}