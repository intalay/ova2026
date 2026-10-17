import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type Match = {
  id: string; event_id: string; division_id: string; team_a_id: string; team_b_id: string | null;
  venue_id: string | null; source_date: string | null; starts_at: string | null; court: string | null;
  status: string; score_a: number | null; score_b: number | null; sets: { a: number; b: number }[] | null; data_mode: string;
};

async function fetchCompetition() {
    const [teams, divisions, events, venues, matches, rankings, announcements] = await Promise.all([
      supabase.from("teams").select("*").order("name"),
      supabase.from("divisions").select("*").order("name"),
      supabase.from("events").select("*"),
      supabase.from("venues").select("*"),
      supabase.from("matches").select("*").order("starts_at", { ascending: true, nullsFirst: false }),
      supabase.from("rankings").select("*"),
      supabase.from("announcements").select("*").eq("status", "published").order("published_at", { ascending: false }),
    ]);
    for (const r of [teams, divisions, events, venues, matches, rankings, announcements]) if (r.error) throw r.error;
    return {
      teams: teams.data ?? [], divisions: divisions.data ?? [], events: events.data ?? [], venues: venues.data ?? [],
      matches: (matches.data ?? []) as unknown as Match[], rankings: rankings.data ?? [], announcements: announcements.data ?? [],
    };
}
export type CompetitionData = Awaited<ReturnType<typeof fetchCompetition>>;
export const competitionQuery = queryOptions({ queryKey: ["competition"], queryFn: fetchCompetition });

export const venueQuery = (id: string) => queryOptions({
  queryKey: ["venue", id],
  queryFn: async () => {
    const [v, p] = await Promise.all([
      supabase.from("venues").select("*").eq("id", id).maybeSingle(),
      supabase.from("parking").select("*").eq("venue_id", id),
    ]);
    if (v.error) throw v.error;
    return { venue: v.data, parking: p.data ?? [] };
  },
});

/** Private data: RLS only returns players the signed-in user may see. */
async function fetchHousehold(userId: string | undefined) {
    if (!userId) throw new Error("Sign in required");
    const [players, links, roles, follows, profile, managed] = await Promise.all([
      supabase.from("players").select("*"),
       supabase.from("family_links").select("*").eq("family_user_id", userId),
       supabase.from("user_roles").select("role").eq("user_id", userId),
       supabase.from("follows").select("*").eq("user_id", userId),
       supabase.from("profiles").select("*").eq("id", userId).maybeSingle(),
       supabase.from("managed_teams").select("*").eq("user_id", userId),
    ]);
     for (const result of [players, links, roles, follows, profile, managed]) if (result.error) throw result.error;
     const all = players.data ?? [];
    const familyLinks = links.data ?? [];
    const linkedIds = new Set(familyLinks.filter(l => l.status === 'approved').map((l) => l.player_id));
    return {
      linkedPlayers: all.filter((p) => linkedIds.has(p.id)),
      familyLinks,
      self: all.find((p) => p.user_id === userId) ?? null,
      visiblePlayers: all,
      roles: (roles.data ?? []).map((r) => r.role as string),
      follows: follows.data ?? [],
      profile: profile.data,
      managedTeams: (managed.data ?? []).map((m) => m.team_id),
    };
}
export type Household = Awaited<ReturnType<typeof fetchHousehold>>;
export const myHouseholdQuery = (userId: string | undefined) =>
  queryOptions({ queryKey: ["household", userId], enabled: !!userId, queryFn: () => fetchHousehold(userId) });
