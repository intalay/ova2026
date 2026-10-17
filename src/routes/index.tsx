import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useSuspenseQuery } from "@tanstack/react-query";
import { MapPin, CalendarDays, UserRound, Megaphone } from "lucide-react";
import { AppShell, Section, Card, btn } from "@/components/AppShell";
import { MatchCard } from "@/components/MatchCard";
import { competitionQuery, myHouseholdQuery, type Match, type CompetitionData } from "@/lib/queries";
import { useSessionUser } from "@/hooks/use-session";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "OVA Companion — Ontario volleyball schedules & results" },
      { name: "description", content: "Follow Ontario Volleyball Association teams: upcoming matches, results, venues and parking." },
      { property: "og:title", content: "OVA Companion" },
      { property: "og:description", content: "Schedules, results and venue guides for Ontario volleyball families." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  loader: ({ context }) => context.queryClient.ensureQueryData(competitionQuery),
  component: Home,
});

const now = () => Date.now();
const upcoming = (ms: Match[]) => ms.filter((m) => m.status === "scheduled" && (!m.starts_at || new Date(m.starts_at).getTime() > now() - 3 * 3600e3));

function Home() {
  const { data } = useSuspenseQuery(competitionQuery);
  const { user } = useSessionUser();
  const hh = useQuery(myHouseholdQuery(user?.id));
  const linked = hh.data?.linkedPlayers ?? [];

  if (user && linked.length > 0) return <FamilyHome data={data} players={linked} />;

  const next = upcoming(data.matches).slice(0, 3);
  return (
    <AppShell title="Home">
      <Card className="bg-primary text-primary-foreground">
        <h2 className="text-3xl font-bold uppercase">Game day, sorted</h2>
        <p className="mt-1 text-lg">Schedules, results and venue guides. No sign-in needed to look around.</p>
        <div className="mt-4 flex flex-wrap gap-3">
          <Link to="/schedule" className={btn.primary}><CalendarDays aria-hidden />See the schedule</Link>
          <Link to="/account" className="inline-flex min-h-12 items-center gap-2 rounded-lg border-2 border-primary-foreground px-5 text-lg font-bold">
            <UserRound aria-hidden />{user ? "Link a player" : "Sign in for my family"}
          </Link>
        </div>
      </Card>
      <Section title="Next matches">
        {next.length ? next.map((m) => <MatchCard key={m.id} m={m} data={data} />) : <Card>No upcoming matches are published yet.</Card>}
      </Section>
      <Announcements items={data.announcements} />
    </AppShell>
  );
}

type Data = CompetitionData;

function FamilyHome({ data, players }: { data: Data; players: { id: string; display_name: string; team_id: string | null }[] }) {
  return (
    <AppShell title="My family">
      {players.map((p) => {
        const team = data.teams.find((t) => t.id === p.team_id);
        const mine = data.matches.filter((m) => m.team_a_id === p.team_id || m.team_b_id === p.team_id);
        const next = upcoming(mine)[0];
        const recent = mine.filter((m) => m.status === "final").sort((a, b) => (b.starts_at ?? "").localeCompare(a.starts_at ?? "")).slice(0, 2);
        const venue = next && data.venues.find((v) => v.id === next.venue_id);
        return (
          <Section key={p.id} id={`player-${p.id}`} title={p.display_name}>
            <p className="-mt-2 text-lg text-muted-foreground">{team?.name ?? "Team to be determined"}</p>
            <h3 className="text-xl font-bold uppercase">Next match</h3>
            {next ? <MatchCard m={next} data={data} focusTeam={p.team_id ?? undefined} /> : <Card>No upcoming match is published.</Card>}
            {venue && (
              <Link to="/venue/$id" params={{ id: venue.id }} className={`${btn.primary} w-full`}>
                <MapPin aria-hidden />Next Venue: {venue.name}
              </Link>
            )}
            <h3 className="text-xl font-bold uppercase">Recent results</h3>
            {recent.length ? recent.map((m) => <MatchCard key={m.id} m={m} data={data} focusTeam={p.team_id ?? undefined} />) : <Card>No results yet.</Card>}
          </Section>
        );
      })}
      <Announcements items={data.announcements} />
    </AppShell>
  );
}

function Announcements({ items }: { items: { id: string; title: string; body: string }[] }) {
  if (!items.length) return null;
  return (
    <Section title="Announcements">
      {items.slice(0, 3).map((a) => (
        <Card key={a.id}>
          <p className="flex items-center gap-2 text-xl font-bold"><Megaphone aria-hidden className="size-5 text-accent" />{a.title}</p>
          <p className="mt-1">{a.body}</p>
        </Card>
      ))}
    </Section>
  );
}
