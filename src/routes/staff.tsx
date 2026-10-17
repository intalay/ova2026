import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { AppShell, Section, Card, btn } from "@/components/AppShell";
import { competitionQuery, myHouseholdQuery } from "@/lib/queries";
import { useSessionUser } from "@/hooks/use-session";
import { supabase } from "@/integrations/supabase/client";
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
  const qc = useQueryClient();
  const roles = hh.data?.roles ?? [];
  const staff = roles.includes("staff") || roles.includes("admin");
  const [title, setTitle] = useState(""); const [body, setBody] = useState("");
  const [csv, setCsv] = useState(""); const [teamId, setTeamId] = useState(comp.teams[0]?.id ?? "");

  if (!ready || hh.isLoading) return <AppShell title="Staff"><p>Loading…</p></AppShell>;
  if (!user || (!staff && !hh.data?.managedTeams.length))
    return <AppShell title="Staff"><Card>Staff tools are only available to OVA staff and approved coaches.</Card></AppShell>;

  const pending = (hh.data?.visiblePlayers ?? []).filter((p) => p.status === "pending");
  const teamName = (id: string | null) => comp.teams.find((t) => t.id === id)?.name ?? "—";

  async function publish(e: FormEvent) {
    e.preventDefault();
    const { error } = await supabase.from("announcements").insert({ title, body, author_id: user!.id, data_mode: "real" });
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
      <Section title="Verify player requests">
        {pending.length ? pending.map((p) => (
          <Card key={p.id}>
            <p className="text-xl font-bold">{p.display_name}</p><p>{teamName(p.team_id)}</p>
            <div className="mt-2 flex gap-2">
              <button onClick={() => verify(p.id, "verified")} className={btn.primary}>Verify</button>
              <button onClick={() => verify(p.id, "rejected")} className={btn.secondary}>Reject</button>
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
              <button className={btn.primary}>Publish</button>
            </form>
          </Section>
          <Section title="Import or update roster">
            <p className="text-base">Paste CSV with columns <code>player_id,name,jersey</code>. Re-importing the same player_id updates that entry.</p>
            <select value={teamId} onChange={(e) => setTeamId(e.target.value)} aria-label="Team" className={btn.input}>
              {comp.teams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
            <textarea aria-label="Roster CSV" value={csv} onChange={(e) => setCsv(e.target.value)} rows={5} className={`${btn.input} py-2 font-mono`} />
            <button onClick={importRoster} className={btn.primary}>Import roster</button>
          </Section>
        </>
      )}
    </AppShell>
  );
}
