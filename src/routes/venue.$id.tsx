import { createFileRoute, notFound } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { Car, Navigation, ExternalLink } from "lucide-react";
import { AppShell, Section, Card, Tbd, btn } from "@/components/AppShell";
import { venueQuery } from "@/lib/queries";

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
    ],
  }),
  component: Venue,
});

function Venue() {
  const { id } = Route.useParams();
  const { data } = useSuspenseQuery(venueQuery(id));
  const v = data.venue;
  if (!v) return <AppShell title="Venue"><p>Venue unavailable.</p></AppShell>;
  const hasPoint = v.coordinates_verified && v.latitude != null && v.longitude != null;
  const dest = hasPoint ? `${v.latitude},${v.longitude}` : v.address;
  const bbox = hasPoint && v.longitude !== null && v.latitude !== null ? `${v.longitude - 0.006},${v.latitude - 0.003},${v.longitude + 0.006},${v.latitude + 0.003}` : "";
  return (
    <AppShell title={v.name}>
      <p className="text-lg">{v.address}</p>
      <a className={`${btn.primary} w-full`} href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(dest)}`} target="_blank" rel="noopener noreferrer">
        <Navigation aria-hidden />See Route
      </a>
      {hasPoint && (
        <iframe title={`Map of ${v.name}`} className="h-72 w-full rounded-xl border-2" loading="lazy"
          src={`https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=mapnik&marker=${v.latitude},${v.longitude}`} />
      )}
      {v.image_note && <p className="text-base text-muted-foreground">{v.image_note}</p>}
      <Section title="Parking">
        {data.parking.length ? data.parking.map((p) => (
          <Card key={p.id}>
            <p className="flex items-center gap-2 text-xl font-bold"><Car aria-hidden />{p.name}</p>
            {p.notes && <p className="mt-1">{p.notes}</p>}
            {!p.coordinates_verified && <p className="mt-2"><Tbd>Entrance location to be confirmed</Tbd></p>}
            {p.source_url && <a href={p.source_url} target="_blank" rel="noopener noreferrer" className="mt-2 inline-flex items-center gap-1 font-bold text-primary underline">Official source <ExternalLink aria-hidden className="size-4" /></a>}
          </Card>
        )) : <Card><Tbd>Parking information to be confirmed</Tbd></Card>}
      </Section>
    </AppShell>
  );
}
