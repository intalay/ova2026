import { describe, expect, it } from 'vitest';
import { videoPage, streamPreviews, type WatchVideo, type StreamEvent } from '../lib/watch';

const videos: WatchVideo[] = Array.from({length: 15}, (_,i) => ({id: String(i), title: `OVA ${i % 2 ? 'Beach' : 'Indoor'} Match ${i}`, url: '', thumbnail: ''}));
describe('OVA TV catalogue', () => {
  it('shows six videos per page', () => {
    expect(videoPage(videos, '', 1).videos.map(v => v.id)).toEqual(['0','1','2','3','4','5']);
    expect(videoPage(videos, '', 2).videos.map(v => v.id)).toEqual(['6','7','8','9','10','11']);
    expect(videoPage(videos, '', 3).totalPages).toBe(3);
  });
  it('searches uploaded video titles across the catalogue', () => {
    const result = videoPage(videos, 'beach match', 1);
    expect(result.total).toBe(7);
    expect(result.videos.map(v => v.id)).toEqual(['1','3','5','7','9','11']);
  });
  it('clamps direct page jumps and handles no matches', () => {
    expect(videoPage(videos, '', 999).page).toBe(3);
    expect(videoPage(videos, '', -1).page).toBe(1);
    expect(videoPage(videos, 'nonexistent', 2).videos).toEqual([]);
  });
});
it('shows the next three and the latest three streams without fabricating missing events', () => {
  const events: StreamEvent[] = Array.from({length: 10}, (_,i) => ({id:String(i), title:String(i), url:'', thumbnail:null, memberOnly:true, startsAt:`2026-10-${String(i+10).padStart(2,'0')}T12:00:00Z`}));
  const result = streamPreviews(events, Date.parse('2026-10-15T18:00:00Z'));
  expect(result.upcoming.map(e => e.id)).toEqual(['6','7','8']);
  expect(result.latest.map(e => e.id)).toEqual(['5','4','3']);
  expect(streamPreviews([], Date.now())).toEqual({ upcoming: [], latest: [] });
});