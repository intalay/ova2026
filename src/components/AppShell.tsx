import { Link } from "@tanstack/react-router";
import { Home, CalendarDays, Trophy, Compass, UserRound, ShoppingBag, ArrowUpRight } from "lucide-react";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import logo from "@/assets/ova-logo.png.asset.json";
import canuck from "@/assets/sponsor-canuckstuff.png";
import ontario from "@/assets/sponsor-ontario.png";
import toronto from "@/assets/sponsor-toronto.png";
import mikasa from "@/assets/sponsor-mikasa.png";
const SPONSORS = [{ name: "Canuckstuff", src: canuck }, { name: "Government of Ontario", src: ontario }, { name: "City of Toronto", src: toronto }, { name: "Mikasa Canada", src: mikasa }];
const NAV = [
 { to: "/schedule", label: "Matches", icon: CalendarDays },
 { to: "/results", label: "Results", icon: Trophy },
 { to: "/", label: "Homepage", icon: Home },
 { to: "/explore", label: "Explore", icon: Compass },
 { to: "/shop", label: "Shop", icon: ShoppingBag },
] as const;
export function AppShell({ children, title, action, sourceLabel = 'Synthetic competition data', contentClassName = '' }: { children: ReactNode; title: string; action?: ReactNode; sourceLabel?: string; contentClassName?: string }) {
 return <div className="min-h-dvh pb-28">
  <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-50 focus:bg-accent focus:px-4 focus:py-2">Skip to content</a>
  <header className="border-b bg-card">
   <div className="mx-auto grid max-w-6xl grid-cols-[minmax(0,1fr)_auto] items-center gap-2 px-4 py-4 sm:px-8">
    <Link to="/" aria-label="Ontario Volleyball Association home" className="flex min-w-0 items-center gap-2"><img src={logo.url} alt="" width={60} height={60} className="size-9 shrink-0 object-contain sm:size-12" /><span className="association-wordmark"><span>Ontario</span> Volleyball Association</span></Link>
    <div className="flex shrink-0 items-center gap-2">{action}<Button asChild variant="secondary" size="icon"><Link to="/account" aria-label="Account and role selection" title="Account"><UserRound aria-hidden /></Link></Button></div>
   </div>
  </header>
  <main id="main" className={`mx-auto max-w-6xl space-y-7 px-5 py-6 sm:px-8 sm:py-8 ${contentClassName}`}>
   <div className="flex flex-wrap items-center justify-between gap-2"><h1 className="font-display text-4xl font-bold uppercase sm:text-5xl">{title}</h1><span className="flex items-center gap-2 text-xs font-bold text-muted-foreground"><span className="size-2 rounded-full bg-pending-foreground"/>{sourceLabel}</span></div>
   {children}
   <section aria-labelledby="sponsorship" className="border-t pt-2"><h2 id="sponsorship" className="text-center font-sans text-sm font-normal text-muted-foreground">Partner</h2><ul className="mt-6 flex flex-wrap items-center justify-center gap-x-7 gap-y-3">{SPONSORS.map(s=><li key={s.name}><img src={s.src} alt={s.name} loading="lazy" className="h-5 w-auto max-w-[18vw] object-contain sm:h-8 sm:max-w-none" /></li>)}</ul></section>
  </main>
  <nav aria-label="Main" className="fixed inset-x-0 bottom-0 z-40 border-t bg-card pb-[env(safe-area-inset-bottom)]">
   <ul className="mx-auto grid max-w-3xl grid-cols-5">{NAV.map(({to,label,icon:Icon})=><li key={to}><Link to={to} activeOptions={{ exact: to === "/" }} className={`flex min-h-20 flex-col items-center justify-center gap-1 text-xs font-bold text-muted-foreground data-[status=active]:text-primary ${to === "/" ? "" : "data-[status=active]:bg-secondary"}`}><span className={to === "/" ? "-mt-5 flex size-14 items-center justify-center rounded-full border-4 border-card bg-primary text-primary-foreground" : "flex size-8 items-center justify-center"}><Icon aria-hidden className="size-6"/></span><span>{label}</span></Link></li>)}</ul>
  </nav>
 </div>;
}
export function Section({ title, children, id, link }: { title: string; children: ReactNode; id?: string; link?: ReactNode }) {
 const hid=id??title.toLowerCase().replace(/\W+/g,"-");
 return <section aria-labelledby={hid} className="min-w-0 space-y-3"><div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3"><h2 id={hid} className="module-heading min-w-0">{title}</h2>{link}</div>{children}</section>;
}
export function Card({ children, className="" }: { children: ReactNode; className?: string }) { return <div className={`rounded-lg border bg-card p-5 text-card-foreground ${className}`}>{children}</div>; }
export function Tbd({ children }: { children: ReactNode }) {return <span className="rounded bg-pending px-1.5 py-0.5 font-bold text-pending-foreground">{children}</span>;}
export function MoreLink({to,children}: {to:"/schedule"|"/results"|"/announcements"|"/shop"|"/fifty-fifty";children:ReactNode}) {return <Link to={to} className="inline-flex min-h-11 items-center gap-1 text-sm font-bold text-primary">{children}<ArrowUpRight aria-hidden className="size-4"/></Link>;}
export const btn={primary:"inline-flex min-h-12 items-center justify-center gap-2 rounded-md bg-primary px-5 text-base font-bold text-primary-foreground hover:brightness-95 disabled:opacity-60",secondary:"inline-flex min-h-12 items-center justify-center gap-2 rounded-md border border-input bg-card px-5 text-base font-bold text-primary hover:bg-secondary disabled:opacity-60",input:"min-h-12 w-full rounded-md border border-input bg-card px-3 text-base placeholder:text-muted-foreground"};
