import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { AppShell } from "@/components/AppShell";
import { WatchCatalog } from '@/components/WatchCatalog';
import { WatchStreams } from '@/components/WatchStreams';
import catalog from '@/lib/watch-catalog.json';
import { streamsQuery } from '@/lib/watch.functions';

export const Route = createFileRoute("/explore")({
  head: () => ({
    meta: [
      { title: "Explore — OVA Companion" },
      { name: "description", content: "Search OVA TV volleyball videos and browse CBC Sports upcoming matches and latest recordings." },
      { property: "og:title", content: "Explore — OVA Companion" },
      { property: "og:description", content: "OVA TV videos, keyword search and CBC Sports volleyball streams." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  loader: ({ context }) => context.queryClient.ensureQueryData(streamsQuery),
  component: Explore,
});

function Explore() {
  const { data } = useSuspenseQuery(streamsQuery);
  return (
    <AppShell title="Explore" sourceLabel="Official viewing sources">
      <div className="min-w-0 space-y-8">
        <WatchCatalog videos={catalog.videos} checkedAt={catalog.checkedAt} />
        <WatchStreams {...data} />
      </div>
    </AppShell>
  );
}
