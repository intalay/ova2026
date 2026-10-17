import { Link } from '@tanstack/react-router';
import { useRef, useState } from 'react';
import { ArrowUpRight, Pin, Megaphone, ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { CompetitionData } from '@/lib/queries';

export function AnnouncementCarousel({ items }: { items: CompetitionData['announcements'] }) {
 const track = useRef<HTMLDivElement>(null);
 const [active,setActive] = useState(0);
 const go = (index: number) => { const el=track.current; if(!el)return; el.scrollTo({left:index*el.clientWidth,behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'}); };
 return <div className="min-w-0" role="region" aria-label="Team announcements" aria-roledescription="carousel">
  <div ref={track} onScroll={e=>setActive(Math.round(e.currentTarget.scrollLeft/e.currentTarget.clientWidth))} className="flex snap-x snap-mandatory overflow-x-auto overscroll-x-contain [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
   {items.map((a,i)=><div key={a.id} className="w-full shrink-0 snap-start" role="group" aria-label={`${i+1} of ${items.length}`}><Link to="/announcements" tabIndex={i===active?0:-1} className="flex min-h-36 items-start gap-4 rounded-lg border bg-card p-5"><span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-secondary"><Megaphone aria-hidden className="size-5 text-primary"/></span><div className="min-w-0 flex-1">{a.pinned_at&&<span className="mb-1 inline-flex items-center gap-1 text-xs font-bold text-primary"><Pin aria-hidden className="size-3"/>Pinned</span>}<p className="text-lg font-bold">{a.title}</p><p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{a.body}</p></div><ArrowUpRight aria-hidden className="shrink-0"/></Link></div>)}
  </div>
  {items.length>1&&<div className="mt-2 flex items-center justify-center gap-2"><Button variant="ghost" size="icon" aria-label="Previous announcement" disabled={active===0} onClick={()=>go(active-1)}><ChevronLeft aria-hidden/></Button>{items.map((a,i)=><Button key={a.id} variant="ghost" size="icon" aria-label={`Show announcement ${i+1}`} aria-pressed={active===i} onClick={()=>go(i)}><span className={`size-2 rounded-full ${i===active?'bg-primary':'bg-muted-foreground'}`}/></Button>)}<Button variant="ghost" size="icon" aria-label="Next announcement" disabled={active===items.length-1} onClick={()=>go(active+1)}><ChevronRight aria-hidden/></Button></div>}
 </div>;
}