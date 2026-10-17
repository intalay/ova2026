export const MAX_PINNED_ANNOUNCEMENTS = 3;
type AnnouncementState = { id: string; status: string; pinned_at: string | null; published_at: string | null };
export function sortAnnouncements<T extends AnnouncementState>(items: T[]): T[] {
  return [...items].sort((a,b) => {
    if (!!a.pinned_at !== !!b.pinned_at) return a.pinned_at ? -1 : 1;
    return (b.pinned_at ?? b.published_at ?? '').localeCompare(a.pinned_at ?? a.published_at ?? '');
  });
}
export function audienceAnnouncements<T extends AnnouncementState>(items: T[], now = Date.now()): T[] {
  return sortAnnouncements(items.filter(a => a.status === 'published' && (a.pinned_at !== null || (a.published_at !== null && Date.parse(a.published_at) > now - 24 * 60 * 60 * 1000))));
}
export function canPinAnnouncement(pinnedCount: number): boolean { return pinnedCount < MAX_PINNED_ANNOUNCEMENTS; }