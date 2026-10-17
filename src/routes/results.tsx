import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useState } from "react";
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis, Bar, BarChart } from "recharts";
import { AppShell, Section, Card, btn } from "@/components/AppShell";
import { MatchCard } from "@/components/MatchCard";
import { competitionQuery } from "@/lib/queries";
import { formatDate } from "@/lib/format";

export const Route = createFileRoute("/results")({
  head: () => ({
    meta: [
      { title: "Results — OVA Companion" },
      { name: "description", content: "Match history, set scores and placement trends for Ontario volleyball teams." },
      { property: "og:title", content: "Results — OVA Companion" },
      { property: "og:description", content: "Past results and trend charts by team." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  loader: ({ context }) => context.queryClient.ensureQueryData(competitionQuery),
  component: Results,
});

function Results() {
  const { data } = useSuspenseQuery(competitionQuery);
  const [team, setTeam] = useState("demo-north");
  const [chart, setChart] = useState<"placement" | "sets">("placement");
  const finals = data.matches.filter((m) => m.status === "final" && (m.team_a_id === team || m.team_b_id === team))
    .sort((a, b) => (b.starts_at ?? "").localeCompare(a.starts_at ?? ""));
  const evName = (id: string) => data.events.find((e) => e.id === id);
  const placement = data.rankings.filter((r) => r.team_id === team && r.final_confirmed)
    .map((r) => ({ event: evName(r.event_id)?.name.replace(" · Demo", "") ?? r.event_id, date: evName(r.event_id)?.start_date ?? "", rank: r.rank, field: r.field_size }))
    .sort((a, b) => a.date.localeCompare(b.date));
  const sets = [...finals].reverse().map((m) => {
    const mine = m.team_a_id === team ? m.score_a! : m.score_b!;
    const theirs = m.team_a_id === team ? m.score_b! : m.score_a!;
    return { label: formatDate(m.source_date).replace(/, \d{4}$/, ""), diff: mine - theirs };
  });

  return (
    <AppShell title="Results">
      <label className="block text-lg font-bold">Team
        <select value={team} onChange={(e) => setTeam(e.target.value)} className="mt-1 min-h-12 w-full rounded-lg border-2 border-input bg-card px-3 text-lg">
          {data.teams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
        </select>
      </label>

      <Section title="Trend">
        <div role="group" aria-label="Chart type" className="flex flex-wrap gap-2">
          <button aria-pressed={chart === "placement"} onClick={() => setChart("placement")} className={chart === "placement" ? btn.primary : btn.secondary}>Final placement</button>
          <button aria-pressed={chart === "sets"} onClick={() => setChart("sets")} className={chart === "sets" ? btn.primary : btn.secondary}>Set difference</button>
        </div>
        <Card>
          {chart === "placement" ? (
            placement.length ? (
              <>
                <div className="h-64" aria-hidden>
                  <ResponsiveContainer>
                    <LineChart data={placement}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="event" tick={{ fontSize: 14 }} />
                      <YAxis reversed allowDecimals={false} domain={[1, "dataMax"]} tick={{ fontSize: 14 }} />
                      <Tooltip />
                      <Line type="monotone" dataKey="rank" stroke="var(--chart-1)" strokeWidth={4} dot={{ r: 6 }} isAnimationActive={false} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
                <table className="mt-3 w-full text-left text-base">
                  <caption className="sr-only">Final placement by event</caption>
                  <thead><tr><th>Event</th><th>Place</th></tr></thead>
                  <tbody>{placement.map((p) => <tr key={p.event}><td>{p.event}</td><td>{p.rank} of {p.field ?? "?"}</td></tr>)}</tbody>
                </table>
              </>
            ) : <p>No confirmed final placements for this team. Unconfirmed placements are not charted.</p>
          ) : sets.length ? (
            <>
              <div className="h-64" aria-hidden>
                <ResponsiveContainer>
                  <BarChart data={sets}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="label" tick={{ fontSize: 14 }} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 14 }} />
                    <Tooltip />
                    <Bar dataKey="diff" fill="var(--chart-2)" isAnimationActive={false} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <p className="mt-2 text-base">Sets won minus sets lost in each recorded match.</p>
            </>
          ) : <p>No recorded results for this team.</p>}
        </Card>
      </Section>

      <Section title="Match history">
        {finals.length ? finals.map((m) => <MatchCard key={m.id} m={m} data={data} focusTeam={team} />) : <Card>No results recorded.</Card>}
      </Section>
    </AppShell>
  );
}
