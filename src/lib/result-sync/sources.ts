import type { EventResultSource, ResultProvider } from "./model";

/**
 * Structural allowlist only, not a claim that fetching/access has been approved.
 * Rejects credentials, redirects, alternate hosts/ports and unrelated paths.
 */
export function validateOfficialResultsUrl(
  value: string,
  provider: ResultProvider,
  upstreamEventId: string,
): string | null {
  if (value !== value.trim() || !/^[A-Za-z0-9_-]+$/.test(upstreamEventId)) return null;
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || url.username || url.password || url.port || url.hash)
      return null;
    if (provider === "timu") {
      if (
        !["www.timu.ca", "timu.ca"].includes(url.hostname) ||
        url.pathname !== "/scoreboards/results.php" ||
        !/^\d+$/.test(upstreamEventId) ||
        url.searchParams.get("tid") !== upstreamEventId ||
        [...url.searchParams.keys()].length !== 1
      )
        return null;
    } else if (provider === "aes") {
      if (
        url.hostname !== "results.advancedeventsystems.com" ||
        url.search ||
        !new RegExp(`^/event/${upstreamEventId}(?:/divisions/[0-9]+/overview)?/?$`).test(
          url.pathname,
        )
      )
        return null;
    } else return null;
    return url.href;
  } catch {
    return null;
  }
}

// Exact IDs/links from the local verified history package. Display configuration
// does not enable an adapter. No global fallback to a sample tournament.
export const EVENT_RESULT_SOURCES: readonly EventResultSource[] = [
  {
    key: "timu-3960",
    provider: "timu",
    eventId: "event_57082766dc86cb3d705e2c4eebe9599c",
    upstreamEventId: "3960",
    dataMode: "real",
    officialResultsUrl: "https://www.timu.ca/scoreboards/results.php?tid=3960",
  },
  {
    key: "aes-ontario-2026-event-2",
    provider: "aes",
    eventId: "event_070bb34b268b3e11e73be5e4c6444b77",
    upstreamEventId: "MjAyNl9PbnRhcmlvX0NoYW1waW9uc2hpcHNfX19FdmVudF8yX182djZHX19UTFNHX18xNVVCXw2",
    dataMode: "real",
    officialResultsUrl:
      "https://results.advancedeventsystems.com/event/MjAyNl9PbnRhcmlvX0NoYW1waW9uc2hpcHNfX19FdmVudF8yX182djZHX19UTFNHX18xNVVCXw2",
  },
];

export function eventResultSource(
  eventId: string | null | undefined,
  dataMode: string,
  sources: readonly EventResultSource[] = EVENT_RESULT_SOURCES,
): EventResultSource | null {
  const matches = sources.filter((s) => s.eventId === eventId && s.dataMode === dataMode);
  const source = matches.length === 1 ? matches[0] : null;
  return source &&
    validateOfficialResultsUrl(source.officialResultsUrl, source.provider, source.upstreamEventId)
    ? source
    : null;
}
