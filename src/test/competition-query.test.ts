import { describe, expect, it, vi } from 'vitest';
vi.mock('@/integrations/supabase/client', () => ({ supabase: {} }));
import { fetchCompetition } from '@/lib/queries';
import { mockClient } from './results-client';

describe('complete shared competition reads', () => {
  it('keeps team-private announcements out of the public shared query even when authenticated transport can return them', async () => {
    const { client, calls } = mockClient({ announcements: [
      { id: 'public', team_id: null, status: 'published' },
      { id: 'private-A', team_id: 'team-A', status: 'published' },
      { id: 'private-B', team_id: 'team-B', status: 'published' },
    ] });
    expect((await fetchCompetition(client)).announcements.map(a => a.id)).toEqual(['public']);
    expect(calls.find(c => c.table === 'announcements')?.operations).toContainEqual({ method: 'is', args: ['team_id', null] });
  });
  it('reads beyond the server cap on all seven tables with stable ID ordering and exact counts', async () => {
    const rows = Array.from({ length: 1836 }, (_, index) => ({ id: `row-${String(index).padStart(4, '0')}`, name: 'Same name', status: 'published', starts_at: null, published_at: null, team_id: null }));
    const { client, calls } = mockClient(Object.fromEntries(['teams', 'divisions', 'events', 'venues', 'matches', 'rankings', 'announcements'].map(table => [table, rows])), { serverLimit: 100 });
    const result = await fetchCompetition(client);
    for (const records of Object.values(result)) { expect(records).toHaveLength(1836); expect(records.at(-1)?.id).toBe('row-1835'); }
    for (const call of calls) {
      expect(call.operations).toContainEqual({ method: 'select', args: ['*', { count: 'exact' }] });
      expect(call.operations).toContainEqual({ method: 'order', args: ['id', {}] });
    }
  });
  it.each(['missing-count', 'early-empty', 'duplicate-id', 'count-change', 'error'])('withholds an incomplete shared snapshot after %s', async failure => {
    const rows = Array.from({ length: 600 }, (_, index) => ({ id: `m-${index}` }));
    const { client } = mockClient({ matches: rows }, { response: (table, from, result) => {
      if (table !== 'matches') return result;
      if (failure === 'missing-count') return { ...result, count: null };
      if (failure === 'error') return { ...result, error: new Error('private detail') };
      if (!from) return result;
      if (failure === 'early-empty') return { ...result, data: [] };
      if (failure === 'count-change') return { ...result, count: 601 };
      return { ...result, data: [rows[0]!] };
    } });
    await expect(fetchCompetition(client)).rejects.toThrow(/try again/i);
  });
});
