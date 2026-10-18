import { createFileRoute, notFound } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { Car, Navigation, ExternalLink, MapPin } from "lucide-react";
import { useState } from "react";
import { AppShell, Section, Card, Tbd } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { venueQuery } from "@/lib/queries";
import { venueMedia } from "@/lib/venue-media";

export const Route = createFileRoute("/venue/$id")({
  loader: async ({ context, params }) => {
    const d = await context.queryClient.ensureQueryData(venueQuery(params.id));
    if (!d.venue) throw notFound();
    return { name: d.venue.name };
  },
  head: ({ loaderData }) => ({
    meta: [
      { title: `${loaderData?.name ?? "Venue"} — OVA Companion` },
      { name: "description", content: `Directions and confirmed parking information for ${loaderData?.name ?? "this venue"}.` },
      { property: "og:title", content: `${loaderData?.name ?? "Venue"} — OVA Companion` },
      { property: "og:description", content: "Venue map, directions and parking." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      ...(loaderData?.name && venueMedia(loaderData.name)?.url.startsWith('https://') ? [
        { property: "og:image", content: venueMedia(loaderData.name)?.url },
        { name: "twitter:image", content: venueMedia(loaderData.name)?.url },
      ] : []),
    ],
  }),
  component: Venue,
});

function Venue() {
  const { id } = Route.useParams();
  const { data } = useSuspenseQuery(venueQuery(id));
  const [selectedParking, setSelectedParking] = useState<string | null>(null);
  const v = data.venue;
  if (!v) return <AppShell title="Venue"><p>Venue unavailable.</p></AppShell>;
  const hasPoint = v.coordinates_verified && v.latitude != null && v.longitude != null;
  const dest = hasPoint ? `${v.latitude},${v.longitude}` : v.address;
  const bbox = hasPoint && v.longitude !== null && v.latitude !== null ? `${v.longitude - 0.006},${v.latitude - 0.003},${v.longitude + 0.006},${v.latitude + 0.003}` : "";
  const photo = venueMedia(v.name);
  const selected = data.parking.find(p => p.id === selectedParking) ?? data.parking[0];
  return (
    <AppShell title={v.name}>
      <div className="space-y-4">
        {photo ? <div className="aspect-[16/7] overflow-hidden rounded-lg bg-muted"><img src={photo.url} alt={photo.alt} width={1044} height={456} className="size-full object-cover" /></div> : <div className="flex aspect-[16/7] items-center justify-center gap-3 rounded-lg bg-secondary text-secondary-foreground"><MapPin aria-hidden className="size-8" /><span>Venue photo to be determined</span></div>}
        <p className="flex items-start gap-2 text-lg"><MapPin aria-hidden className="mt-1 size-6 shrink-0" />{v.address}</p>
        <div className="flex flex-wrap gap-3">
          <Button asChild><a href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(dest)}`} target="_blank" rel="noopener noreferrer"><Navigation aria-hidden />Get directions</a></Button>
          {(v.source_url || photo) && <Button asChild variant="outline"><a href={v.source_url ?? photo?.source} target="_blank" rel="noopener noreferrer">Official venue information<ExternalLink aria-hidden /></a></Button>}
        </div>
      </div>
      <Section title="Map & Parking">
        {hasPoint ? <div className="space-y-2"><iframe title={`Interactive map around ${v.name}`} className="h-80 w-full rounded-lg border-2 sm:h-96" loading="lazy" src={`https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=mapnik&marker=${v.latitude},${v.longitude}`} /><p className="text-sm text-muted-foreground">Venue marker only · Parking entrances are not confirmed.</p></div> : <p><Tbd>Map location to be confirmed</Tbd></p>}
        {data.parking.length ? <div className="mt-5 space-y-4">
          {data.parking.length > 1 && <div className="flex flex-wrap gap-3" aria-label="Parking locations">{data.parking.map((p) => <Button key={p.id} variant={selected?.id === p.id ? 'default' : 'outline'} aria-pressed={selected?.id === p.id} onClick={() => setSelectedParking(p.id)}><Car aria-hidden />{p.name}</Button>)}</div>}
          {selected && <Card><div aria-live="polite"><h3 className="flex items-center gap-2 text-xl font-semibold"><Car aria-hidden />{selected.name}</h3>{selected.address && <p className="mt-2">{selected.address}</p>}{selected.notes && <p className="mt-2">{selected.notes}</p>}{selected.data_mode === 'synthetic' && <p className="mt-2 text-sm text-muted-foreground">Synthetic parking record</p>}{!selected.coordinates_verified && <p className="mt-2"><Tbd>Parking entrance location to be confirmed</Tbd></p>}</div><div className="mt-4 flex flex-wrap gap-3">{selected.coordinates_verified && selected.address && <Button asChild variant="outline"><a href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(selected.address)}`} target="_blank" rel="noopener noreferrer"><Navigation aria-hidden />Directions to parking</a></Button>}{selected.source_url && <Button asChild variant="outline"><a href={selected.source_url} target="_blank" rel="noopener noreferrer">Official parking information<ExternalLink aria-hidden /></a></Button>}</div></Card>}
        </div> : <div className="mt-5"><Card><Tbd>Parking information to be confirmed</Tbd></Card></div>}
      </Section>
    </AppShell>
  );
}
