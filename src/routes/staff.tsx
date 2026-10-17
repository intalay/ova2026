import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { AppShell, Section, Card, btn } from "@/components/AppShell";
import { competitionQuery, myHouseholdQuery } from "@/lib/queries";
import { useSessionUser } from "@/hooks/use-session";
import { supabase } from "@/integrations/supabase/client";
import { StaffSignIn } from "@/components/StaffSignIn";
import { parseRosterCsv } from "@/lib/roster";

export const Route = createFileRoute("/staff")({
  head: () => ({
    meta: [
      { title: "Staff tools — OVA Companion" },
      { name: "description", content: "Announcements, roster imports and player verification for OVA staff." },
      { property: "og:title", content: "Staff tools — OVA Companion" },
      { property: "og:description", content: "Staff and coach tools." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  loader: ({ context }) => context.queryClient.ensureQueryData(competitionQuery),
  component: Staff,
});

function Staff() {
  const { user, ready } = useSessionUser();
  const hh = useQuery(myHouseholdQuery(user?.id));
  const { data: comp } = useSuspenseQuery(competitionQuery);
  const coachRequests = useQuery({ queryKey:["staff-coach-requests",user?.id],enabled:!!user,queryFn:async()=>{const {data,error}=await supabase.from("coach_requests").select("*").eq("status","pending");if(error)throw error;return data??[];} });
  const qc = useQueryClient();
  const roles = hh.data?.roles ?? [];
  const staff = roles.includes("staff") || roles.includes("admin");
  const [title, setTitle] = useState(""); const [body, setBody] = useState("");
  const [csv, setCsv] = useState(""); const [teamId, setTeamId] = useState(comp.teams[0]?.id ?? "");

  if (!ready || hh.isLoading) return <AppShell title="Staff"><p>Loading…</p></AppShell>;
  if (!user || (!staff && !hh.data?.managedTeams.length))
    return <AppShell title="Staff">{!user?<StaffSignIn/>:<Card><p className="text-xl font-bold">OVA Staff channel</p><p className="mt-2">Staff access has not been granted to this account.</p><Button className="mt-4" variant="outline" onClick={async()=>{await qc.cancelQueries();qc.clear();await supabase.auth.signOut();}}>Sign out</Button></Card>}</AppShell>;

  const pending = (hh.data?.visiblePlayers ?? []).filter((p) => p.status === "pending");
  const teamName = (id: string | null) => comp.teams.find((t) => t.id === id)?.name ?? "—";

  async function publish(e: FormEvent) {
    e.preventDefault();
    if (!user) return;
    const { error } = await supabase.from("announcements").insert({ title, body, author_id: user.id, data_mode: "real" });
    if (error) { toast.error(error.message); return; }
    toast.success("Announcement published"); setTitle(""); setBody(""); qc.invalidateQueries({ queryKey: ["competition"] });
  }
  async function verify(id: string, status: "verified" | "rejected") {
    const { error } = await supabase.rpc("verify_player", { _player: id, _status: status });
    if (error) { toast.error(error.message); return; }
    qc.invalidateQueries({ queryKey: ["household"] });
  }
  async function importRoster() {
    const { rows, errors } = parseRosterCsv(csv);
    if (errors.length) { toast.error(errors.join(" ")); return; }
    const { error } = await supabase.from("players").upsert(rows.map((r) => ({ id: `roster-${teamId}-${r.key}`, display_name: r.name, jersey_number: r.jersey, team_id: teamId, status: "verified", data_mode: "real" })));
    if (error) { toast.error(error.message); return; }
    toast.success(`${rows.length} roster entries saved`); setCsv(""); qc.invalidateQueries({ queryKey: ["household"] });
  }

  return (
    <AppShell title="Staff tools">
      {staff && <Section title="Coach applications">{coachRequests.data?.length ? coachRequests.data.map(r=><Card key={r.id}><p className="font-bold">{teamName(r.team_id)}</p><p className="text-sm">Submitted {new Date(r.created_at).toLocaleDateString()}</p><div className="mt-3 flex gap-2">{[true,false].map(approve=><Button key={String(approve)} variant={approve?"default":"outline"} onClick={async()=>{const {error}=await supabase.rpc("review_coach_request",{_request:r.id,_approve:approve});if(error)toast.error(error.message);else{toast.success(approve?"Coach approved":"Application rejected");qc.invalidateQueries({queryKey:["staff-coach-requests"]});}}}>{approve?"Approve coach":"Reject"}</Button>)}</div></Card>):<p>No pending coach applications.</p>}</Section>}
      <Section title="Verify player requests">
        {pending.length ? pending.map((p) => (
          <Card key={p.id}>
            <p className="text-xl font-bold">{p.display_name}</p><p>{teamName(p.team_id)}</p>
            <div className="mt-2 flex gap-2">
              <Button onClick={() => verify(p.id, "verified")} className={btn.primary}>Verify</Button>
              <Button onClick={async () => { const note=window.prompt("What should this player modify?"); if (!note) return; const { error }=await supabase.rpc("request_player_changes", { _player:p.id,_note:note }); if(error)toast.error(error.message); else qc.invalidateQueries({queryKey:["household"]}); }} className={btn.secondary}>Request changes</Button>
            </div>
          </Card>
        )) : <Card>No pending requests.</Card>}
      </Section>
      {staff && (
        <>
          <Section title="Post announcement">
            <form onSubmit={publish} className="space-y-3">
              <label className="block text-lg font-bold">Title<input required value={title} onChange={(e) => setTitle(e.target.value)} className={btn.input} /></label>
              <label className="block text-lg font-bold">Message<textarea required value={body} onChange={(e) => setBody(e.target.value)} rows={4} className={`${btn.input} py-2`} /></label>
              <Button className={btn.primary}>Publish</Button>
            </form>
          </Section>
          <Section title="Import or update roster">
            <p className="text-base">Paste CSV with columns <code>player_id,name,jersey</code>. Re-importing the same player_id updates that entry.</p>
            <select value={teamId} onChange={(e) => setTeamId(e.target.value)} aria-label="Team" className={btn.input}>
              {comp.teams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
            <textarea aria-label="Roster CSV" value={csv} onChange={(e) => setCsv(e.target.value)} rows={5} className={`${btn.input} py-2 font-mono`} />
            <Button onClick={importRoster} className={btn.primary}>Import roster</Button>
          </Section>
        </>
      )}
    </AppShell>
  );
}
