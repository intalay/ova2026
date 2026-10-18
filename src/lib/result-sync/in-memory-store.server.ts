import type {
  NormalizedResult,
  ResultSyncState,
  ResultSyncStore,
  SyncLease,
  SyncScope,
} from "./model";
import { summarizeRecordedResults } from "./normalize";

const scopeKey = (scope: SyncScope) => JSON.stringify([scope.key, scope.eventId, scope.dataMode]);
const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

/** LOCAL/TEST ONLY. No durability, cross-process locking or crash recovery. */
export function createInMemoryResultSyncStore() {
  const states = new Map<string, ResultSyncState>();
  const rows = new Map<string, { scope: SyncScope; match: NormalizedResult }>();
  const successfulDays = new Set<string>();
  const runs: ResultSyncState[] = [];
  function leased(lease: SyncLease) {
    const state = states.get(scopeKey(lease.scope));
    if (!state || state.lastRun.id !== lease.runId || state.lastRun.status !== "running")
      throw new Error("Stale sync lease");
    return state;
  }
  const store: ResultSyncStore = {
    async acquire({ scope, run }) {
      const key = scopeKey(scope);
      const current = states.get(key);
      if (current?.lastRun.status === "running")
        return { status: "already_running", state: structuredClone(current) };
      if (successfulDays.has(JSON.stringify([key, run.runDate])) && current)
        return { status: "already_succeeded", state: structuredClone(current) };
      states.set(key, {
        scope: structuredClone(scope),
        lastRun: structuredClone(run),
        lastSuccess: current?.lastSuccess ?? null,
      });
      return { status: "acquired", lease: { scope, runId: run.id } };
    },
    async commit({ lease, matches, finishedAt, officialUpdatedAt }) {
      const state = leased(lease);
      const draft = new Map(rows);
      let changed = 0;
      for (const match of matches) {
        if (match.event_id !== lease.scope.eventId || match.data_mode !== lease.scope.dataMode)
          throw new Error("Scope conflict");
        const previous = draft.get(match.id);
        if (previous) {
          const before = previous.match;
          if (
            scopeKey(previous.scope) !== scopeKey(lease.scope) ||
            before.division_id !== match.division_id ||
            before.team_a_id !== match.team_a_id ||
            (before.team_b_id !== null && before.team_b_id !== match.team_b_id) ||
            (before.status === "final" && match.status !== "final")
          )
            throw new Error("Match identity conflict or final downgrade");
        }
        if (!previous || !same(previous.match, match)) changed++;
        draft.set(match.id, { scope: structuredClone(lease.scope), match: structuredClone(match) });
      }
      const summary = summarizeRecordedResults(
        [...draft.values()]
          .filter((row) => scopeKey(row.scope) === scopeKey(lease.scope))
          .map((row) => row.match),
        lease.scope.eventId,
        lease.scope.dataMode,
      );
      const next: ResultSyncState = {
        scope: state.scope,
        lastRun: {
          ...state.lastRun,
          status: "succeeded",
          finishedAt,
          received: matches.length,
          changed,
          unchanged: matches.length - changed,
        },
        lastSuccess: {
          completedAt: finishedAt,
          officialUpdatedAt,
          completedResults: summary.completedResults,
          latestMatchDate: summary.latestMatchDate,
        },
      };
      // No mutations before all validation succeeds (transaction analogue).
      rows.clear();
      draft.forEach((value, key) => rows.set(key, value));
      states.set(scopeKey(lease.scope), next);
      successfulDays.add(JSON.stringify([scopeKey(lease.scope), state.lastRun.runDate]));
      runs.push(structuredClone(next));
      return structuredClone(next);
    },
    async fail({ lease, finishedAt, failureCode }) {
      const state = leased(lease);
      const next: ResultSyncState = {
        ...state,
        lastRun: { ...state.lastRun, status: "failed", finishedAt, failureCode },
      };
      states.set(scopeKey(lease.scope), next);
      runs.push(structuredClone(next));
      return structuredClone(next);
    },
  };
  return {
    store,
    snapshot: () =>
      structuredClone({
        matches: [...rows.values()].map((row) => row.match),
        states: [...states.values()],
        runs,
      }),
  };
}
