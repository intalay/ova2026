import type { ComponentType, ReactNode } from "react";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
const mock = vi.hoisted(() => ({ mode: "synthetic", coordinates: true }));
vi.mock("@tanstack/react-router", () => ({
  createFileRoute: () => (options: { component: ComponentType }) => ({
    options,
    useParams: () => ({ id: "demo-venue" }),
  }),
  notFound: () => new Error("not found"),
}));
vi.mock("@tanstack/react-query", () => ({
  useSuspenseQuery: () => ({
    data: {
      venue: {
        id: "demo-venue",
        name: "Enercare Centre",
        address: "100 Princes' Blvd, Toronto",
        latitude: 43.6342069,
        longitude: -79.4127931,
        coordinates_verified: mock.coordinates,
        data_mode: mock.mode,
        source_url: "https://www.explace.on.ca/venue/enercare-centre/",
      },
      parking: [
        {
          id: "parking",
          name: "Garage",
          data_mode: mock.mode,
          coordinates_verified: false,
          address: null,
          notes: null,
          source_url: null,
        },
      ],
    },
  }),
}));
vi.mock("@/lib/queries", () => ({ venueQuery: () => ({}) }));
vi.mock("@/components/AppShell", () => ({
  AppShell: ({
    children,
    title,
    sourceLabel,
  }: {
    children: ReactNode;
    title: string;
    sourceLabel?: string;
  }) => (
    <main>
      <h1>{title}</h1>
      <p>{sourceLabel}</p>
      {children}
    </main>
  ),
  Section: ({ children, title }: { children: ReactNode; title: string }) => (
    <section aria-label={title}>{children}</section>
  ),
  Card: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  Tbd: ({ children }: { children: ReactNode }) => <span>{children}</span>,
}));
import { Route } from "@/routes/venue.$id";
const Venue = Route.options.component as ComponentType;
afterEach(() => {
  cleanup();
  mock.mode = "synthetic";
  mock.coordinates = true;
});
it("opens the recorded Demo venue with clear labels, the existing verified map, and directions", () => {
  render(<Venue />);
  expect(screen.getByRole("status")).toHaveTextContent("Demo venue record");
  expect(screen.getByTitle("Interactive map around Enercare Centre")).toHaveAttribute(
    "src",
    expect.stringContaining("marker=43.6342069,-79.4127931"),
  );
  expect(screen.getByRole("link", { name: "Get directions" })).toHaveAttribute(
    "href",
    "https://www.google.com/maps/dir/?api=1&destination=43.6342069%2C-79.4127931",
  );
  expect(screen.getByRole("link", { name: /Official venue information/ })).toHaveAttribute(
    "href",
    "https://www.explace.on.ca/venue/enercare-centre/",
  );
  expect(screen.getByText("Synthetic parking record")).toBeInTheDocument();
});
it("does not label a real venue as Demo or change its map navigation", () => {
  mock.mode = "real";
  render(<Venue />);
  expect(screen.queryByRole("status")).not.toBeInTheDocument();
  expect(screen.getByTitle("Interactive map around Enercare Centre")).toBeInTheDocument();
  expect(screen.getByRole("link", { name: "Get directions" })).toBeInTheDocument();
});
it("does not invent a map point when recorded coordinates are unverified", () => {
  mock.coordinates = false;
  render(<Venue />);
  expect(screen.queryByTitle("Interactive map around Enercare Centre")).not.toBeInTheDocument();
  expect(screen.getByText("Map location to be confirmed")).toBeInTheDocument();
  expect(screen.getByRole("link", { name: "Get directions" })).toHaveAttribute(
    "href",
    expect.stringContaining("100%20Princes'%20Blvd"),
  );
});
