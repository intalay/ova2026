import { z } from "zod";
import type { Match } from "@/lib/queries";
import type { EventResultSource, NormalizedResult, RecordedResultsSummary } from "./model";

export const calendarDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((value) => {
    const date = new Date(`${value}T00:00:00Z`);
    return (
      !value.startsWith("0000") &&
      !Number.isNaN(date.getTime()) &&
      date.toISOString().slice(0, 10) === value
    );
  });

const id = z
  .string()
  .min(1)
  .max(200)
  .regex(/^[A-Za-z0-9_-]+$/);
const score = z.number().int().min(0).max(99);
export const instantSchema = z.string().datetime({ offset: true });
export const normalizedResultSchema = z
  .object({
    id,
    event_id: id,
    division_id: id,
    team_a_id: id,
    team_b_id: id.nullable(),
    venue_id: id.nullable(),
    source_date: calendarDateSchema.nullable(),
    starts_at: instantSchema.nullable(),
    court: z.string().max(100).nullable(),
    status: z.enum(["scheduled", "final"]),
    score_a: score.nullable(),
    score_b: score.nullable(),
    sets: z
      .array(
        z
          .object({ a: z.number().int().min(0).max(199), b: z.number().int().min(0).max(199) })
          .strict(),
      )
      .max(9)
      .nullable(),
    data_mode: z.enum(["real", "synthetic"]),
  })
  .strict()
  .superRefine((row, ctx) => {
    const invalid = (message: string) => ctx.addIssue({ code: "custom", message });
    if (row.team_b_id === row.team_a_id) invalid("A match needs two different teams");
    if (row.status !== "final") {
      if (row.score_a !== null || row.score_b !== null || row.sets !== null)
        invalid("Pending results must use null scores and sets");
      return;
    }
    if (
      !row.team_b_id ||
      row.score_a === null ||
      row.score_b === null ||
      row.score_a === row.score_b
    ) {
      invalid("A final needs an opponent and decided set totals");
      return;
    }
    if (row.sets !== null) {
      if (
        row.sets.some((set) => set.a === set.b) ||
        row.sets.length !== row.score_a + row.score_b ||
        row.sets.filter((set) => set.a > set.b).length !== row.score_a ||
        row.sets.filter((set) => set.b > set.a).length !== row.score_b
      )
        invalid("Per-set scores must agree with decided set totals");
    }
  });

/** All-or-nothing validation. Preserve supplied stable IDs, never hash names/dates. */
export function normalizeResultBatch(
  value: unknown,
  source: EventResultSource,
): NormalizedResult[] {
  const rows = z.array(normalizedResultSchema).max(50_000).parse(value);
  const unique = new Map<string, NormalizedResult>();
  for (const row of rows) {
    if (row.event_id !== source.eventId || row.data_mode !== source.dataMode)
      throw new Error("Result source scope mismatch");
    const previous = unique.get(row.id);
    if (previous && JSON.stringify(previous) !== JSON.stringify(row))
      throw new Error("Conflicting duplicate match ID");
    unique.set(row.id, row);
  }
  return [...unique.values()];
}

/** Use on a COMPLETE scoped read. Unknown dates stay unknown. */
export function summarizeRecordedResults(
  rows: readonly Match[],
  eventId: string,
  dataMode: "real" | "synthetic",
): RecordedResultsSummary {
  const finals = rows.filter(
    (m) =>
      m.event_id === eventId &&
      m.data_mode === dataMode &&
      m.status === "final" &&
      m.score_a !== null &&
      m.score_b !== null &&
      Number.isInteger(m.score_a) &&
      Number.isInteger(m.score_b) &&
      m.score_a >= 0 &&
      m.score_b >= 0 &&
      m.score_a !== m.score_b,
  );
  return {
    eventId,
    dataMode,
    completedResults: finals.length,
    latestMatchDate:
      finals
        .flatMap((m) =>
          m.source_date && calendarDateSchema.safeParse(m.source_date).success
            ? [m.source_date]
            : [],
        )
        .sort()
        .at(-1) ?? null,
  };
}
