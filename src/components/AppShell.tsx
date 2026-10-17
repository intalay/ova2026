import { Link } from "@tanstack/react-router";
import { Home, CalendarDays, Trophy, Compass, UserRound } from "lucide-react";
import type { ReactNode } from "react";

const NAV = [
  { to: "/", label: "Home", icon: Home },
  { to: "/schedule", label: "Schedule", icon: CalendarDays },
  { to: "/results", label: "Results", icon: Trophy },
  { to: "/explore", label: "Explore", icon: Compass },
  { to: "/account", label: "Account", icon: UserRound },
] as const;

export function AppShell({ children, title, action }: { children: ReactNode; title: string; action?: ReactNode }) {
  return (
    <div className="min-h-screen pb-28">
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-50 focus:rounded-md focus:bg-accent focus:px-4 focus:py-2 focus:text-accent-foreground">
        Skip to content
      </a>
      <header className="bg-court text-court-foreground">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-3 px-4 py-4">
          <div>
            <p className="text-sm font-bold uppercase tracking-widest opacity-80">OVA Companion</p>
            <h1 className="text-3xl font-bold uppercase">{title}</h1>
          </div>
          {action}
        </div>
        <p className="bg-pending px-4 py-1.5 text-center text-sm font-bold text-pending-foreground" role="note">
          Synthetic demo data · teams and players are fictional
        </p>
      </header>
      <main id="main" className="mx-auto max-w-3xl space-y-6 px-4 py-6">{children}</main>
      <nav aria-label="Main" className="fixed inset-x-0 bottom-0 z-40 border-t-2 bg-card">
        <ul className="mx-auto grid max-w-3xl grid-cols-5">
          {NAV.map(({ to, label, icon: Icon }) => (
            <li key={to}>
              <Link
                to={to}
                activeOptions={{ exact: to === "/" }}
                className="flex min-h-16 flex-col items-center justify-center gap-0.5 text-sm font-bold text-muted-foreground data-[status=active]:text-primary data-[status=active]:[&>span]:underline data-[status=active]:[&>span]:decoration-accent data-[status=active]:[&>span]:decoration-4 data-[status=active]:[&>span]:underline-offset-4"
              >
                <Icon aria-hidden className="size-6" />
                <span>{label}</span>
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  );
}

export function Section({ title, children, id }: { title: string; children: ReactNode; id?: string }) {
  const hid = id ?? title.toLowerCase().replace(/\W+/g, "-");
  return (
    <section aria-labelledby={hid} className="space-y-3">
      <h2 id={hid} className="text-2xl font-bold uppercase">{title}</h2>
      {children}
    </section>
  );
}

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`rounded-xl border-2 bg-card p-4 text-card-foreground ${className}`}>{children}</div>;
}

export function Tbd({ children }: { children: ReactNode }) {
  return <span className="rounded bg-pending px-1.5 py-0.5 font-bold text-pending-foreground">{children}</span>;
}

export const btn = {
  primary: "inline-flex min-h-12 items-center justify-center gap-2 rounded-lg bg-accent px-5 text-lg font-bold text-accent-foreground hover:brightness-95 disabled:opacity-60",
  secondary: "inline-flex min-h-12 items-center justify-center gap-2 rounded-lg border-2 border-primary bg-card px-5 text-lg font-bold text-primary hover:bg-secondary disabled:opacity-60",
  input: "min-h-12 w-full rounded-lg border-2 border-input bg-card px-3 text-lg",
};
