import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useState, type FormEvent } from "react";
import { KeyRound, LogOut, X } from "lucide-react";
import { toast } from "sonner";
import { AppShell, Section, Card, btn } from "@/components/AppShell";
import { competitionQuery, myHouseholdQuery, type Household } from "@/lib/queries";
import { useSessionUser } from "@/hooks/use-session";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/account")({
  head: () => ({
    meta: [
      { title: "Account — OVA Companion" },
      { name: "description", content: "Sign in, link your players and manage pairing codes." },
      { property: "og:title", content: "Account — OVA Companion" },
      { property: "og:description", content: "Family and player account for OVA Companion." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  loader: ({ context }) => context.queryClient.ensureQueryData(competitionQuery),
  component: Account,
});

function Account() {
  const { user, ready } = useSessionUser();
  if (!ready) return <AppShell title="Account"><p>Loading…</p></AppShell>;
  return user ? <Profile userId={user.id} email={user.email ?? ""} /> : <SignIn />;
}

function SignIn() {
  const [mode, setMode] = useState<"in" | "up">("in");
  const [email, setEmail] = useState(""); const [password, setPassword] = useState(""); const [name, setName] = useState("");
  const [busy, setBusy] = useState(false); const [msg, setMsg] = useState<string | null>(null);
  async function submit(e: FormEvent) {
    e.preventDefault(); setBusy(true); setMsg(null);
    const res = mode === "in"
      ? await supabase.auth.signInWithPassword({ email, password })
      : await supabase.auth.signUp({ email, password, options: { emailRedirectTo: `${window.location.origin}/account`, data: { display_name: name } } });
    setBusy(false);
    if (res.error) return setMsg(res.error.message);
    if (mode === "up" && !res.data.session) setMsg("Check your email to confirm your account, then sign in.");
  }
  return (
    <AppShell title="Account">
      <Card>
        <h2 className="text-2xl font-bold uppercase">{mode === "in" ? "Sign in" : "Create account"}</h2>
        <form onSubmit={submit} className="mt-3 space-y-3">
          {mode === "up" && <label className="block text-lg font-bold">Your name<input required value={name} onChange={(e) => setName(e.target.value)} className={btn.input} autoComplete="name" /></label>}
          <label className="block text-lg font-bold">Email<input required type="email" value={email} onChange={(e) => setEmail(e.target.value)} className={btn.input} autoComplete="email" /></label>
          <label className="block text-lg font-bold">Password<input required type="password" minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} className={btn.input} autoComplete={mode === "in" ? "current-password" : "new-password"} /></label>
          {msg && <p role="status" className="rounded-lg bg-secondary p-3 font-bold">{msg}</p>}
          <button disabled={busy} className={`${btn.primary} w-full`}>{mode === "in" ? "Sign in" : "Create account"}</button>
        </form>
        <button onClick={() => setMode(mode === "in" ? "up" : "in")} className="mt-3 text-lg font-bold text-primary underline underline-offset-4">
          {mode === "in" ? "New here? Create an account" : "Already have an account? Sign in"}
        </button>
      </Card>
      <p className="text-base text-muted-foreground">You can browse schedules, results and venues without an account.</p>
    </AppShell>
  );
}

function Profile({ userId, email }: { userId: string; email: string }) {
  const { data: comp } = useSuspenseQuery(competitionQuery);
  const hh = useQuery(myHouseholdQuery(userId));
  const qc = useQueryClient(); const nav = useNavigate();
  const [pairOpen, setPairOpen] = useState(false);
  const d = hh.data;
  const roles = d?.roles ?? [];
  const teamName = (id: string | null) => comp.teams.find((t) => t.id === id)?.name ?? "Team to be determined";

  async function signOut() {
    await qc.cancelQueries(); qc.removeQueries({ queryKey: ["household"] });
    await supabase.auth.signOut(); nav({ to: "/", replace: true });
  }
  async function joinDemo() {
    const { error } = await supabase.rpc("join_synthetic_demo");
    if (error) return toast.error(error.message);
    toast.success("Linked to the fictional demo players"); qc.invalidateQueries({ queryKey: ["household"] });
  }

  return (
    <AppShell title="Profile" action={
      <button onClick={() => setPairOpen(true)} aria-label="Pairing codes" className="inline-flex size-12 items-center justify-center rounded-full bg-accent text-accent-foreground">
        <KeyRound aria-hidden />
      </button>
    }>
      <Card>
        <p className="text-2xl font-bold">{d?.profile?.display_name || email}</p>
        <p className="text-base text-muted-foreground">{email}</p>
        <p className="mt-2 flex flex-wrap gap-2">{roles.map((r) => <span key={r} className="rounded bg-secondary px-2 py-0.5 font-bold capitalize text-secondary-foreground">{r}</span>)}</p>
      </Card>

      {d?.self && (
        <Section title="My player profile">
          <Card>
            <p className="text-xl font-bold">{d.self.display_name}</p>
            <p>{teamName(d.self.team_id)} · <span className="font-bold capitalize">{d.self.status === "pending" ? "Waiting for coach or staff verification" : d.self.status}</span></p>
          </Card>
        </Section>
      )}

      <Section title="Linked players">
        {d?.linkedPlayers.length ? d.linkedPlayers.map((p) => (
          <Card key={p.id}><p className="text-xl font-bold">{p.display_name}</p><p>{teamName(p.team_id)}</p></Card>
        )) : <Card><p>No players linked yet. Ask your player for a family code, then tap the key icon at the top right.</p></Card>}
        <Card className="border-dashed">
          <p className="font-bold">Trying the demo?</p>
          <p className="text-base">Link your account to the two fictional demo players. This uses synthetic data only.</p>
          <button onClick={joinDemo} className={`${btn.secondary} mt-2`}>Link demo players</button>
        </Card>
      </Section>

      {(roles.includes("staff") || roles.includes("admin") || (d?.managedTeams.length ?? 0) > 0) && (
        <Link to="/staff" className={`${btn.primary} w-full`}>Open staff tools</Link>
      )}
      <button onClick={signOut} className={`${btn.secondary} w-full`}><LogOut aria-hidden />Sign out</button>

      {pairOpen && <PairingDialog onClose={() => setPairOpen(false)} data={d} teams={comp.teams} roles={roles} />}
    </AppShell>
  );
}

type HH = Household;

function PairingDialog({ onClose, data, teams, roles }: { onClose: () => void; data: HH | undefined; teams: { id: string; name: string }[]; roles: string[] }) {
  const qc = useQueryClient();
  const [code, setCode] = useState(""); const [rel, setRel] = useState("parent"); const [issued, setIssued] = useState<{ code: string; purpose: string; expires_at: string } | null>(null);
  const staff = roles.includes("staff") || roles.includes("admin");
  const codeTeams = teams.filter((t) => staff || data?.managedTeams.includes(t.id));
  const [teamId, setTeamId] = useState(codeTeams[0]?.id ?? "");

  async function redeem(e: FormEvent) {
    e.preventDefault();
    const { data: r, error } = await supabase.rpc("redeem_code", { _code: code, _relationship: rel });
    if (error) return toast.error(error.message);
    const res = r as { purpose: string };
    toast.success(res.purpose === "TEAM" ? "Team request sent — waiting for verification" : "Player linked to your family");
    setCode(""); qc.invalidateQueries({ queryKey: ["household"] });
  }
  async function issue(kind: "TEAM" | "FAMILY") {
    const { data: r, error } = kind === "TEAM"
      ? await supabase.rpc("create_team_code", { _team: teamId })
      : await supabase.rpc("create_family_code", { _player: data!.self!.id });
    if (error) return toast.error(error.message);
    setIssued(r as never);
  }

  return (
    <div role="dialog" aria-modal="true" aria-labelledby="pair-title" className="fixed inset-0 z-50 flex items-end justify-center bg-foreground/50 sm:items-center"
      onKeyDown={(e) => e.key === "Escape" && onClose()}>
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-t-2xl bg-card p-5 sm:rounded-2xl">
        <div className="flex items-center justify-between">
          <h2 id="pair-title" className="text-2xl font-bold uppercase">Pairing codes</h2>
          <button autoFocus onClick={onClose} aria-label="Close" className="inline-flex size-12 items-center justify-center rounded-full border-2"><X aria-hidden /></button>
        </div>
        <form onSubmit={redeem} className="mt-4 space-y-3">
          <label className="block text-lg font-bold">Enter a team or family code
            <input value={code} onChange={(e) => setCode(e.target.value)} required className={`${btn.input} font-mono uppercase tracking-widest`} autoComplete="off" />
          </label>
          <label className="block text-lg font-bold">If it is a family code, I am the player's
            <select value={rel} onChange={(e) => setRel(e.target.value)} className={btn.input}>
              <option value="parent">Parent</option><option value="guardian">Guardian</option><option value="family">Family member</option><option value="friend">Friend</option>
            </select>
          </label>
          <button className={`${btn.primary} w-full`}>Use code</button>
        </form>

        {data?.self?.status === "verified" && (
          <div className="mt-6 border-t-2 pt-4">
            <h3 className="text-xl font-bold uppercase">Invite a family member</h3>
            <p className="text-base">Each family code works once, for one person, for 48 hours.</p>
            <button onClick={() => issue("FAMILY")} className={`${btn.secondary} mt-2 w-full`}>Create family code</button>
          </div>
        )}
        {codeTeams.length > 0 && (
          <div className="mt-6 border-t-2 pt-4">
            <h3 className="text-xl font-bold uppercase">Team code</h3>
            <p className="text-base">Players use this to request to join. You verify each request. A new code replaces your previous one.</p>
            <select value={teamId} onChange={(e) => setTeamId(e.target.value)} aria-label="Team" className={`${btn.input} mt-2`}>
              {codeTeams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
            <button onClick={() => issue("TEAM")} className={`${btn.secondary} mt-2 w-full`}>Create team code</button>
          </div>
        )}
        {issued && (
          <p role="status" className="mt-4 rounded-lg bg-secondary p-4 text-center">
            <span className="block text-base">{issued.purpose === "TEAM" ? "Team code" : "Family code"} · expires {new Date(issued.expires_at).toLocaleString("en-CA")}</span>
            <span className="block font-mono text-3xl font-bold tracking-widest">{issued.code}</span>
          </p>
        )}
      </div>
    </div>
  );
}
