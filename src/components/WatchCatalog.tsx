import { useState } from 'react';
import { ArrowUpRight, ChevronLeft, ChevronRight, Play, Search, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { OVA_CHANNEL_URL, videoPage, type WatchVideo } from '@/lib/watch';

export function WatchCatalog({ videos, checkedAt }: { videos: WatchVideo[]; checkedAt: string }) {
  const [keyword, setKeyword] = useState('');
  const [requestedPage, setPage] = useState(1);
  const [jump, setJump] = useState('');
  const result = videoPage(videos, keyword, requestedPage);
  return <section aria-labelledby="ova-tv" className="space-y-5">
    <div className="flex flex-wrap items-end justify-between gap-3"><div><p className="mb-1 text-xs font-semibold uppercase text-primary">Ontario volleyball · YouTube</p><h3 id="ova-tv" className="text-4xl font-semibold">OVA TV</h3></div><Button variant="outline" asChild><a href={OVA_CHANNEL_URL} target="_blank" rel="noopener noreferrer">YouTube channel<ArrowUpRight aria-hidden className="size-4" /></a></Button></div>
    <div className="flex flex-wrap items-center justify-between gap-3 border-y py-4">
      <div className="relative w-full sm:max-w-md"><Search aria-hidden className="absolute left-3 top-1/2 size-5 -translate-y-1/2 text-muted-foreground" /><input aria-label="Search OVA TV videos" type="search" value={keyword} onChange={e => {setKeyword(e.target.value); setPage(1);}} placeholder="Search OVA TV" className="min-h-12 w-full rounded-md border border-input bg-card pl-10 pr-12 text-base" />{keyword && <Button variant="ghost" size="icon" aria-label="Clear video search" className="absolute right-1 top-1/2 -translate-y-1/2" onClick={() => {setKeyword(''); setPage(1);}}><X aria-hidden className="size-4" /></Button>}</div>
      <p aria-live="polite" className="text-sm text-muted-foreground">{result.total} videos{keyword ? ' found' : ''}</p>
    </div>
    {result.videos.length ? <div className="grid grid-cols-2 gap-3 sm:gap-5 lg:grid-cols-3">{result.videos.map(video => <a key={video.id} href={video.url} target="_blank" rel="noopener noreferrer" className="watch-video group flex flex-col overflow-hidden rounded-lg border bg-card text-card-foreground">
      <div className="relative aspect-video overflow-hidden bg-muted">{video.tile === undefined ? <img src={video.thumbnail} alt="" loading="lazy" className="h-full w-full object-cover" /> : <svg aria-hidden viewBox="0 0 320 180" className="h-full w-full"><image href={video.thumbnail} width={1920} height={1800} x={-(video.tile % 6) * 320} y={-Math.floor(video.tile / 6) * 180} /></svg>}<span className="absolute bottom-3 right-3 flex size-10 items-center justify-center rounded-full bg-primary text-primary-foreground"><Play aria-hidden className="size-5 fill-current" /></span></div>
      <div className="flex flex-1 flex-col gap-2 p-4"><h4 className="font-sans text-xs font-semibold leading-snug sm:text-sm">{video.title}</h4><p className="mt-auto flex items-center justify-between gap-2 text-xs text-muted-foreground"><span>{video.publishedLabel || 'OVA TV'}</span><ArrowUpRight aria-label="Opens YouTube in a new tab" className="size-4 shrink-0" /></p></div>
    </a>)}</div> : <p className="py-10 text-center text-muted-foreground">No videos found.</p>}
    <div className="flex flex-nowrap items-center justify-between gap-2 border-t pt-3 text-xs">
      <div className="flex items-center gap-1.5"><Button variant="outline" size="icon" aria-label="Previous video page" className="size-8" disabled={result.page === 1} onClick={() => setPage(result.page - 1)}><ChevronLeft aria-hidden className="size-4" /></Button><p aria-live="polite" className="whitespace-nowrap text-xs">Page <strong>{result.page}</strong> of <strong>{result.totalPages}</strong></p><Button variant="outline" size="icon" aria-label="Next video page" className="size-8" disabled={result.page === result.totalPages} onClick={() => setPage(result.page + 1)}><ChevronRight aria-hidden className="size-4" /></Button></div>
      <form onSubmit={e => {e.preventDefault(); if(jump.trim()) setPage(Number(jump)); setJump('');}} className="flex items-center gap-1.5"><label htmlFor="video-page" className="whitespace-nowrap text-xs">Go to page</label><input id="video-page" type="number" min={1} max={result.totalPages} value={jump} onChange={e => setJump(e.target.value)} className="h-8 w-12 rounded-md border border-input bg-card px-1.5 text-xs" /><Button variant="secondary" type="submit" size="icon" aria-label="Go to video page" className="size-8"><ArrowUpRight aria-hidden className="size-3.5" /></Button></form>
    </div>
    <p className="text-xs text-muted-foreground">YouTube catalogue checked {checkedAt}.</p>
  </section>;
}