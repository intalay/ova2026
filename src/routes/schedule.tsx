import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Star, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
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
  const [monthIndex, setMonthIndex] = useState(0);
  const months = calendarMonths();
  const month = months[monthIndex] ?? months[0];
  const monthPrefix = `${month?.year}-${String(month?.month).padStart(2, "0")}`;
  const [selected, setSelected] = useState<string | null>(null);

  const scheduled = data.matches.filter((m) => m.status === "scheduled");
  const visible = scheduled.filter((m) => filter === "all" || followed.has(`team:${m.team_a_id}`) || followed.has(`team:${m.team_b_id}`) || followed.has(`division:${m.division_id}`));
  const byDay = useMemo(() => {
    const map = new Map<string, number>();
    for (const m of visible) { const k = m.starts_at ? dayKey(m.starts_at) : m.source_date; if (k) map.set(k, (map.get(k) ?? 0) + 1); }
    return map;
  }, [visible]);
  const list = selected ? visible.filter((m) => (m.starts_at ? dayKey(m.starts_at) : m.source_date) === selected) : visible.filter(m => (m.starts_at ? dayKey(m.starts_at) : m.source_date)?.startsWith(monthPrefix) || (!m.starts_at && !m.source_date));

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
          <Button key={f} aria-pressed={filter === f} aria-controls={f === "following" ? "starred-team-filters" : undefined} onClick={() => { setFilter(f); setSelected(null); }} className={filter === f ? btn.primary : btn.secondary} disabled={f === "following" && !user}>
            {f === "all" ? "All matches" : "Starred Team"}
          </Button>
        ))}
      </div>
      {!user && <p className="text-base text-muted-foreground">Sign in on Account to follow teams and divisions.</p>}

      {user && filter === "following" && (
        <div id="starred-team-filters" role="group" aria-label="Starred teams and divisions" className="space-y-4">
          {(["team", "division"] as const).map((type) => (
            <div key={type}>
              <h3 className="mb-2 text-base">{type === "team" ? "Teams" : "Divisions"}</h3>
              <ul className="space-y-2">
                {(type === "team" ? data.teams : data.divisions).map((x) => {
                  const on = followed.has(`${type}:${x.id}`);
                  return (
                    <li key={`${type}:${x.id}`}>
                      <Button aria-pressed={on} variant="outline" onClick={() => { setSelected(null); void toggleFollow(type, x.id); }} className="flex min-h-12 w-full items-center justify-between gap-3 rounded-lg border-2 bg-card px-4 text-left text-base text-foreground whitespace-normal">
                        <span>{x.name}</span>
                        <Star aria-hidden className={`shrink-0 ${on ? "fill-starred text-starred" : "text-muted-foreground"}`} />
                      </Button>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </div>
      )}

      <Section title="Calendar">
        <div className="mx-auto max-w-xl space-y-3" onKeyDown={e => { if (e.target instanceof HTMLSelectElement || e.target instanceof HTMLInputElement) return; if(e.key === "ArrowRight" && monthIndex < 2){setMonthIndex(monthIndex+1);setSelected(null);} if(e.key === "ArrowLeft" && monthIndex > 0){setMonthIndex(monthIndex-1);setSelected(null);} }}>
          <div className="flex items-center justify-between gap-2">
            <Button variant="outline" size="icon" aria-label="Previous month" disabled={monthIndex===0} onClick={()=>{setMonthIndex(monthIndex-1);setSelected(null);}}><ChevronLeft aria-hidden/></Button>
            <Button variant="ghost" disabled={monthIndex===0} onClick={()=>{setMonthIndex(0);setSelected(null);}}>This Month</Button>
            <Button variant="outline" size="icon" aria-label="Next month" disabled={monthIndex===2} onClick={()=>{setMonthIndex(monthIndex+1);setSelected(null);}}><ChevronRight aria-hidden/></Button>
          </div>
          {month && <Month year={month.year} month={month.month} counts={byDay} selected={selected} onSelect={setSelected}/>}
        </div>
        {selected && <Button className={btn.secondary} onClick={() => setSelected(null)}>Show all dates</Button>}
      </Section>

      <Section title={selected ? `Matches on ${selected}` : "Upcoming matches"}>
        {list.length ? <div className="glass-list space-y-3">{list.map((m) => <MatchCard key={m.id} m={m} data={data} />)}</div> : <Card>No matches published for this selection.</Card>}
      </Section>
    </AppShell>
  );
}

function Month({ year, month, counts, selected, onSelect }: { year: number; month: number; counts: Map<string, number>; selected: string | null; onSelect: (d: string) => void }) {
  const first = new Date(Date.UTC(year, month - 1, 1)).getUTCDay();
  const days = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const label = new Intl.DateTimeFormat("en-CA", { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(Date.UTC(year, month - 1, 15)));
  return (
    <div className="rounded-lg border bg-card p-4">
      <h3 aria-live="polite" className="mb-4 text-center text-2xl font-semibold">{label}</h3>
      <div className="grid grid-cols-7 gap-1 text-center" aria-label={label}>
        {["S", "M", "T", "W", "T", "F", "S"].map((d, i) => <span key={i} aria-hidden className="text-sm font-semibold text-muted-foreground">{d}</span>)}
        {Array.from({ length: first }).map((_, i) => <span key={`e${i}`} />)}
        {Array.from({ length: days }).map((_, i) => {
          const key = `${year}-${String(month).padStart(2, "0")}-${String(i + 1).padStart(2, "0")}`;
          const n = counts.get(key) ?? 0;
          return (
            <Button key={key} disabled={!n} onClick={() => onSelect(key)} aria-pressed={selected === key}
              aria-label={`${key}: ${n ? `${n} match${n > 1 ? "es" : ""}` : "no matches"}`}
              variant="ghost" className={`min-h-11 w-full p-0 rounded-md text-base ${n ? "bg-accent font-semibold text-accent-foreground" : "text-muted-foreground"} ${selected === key ? "ring-4 ring-primary" : ""}`}>
              {i + 1}
            </Button>
          );
        })}
      </div>
    </div>
  );
}
