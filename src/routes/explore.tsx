import { createFileRoute } from "@tanstack/react-router";
import { ExternalLink, Radio, PlayCircle, Youtube } from "lucide-react";
import { AppShell, Section } from "@/components/AppShell";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/explore")({
  head: () => ({
    meta: [
      { title: "Explore — OVA Companion" },
      { name: "description", content: "The official OVA YouTube channel with recorded-video and live-stream viewing shortcuts." },
      { property: "og:title", content: "Explore — OVA Companion" },
      { property: "og:description", content: "Explore OVA on YouTube, recorded volleyball videos and live-stream shortcuts." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Explore,
});

const VIDEO = [
  { name: "Recorded videos", note: "OVA YouTube uploads", url: "https://www.youtube.com/@OntarioVolleyballAssociation/videos", icon: PlayCircle },
  { name: "Live streams", note: "OVA YouTube streams", url: "https://www.youtube.com/@OntarioVolleyballAssociation/streams", icon: Radio },
];

function Explore() {
  return (
    <AppShell title="Explore">
      <Section title="YouTube channel">
        <div className="flex flex-wrap items-center justify-between gap-5 border-b pb-6">
          <div className="flex items-center gap-4"><Youtube aria-hidden className="size-12 shrink-0 text-primary" /><div><h2 className="text-2xl font-bold">Ontario Volleyball Association</h2><p className="mt-1 text-base text-muted-foreground">Official OVA YouTube channel</p></div></div>
          <Button asChild variant="outline"><a href="https://www.youtube.com/@OntarioVolleyballAssociation" target="_blank" rel="noopener noreferrer">Visit channel<ExternalLink aria-label="Opens in a new tab" /></a></Button>
        </div>
        <p className="text-sm font-bold text-muted-foreground">Demo viewing links · Live status unverified</p>
        <div className="grid gap-4 sm:grid-cols-2">
        {VIDEO.map((v) => (
          <Button asChild key={v.url} variant="outline" className="h-auto min-h-32 justify-between gap-3 whitespace-normal bg-card p-5 text-left">
          <a href={v.url} target="_blank" rel="noopener noreferrer">
            <span><span className="flex items-center gap-2 text-xl font-bold"><v.icon aria-hidden className="size-6 shrink-0 text-primary" />{v.name}</span><span className="mt-2 block text-base font-normal text-muted-foreground">{v.note}</span></span>
            <ExternalLink aria-label="Opens in a new tab" />
          </a>
          </Button>
        ))}
        </div>
      </Section>
    </AppShell>
  );
}
