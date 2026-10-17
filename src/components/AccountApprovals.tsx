import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { CheckCircle2, XCircle, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, Section, btn } from '@/components/AppShell';
import { supabase } from '@/integrations/supabase/client';

export function AccountApprovals({ kind, userId, teamId }: { kind: 'TEAM' | 'FAMILY'; userId: string; teamId: string | undefined }) {
  const qc = useQueryClient();
  const [busy, setBusy] = useState<string | null>(null);
  const [changes, setChanges] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const requests = useQuery({
    queryKey: ['identity-approvals', userId, kind, teamId],
    queryFn: async () => {
      if (kind === 'FAMILY') {
        const { data, error } = await supabase.rpc('family_approval_requests');
        if (error) throw error;
        return (data ?? []).map(r => ({ ...r, jersey: null }));
      }
      if (!teamId) return [];
      const { data, error } = await supabase.from('players').select('*').eq('team_id', teamId).order('created_at', { ascending: false });
      if (error) throw error;
      return (data ?? []).map(p => ({ id: p.id, display_name: p.display_name, status: p.status, relationship: null, jersey: p.jersey_number, created_at: p.created_at }));
    },
  });
  async function review(id: string, approve: boolean, changeNote?: string) {
    setBusy(id);
    try {
      const result = kind === 'FAMILY'
        ? await supabase.rpc('review_family_request', { _link: id, _approve: approve })
        : changeNote
          ? await supabase.rpc('request_player_changes', { _player: id, _note: changeNote })
          : await supabase.rpc('verify_player', { _player: id, _status: approve ? 'verified' : 'rejected' });
      if (result.error) throw result.error;
      await Promise.all([
        qc.invalidateQueries({ queryKey: ['identity-approvals'] }),
        qc.invalidateQueries({ queryKey: ['household'] }),
        qc.invalidateQueries({ queryKey: ['competition'] }),
      ]);
      setChanges(null); setNote('');
      toast.success(changeNote ? 'Changes requested' : approve ? 'Approved' : 'Request rejected');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not review this request.');
    } finally { setBusy(null); }
  }
  const pending = requests.data?.filter(r => r.status === 'pending') ?? [];
  const reviewed = requests.data?.filter(r => r.status !== 'pending') ?? [];
  return <Section title={kind === 'TEAM' ? 'Verify my players' : 'Verify my family & friends'}>
    {requests.isPending ? <p role="status">Loading requests…</p> : requests.isError ? <div role="alert"><p>Could not load verification requests.</p><Button variant="outline" onClick={() => requests.refetch()}>Try again</Button></div> : <>
      {pending.length ? <div className="space-y-3">{pending.map(r => <Card key={r.id}>
        <div className="flex flex-wrap items-start justify-between gap-3"><div><h3 className="text-xl font-bold">{r.display_name}</h3><p className="capitalize text-muted-foreground">{kind === 'TEAM' ? `Jersey #${r.jersey ?? '—'}` : r.relationship}</p></div><span className="font-bold text-pending-foreground">Pending verification</span></div>
        <div className="mt-4 flex flex-wrap gap-3"><Button disabled={busy !== null} onClick={() => review(r.id, true)}><CheckCircle2 aria-hidden />Approve</Button><Button disabled={busy !== null} variant="outline" onClick={() => review(r.id, false)}><XCircle aria-hidden />Reject</Button>{kind === 'TEAM' && <Button variant="ghost" disabled={busy !== null} onClick={() => { setChanges(r.id); setNote(''); }}>Request changes</Button>}</div>
        {changes === r.id && <form className="mt-4 space-y-3" onSubmit={e => { e.preventDefault(); if (note.trim()) void review(r.id, false, note.trim()); }}><label className="block font-bold">What should this player change?<textarea required maxLength={1000} rows={3} className={btn.input} value={note} onChange={e => setNote(e.target.value)} /></label><Button disabled={busy !== null || !note.trim()}>Send request</Button></form>}
      </Card>)}</div> : <p className="border-y py-5 text-muted-foreground">No pending verification requests.</p>}
      {reviewed.length > 0 && <div className="space-y-3 pt-3"><h3 className="text-lg font-bold">Reviewed</h3>{reviewed.map(r => <div key={r.id} className="flex flex-wrap items-center justify-between gap-3 border-b py-3"><span>{r.display_name}</span><span className="inline-flex items-center gap-2 font-bold capitalize text-muted-foreground">{r.status === 'verified' || r.status === 'approved' ? <ShieldCheck aria-hidden className="size-5 text-success" /> : <XCircle aria-hidden className="size-5 text-destructive" />}{r.status === 'verified' ? 'Approved' : r.status}</span></div>)}</div>}
    </>}
  </Section>;
}