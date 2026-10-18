import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
export type Row = { id: string; [key: string]: unknown };
type Operation = { method: string; args: unknown[] };
type QueryCall = { table: string; operations: Operation[] };
type Response = { data: Row[] | null; count: number | null; error: unknown };

// A local query-chain mock applies filters before count/range, including each
// team side. It never constructs a network client or reads database credentials.
export function mockClient(
  tables: Record<string, Row[]>,
  options: {
    serverLimit?: number;
    response?: (table: string, from: number, response: Response) => Response;
  } = {},
) {
  const calls: QueryCall[] = [];
  const client = {
    from(table: string) {
      const operations: Operation[] = [];
      const filters: ((row: Row) => boolean)[] = [];
      const orders: { field: string; ascending: boolean; nullsFirst: boolean }[] = [];
      let columns = "*";
      calls.push({ table, operations });
      const chain = {
        select(fields: string, count: unknown) {
          columns = fields;
          operations.push({ method: "select", args: [fields, count] });
          return chain;
        },
        eq(field: string, value: unknown) {
          operations.push({ method: "eq", args: [field, value] });
          filters.push((row) => row[field] === value);
          return chain;
        },
        is(field: string, value: unknown) {
          operations.push({ method: "is", args: [field, value] });
          filters.push((row) => row[field] === value);
          return chain;
        },
        gte(field: string, value: string) {
          operations.push({ method: "gte", args: [field, value] });
          filters.push((row) => row[field] != null && String(row[field]) >= value);
          return chain;
        },
        lte(field: string, value: string) {
          operations.push({ method: "lte", args: [field, value] });
          filters.push((row) => row[field] != null && String(row[field]) <= value);
          return chain;
        },
        or(expression: string) {
          operations.push({ method: "or", args: [expression] });
          const clauses = expression.split(",").map((clause) => clause.split(".eq."));
          filters.push((row) => clauses.some(([field, value]) => field && row[field] === value));
          return chain;
        },
        order(field: string, config: { ascending?: boolean; nullsFirst?: boolean } = {}) {
          operations.push({ method: "order", args: [field, config] });
          orders.push({
            field,
            ascending: config.ascending ?? true,
            nullsFirst: config.nullsFirst ?? false,
          });
          return chain;
        },
        range(from: number, to: number) {
          operations.push({ method: "range", args: [from, to] });
          const filtered = (tables[table] ?? []).filter((row) =>
            filters.every((filter) => filter(row)),
          );
          filtered.sort((a, b) => {
            for (const order of orders) {
              const av = a[order.field];
              const bv = b[order.field];
              if (av == null && bv == null) continue;
              if (av == null) return order.nullsFirst ? -1 : 1;
              if (bv == null) return order.nullsFirst ? 1 : -1;
              const compared = String(av).localeCompare(String(bv));
              if (compared) return order.ascending ? compared : -compared;
            }
            return 0;
          });
          const rows = filtered
            .slice(from, Math.min(to + 1, from + (options.serverLimit ?? Infinity)))
            .map((row) =>
              columns === "*"
                ? row
                : (Object.fromEntries(
                    columns.split(",").map((field) => [field, row[field]]),
                  ) as Row),
            );
          const response = { data: rows, count: filtered.length, error: null };
          return Promise.resolve(options.response?.(table, from, response) ?? response);
        },
      };
      return chain;
    },
  } as unknown as SupabaseClient<Database>;
  return { client, calls };
}

