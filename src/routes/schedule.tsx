import { createFileRoute, Link } from "@tanstack/react-router";
import { useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AppShell, Section, Card, btn } from "@/components/AppShell";
import { MatchCard } from "@/components/MatchCard";
import { publicCompetition } from "@/lib/public-competition";
import { competitionQuery } from "@/lib/queries";
import { calendarMonths, TZ } from "@/lib/format";
import { useHomeDataMode } from "@/hooks/use-home-data-mode";
import { StarredTargetsPicker } from "@/components/StarredTargetsPicker";
import { starredDisplayContext } from "@/lib/starred-targets";
import { useRole } from "@/hooks/use-role";
import { useParentContext } from "@/hooks/use-parent-context";
import { validateBrowseSearch } from "@/lib/parent-context";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/schedule")({
  validateSearch: validateBrowseSearch,
  head: () => ({
    meta: [
      { title: "Schedule — OVA Companion" },
      {
        name: "description",
        content: "Upcoming Ontario volleyball matches for the teams and divisions you follow.",
      },
      { property: "og:title", content: "Schedule — OVA Companion" },
      {
        property: "og:description",
        content: "Calendar of upcoming matches for this month and the next two.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  loader: ({ context }) => context.queryClient.ensureQueryData(competitionQuery),
  component: Schedule,
});

const dayKey = (iso: string) =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(iso));

function Schedule() {
  const { data: storedCompetition } = useSuspenseQuery(competitionQuery);
  const identity = useRole();
  const { mode: homeMode } = useHomeDataMode(identity);
  const data =
    homeMode === "synthetic"
      ? {
          ...storedCompetition,
          teams: storedCompetition.teams.filter((t) => t.data_mode === "synthetic"),
          matches: storedCompetition.matches.filter((m) => m.data_mode === "synthetic"),
        }
      : publicCompetition(storedCompetition);
  const { user } = identity;
  const hh = identity.household;
  const parentContext = useParentContext(identity, storedCompetition.teams);
  const qc = useQueryClient();
  const starsUnavailable = identity.ready === false || (!!user && (hh.isPending || hh.isError));
  const starsContext = useMemo(
    () =>
      starredDisplayContext(
        { events: data.events, divisions: data.divisions, matches: data.matches },
        homeMode,
      ),
    [data.events, data.divisions, data.matches, homeMode],
  );
  const [guestStars, setGuestStars] = useState<string[]>([]);
  useEffect(() => {
    try {
      setGuestStars(JSON.parse(localStorage.getItem("ova-guest-stars") ?? "[]"));
    } catch {
      /* ignore */
    }
  }, []);
  const followed = new Set(
    user ? (hh.data?.follows ?? []).map((f) => `${f.target_type}:${f.target_id}`) : guestStars,
  );
  const [filter, setFilter] = useState<"context" | "all" | "following">("context");
  const [monthIndex, setMonthIndex] = useState(0);
  const months = calendarMonths();
  const month = months[monthIndex] ?? months[0];
  const monthPrefix = `${month?.year}-${String(month?.month).padStart(2, "0")}`;
  const [selected, setSelected] = useState<string | null>(null);

  useEffect(() => {
    setSelected(null);
  }, [parentContext.teamId]);
  const contextual =
    filter === "context" &&
    (parentContext.pending || parentContext.invalid || !!parentContext.teamId);
  const activeFilter = filter === "context" && !contextual ? "all" : filter;
  const scheduled = data.matches.filter((m) => m.status === "scheduled");
  const visible = scheduled.filter((m) =>
    contextual
      ? !!parentContext.teamId &&
        (m.team_a_id === parentContext.teamId || m.team_b_id === parentContext.teamId)
      : filter !== "following" ||
        followed.has(`team:${m.team_a_id}`) ||
        followed.has(`team:${m.team_b_id}`) ||
        followed.has(`division:${m.division_id}`),
  );
  const byDay = useMemo(() => {
    const map = new Map<string, number>();
    for (const m of visible) {
      const k = m.starts_at ? dayKey(m.starts_at) : m.source_date;
      if (k) map.set(k, (map.get(k) ?? 0) + 1);
    }
    return map;
  }, [visible]);
  const list = selected
    ? visible.filter((m) => (m.starts_at ? dayKey(m.starts_at) : m.source_date) === selected)
    : visible.filter(
        (m) =>
          (m.starts_at ? dayKey(m.starts_at) : m.source_date)?.startsWith(monthPrefix) ||
          (!m.starts_at && !m.source_date),
      );

  async function toggleFollow(type: "team" | "division", id: string) {
    if (starsUnavailable) throw new Error("Saved stars are not available yet");
    if (!user) {
      const k = `${type}:${id}`;
      const next = guestStars.includes(k) ? guestStars.filter((x) => x !== k) : [...guestStars, k];
      setGuestStars(next);
      try {
        localStorage.setItem("ova-guest-stars", JSON.stringify(next));
      } catch {
        /* ignore */
      }
      return;
    }
    const result = followed.has(`${type}:${id}`)
      ? await supabase
          .from("follows")
          .delete()
          .eq("user_id", user.id)
          .eq("target_type", type)
          .eq("target_id", id)
      : await supabase
          .from("follows")
          .insert({ user_id: user.id, target_type: type, target_id: id });
    if (result.error) throw result.error;
    await qc.invalidateQueries({ queryKey: ["household", user.id] });
  }

  return (
    <AppShell
      sourceLabel={
        homeMode === "synthetic" ? "Demo data · Not real competition" : "Real competition data"
      }
      title="Schedule"
    >
      <div className="flex flex-wrap gap-3 text-sm font-semibold">
        <Link to="/" search={parentContext.search}>
          Back to homepage
        </Link>
        <Link to="/announcements" search={parentContext.search}>
          Announcements
        </Link>
      </div>
      {parentContext.invalid && (
        <p role="status">
          This player or team selection is no longer available. Choose an approved player or team.
        </p>
      )}
      {parentContext.pending && <p role="status">Loading your selected team…</p>}
      {parentContext.player && (
        <p className="text-sm">
          Linked player: {parentContext.player.display_name} ·{" "}
          {data.teams.find((team) => team.id === parentContext.teamId)?.name ??
            "Team to be determined"}
        </p>
      )}
      <div role="group" aria-label="Show matches" className="flex gap-2">
        {parentContext.teamId && (
          <Button
            aria-pressed={activeFilter === "context"}
            className={activeFilter === "context" ? btn.primary : btn.secondary}
            onClick={() => {
              setFilter("context");
              setSelected(null);
            }}
          >
            Current team
          </Button>
        )}
        {(["all", "following"] as const).map((f) => (
          <Button
            key={f}
            aria-pressed={activeFilter === f}
            aria-controls={f === "following" ? "starred-team-filters" : undefined}
            onClick={() => {
              setFilter(f);
              setSelected(null);
            }}
            className={activeFilter === f ? btn.primary : btn.secondary}
          >
            {f === "all" ? "All matches" : "Starred Team"}
          </Button>
        ))}
      </div>

      {filter === "following" && (
        <div
          id="starred-team-filters"
          role="group"
          aria-label="Starred teams and divisions"
          className="space-y-4"
        >
          <StarredTargetsPicker
            disabled={starsUnavailable}
            teams={data.teams}
            divisions={data.divisions}
            context={starsContext}
            followed={followed}
            dataMode={homeMode}
            onToggle={async (type, id) => {
              setSelected(null);
              await toggleFollow(type, id);
            }}
          />
        </div>
      )}

      <Section title="Calendar">
        <p className="text-sm text-muted-foreground">
          The current month and the next two months. All times are in Toronto.
        </p>
        <div
          className="mx-auto max-w-xl space-y-3"
          onKeyDown={(e) => {
            if (e.target instanceof HTMLSelectElement || e.target instanceof HTMLInputElement)
              return;
            if (e.key === "ArrowRight" && monthIndex < 2) {
              setMonthIndex(monthIndex + 1);
              setSelected(null);
            }
            if (e.key === "ArrowLeft" && monthIndex > 0) {
              setMonthIndex(monthIndex - 1);
              setSelected(null);
            }
          }}
        >
          <div className="flex items-center justify-between gap-2">
            <Button
              variant="outline"
              size="icon"
              aria-label="Previous month"
              disabled={monthIndex === 0}
              onClick={() => {
                setMonthIndex(monthIndex - 1);
                setSelected(null);
              }}
            >
              <ChevronLeft aria-hidden />
            </Button>
            <Button
              variant="ghost"
              disabled={monthIndex === 0}
              onClick={() => {
                setMonthIndex(0);
                setSelected(null);
              }}
            >
              This Month
            </Button>
            <Button
              variant="outline"
              size="icon"
              aria-label="Next month"
              disabled={monthIndex === 2}
              onClick={() => {
                setMonthIndex(monthIndex + 1);
                setSelected(null);
              }}
            >
              <ChevronRight aria-hidden />
            </Button>
          </div>
          {month && (
            <Month
              year={month.year}
              month={month.month}
              counts={byDay}
              selected={selected}
              onSelect={setSelected}
            />
          )}
          <p className="text-sm text-muted-foreground">
            Numbers below dates show match counts. Select a day for full details.
          </p>
        </div>
        {selected && (
          <Button className={btn.secondary} onClick={() => setSelected(null)}>
            Show all dates
          </Button>
        )}
      </Section>

      <Section title={selected ? `Matches on ${selected}` : "Upcoming matches"}>
        <div className="glass-list space-y-3">
          {list.length ? (
            list.map((m) => <MatchCard key={m.id} m={m} data={data} />)
          ) : (
            <Card className="match-pending">
              <p className="font-semibold">
                {contextual && parentContext.pending
                  ? "Loading your selected team's schedule…"
                  : contextual && parentContext.invalid
                    ? "Choose an approved player or team to view their schedule."
                    : "No matches published for this selection."}
              </p>
              {!parentContext.pending && (
                <>
                  <p className="mt-2 text-sm">
                    An empty calendar does not confirm that no matches exist. Choose another date or
                    check back when the schedule is released.
                  </p>
                  <div className="mt-4 flex flex-wrap gap-3">
                    {contextual && !parentContext.invalid && (
                      <Button
                        variant="outline"
                        className="text-foreground"
                        onClick={() => {
                          setFilter("all");
                          setSelected(null);
                        }}
                      >
                        Browse all matches
                      </Button>
                    )}
                    {filter !== "following" && (
                      <Button
                        variant="outline"
                        className="text-foreground"
                        onClick={() => {
                          setFilter("following");
                          setSelected(null);
                        }}
                      >
                        Choose teams &amp; divisions
                      </Button>
                    )}
                    <Button asChild variant="outline" className="text-foreground">
                      <Link to="/results" search={parentContext.search}>
                        View recorded results
                      </Link>
                    </Button>
                  </div>
                </>
              )}
            </Card>
          )}
        </div>
      </Section>
    </AppShell>
  );
}

function Month({
  year,
  month,
  counts,
  selected,
  onSelect,
}: {
  year: number;
  month: number;
  counts: Map<string, number>;
  selected: string | null;
  onSelect: (d: string) => void;
}) {
  const first = new Date(Date.UTC(year, month - 1, 1)).getUTCDay();
  const days = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const label = new Intl.DateTimeFormat("en-CA", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(year, month - 1, 15)));
  return (
    <div className="rounded-lg border bg-card p-4">
      <h3 aria-live="polite" className="mb-4 text-center text-2xl font-semibold">
        {label}
      </h3>
      <div className="grid grid-cols-7 gap-1 text-center" aria-label={label}>
        {["S", "M", "T", "W", "T", "F", "S"].map((d, i) => (
          <span key={i} aria-hidden className="text-sm font-semibold text-muted-foreground">
            {d}
          </span>
        ))}
        {Array.from({ length: first }).map((_, i) => (
          <span key={`e${i}`} />
        ))}
        {Array.from({ length: days }).map((_, i) => {
          const key = `${year}-${String(month).padStart(2, "0")}-${String(i + 1).padStart(2, "0")}`;
          const n = counts.get(key) ?? 0;
          return (
            <Button
              key={key}
              disabled={!n}
              onClick={() => onSelect(key)}
              aria-pressed={selected === key}
              aria-label={`${key}: ${n ? `${n} match${n > 1 ? "es" : ""}` : "no matches"}`}
              variant="ghost"
              className={`min-h-11 w-full flex-col gap-1 p-0 rounded-md text-base ${n ? "bg-accent font-semibold text-accent-foreground" : "text-muted-foreground"} ${selected === key ? "ring-4 ring-primary" : ""}`}
            >
              <span>{i + 1}</span>
              {n > 0 && (
                <span aria-hidden="true" className="text-xs font-medium leading-none">
                  {n}
                  <span className="hidden sm:inline"> {n === 1 ? "match" : "matches"}</span>
                </span>
              )}
            </Button>
          );
        })}
      </div>
    </div>
  );
}
