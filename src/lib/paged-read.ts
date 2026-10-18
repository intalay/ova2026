type PageResponse<Row> = { data: Row[] | null; error: unknown; count: number | null };

export function requireExactCount(count: number | null, label: string): number {
  if (count === null || !Number.isSafeInteger(count) || count < 0) {
    throw new Error(`${label} could not be fully checked. Please try again.`);
  }
  return count;
}

const FILTER_BATCH_SIZE = 500;

// Keep walking by the rows actually received: a PostgREST row cap may be lower
// than the requested range. An exact count, stable IDs and a nonempty next page
// are required before treating a catalogue as complete.
export async function readAllPages<Row extends { id: string }>(
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
