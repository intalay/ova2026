import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import {
  loadResultsFilters,
  loadResultsPage,
  loadTeamResultsHistory,
  resultsFiltersSchema,
  resultsPageSchema,
  teamResultsHistorySchema,
} from "./results-query";

// Public, read-only Results access intentionally stays independent of the shared
// competition query and of authenticated family/team history.
function publicResultsClient() {
  const key = process.env["SUPABASE_PUBLISHABLE_KEY"] ?? process.env["SUPABASE_ANON_KEY"];
  const url = process.env["SUPABASE_URL"];
  if (!key || !url || key.startsWith("sb_secret_")) throw new Error("Results source unavailable");

  return createClient<Database>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: {
      fetch: (input, init) => {
        const headers = new Headers(
          typeof Request !== "undefined" && input instanceof Request ? input.headers : undefined,
        );
        new Headers(init?.headers).forEach((value, name) => headers.set(name, value));
        if (key.startsWith("sb_") && headers.get("Authorization") === `Bearer ${key}`) {
          headers.delete("Authorization");
        }
        headers.set("apikey", key);
        return fetch(input, { ...init, headers });
      },
    },
  });
}

export const getResultsPage = createServerFn({ method: "GET" })
  .inputValidator((input) => resultsPageSchema.parse(input))
  .handler(async ({ data }) => loadResultsPage(publicResultsClient(), data));

export const getResultsFilters = createServerFn({ method: "GET" })
  .inputValidator((input) => resultsFiltersSchema.parse(input))
  .handler(async ({ data }) => loadResultsFilters(publicResultsClient(), data));

export const getTeamResultsHistory = createServerFn({ method: "GET" })
  .inputValidator((input) => teamResultsHistorySchema.parse(input))
  .handler(async ({ data }) => loadTeamResultsHistory(publicResultsClient(), data));

