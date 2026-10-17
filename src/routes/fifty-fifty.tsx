import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { ExternalLink, FileText, Star } from "lucide-react";
import { AppShell, Section } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import logo from "@/assets/ova-5050.png.asset.json";
import { TICKET_TIERS, LOTTERY_URL, RULES_URL } from "@/lib/lottery";
export const Route=createFileRoute('/fifty-fifty')({head:()=>({meta:[{title:'50/50 Lottery — OVA Companion'},{name:'description',content:'Official OVA 50/50 ticket options and rules.'},{property:'og:title',content:'OVA 50/50 Lottery'},{property:'og:description',content:'Support Ontario volleyball through the official OVA draw.'},{property:'og:type',content:'website'},{name:'twitter:card',content:'summary'}]}),component:Lottery});
const STYLE: Record<number,{label?:string;cls:string}>={400:{label:'Best value',cls:''},150:{label:'Fan favourite',cls:'green'}};
function Lottery(){
 const tiers=[...TICKET_TIERS].sort((a,b)=>b.tickets-a.tickets);
 const [sel,setSel]=useState(400);
 const chosen=tiers.find(t=>t.tickets===sel);
 if(!chosen) return null;
 return <AppShell title="50/50 Lottery">
  <section aria-labelledby="draw" className="lotto-stage px-4 py-10 text-center sm:px-8">
   <div className="relative space-y-3">
    <img src={logo.url} alt="OVA 50/50" width={200} height={70} className="mx-auto h-14 w-44 object-contain"/>
    <h2 id="draw" className="text-lg font-semibold uppercase tracking-[0.3em]">Last Fall Classic winner took home</h2>
    <p className="jackpot font-display text-7xl font-semibold leading-none sm:text-9xl">$14,835</p>
    <p className="text-sm font-semibold">18+ · Must be in Ontario to purchase</p>
   </div>
   <div className="relative mt-10">
    <p id="pick" className="mb-4 text-lg font-semibold">Pick your tickets</p>
    <ul aria-labelledby="pick" className="mx-auto grid max-w-4xl grid-cols-5 gap-2 pb-4 pt-4 sm:gap-4">
     {tiers.map(t=>{const s=STYLE[t.tickets]??{cls:'silver'};return <li key={t.tickets}>
      <Button type="button" variant="ghost" aria-pressed={sel===t.tickets} onClick={()=>setSel(t.tickets)} aria-label={`${t.tickets} tickets for $${t.price} CAD${s.label?`, ${s.label}`:''}`} className="ticket-btn block h-auto w-full whitespace-normal rounded-lg p-0 hover:bg-transparent hover:text-inherit">
       <div className={`golden-ticket ${s.cls} flex h-52 w-full flex-col items-center justify-between rounded-md px-1 py-4 sm:h-60 sm:px-3`}>
        <span className="min-h-8 text-center text-[0.6rem] leading-tight sm:text-[0.7rem] font-semibold uppercase">{s.label??'OVA 50/50'}</span>
        <div className="flex w-full flex-col items-center border-y-2 border-dashed border-current/40 py-3">
         <span className="flex gap-0.5" aria-hidden>{[0,1,2].map(i=><Star key={i} className="size-3 fill-current"/>)}</span>
         <span className="font-display text-3xl font-semibold leading-none sm:text-5xl">{t.tickets}</span>
         <span className="text-[0.6rem] font-semibold uppercase sm:text-xs sm:tracking-[0.3em]">Tickets</span>
        </div>
        <span className="font-display text-2xl font-semibold sm:text-3xl">${t.price}</span>
       </div>
      </Button></li>;})}
    </ul>
    <p role="status" className="mb-4 font-semibold">Selected: {chosen.tickets} tickets · ${chosen.price} CAD</p>
    <Button asChild size="lg" className="min-h-14 bg-gold px-10 text-xl font-semibold uppercase text-gold-foreground hover:brightness-110">
     <a href={LOTTERY_URL} target="_blank" rel="noopener noreferrer">Buy now<ExternalLink aria-hidden/></a>
    </Button>
    <p className="mt-3 text-sm">Opens the official OVA 50/50 site; choose the same bundle there to complete checkout.</p>
   </div>
  </section>
  <Section title="Additional information"><ul className="list-disc space-y-2 pl-6"><li>You must be 18 or older and physically in Ontario when purchasing.</li><li>Licence RAF1499817 · Verify current draw details on the official site.</li><li>Responsible gambling: <a href="https://www.connexontario.ca" target="_blank" rel="noopener noreferrer" className="font-semibold text-primary underline">ConnexOntario</a> · <a href="tel:18665312600" className="underline">1-866-531-2600</a></li></ul><Button asChild variant="outline"><a href={RULES_URL} target="_blank" rel="noopener noreferrer"><FileText aria-hidden/>Electronic 50/50 Rules of Play</a></Button></Section>
 </AppShell>;
}
