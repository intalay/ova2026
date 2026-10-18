import { useEffect, useState } from "react";
import type { CompetitionData } from "@/lib/queries";
import { cumulativeWinTrend, resultStats } from "@/lib/results";
import { formatMonthDay } from "@/lib/format";
import {
  amandaPreviewMatches as syntheticFinishedMatches,
  previewOpponentName,
} from "@/lib/amanda-results-preview";
import { ResultsTrend } from "./ResultsTrend";

// Existing user-confirmed synthetic association; this never changes player/team bindings.
const ALEX_DEMO_TEAM_ID = "demo-sand";
export function DemoTeamTrend({ data }: { data: CompetitionData | undefined }) {
  const [expanded, setExpanded] = useState(true);
  const [ready, setReady] = useState(false);
  useEffect(() => setReady(true), []);
  const team = data?.teams.find(
    (team) => team.id === ALEX_DEMO_TEAM_ID && team.data_mode === "synthetic",
  );
  if (!ready || !team || !data) return null;
  const records = data.matches.filter(
    (match) =>
      match.data_mode === "synthetic" &&
      (match.team_a_id === team.id || match.team_b_id === team.id),
  );
  const finals = records.filter((match) => match.status === "final");
  // Reuse the four existing fixtures only in this isolated, explicitly labelled Demo.
  // Never add them to competition data, public Results queries or household bindings.
  const usingFixtures = finals.length === 0;
  const trendMatches = usingFixtures ? syntheticFinishedMatches : finals;
  const stats = resultStats(trendMatches, team.id);
  const trendTeams = usingFixtures
    ? [
        ...data.teams,
        ...syntheticFinishedMatches.map((match) => ({
          id: match.team_b_id!,
          name: previewOpponentName(match),
        })),
      ]
    : data.teams;
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
        Demo only. Separate from the real team search, historical results and statistics above.
      </p>
      {usingFixtures && (
        <p className="mt-2 text-sm text-muted-foreground">
          Demo preview · 4 existing fixture matches. No completed team records are stored yet; this
          illustrative trend uses the existing preview fixtures, not actual competition results.
        </p>
      )}
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
            eventName={
              usingFixtures
                ? "Demo preview · Existing fixture matches"
                : "Existing Demo competitions"
            }
            matches={trendMatches}
            teams={trendTeams}
            stats={stats}
            metric="match"
            daily={cumulativeWinTrend(trendMatches, team.id).map((point) => ({
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
