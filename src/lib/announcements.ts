export const ANNOUNCEMENT_LIFETIME_MS = 24 * 60 * 60 * 1000;
export type AnnouncementState = { id: string; status: string; pinned: boolean; published_at: string | null };
export function announcementVisible(a: AnnouncementState, now: number, manager = false) {
  if (a.status !== 'published') return false;
  if (manager || a.pinned) return true;
  if (!a.published_at) return false;
  const published = Date.parse(a.published_at);
  return published <= now && now < published + ANNOUNCEMENT_LIFETIME_MS;
}
export function orderAnnouncements<T extends AnnouncementState>(items: T[]) {
  return [...items].sort((a,b) => Number(b.pinned)-Number(a.pinned) || (Date.parse(b.published_at ?? '') || 0)-(Date.parse(a.published_at ?? '') || 0));
}