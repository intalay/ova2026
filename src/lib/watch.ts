export const VIDEO_PAGE_SIZE = 6;
export const STREAM_PREVIEW_SIZE = 3;
export const LATEST_STREAM_PREVIEW_SIZE = 4;
export const OVA_CHANNEL_URL = 'https://www.youtube.com/@OntarioVolleyballAssociation';
export const CBC_URL = 'https://cbc.watch.pixellot.tv/category/6453c53e4e6ac24f2eda85c5/sub-category/6496170aa84cf6a8dee1c82c/';

export type WatchVideo = { id: string; title: string; url: string; thumbnail: string; publishedLabel?: string; tile?: number };
export type StreamEvent = { id: string; title: string; url: string; startsAt: string | null; thumbnail: string | null; memberOnly: boolean };

export function videoPage(videos: WatchVideo[], keyword: string, requestedPage: number) {
  const terms = keyword.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
  const matches = videos.filter(video => terms.every(term => video.title.toLocaleLowerCase().includes(term)));
  const totalPages = Math.max(1, Math.ceil(matches.length / VIDEO_PAGE_SIZE));
  const page = Math.max(1, Math.min(totalPages, Number.isFinite(requestedPage) ? Math.trunc(requestedPage) : 1));
  return { videos: matches.slice((page - 1) * VIDEO_PAGE_SIZE, page * VIDEO_PAGE_SIZE), page, totalPages, total: matches.length };
}

export function streamPreviews(events: StreamEvent[], now: number) {
  const dated = events.filter(event => event.startsAt && Number.isFinite(Date.parse(event.startsAt)));
  return {
    upcoming: dated.filter(event => Date.parse(event.startsAt ?? '') > now).sort((a,b) => Date.parse(a.startsAt ?? '') - Date.parse(b.startsAt ?? '')).slice(0, STREAM_PREVIEW_SIZE),
    latest: dated.filter(event => Date.parse(event.startsAt ?? '') <= now).sort((a,b) => Date.parse(b.startsAt ?? '') - Date.parse(a.startsAt ?? '')).slice(0, LATEST_STREAM_PREVIEW_SIZE),
  };
}