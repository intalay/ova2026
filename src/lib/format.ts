export const TZ = "America/Toronto";
export const TBD = "To be determined";

export function formatDateTime(iso: string | null | undefined, fallbackDate?: string | null): string {
  if (!iso) {
    if (!fallbackDate) return `Date ${TBD.toLowerCase()}`;
    return `${formatDate(fallbackDate)} · time ${TBD.toLowerCase()}`;
  }
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ, weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit",
  }).format(new Date(iso));
}

export function formatDate(d: string | null | undefined): string {
  if (!d) return `Date ${TBD.toLowerCase()}`;
  const date = d.length === 10 ? new Date(`${d}T12:00:00Z`) : new Date(d);
  return new Intl.DateTimeFormat("en-CA", { timeZone: TZ, weekday: "short", month: "short", day: "numeric", year: "numeric" }).format(date);
}

/** Today's date (YYYY-MM-DD) in Toronto. */
export function torontoToday(now = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}

/** Calendar shows the current month plus the following two months. */
export function calendarMonths(now = new Date()): { year: number; month: number }[] {
  const [y, m] = torontoToday(now).split("-").map(Number);
  return [0, 1, 2].map((offset) => {
    const idx = m - 1 + offset;
    return { year: y + Math.floor(idx / 12), month: (idx % 12) + 1 };
  });
}

export function teamLabel(name: string | null | undefined): string {
  return name ?? `Opponent ${TBD.toLowerCase()}`;
}
