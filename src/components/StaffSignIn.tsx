import { useState, type FormEvent } from "react";
import { Link } from "@tanstack/react-router";
import { ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, btn } from "@/components/AppShell";
import { supabase } from "@/integrations/supabase/client";
import { isStaffEmailAllowed } from "@/lib/staff";

export function StaffSignIn() {
  const [mode, setMode] = useState<"in" | "up">("in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  async function submit(e: FormEvent) {
    e.preventDefault(); setMsg("");
    if (mode === "up" && !isStaffEmailAllowed(email)) { setMsg("This email is not authorized for OVA staff access."); return; }
    setBusy(true);
    const res = mode === "in"
      ? await supabase.auth.signInWithPassword({ email, password })
      : await supabase.auth.signUp({ email, password, options: { emailRedirectTo: `${window.location.origin}/staff` } });
    setBusy(false);
    if (res.error) { setMsg(res.error.message); return; }
    if (mode === "up" && !res.data.session) setMsg("Check your email to confirm your staff account, then sign in.");
  }
  return (
    <Card className="mx-auto max-w-xl space-y-4">
      <p className="flex items-center gap-2 text-2xl font-bold"><ShieldCheck aria-hidden />OVA Staff sign-in</p>
      <p>For OVA staff to verify coach applications.</p>
      <form onSubmit={submit} className="space-y-4">
        <label className="block font-bold">Email<input required type="email" autoComplete="email" value={email} onChange={e => setEmail(e.target.value)} className={btn.input} /></label>
        <label className="block font-bold">Password<input required type="password" minLength={8} autoComplete={mode === "in" ? "current-password" : "new-password"} value={password} onChange={e => setPassword(e.target.value)} className={btn.input} /></label>
        <Button disabled={busy} className="w-full">{busy ? "Please wait…" : mode === "in" ? "Sign in" : "Create staff account"}</Button>
      </form>
      <Button variant="link" onClick={() => { setMode(mode === "in" ? "up" : "in"); setMsg(""); }}>{mode === "in" ? "Create staff account" : "Already have an account? Sign in"}</Button>
      <Link to="/reset-password" className="block min-h-11 text-sm font-bold text-primary underline">Forgot password?</Link>
      {msg && <p role="status" className="rounded-md bg-secondary p-4">{msg}</p>}
    </Card>
  );
}
