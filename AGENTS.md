<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

## Architecture rules
- Pairing codes, family links and player verification run only in SECURITY DEFINER SQL functions (redeem_code, create_*_code, verify_player); invite_codes has no client access. Why: permission checks must be server-side and atomic.
- Player private data is gated by RLS via can_view_player (self, linked family, managing coach, staff). Why: family must never see unlinked players.
- Every row carries data_mode ('real'|'synthetic') and the UI labels synthetic data. Why: source data and demo data must stay separate.
- Unknown schedule, opponent, venue or placement renders the shared "to be determined" helpers in src/lib/format.ts; never invent values. Why: original product rule.
- Role module visibility, view variants and actions are separate configuration; selected roles are presentation preferences only and actual access remains RLS/RPC-scoped. Why: reusable composition must not grant privileges.
- Official shop records are a checked static catalog with CDN asset pointers and external checkout links. Why: the app must not duplicate store payment or inventory operations.
- Team announcements and private attachments use the same team-scoped authorization and persistent records. Why: a shared public feed must never expose private team content.
- All-results pagination uses a public read-only server function independent of team history and trend state. Why: changing the selected team must not filter the all-team result window.
- Product detail routes unnest from the catalog route. Why: a content-only catalog has no Outlet and must not swallow product detail views.
- Staff role is granted only by a server trigger for confirmed emails in the staff allow-list. Why: on-screen choices and sign-up must never grant privileges.
- Account resolves its code-generation view from the authenticated household verification/team associations; existing RPCs authorize generation. Why: presentation preferences must not expose unauthorized code types.
- Identity approvals are owner-scoped RPCs: managing coaches review players, verified players review family links; only approved links to verified players can read private team content. Existing family links are preserved as approved during the additive transition. Why: redeeming an invitation must not grant private access by itself.
- Announcement audience visibility and ordering use shared pure rules and a shared carousel; expiration hides notices without deleting manager history, while pin/edit/delete writes remain author/team RLS-scoped. Why: home and detail views must agree without scheduled destructive cleanup.
- Explore is a static external-video directory without a competition-data loader. Why: viewing channel shortcuts must not depend on fetching venue or private team data.
