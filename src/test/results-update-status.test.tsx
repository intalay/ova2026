import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { ResultsUpdateStatus } from "@/components/ResultsUpdateStatus";
import { EVENT_RESULT_SOURCES } from "@/lib/result-sync/sources";
import type { RecordedResultsSummary, ResultSyncState } from "@/lib/result-sync/model";

afterEach(cleanup);
const source = EVENT_RESULT_SOURCES[0]!;
const summary: RecordedResultsSummary = {
  eventId: source.eventId,
  dataMode: "real",
  completedResults: 21,
  latestMatchDate: "2026-03-07",
};
const state: ResultSyncState = {
  scope: { key: source.key, eventId: source.eventId, dataMode: "real" },
  lastRun: {
    id: "run1",
    runDate: "2026-10-17",
    startedAt: "2026-10-18T01:29:00Z",
    finishedAt: "2026-10-18T01:30:00Z",
    status: "succeeded",
    received: 21,
    changed: 21,
    unchanged: 0,
    failureCode: null,
  },
  lastSuccess: {
    completedAt: "2026-10-18T01:30:00Z",
    officialUpdatedAt: null,
    completedResults: 21,
    latestMatchDate: "2026-03-07",
  },
};
function fact(label: string) {
  return within(screen.getByText(label).parentElement!).getByRole("definition");
}

describe("parent-facing update status", () => {
  it("defaults to historical, with no invented automatic-sync timestamp", () => {
    const { container } = render(
      <ResultsUpdateStatus eventId={source.eventId} summary={summary} />,
    );
    expect(screen.getByRole("heading", { name: "Historical results" })).toBeInTheDocument();
    expect(screen.getByText("Automatic updates not enabled")).toBeInTheDocument();
    expect(fact("Last successful sync")).toHaveTextContent("Not recorded");
    expect(fact("Recorded results")).toHaveTextContent("21 completed matches");
    expect(fact("Latest match date")).toHaveTextContent("2026");
    expect(container.querySelectorAll("time")).toHaveLength(1);
    expect(screen.getByRole("link", { name: /Official results · TIMU/ })).toHaveAttribute(
      "href",
      source.officialResultsUrl,
    );
    expect(container.textContent).not.toMatch(/Daily active|0[–-]0/);
  });
  it("uses only a persisted successful sync, independently of the last match date", () => {
    render(
      <ResultsUpdateStatus eventId={source.eventId} automaticUpdates="enabled" syncState={state} />,
    );
    expect(screen.getByRole("heading", { name: "Results updated" })).toBeInTheDocument();
    expect(fact("Last successful sync").querySelector("time")).toHaveAttribute(
      "dateTime",
      "2026-10-18T01:30:00Z",
    );
    expect(fact("Last successful sync")).toHaveTextContent("Oct 17, 2026");
    expect(fact("Latest match date").querySelector("time")).toHaveAttribute(
      "dateTime",
      "2026-03-07",
    );
  });
  it("keeps old result facts and last success visible after failure", () => {
    render(
      <ResultsUpdateStatus
        eventId={source.eventId}
        automaticUpdates="enabled"
        syncState={{
          ...state,
          lastRun: { ...state.lastRun, status: "failed", failureCode: "adapter_failed" },
        }}
      />,
    );
    expect(screen.getByRole("heading", { name: "Results update delayed" })).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent(
      "Previously recorded results are still available",
    );
    expect(fact("Recorded results")).toHaveTextContent("21 completed matches");
    expect(fact("Last successful sync").querySelector("time")).toHaveAttribute(
      "dateTime",
      state.lastSuccess!.completedAt,
    );
  });
  it("does not imply success when enabled but no status facts exist", () => {
    render(<ResultsUpdateStatus eventId={source.eventId} automaticUpdates="enabled" />);
    expect(screen.getByRole("heading", { name: "Update status unavailable" })).toBeInTheDocument();
    expect(fact("Last successful sync")).toHaveTextContent("Not recorded");
    expect(fact("Recorded results")).toHaveTextContent("Not confirmed");
  });
  it("rejects stale facts/links from another event or source mode", () => {
    render(
      <ResultsUpdateStatus
        eventId="another_event"
        source={source}
        summary={summary}
        syncState={state}
      />,
    );
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
    expect(fact("Recorded results")).toHaveTextContent("Not confirmed");
    expect(fact("Last successful sync")).toHaveTextContent("Not recorded");
  });
  it("has no sample-event fallback for all events, and labels synthetic results", () => {
    const { rerender } = render(<ResultsUpdateStatus />);
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
    expect(
      screen.getByText("Select an event to view its official results link."),
    ).toBeInTheDocument();
    rerender(
      <ResultsUpdateStatus
        eventId={source.eventId}
        dataMode="synthetic"
        summary={summary}
        syncState={state}
      />,
    );
    expect(screen.getByRole("heading", { name: "Synthetic demo results" })).toBeInTheDocument();
    expect(fact("Recorded results")).toHaveTextContent("Not confirmed");
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });
  it("suppresses an unsafe official link even if a caller supplies it", () => {
    render(
      <ResultsUpdateStatus
        eventId={source.eventId}
        source={{ ...source, officialResultsUrl: "javascript:alert(1)" }}
      />,
    );
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });
  it("keeps a complete summary's unknown date unknown instead of using a stale date", () => {
    render(
      <ResultsUpdateStatus
        eventId={source.eventId}
        summary={{ ...summary, latestMatchDate: null }}
        syncState={state}
      />,
    );
    expect(fact("Latest match date")).toHaveTextContent("Date to be determined");
  });
  it("does not display an invalid or timezone-free success timestamp", () => {
    render(
      <ResultsUpdateStatus
        eventId={source.eventId}
        syncState={{
          ...state,
          lastSuccess: { ...state.lastSuccess!, completedAt: "2026-10-18T01:30:00" },
        }}
      />,
    );
    expect(fact("Last successful sync")).toHaveTextContent("Not recorded");
  });
});
