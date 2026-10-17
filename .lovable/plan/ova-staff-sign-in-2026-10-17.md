# OVA Staff sign-in

## What you will see
- The "OVA Staff — verify coaches" button on the Account page opens a dedicated **OVA Staff sign-in** screen (staff page when signed out).
- The screen has Sign in and Create staff account, email + password, and "Forgot password?".
- **Only 395945526@qq.com can create a staff account.** Any other email is refused with "This email is not authorized for OVA staff access" and no account is created.
- After creating the account, the owner of 395945526@qq.com must click the confirmation email. Only after that does the account become staff and see coach applications (Approve / Reject), player verification, announcements and roster import.
- Signed in as a non-staff account, the page says staff access is not granted and offers Sign out.

## Rules
- Staff permission is granted only on the server, only to that exact email, and only after its email is confirmed. Typing that email on the form without owning the mailbox does not grant access.
- Picking "Staff" on screen never grants permission by itself.

## Technical details
- Database: a SECURITY DEFINER trigger function on auth users (insert + email_confirmed_at update) that inserts `staff` into `user_roles` when lower(email) = '395945526@qq.com' and email is confirmed. If the account already exists and is confirmed, backfill the role in the same migration.
- Staff allow-list kept in a small `staff_allowlist` table (no client access) so the email can be changed later without code edits; seeded with the one email.
- Client: `src/routes/staff.tsx` signed-out state renders the staff form; sign-up checks the email client-side for the friendly message (server trigger is the real gate). Email redirect returns to `/staff`.
- Test: `isStaffEmailAllowed` helper test asserting the allowed email passes (case-insensitive) and another email fails.
- AGENTS.md: record "staff role is granted only by server trigger from a verified allow-listed email".
- Memory: record the staff email allow-list requirement.
