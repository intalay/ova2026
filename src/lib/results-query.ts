import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import type { Database } from "@/integrations/supabase/types";

const calendarDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Use a date in YYYY-MM-DD format")
  .refine((value) => {
    const parsed = new Date(`${value}T00:00:00.000Z`);
    return (
      value.slice(0, 4) !== "0000" &&
      !Number.isNaN(parsed.getTime()) &&
      parsed.toISOString().slice(0, 10) === value
    );
  }, "Choose a valid calendar date");
// IDs are also interpolated into PostgREST OR grammar for the two team sides.
const recordId = z
  .string()
  .min(1)
  .max(200)
  .regex(/^[A-Za-z0-9_-]+$/, "Choose a valid record");

export const resultsDataModeSchema = z.enum(["all", "real", "synthetic"]);
export type ResultsDataMode = z.infer<typeof resultsDataModeSchema>;

export const resultsPageSchema = z
  .object({
    page: z
      .number()
      .int()
      .min(1)
      .max(Math.floor(Number.MAX_SAFE_INTEGER / 50)),
    pageSize: z.number().int().min(1).max(50),
    period: z.enum(["recent", "history"]).default("history"),
    dataMode: resultsDataModeSchema.default("real"),
    eventId: recordId.optional(),
    teamId: recordId.optional(),
    dateFrom: calendarDate.optional(),
    dateTo: calendarDate.optional(),
  })
  .refine((value) => !value.dateFrom || !value.dateTo || value.dateFrom <= value.dateTo, {
    path: ["dateTo"],
    message: "End date must be on or after start date",
  });

export const resultsFiltersSchema = z.object({
  dataMode: resultsDataModeSchema.default("real"),
});
export const teamResultsHistorySchema = z.object({
  teamId: recordId,
  dataMode: z.enum(["real", "synthetic"]),
});
export type ResultsPageInput = z.input<typeof resultsPageSchema>;
export type ResultsFiltersInput = z.input<typeof resultsFiltersSchema>;
export type TeamResultsHistoryInput = z.input<typeof teamResultsHistorySchema>;

type PublicResultsClient = SupabaseClient<Database>;
type PageResponse<Row> = { data: Row[] | null; error: unknown; count: number | null };

function requireExactCount(count: number | null, label: string): number {
  if (count === null || !Number.isSafeInteger(count) || count < 0) {
    throw new Error(`${label} could not be fully checked. Please try again.`);
  }
  return count;
}

export async function loadResultsPage(
  client: PublicResultsClient,
  input: ResultsPageInput,
  now = new Date(),
) {
  const data = resultsPageSchema.parse(input);
  const from = (data.page - 1) * data.pageSize;
  let query = client.from("matches").select("*", { count: "exact" }).eq("status", "final");

  if (data.dataMode !== "all") query = query.eq("data_mode", data.dataMode);
  if (data.eventId) query = query.eq("event_id", data.eventId);
  if (data.teamId) query = query.or(`team_a_id.eq.${data.teamId},team_b_id.eq.${data.teamId}`);
  if (data.period === "recent") {
    const start = new Date(now);
    start.setUTCMonth(start.getUTCMonth() - 3);
    query = query
      .gte("source_date", start.toISOString().slice(0, 10))
      .lte("source_date", now.toISOString().slice(0, 10));
  }
  if (data.dateFrom) query = query.gte("source_date", data.dateFrom);
  if (data.dateTo) query = query.lte("source_date", data.dateTo);

  const {
    data: matches,
    error,
    count,
  } = await query
    .order("source_date", { ascending: false, nullsFirst: false })
    .order("id", { ascending: true })
    .range(from, from + data.pageSize - 1);
  if (error) throw new Error("Could not load results. Please try again.");
  const total = requireExactCount(count, "Results");
  const rows = matches ?? [];
  const expected = Math.min(data.pageSize, Math.max(0, total - from));
  if (rows.length !== expected) {
    throw new Error("Results page is incomplete. Please try again.");
  }
  return { matches: rows, total };
}

const FILTER_BATCH_SIZE = 500;

// Keep walking by the rows actually received: a PostgREST row cap may be lower
// than the requested range. An exact count, stable IDs and a nonempty next page
// are required before treating a catalogue as complete.
async function readAllPages<Row extends { id: string }>(
  readPage: (from: number, to: number) => PromiseLike<PageResponse<Row>>,
  label: string,
): Promise<Row[]> {
  const rows: Row[] = [];
  const seen = new Set<string>();
  let total: number | undefined;
  do {
    const result = await readPage(rows.length, rows.length + FILTER_BATCH_SIZE - 1);
    if (result.error) throw new Error(`Could not load ${label}. Please try again.`);
    const count = requireExactCount(result.count, label);
    if (total !== undefined && count !== total) {
      throw new Error(`${label} changed while loading. Please try again.`);
    }
    total = count;
    const page = result.data ?? [];
    if ((!page.length && rows.length < total) || rows.length + page.length > total) {
      throw new Error(`${label} is incomplete. Please try again.`);
    }
    for (const row of page) {
      if (seen.has(row.id)) throw new Error(`${label} is incomplete. Please try again.`);
      seen.add(row.id);
      rows.push(row);
    }
  } while (rows.length < total);
  return rows;
}

export async function loadResultsFilters(client: PublicResultsClient, input: ResultsFiltersInput) {
  const { dataMode } = resultsFiltersSchema.parse(input);
  const [events, teams, divisions, participationMatches] = await Promise.all([
    readAllPages((from, to) => {
      let query = client
        .from("events")
        .select("id,name,start_date,end_date,data_mode", { count: "exact" });
      if (dataMode !== "all") query = query.eq("data_mode", dataMode);
      return query.order("id", { ascending: true }).range(from, to);
    }, "Results events"),
    readAllPages((from, to) => {
      let query = client.from("teams").select("id,name,division_id,data_mode", { count: "exact" });
      if (dataMode !== "all") query = query.eq("data_mode", dataMode);
      return query.order("id", { ascending: true }).range(from, to);
    }, "Results teams"),
    readAllPages((from, to) => {
      let query = client.from("divisions").select("id,name,data_mode", { count: "exact" });
      if (dataMode !== "all") query = query.eq("data_mode", dataMode);
      return query.order("id", { ascending: true }).range(from, to);
    }, "Results divisions"),
    readAllPages((from, to) => {
      let query = client
        .from("matches")
        .select("id,event_id,team_a_id,team_b_id", { count: "exact" })
        .eq("status", "final");
      if (dataMode !== "all") query = query.eq("data_mode", dataMode);
      return query.order("id", { ascending: true }).range(from, to);
    }, "Results team events"),
  ]);
  // Team records may represent an event-specific entry, even when name and
  // division match another entry. Only match participation identifies its event.
  const teamEvents: { teamId: string; eventId: string }[] = [];
  const seen = new Set<string>();
  for (const match of participationMatches) {
    for (const teamId of [match.team_a_id, match.team_b_id]) {
      if (!teamId) continue;
      const key = JSON.stringify([teamId, match.event_id]);
      if (seen.has(key)) continue;
      seen.add(key);
      teamEvents.push({ teamId, eventId: match.event_id });
    }
  }
  return { events, teams, divisions, teamEvents };
}

export async function loadTeamResultsHistory(
  client: PublicResultsClient,
  input: TeamResultsHistoryInput,
) {
  const { teamId, dataMode } = teamResultsHistorySchema.parse(input);
  const [matches, rankings] = await Promise.all([
    readAllPages(
      (from, to) =>
        client
          .from("matches")
          .select("*", { count: "exact" })
          .eq("status", "final")
          .eq("data_mode", dataMode)
          .or(`team_a_id.eq.${teamId},team_b_id.eq.${teamId}`)
          .order("source_date", { ascending: false, nullsFirst: false })
          .order("id", { ascending: true })
          .range(from, to),
      "Team results",
    ),
    readAllPages(
      (from, to) =>
        client
          .from("rankings")
          .select("*", { count: "exact" })
          .eq("team_id", teamId)
          .eq("data_mode", dataMode)
          .order("id", { ascending: true })
          .range(from, to),
      "Team placements",
    ),
  ]);
  // final_confirmed remains authoritative; unconfirmed source placements must
  // not be promoted to confirmed results or plotted as final standings by UI.
  return { matches, rankings };
}

