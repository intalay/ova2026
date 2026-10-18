import { describe, expect, it, vi } from "vitest";
import { runDailyResultSync } from "@/lib/result-sync/daily-job.server";
import { createInMemoryResultSyncStore } from "@/lib/result-sync/in-memory-store.server";
import { EVENT_RESULT_SOURCES } from "@/lib/result-sync/sources";
import type { ResultAdapter, AdapterBatch } from "@/lib/result-sync/adapters.server";
import type { ResultSyncStore } from "@/lib/result-sync/model";

const source = EVENT_RESULT_SOURCES[0]!;
const row = {
  id: "existing_match_1",
  event_id: source.eventId,
  division_id: "existing_division",
  team_a_id: "a",
  team_b_id: "b",
  venue_id: null,
  court: null,
  source_date: "2026-04-19",
  starts_at: null,
  status: "final",
  score_a: 2,
  score_b: 0,
  sets: null,
  data_mode: "real",
};
function setup() {
  const memory = createInMemoryResultSyncStore();
  const read = vi
    .fn<ResultAdapter["read"]>()
    .mockResolvedValue({ complete: true, records: [row, row], officialUpdatedAt: null });
  let date = new Date("2026-10-18T01:30:00Z"); // still Oct 17 in Toronto
  let run = 0;
  const dependencies = {
    store: memory.store,
    adapters: { timu: { provider: "timu" as const, configured: true, read } },
    clock: () => date,
    createRunId: () => `run_${++run}`,
  };
  return {
    ...memory,
    read,
    dependencies,
    nextDay: () => {
      date = new Date("2026-10-19T01:30:00Z");
    },
  };
}
const input = { sourceKey: source.key, enabled: true };

describe("disabled-by-default daily job", () => {
  it("never fetches/writes when disabled or not configured", async () => {
    const s = setup();
    expect(await runDailyResultSync({ sourceKey: source.key }, s.dependencies)).toEqual({
      status: "not_configured",
      reason: "disabled",
    });
    expect(await runDailyResultSync(input)).toEqual({
      status: "not_configured",
      reason: "adapter_missing",
    });
    expect(await runDailyResultSync({ ...input, sourceKey: "unmapped" }, s.dependencies)).toEqual({
      status: "not_configured",
      reason: "source_missing",
    });
    expect(await runDailyResultSync(input, { adapters: s.dependencies.adapters })).toEqual({
      status: "not_configured",
      reason: "storage_missing",
    });
    expect(s.read).not.toHaveBeenCalled();
    expect(s.snapshot()).toEqual({ matches: [], states: [], runs: [] });
  });
  it("deduplicates a day and re-imported IDs, retaining unknown official update time", async () => {
    const s = setup();
    const first = await runDailyResultSync(input, s.dependencies);
    expect(first).toMatchObject({
      status: "succeeded",
      state: {
        lastRun: { runDate: "2026-10-17", received: 1, changed: 1 },
        lastSuccess: {
          completedAt: "2026-10-18T01:30:00.000Z",
          officialUpdatedAt: null,
          latestMatchDate: "2026-04-19",
        },
      },
    });
    expect(await runDailyResultSync(input, s.dependencies)).toMatchObject({
      status: "already_succeeded",
    });
    s.nextDay();
    expect(await runDailyResultSync(input, s.dependencies)).toMatchObject({
      status: "succeeded",
      state: { lastRun: { changed: 0, unchanged: 1 } },
    });
    expect(s.snapshot().matches).toEqual([row]);
    expect(s.read).toHaveBeenCalledTimes(2);
  });
  it("blocks overlap before reading a second batch", async () => {
    const s = setup();
    let resolve!: (value: AdapterBatch) => void;
    s.read.mockImplementationOnce(
      () =>
        new Promise((r) => {
          resolve = r;
        }),
    );
    const first = runDailyResultSync(input, s.dependencies);
    await vi.waitFor(() => expect(s.read).toHaveBeenCalledOnce());
    expect(await runDailyResultSync(input, s.dependencies)).toMatchObject({
      status: "already_running",
    });
    resolve({ complete: true, records: [row], officialUpdatedAt: null });
    expect(await first).toMatchObject({ status: "succeeded" });
    expect(s.read).toHaveBeenCalledOnce();
  });
  it("retains all old results and last success after provider failure; same-day retry works", async () => {
    const s = setup();
    await runDailyResultSync(input, s.dependencies);
    const previous = s.snapshot();
    s.nextDay();
    s.read.mockRejectedValueOnce(new Error("secret provider token must not appear"));
    expect(await runDailyResultSync(input, s.dependencies)).toMatchObject({
      status: "failed",
      code: "adapter_failed",
      persisted: true,
      state: { lastSuccess: previous.states[0]?.lastSuccess },
    });
    expect(s.snapshot().matches).toEqual(previous.matches);
    expect(JSON.stringify(s.snapshot().runs)).not.toContain("secret");
    expect(await runDailyResultSync(input, s.dependencies)).toMatchObject({ status: "succeeded" });
  });
  it("rejects partial/invalid batches atomically, without promoting a success timestamp", async () => {
    const s = setup();
    await runDailyResultSync(input, s.dependencies);
    s.nextDay();
    s.read.mockResolvedValueOnce({
      complete: true,
      records: [
        { ...row, id: "new_match" },
        { ...row, score_a: null },
      ],
      officialUpdatedAt: null,
    });
    expect(await runDailyResultSync(input, s.dependencies)).toMatchObject({
      status: "failed",
      code: "invalid_batch",
    });
    expect(s.snapshot().matches).toEqual([row]);
    expect(s.snapshot().states[0]?.lastSuccess?.completedAt).toBe("2026-10-18T01:30:00.000Z");
    s.read.mockResolvedValueOnce({
      complete: false,
      records: [],
      officialUpdatedAt: null,
    } as unknown as AdapterBatch);
    expect(await runDailyResultSync(input, s.dependencies)).toMatchObject({
      status: "failed",
      code: "invalid_batch",
    });
  });
  it("does not delete absent rows, and permits corrected final scores on the same stable ID", async () => {
    const s = setup();
    await runDailyResultSync(input, s.dependencies);
    s.nextDay();
    s.read.mockResolvedValueOnce({ complete: true, records: [], officialUpdatedAt: null });
    expect(await runDailyResultSync(input, s.dependencies)).toMatchObject({
      status: "succeeded",
      state: { lastSuccess: { completedResults: 1 } },
    });
    s.read.mockResolvedValueOnce({
      complete: true,
      records: [{ ...row, score_a: 1, score_b: 2 }],
      officialUpdatedAt: null,
    });
    expect(
      await runDailyResultSync({ ...input, runDate: "2026-10-19" }, s.dependencies),
    ).toMatchObject({ status: "succeeded" });
    expect(s.snapshot().matches).toEqual([{ ...row, score_a: 1, score_b: 2 }]);
  });
  it("protects decided results and identity from a pending downgrade or changed teams", async () => {
    const s = setup();
    await runDailyResultSync(input, s.dependencies);
    s.nextDay();
    s.read.mockResolvedValueOnce({
      complete: true,
      records: [{ ...row, status: "scheduled", score_a: null, score_b: null }],
      officialUpdatedAt: null,
    });
    expect(await runDailyResultSync(input, s.dependencies)).toMatchObject({
      status: "failed",
      code: "storage_failed",
    });
    s.read.mockResolvedValueOnce({
      complete: true,
      records: [{ ...row, team_a_id: "unmapped_a" }],
      officialUpdatedAt: null,
    });
    expect(await runDailyResultSync(input, s.dependencies)).toMatchObject({
      status: "failed",
      code: "storage_failed",
    });
    expect(s.snapshot().matches).toEqual([row]);
  });
  it("reports storage outages honestly, even when failure logging cannot persist", async () => {
    const s = setup();
    const broken: ResultSyncStore = {
      ...s.store,
      commit: async () => {
        throw new Error("offline");
      },
      fail: async () => {
        throw new Error("offline");
      },
    };
    expect(await runDailyResultSync(input, { ...s.dependencies, store: broken })).toEqual({
      status: "failed",
      code: "storage_failed",
      state: null,
      persisted: false,
    });
    expect(s.snapshot().matches).toEqual([]);
    expect(s.snapshot().states[0]?.lastSuccess).toBeNull();
  });
  it("can complete a previously scheduled match without changing its stable ID", async () => {
    const s = setup();
    s.read.mockResolvedValueOnce({
      complete: true,
      records: [{ ...row, status: "scheduled", team_b_id: null, score_a: null, score_b: null }],
      officialUpdatedAt: null,
    });
    expect(await runDailyResultSync(input, s.dependencies)).toMatchObject({
      status: "succeeded",
      state: { lastSuccess: { completedResults: 0, latestMatchDate: null } },
    });
    s.nextDay();
    expect(await runDailyResultSync(input, s.dependencies)).toMatchObject({
      status: "succeeded",
      state: { lastSuccess: { completedResults: 1 } },
    });
    expect(s.snapshot().matches).toEqual([row]);
  });
});
