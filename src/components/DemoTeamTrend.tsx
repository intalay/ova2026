import { useState } from "react";
import type { CompetitionData } from "@/lib/queries";
import { cumulativeWinTrend, resultStats } from "@/lib/results";
import { formatMonthDay } from "@/lib/format";
import { ResultsTrend } from "./ResultsTrend";

// Existing user-confirmed synthetic association; this never changes player/team bindings.
const ALEX_DEMO_TEAM_ID = "demo-sand";
export function DemoTeamTrend({ data }: { data: CompetitionData | undefined }) {
  const [expanded, setExpanded] = useState(true);
  const team = data?.teams.find(
    (team) => team.id === ALEX_DEMO_TEAM_ID && team.data_mode === "synthetic",
  );
  if (!team || !data) return null;
  const records = data.matches.filter(
    (match) =>
      match.data_mode === "synthetic" &&
      (match.team_a_id === team.id || match.team_b_id === team.id),
  );
  const finals = records.filter((match) => match.status === "final");
  const stats = resultStats(finals, team.id);
  return (
    <section
      className="rounded-2xl border border-dashed border-primary/40 bg-card p-5 sm:p-7"
      aria-label="Alex demo team trend"
    >
      <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
        Independent Demo team · Not real Results
      </p>
      <h2 className="mt-2 text-2xl font-semibold">Alex · {team.name}</h2>
      <p className="mt-2 text-sm text-muted-foreground">
        Existing synthetic records only. Separate from the real team search, historical results and
        statistics above.
      </p>
      <p className="mt-4 font-semibold">
        {finals.length} completed matches ·{" "}
        {records.filter((match) => match.status === "scheduled").length} scheduled records
      </p>
      {stats.played > 0 ? (
        <div className="mt-5">
          <ResultsTrend
            dataMode="synthetic"
            teamId={team.id}
            teamName={team.name}
            eventName="Existing Demo competitions"
            matches={finals}
            teams={data.teams}
            stats={stats}
            metric="match"
            daily={cumulativeWinTrend(finals, team.id).map((point) => ({
              ...point,
              date: formatMonthDay(point.sourceDate),
            }))}
            expanded={expanded}
            onToggle={() => setExpanded(!expanded)}
          />
        </div>
      ) : (
        <p className="mt-3 text-muted-foreground">
          No recorded final scores for this team yet. A cumulative win-rate trend cannot be
          calculated. Scheduled matches are not treated as wins, losses or zero-percent results.
        </p>
      )}
    </section>
  );
}
