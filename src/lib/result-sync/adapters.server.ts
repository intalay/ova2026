import type { EventResultSource, ResultProvider } from "./model";

export type AdapterBatch = {
  // A partial/failed page read must throw or return not_configured, never succeed.
  complete: true;
  records: unknown;
  // Only use an explicit upstream timestamp, otherwise null.
  officialUpdatedAt: string | null;
};

/**
 * Provider-specific code owns the authorized transport and protocol. No arbitrary
 * URL/API-key input. A URL alone cannot configure an unknown API or HTML parser.
 * Resolve upstream IDs against existing import mappings; reject ambiguous IDs.
 */
export interface ResultAdapter {
  provider: ResultProvider;
  configured: boolean;
  read(input: { source: EventResultSource; runDate: string }): Promise<AdapterBatch>;
}

function unconfigured(provider: ResultProvider): ResultAdapter {
  return {
    provider,
    configured: false,
    async read() {
      throw new Error("not_configured");
    },
  };
}

export const RESULT_ADAPTERS: Readonly<Record<ResultProvider, ResultAdapter>> = {
  timu: unconfigured("timu"),
  aes: unconfigured("aes"),
};
