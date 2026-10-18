import { describe, expect, it } from 'vitest';
import { cumulativeWinTrend, filterResultsRange, latestCompletedEvent, resultSetStats } from '@/lib/results';
import type { Match } from '@/lib/queries';
// Sanitized score pairs verified against AES 6v6 Girls Division 1, Hurricanes Category 3 Blue.
export const aesHistory = [[19,0,2],[19,2,0],[19,2,0],[20,2,1],[20,0,2],[20,0,2],[21,2,0],[21,1,2],[21,2,0]].map(([day,a,b], index): Match => ({id:`aes-${index}`,event_id:'aes',division_id:'6v6-girls-1',team_a_id:'hurricanes',team_b_id:`opponent-${index}`,source_date:`2026-04-${day}`,starts_at:null,venue_id:null,court:null,status:'final',score_a:a!,score_b:b!,sets:null,data_mode:'real'}));
describe('range cumulative match and set metrics', () => {
  it('groups complete source dates without claiming intraday order', () => {
    expect(cumulativeWinTrend(aesHistory, 'hurricanes').map(p => [p.wins,p.wins+p.losses,p.dailyWins,p.dailyLosses])).toEqual([[2,3,2,1],[3,6,1,2],[5,9,2,1]]);
    expect(cumulativeWinTrend([...aesHistory].reverse(), 'hurricanes')).toEqual(cumulativeWinTrend(aesHistory, 'hurricanes'));
    expect(cumulativeWinTrend(aesHistory, 'hurricanes', 'set').map(p => [p.wins,p.wins+p.losses])).toEqual([[4,6],[6,13],[11,20]]);
    expect(resultSetStats(aesHistory, 'hurricanes')).toMatchObject({ wins: 11, losses: 9, played: 20, winRate: 55 });
  });
  it('filters event and inclusive dates BEFORE accumulating, so April20–21 starts with 1/3', () => {
    const range = { period: 'history' as const, eventId: 'aes', dateFrom: '2026-04-20', dateTo: '2026-04-21' };
    const rows = filterResultsRange([...aesHistory,{...aesHistory[0]!,id:'other-event',event_id:'timu'}], range);
    expect(rows).toHaveLength(6);
    expect(cumulativeWinTrend(rows,'hurricanes').map(p=>[p.wins,p.wins+p.losses])).toEqual([[1,3],[3,6]]);
    expect(cumulativeWinTrend(rows,'hurricanes','set').map(p=>[p.wins,p.wins+p.losses])).toEqual([[2,7],[7,14]]);
  });
  it('does not add zero days, unknown dates, unfinished or missing scores to the trend', () => {
    const rows = [aesHistory[0]!, {...aesHistory[1]!, source_date:null}, {...aesHistory[2]!,status:'scheduled'}, {...aesHistory[3]!,score_a:null}];
    expect(cumulativeWinTrend(rows, 'hurricanes')).toHaveLength(1);
    expect(resultSetStats([{...aesHistory[0]!,score_a:null}, {...aesHistory[0]!,score_a:-1}, {...aesHistory[0]!,score_a:1.2}], 'hurricanes').played).toBe(0);
  });
  it('defaults only to a completed event from the selected team history', () => {
    expect(latestCompletedEvent([...aesHistory,{...aesHistory[0]!,event_id:'future',source_date:'2026-10-18'}], [{id:'aes',end_date:'2026-04-21'},{id:'future',end_date:'2026-10-20'}], '2026-10-18')).toBe('aes');
    expect(latestCompletedEvent([],[])).toBe('');
  });
});
