import { useEffect, useState, type ReactNode } from 'react';
import useEmblaCarousel from 'embla-carousel-react';
import { Button } from '@/components/ui/button';
import { ANNOUNCEMENT_LIFETIME_MS, announcementVisible, orderAnnouncements, type AnnouncementState } from '@/lib/announcements';

export function useAnnouncementTime(items: AnnouncementState[]) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const current = Date.now();
    setNow(current);
    const next = Math.min(...items.filter(a => !a.pinned && a.published_at).map(a => Date.parse(a.published_at ?? '') + ANNOUNCEMENT_LIFETIME_MS).filter(t => t > current));
    if (!Number.isFinite(next)) return;
    const timer = setTimeout(() => setNow(Date.now()), Math.min(next-current+10, 2147483647));
    return () => clearTimeout(timer);
  }, [items, now]);
  return now;
}

export function AnnouncementStack<T extends AnnouncementState>({ items, render, manager = false }: { items: T[]; render: (item:T) => ReactNode; manager?: boolean }) {
  const now = useAnnouncementTime(items);
  const visible = orderAnnouncements(items.filter(a => announcementVisible(a, now, manager)));
  const pinned = visible.filter(a => a.pinned);
  const regular = visible.filter(a => !a.pinned);
  const [ref, api] = useEmblaCarousel({align:'start', watchDrag:true});
  const [selected, setSelected] = useState(0);
  useEffect(() => {
    if (!api) return;
    const update = () => setSelected(api.selectedScrollSnap());
    api.on('select',update); api.on('reInit',update); update();
    return () => { api.off('select',update); api.off('reInit',update); };
  }, [api]);
  const pinIds = pinned.map(a => a.id).join(',');
  useEffect(() => { api?.scrollTo(0,true); }, [api,pinIds]);
  if (!visible.length) return <p className="border-y py-5 text-muted-foreground">There is no current announcement.</p>;
  return <div className="min-w-0 space-y-4">
    {pinned.length > 0 && <div role="region" aria-label="Pinned announcements" aria-roledescription="carousel">
      <div className="overflow-hidden" ref={ref}><div className="flex items-start">{pinned.map((a,i)=><div key={a.id} className="min-w-0 flex-[0_0_100%] px-1" role="group" aria-roledescription="slide" aria-label={`${i+1} of ${pinned.length}`} inert={i!==selected}>{render(a)}</div>)}</div></div>
      <div className="mt-2 flex justify-center" aria-label="Choose pinned announcement">{pinned.map((a,i)=><Button key={a.id} variant="ghost" size="icon" aria-label={`Show pinned announcement ${i+1}`} aria-pressed={selected===i} onClick={()=>api?.scrollTo(i)}><span className={`size-2 rounded-full ${selected===i?'bg-primary':'bg-muted-foreground/40'}`}/></Button>)}</div>
    </div>}
    {regular.map(a=><div key={a.id}>{render(a)}</div>)}
  </div>;
}