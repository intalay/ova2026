import { createServerFn } from '@tanstack/react-start';
import { queryOptions } from '@tanstack/react-query';
import { CBC_URL, LATEST_STREAM_PREVIEW_SIZE, streamPreviews, type StreamEvent } from './watch';
import streamImages from './watch-stream-images.json';

type CBCEntry = { event_id?: string; _id?: string; title?: string; event_date?: number; commerceType?: string; content?: { PosterH?: string }; thumbnail?: string };

async function cbcEntries(status: string): Promise<CBCEntry[]> {
  const entries: CBCEntry[] = [];
  for (let page = 0; page < 30; page++) {
    const response = await fetch('https://cbc.watch.pixellot.tv/api/event/list', {
      method: 'POST', headers: {'Content-Type':'application/json'}, signal: AbortSignal.timeout(12000),
      body: JSON.stringify({page, size:status === 'archived' ? LATEST_STREAM_PREVIEW_SIZE : 100, next:true, count:true, filters: {'identities.id':'6496170aa84cf6a8dee1c82c','identities.type':'6453c53e4e6ac24f2eda85c5',status}}),
    });
    if (!response.ok) throw new Error(`CBC listings unavailable (${response.status})`);
    const result = await response.json() as {error?: boolean; content?: { entries?: CBCEntry[]; nextExists?: boolean }};
    if (result.error || !Array.isArray(result.content?.entries)) throw new Error('CBC listings unavailable');
    entries.push(...result.content.entries);
    if (status === 'archived' || !result.content.nextExists) return entries;
  }
  throw new Error('CBC listings could not be fully checked');
}
function normalize(entry: CBCEntry): StreamEvent | null {
  const id = entry.event_id ?? entry._id;
  if (!id || !entry.title) return null;
  const thumbnail = (streamImages as Record<string,string>)[id];
  return {id, title:entry.title.trim(), url:CBC_URL, startsAt:entry.event_date && Number.isFinite(entry.event_date) ? new Date(entry.event_date).toISOString() : null, thumbnail:thumbnail ?? null, memberOnly:entry.commerceType === 'members'};
}
export const getStreams = createServerFn({method:'GET'}).handler(async () => {
  try {
    const [upcomingRows, latestRows] = await Promise.all([cbcEntries('upcoming'), cbcEntries('archived')]);
    const now = Date.now();
    const upcoming = streamPreviews(upcomingRows.map(normalize).filter((event): event is StreamEvent => event !== null), now).upcoming;
    const latest = streamPreviews(latestRows.map(normalize).filter((event): event is StreamEvent => event !== null), now).latest;
    return {upcoming,latest,checkedAt:new Date().toISOString().slice(0,10),error:undefined};
  } catch {
    return {upcoming:[] as StreamEvent[],latest:[] as StreamEvent[],error:'CBC listings cannot be reached right now. You can still open CBC Watch.'};
  }
});
export const streamsQuery = queryOptions({queryKey:['cbc-watch-streams'],queryFn:() => getStreams(),staleTime:300000});