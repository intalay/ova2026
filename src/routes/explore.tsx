import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { ExternalLink, MapPin, PlayCircle } from "lucide-react";
import { AppShell, Section, Card } from "@/components/AppShell";
import { competitionQuery } from "@/lib/queries";

export const Route = createFileRoute("/explore")({
  head: () => ({
    meta: [
      { title: "Explore — OVA Companion" },
      { name: "description", content: "Venues, parking guidance and official OVA video channels." },
      { property: "og:title", content: "Explore — OVA Companion" },
      { property: "og:description", content: "Find venues and official volleyball video." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  loader: ({ context }) => context.queryClient.ensureQueryData(competitionQuery),
  component: Explore,
});

const VIDEO = [
  { name: "OVA on YouTube", note: "Official Ontario Volleyball Association channel", url: "https://www.youtube.com/@OntarioVolleyballAssociation" },
  { name: "CBC Sports streams", note: "Official streaming destination (opens Pixellot)", url: "https://cbc.watch.pixellot.tv/category/6453c53e4e6ac24f2eda85c5/sub-category/6496170aa84cf6a8dee1c82c/" },
];

function Explore() {
  const { data } = useSuspenseQuery(competitionQuery);
  return (
    <AppShell title="Explore">
      <Section title="Venues">
        {data.venues.map((v) => (
          <Link key={v.id} to="/venue/$id" params={{ id: v.id }} className="block rounded-xl border-2 bg-card p-4 hover:border-primary">
            <p className="flex items-center gap-2 text-xl font-bold"><MapPin aria-hidden className="text-accent" />{v.name}</p>
            <p className="text-base text-muted-foreground">{v.address}</p>
          </Link>
        ))}
      </Section>
      <Section title="Watch">
        {VIDEO.map((v) => (
          <a key={v.url} href={v.url} target="_blank" rel="noopener noreferrer" className="flex items-center justify-between gap-3 rounded-xl border-2 bg-card p-4 hover:border-primary">
            <span><span className="flex items-center gap-2 text-xl font-bold"><PlayCircle aria-hidden className="text-accent" />{v.name}</span><span className="text-base text-muted-foreground">{v.note}</span></span>
            <ExternalLink aria-label="Opens in a new tab" />
          </a>
        ))}
        <Card><p className="text-base">Latest uploads are not shown: the YouTube connection is not configured. Live status is not tracked.</p></Card>
      </Section>
    </AppShell>
  );
}
