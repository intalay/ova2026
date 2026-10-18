import type { Match } from "@/lib/queries";

export type ResultProvider = "timu" | "aes";
export type ResultDataMode = "real" | "synthetic";

/** A reviewed, event-specific binding. This is a link, never a fetch endpoint. */
export type EventResultSource = {
  key: string;
  provider: ResultProvider;
  eventId: string;
  upstreamEventId: string;
  dataMode: ResultDataMode;
  officialResultsUrl: string;
};

export type SyncScope = Pick<EventResultSource, "key" | "eventId" | "dataMode">;
export type NormalizedResult = Omit<Match, "status" | "data_mode"> & {
  status: "scheduled" | "final";
  data_mode: ResultDataMode;
};

export type SyncFailureCode = "adapter_failed" | "invalid_batch" | "storage_failed";
export type SyncRun = {
  id: string;
  runDate: string;
  startedAt: string;
  finishedAt: string | null;
  status: "running" | "succeeded" | "failed";
  received: number;
  changed: number;
  unchanged: number;
  failureCode: SyncFailureCode | null;
};

/** Last success survives a failed attempt. No imported_at/page-load timestamp. */
export type ResultSyncState = {
  scope: SyncScope;
  lastRun: SyncRun;
  lastSuccess: {
    completedAt: string;
    officialUpdatedAt: string | null;
    completedResults: number;
    latestMatchDate: string | null;
  } | null;
};

export type SyncLease = { scope: SyncScope; runId: string };
export type AcquireResult =
  | { status: "acquired"; lease: SyncLease }
  | { status: "already_running" | "already_succeeded"; state: ResultSyncState };

/**
 * Server-side storage contract. acquire must atomically lock this source/event/mode,
 * and deduplicate successful runs for runDate (Toronto calendar date).
 * commit must atomically upsert by EXISTING match ID + save state + append run log.
 * Never delete absent records or overwrite another scope, a decided final with a
 * pending result, or records with conflicting event/team/division identity.
 * Durable implementations need fencing/lease expiry for crash recovery.
 */
export interface ResultSyncStore {
  acquire(input: { scope: SyncScope; run: SyncRun }): Promise<AcquireResult>;
  commit(input: {
    lease: SyncLease;
    matches: NormalizedResult[];
    finishedAt: string;
    officialUpdatedAt: string | null;
  }): Promise<ResultSyncState>;
  fail(input: {
    lease: SyncLease;
    finishedAt: string;
    failureCode: SyncFailureCode;
  }): Promise<ResultSyncState>;
}

/** Full selected scope, never just the current six-row Results page. */
export type RecordedResultsSummary = {
  eventId: string;
  dataMode: ResultDataMode;
  completedResults: number;
  latestMatchDate: string | null;
};
