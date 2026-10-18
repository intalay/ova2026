import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";
import { UpcomingEvents } from "@/components/UpcomingEvents";
import { OFFICIAL_EVENT_OVERVIEWS } from "@/lib/upcoming-events";
afterEach(cleanup);
it("starts with nearest three and expands and collapses with an accessible triangle button", () => {
  render(<UpcomingEvents events={[...OFFICIAL_EVENT_OVERVIEWS].reverse()} mode="real" />);
  expect(screen.getAllByRole("heading")).toHaveLength(3);
  expect(screen.getAllByRole("heading")[0]).toHaveTextContent("17U Girls Fall Classic");
  const button = screen.getByRole("button", { name: "Show more upcoming events" });
  expect(button).toHaveAttribute("aria-expanded", "false");
  fireEvent.click(button);
  expect(screen.getAllByRole("heading")).toHaveLength(6);
  expect(button).toHaveAttribute("aria-expanded", "true");
  fireEvent.click(screen.getByRole("button", { name: "Show fewer upcoming events" }));
  expect(screen.getAllByRole("heading")).toHaveLength(3);
});
it.each([0, 1, 3])("omits expand for %i events", (count) => {
  render(<UpcomingEvents events={OFFICIAL_EVENT_OVERVIEWS.slice(0, count)} mode="real" />);
  expect(screen.queryByRole("button")).not.toBeInTheDocument();
});
it("resets expansion when mode or event list changes", () => {
  const { rerender } = render(<UpcomingEvents events={OFFICIAL_EVENT_OVERVIEWS} mode="real" />);
  fireEvent.click(screen.getByRole("button"));
  rerender(<UpcomingEvents events={OFFICIAL_EVENT_OVERVIEWS} mode="synthetic" />);
  expect(screen.getAllByRole("heading")).toHaveLength(3);
  fireEvent.click(screen.getByRole("button"));
  rerender(<UpcomingEvents events={OFFICIAL_EVENT_OVERVIEWS.slice(1)} mode="synthetic" />);
  expect(screen.getAllByRole("heading")).toHaveLength(3);
});
