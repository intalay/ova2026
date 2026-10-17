import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { ArrowUpRight, ShoppingBag } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { PRODUCTS } from "@/lib/catalog";

const CATEGORIES = ['Game Day', 'Coaching & Development', 'Support OVA'] as const;
const HORIZONTAL_IMAGES = ['6v6-volleyball-scoresheets', '4v4-scoresheets-book-of-30', 'officials-sanction-card-set'];

export const Route = createFileRoute('/shop')({
  head: () => ({
    meta: [
      { title: 'Shop & Support — OVA Companion' },
      { name: 'description', content: 'Official OVA match-day supplies, coaching resources and OVA Cares donations.' },
      { property: 'og:title', content: 'Shop & Support OVA' },
      { property: 'og:description', content: 'Browse official volleyball equipment and development resources.' },
      { property: 'og:type', content: 'website' },
      { name: 'twitter:card', content: 'summary' },
    ],
  }),
  component: Shop,
});

function ProductCard({ p }: { p: (typeof PRODUCTS)[number] }) {
  return (
    <Link to="/shop/$id" params={{ id: p.id }} className="shop-product group flex min-w-0 flex-col overflow-hidden rounded-lg border bg-card">
      <div className={`shop-image${HORIZONTAL_IMAGES.includes(p.id) ? ' shop-image--horizontal' : ''}`}>
        {p.image ? <img src={p.image} alt={p.title} loading="lazy" width={400} height={400} /> : <ShoppingBag aria-hidden className="size-12 text-muted-foreground" />}
        {!p.available && <span className="shop-unavailable">unavailable</span>}
      </div>
      <div className="flex flex-1 flex-col gap-3 border-t p-3 sm:p-4">
        <h2 className="min-h-12 break-words font-sans text-base font-semibold leading-snug">{p.title}</h2>
        <p className="mt-auto flex items-center justify-between gap-1 text-sm font-semibold sm:text-base">
          <span className="whitespace-nowrap">${p.price} CAD</span>
          <ArrowUpRight aria-hidden className="size-5 shrink-0 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5 motion-reduce:transform-none" />
        </p>
      </div>
    </Link>
  );
}

function Shop() {
  const [category, setCategory] = useState<'all' | (typeof CATEGORIES)[number]>('Game Day');
  return (
    <AppShell title="Shop & Support">
      <div className="border-b pb-5">
        <p className="text-lg text-muted-foreground">For the game. For the team. For Ontario volleyball.</p>
      </div>
      <div role="group" aria-label="Product category" className="flex flex-wrap gap-2">
        <Button variant={category === 'all' ? 'default' : 'outline'} aria-pressed={category === 'all'} onClick={() => setCategory('all')}>Show all</Button>
        {CATEGORIES.map(c => (
          <Button key={c} variant={c === category ? 'default' : 'outline'} aria-pressed={c === category} onClick={() => setCategory(c)}>{c}</Button>
        ))}
      </div>
      {category === 'all' ? (
        CATEGORIES.map(c => (
          <section key={c} aria-label={c} className="flex flex-col gap-3">
            <h2 className="module-heading">{c}</h2>
            <div className="shop-grid">{PRODUCTS.filter(p => p.category === c).map(p => <ProductCard key={p.id} p={p} />)}</div>
          </section>
        ))
      ) : (
        <div className="shop-grid">{PRODUCTS.filter(p => p.category === category).map(p => <ProductCard key={p.id} p={p} />)}</div>
      )}
      <p className="text-sm text-muted-foreground">Official store catalog checked October 17, 2026. Final price, stock, tax and delivery are confirmed by the OVA store.</p>
    </AppShell>
  );
}
