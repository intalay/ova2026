import type { AppRole } from './modules';

export type SignupRole = Exclude<AppRole, 'general_user'>;
export type PendingSignup = { role: SignupRole; email: string; userId: string | null };
const key = 'ova-pending-signup';
export function signupRole(value: unknown): SignupRole | null {
 return value === 'player' || value === 'coach' || value === 'family_friends' ? value : null;
}
export function readPendingSignup(): PendingSignup | null {
 try {
  const value = JSON.parse(localStorage.getItem(key) ?? 'null');
  const role = signupRole(value?.role);
  return role && typeof value.email === 'string' && (value.userId === null || typeof value.userId === 'string')
   ? { role, email: value.email, userId: value.userId } : null;
 } catch { return null; }
}
export function rememberSignup(value: PendingSignup) {
 try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* optional storage */ }
}
export function clearSignup() {
 try { localStorage.removeItem(key); } catch { /* optional storage */ }
}
// A role is a setup preference only. Existing RLS/RPC checks still decide access.
export function confirmedSignupRole(user: { id: string; email?: string; email_confirmed_at?: string; user_metadata?: Record<string, unknown> } | null, pending: PendingSignup | null): SignupRole | null {
 if (!user?.email_confirmed_at) return null;
 if (pending) {
  if (pending.email.toLowerCase() !== user.email?.toLowerCase() || (pending.userId && pending.userId !== user.id)) return null;
  return pending.role;
 }
 return signupRole(user.user_metadata?.signup_role);
}