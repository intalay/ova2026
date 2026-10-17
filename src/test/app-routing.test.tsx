import { QueryClient } from "@tanstack/react-query";
import { createRouter, rootRouteId } from "@tanstack/react-router";
import { describe, expect, it } from "vitest";

import { routeTree } from "@/routeTree.gen";
import { SPONSORS } from "@/components/AppShell";

// Match routes without running loaders or rendering: loaders may need a server or
// network the test run lacks, and jsdom never loads the stylesheets React waits on.
describe("App routing", () => {
  it("opens the venue detail route for a Homepage venue", () => {
    const router = createRouter({ routeTree, context: { queryClient: new QueryClient() } });
    expect(router.matchRoutes('/venue/demo-venue').at(-1)?.routeId).toBe('/venue/$id');
  });
  it("matches a page for / instead of falling back to not found", () => {
    const router = createRouter({ routeTree, context: { queryClient: new QueryClient() } });

    const matches = router.matchRoutes("/");

    expect(matches.at(-1)?.routeId).not.toBe(rootRouteId);
  });
  it("sends each partner logo to its sponsor website", () => {
    expect(SPONSORS.map(({ name, href }) => `${name} -> ${href}`)).toEqual([
      "Canuckstuff -> https://canuckstuff.com/canuckstuff/shop/home",
      "Government of Ontario -> https://www.ontario.ca/",
      "City of Toronto -> https://www.toronto.ca/",
      "Mikasa Canada -> https://www.mikasasports.ca/en",
    ]);
  });
});
