import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Star } from "lucide-react";
import { AppShell, Section, Card, btn } from "@/components/AppShell";
import { MatchCard } from "@/components/MatchCard";
import { competitionQuery, myHouseholdQuery } from "@/lib/queries";
import { calendarMonths, TZ } from "@/lib/format";
import { useSessionUser } from "@/hooks/use-session";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/schedule")({
  head: () => ({
    meta: [
      { title: "Schedule — OVA Companion" },
      { name: "description", content: "Upcoming Ontario volleyball matches for the teams and divisions you follow." },
      { property: "og:title", content: "Schedule — OVA Companion" },
      { property: "og:description", content: "Calendar of upcoming matches for this month and the next two." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  loader: ({ context }) => context.queryClient.ensureQueryData(competitionQuery),
  component: Schedule,
});

const dayKey = (iso: string) => new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(iso));

function Schedule() {
  const { data } = useSuspenseQuery(competitionQuery);
  const { user } = useSessionUser();
  const hh = useQuery(myHouseholdQuery(user?.id));
  const qc = useQueryClient();
  const followed = new Set((hh.data?.follows ?? []).map((f) => `${f.target_type}:${f.target_id}`));
  const [filter, setFilter] = useState<"all" | "following">("all");
  const [selected, setSelected] = useState<string | null>(null);

  const scheduled = data.matches.filter((m) => m.status === "scheduled");
  const visible = scheduled.filter((m) => filter === "all" || followed.has(`team:${m.team_a_id}`) || followed.has(`team:${m.team_b_id}`) || followed.has(`division:${m.division_id}`));
  const byDay = useMemo(() => {
    const map = new Map<string, number>();
    for (const m of visible) { const k = m.starts_at ? dayKey(m.starts_at) : m.source_date; if (k) map.set(k, (map.get(k) ?? 0) + 1); }
    return map;
  }, [visible]);
  const list = selected ? visible.filter((m) => (m.starts_at ? dayKey(m.starts_at) : m.source_date) === selected) : visible;

  async function toggleFollow(type: "team" | "division", id: string) {
    if (!user) return;
    if (followed.has(`${type}:${id}`)) await supabase.from("follows").delete().eq("user_id", user.id).eq("target_type", type).eq("target_id", id);
    else await supabase.from("follows").insert({ user_id: user.id, target_type: type, target_id: id });
    qc.invalidateQueries({ queryKey: ["household"] });
  }

  return (
    <AppShell title="Schedule">
      <div role="group" aria-label="Show matches" className="flex gap-2">
        {(["all", "following"] as const).map((f) => (
          <button key={f} aria-pressed={filter === f} onClick={() => setFilter(f)} className={filter === f ? btn.primary : btn.secondary} disabled={f === "following" && !user}>
            {f === "all" ? "All matches" : "Following"}
          </button>
        ))}
      </div>
      {!user && <p className="text-base text-muted-foreground">Sign in on Account to follow teams and divisions.</p>}

      <Section title="Calendar">
        <div className="grid gap-4 md:grid-cols-3">
          {calendarMonths().map(({ year, month }) => <Month key={`${year}-${month}`} year={year} month={month} counts={byDay} selected={selected} onSelect={setSelected} />)}
        </div>
        {selected && <button className={btn.secondary} onClick={() => setSelected(null)}>Show all dates</button>}
      </Section>

      <Section title={selected ? `Matches on ${selected}` : "Upcoming matches"}>
        {list.length ? list.map((m) => <MatchCard key={m.id} m={m} data={data} />) : <Card>No matches published for this selection.</Card>}
      </Section>

      {user && (
        <Section title="Follow teams & divisions">
          <ul className="space-y-2">
            {[...data.divisions.map((d) => ({ type: "division" as const, id: d.id, name: d.name })), ...data.teams.map((t) => ({ type: "team" as const, id: t.id, name: t.name }))].map((x) => {
              const on = followed.has(`${x.type}:${x.id}`);
              return (
                <li key={`${x.type}${x.id}`}>
                  <button aria-pressed={on} onClick={() => toggleFollow(x.type, x.id)} className="flex min-h-12 w-full items-center justify-between rounded-lg border-2 bg-card px-4 text-left text-lg">
                    <span><span className="text-sm uppercase text-muted-foreground">{x.type}</span> {x.name}</span>
                    <Star aria-hidden className={on ? "fill-accent text-accent" : "text-muted-foreground"} />
                  </button>
                </li>
              );
            })}
          </ul>
        </Section>
      )}
    </AppShell>
  );
}

function Month({ year, month, counts, selected, onSelect }: { year: number; month: number; counts: Map<string, number>; selected: string | null; onSelect: (d: string) => void }) {
  const first = new Date(Date.UTC(year, month - 1, 1)).getUTCDay();
  const days = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const label = new Intl.DateTimeFormat("en-CA", { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(Date.UTC(year, month - 1, 15)));
  return (
    <div className="rounded-xl border-2 bg-card p-3">
      <h3 className="mb-2 text-xl font-bold uppercase">{label}</h3>
      <div className="grid grid-cols-7 gap-1 text-center" role="grid" aria-label={label}>
        {["S", "M", "T", "W", "T", "F", "S"].map((d, i) => <span key={i} aria-hidden className="text-sm font-bold text-muted-foreground">{d}</span>)}
        {Array.from({ length: first }).map((_, i) => <span key={`e${i}`} />)}
        {Array.from({ length: days }).map((_, i) => {
          const key = `${year}-${String(month).padStart(2, "0")}-${String(i + 1).padStart(2, "0")}`;
          const n = counts.get(key) ?? 0;
          return (
            <button key={key} disabled={!n} onClick={() => onSelect(key)} aria-pressed={selected === key}
              aria-label={`${key}: ${n ? `${n} match${n > 1 ? "es" : ""}` : "no matches"}`}
              className={`min-h-10 rounded-md text-base ${n ? "bg-accent font-bold text-accent-foreground" : "text-muted-foreground"} ${selected === key ? "ring-4 ring-primary" : ""}`}>
              {i + 1}
            </button>
          );
        })}
      </div>
    </div>
  );
}
