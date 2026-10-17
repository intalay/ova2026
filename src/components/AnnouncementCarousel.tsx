import { Link } from '@tanstack/react-router';
import { useRef, useState } from 'react';
import { ArrowUpRight, Pin, Megaphone } from 'lucide-react';
import type { CompetitionData } from '@/lib/queries';

export function AnnouncementCarousel({ items }: { items: CompetitionData['announcements'] }) {
 const track = useRef<HTMLDivElement>(null);
 const [active,setActive] = useState(0);
 const [dragging,setDragging] = useState(false);
 const drag = useRef<{x:number;left:number;moved:boolean}|null>(null);
 const suppressClick = useRef(false);
 const go = (index: number) => { const el=track.current; if(!el)return; el.scrollTo({left:index*el.clientWidth,behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'}); };
 return <div className="announcement-carousel relative min-w-0" role="region" aria-label="Team announcements" aria-roledescription="carousel">
  <div ref={track} tabIndex={0} onKeyDown={e=>{if(e.key==='ArrowRight'||e.key==='ArrowLeft'){e.preventDefault();go(Math.max(0,Math.min(items.length-1,active+(e.key==='ArrowRight'?1:-1))));}}}
   onDragStart={e=>e.preventDefault()}
   onPointerDown={e=>{suppressClick.current=false;if(e.pointerType!=='mouse'||e.button!==0)return;drag.current={x:e.clientX,left:e.currentTarget.scrollLeft,moved:false};}}
   onPointerMove={e=>{const d=drag.current;if(!d)return;const delta=e.clientX-d.x;if(Math.abs(delta)>6){d.moved=true;suppressClick.current=true;setDragging(true);e.currentTarget.setPointerCapture(e.pointerId);e.currentTarget.scrollLeft=d.left-delta;}}}
   onPointerUp={e=>{const d=drag.current;if(!d)return;drag.current=null;setDragging(false);if(d.moved){const delta=e.clientX-d.x;const start=Math.round(d.left/e.currentTarget.clientWidth);const index=Math.max(0,Math.min(items.length-1,start+(Math.abs(delta)>40?(delta<0?1:-1):0)));requestAnimationFrame(()=>go(index));}}}
   onPointerCancel={()=>{drag.current=null;setDragging(false);}}
   onClickCapture={e=>{if(suppressClick.current){e.preventDefault();e.stopPropagation();suppressClick.current=false;}}}
   onScroll={e=>setActive(Math.round(e.currentTarget.scrollLeft/e.currentTarget.clientWidth))} className={`flex select-none overflow-x-auto overscroll-x-contain [scrollbar-width:none] [&::-webkit-scrollbar]:hidden ${dragging?'cursor-grabbing snap-none':'cursor-grab snap-x snap-mandatory'}`}>
   {items.map((a,i)=><div key={a.id} className="w-full shrink-0 snap-start" role="group" aria-label={`${i+1} of ${items.length}`}><Link to="/announcements" draggable={false} tabIndex={i===active?0:-1} className="flex min-h-36 cursor-inherit items-start gap-4 rounded-lg border bg-card p-5 pb-10"><span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-secondary"><Megaphone aria-hidden className="size-5 text-primary"/></span><div className="min-w-0 flex-1">{a.pinned_at&&<span className="mb-1 inline-flex items-center gap-1 text-xs font-semibold text-primary"><Pin aria-hidden className="size-3"/>Pinned</span>}<p className="text-lg font-semibold">{a.title}</p><p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{a.body}</p></div><ArrowUpRight aria-hidden className="shrink-0"/></Link></div>)}
  </div>
  {items.length>1&&<div aria-hidden className="pointer-events-none absolute inset-x-0 bottom-3 flex justify-center gap-2">{items.map((a,i)=><span key={a.id} className={`size-2 rounded-full ${i===active?'bg-primary':'bg-muted-foreground'}`}/>)}</div>}
 </div>;
}