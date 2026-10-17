// Friendly client-side check only; the real gate is the server-side allow-list trigger.
export const STAFF_EMAILS = ["395945526@qq.com"];
export function isStaffEmailAllowed(email: string) {
  return STAFF_EMAILS.includes(email.trim().toLowerCase());
}
