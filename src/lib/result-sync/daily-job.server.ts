import { z } from "zod";
import { torontoToday } from "@/lib/format";
import { RESULT_ADAPTERS, type ResultAdapter } from "./adapters.server";
import type {
  EventResultSource,
  ResultSyncState,
  ResultSyncStore,
  SyncFailureCode,
  SyncRun,
} from "./model";
import { calendarDateSchema, normalizeResultBatch } from "./normalize";
import { EVENT_RESULT_SOURCES, validateOfficialResultsUrl } from "./sources";

export type DailySyncOutcome =
  | {
      status: "not_configured";
      reason: "disabled" | "source_missing" | "adapter_missing" | "storage_missing";
    }
  | { status: "already_running" | "already_succeeded" | "succeeded"; state: ResultSyncState }
  | { status: "failed"; code: SyncFailureCode; state: ResultSyncState | null; persisted: boolean };

/** Plain server job function, not an HTTP endpoint or cron registration. */
export async function runDailyResultSync(
  input: { sourceKey: string; enabled?: boolean; runDate?: string },
  dependencies: {
    store?: ResultSyncStore;
    adapters?: Readonly<Partial<Record<"timu" | "aes", ResultAdapter>>>;
    sources?: readonly EventResultSource[];
    clock?: () => Date;
    createRunId?: () => string;
  } = {},
): Promise<DailySyncOutcome> {
  if (input.enabled !== true) return { status: "not_configured", reason: "disabled" };
  const matches = (dependencies.sources ?? EVENT_RESULT_SOURCES).filter(
    (s) => s.key === input.sourceKey,
  );
  const source = matches.length === 1 ? matches[0] : null;
  if (
    !source ||
    !validateOfficialResultsUrl(source.officialResultsUrl, source.provider, source.upstreamEventId)
  )
    return { status: "not_configured", reason: "source_missing" };
  const adapter = (dependencies.adapters ?? RESULT_ADAPTERS)[source.provider];
  if (!adapter?.configured || adapter.provider !== source.provider)
    return { status: "not_configured", reason: "adapter_missing" };
  const store = dependencies.store;
  if (!store) return { status: "not_configured", reason: "storage_missing" };
  const clock = dependencies.clock ?? (() => new Date());
  const now = clock();
  const runDate = calendarDateSchema.parse(input.runDate ?? torontoToday(now));
  const run: SyncRun = {
    id: (dependencies.createRunId ?? (() => crypto.randomUUID()))(),
    runDate,
    startedAt: now.toISOString(),
    finishedAt: null,
    status: "running",
    received: 0,
    changed: 0,
    unchanged: 0,
    failureCode: null,
  };
  let acquired;
  try {
    acquired = await store.acquire({
      scope: { key: source.key, eventId: source.eventId, dataMode: source.dataMode },
      run,
    });
  } catch {
    return { status: "failed", code: "storage_failed", state: null, persisted: false };
  }
  if (acquired.status !== "acquired") return acquired;
  let code: SyncFailureCode = "adapter_failed";
  try {
    const batch = await adapter.read({ source, runDate });
    code = "invalid_batch";
    if (batch.complete !== true) throw new Error("Incomplete source batch");
    const records = normalizeResultBatch(batch.records, source);
    const officialUpdatedAt = z
      .string()
      .datetime({ offset: true })
      .nullable()
      .parse(batch.officialUpdatedAt);
    code = "storage_failed";
    const state = await store.commit({
      lease: acquired.lease,
      matches: records,
      finishedAt: clock().toISOString(),
      officialUpdatedAt,
    });
    return { status: "succeeded", state };
  } catch {
    // Persist safe codes, never credentials, raw provider responses or exception text.
    try {
      const state = await store.fail({
        lease: acquired.lease,
        finishedAt: clock().toISOString(),
        failureCode: code,
      });
      return { status: "failed", code, state, persisted: true };
    } catch {
      return { status: "failed", code: "storage_failed", state: null, persisted: false };
    }
  }
}
