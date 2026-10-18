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
- Mobile sizing uses AppShell classes, mobile spacing/type tokens and scoped overrides. Why: preserve desktop sizing, role palettes and behavior.
- Coach and Player homepage visual overrides stay isolated under role-gated wrappers (.coach-invert, .player-green) with dedicated tokens: coach inverts black/white, player uses a brand-green stage with white info cards. Why: shared homepage modules and navigation must retain their existing presentation for every other role and route.
- Lottery effects, colours and typography use page-scoped tokens. Why: global theme changes must preserve its dedicated presentation.
- Uploaded fonts use CDN assets and local font-face sheets imported by the theme; body, display, section and score tokens remain separate, heavy faces opt-in. Why: change typography without harming readability or embedding binaries.
- Homepage match cards use the optional compact MatchCard variant and HomeLine container fitting; other match views keep their existing layout. Why: complete single-line homepage information must fit without changing schedules or hiding unknown values.
- Venue detail and Homepage share exact-name source-checked CDN media via venue-media and official links; unknown venues have fallbacks, OpenStreetMap remains interactive and parking uses recorded information only. Why: avoid unrelated buildings or fabricated location details.
- Explore uses a checked full public YouTube catalogue with CDN thumbnail atlases and a public read-only CBC listing server function; CBC source status and member restrictions remain explicit. Why: no API secrets, invented events, or privileged data are needed for public viewing discovery.
- Pairing codes, family links and player verification run only in SECURITY DEFINER SQL functions (redeem_code, create_*_code, verify_player); invite_codes has no client access. Why: permission checks must be server-side and atomic.
- Player private data is gated by RLS via can_view_player (self, linked family, managing coach, staff). Why: family must never see unlinked players.
- Every row carries data_mode ('real'|'synthetic') and the UI labels synthetic data. Why: source data and demo data must stay separate.
- Unknown schedule, opponent, venue or placement renders the shared "to be determined" helpers in src/lib/format.ts; never invent values. Why: original product rule.
- Role configuration is presentation-only; RLS/RPC controls access. Account and Home share the household-based family restoration resolver, preserving authorized player/coach choices. Why: missing preferences must neither strand approved families nor grant access.
- Official shop records are a checked static catalog with CDN asset pointers and external checkout links. Why: the app must not duplicate store payment or inventory operations.
- Team announcements and private attachments use the same team-scoped authorization and persistent records. Why: a shared public feed must never expose private team content.
- Announcement pin limits and pin timestamps are enforced by a database trigger and owner-scoped RPC; all audience displays share sorting and expiry helpers. Why: client choices cannot bypass limits or diverge across pages.
- Public team analysis has an independent source selector; DEV fixtures fill empty Demo teams only, outside caches. Trends aggregate dates. Why: preserve identity isolation and avoid fabricated intraday ordering or silent demo substitution.
- Product detail routes unnest from the catalog route. Why: a content-only catalog has no Outlet and must not swallow product detail views.
- Staff role is granted only by a server trigger for confirmed emails in the staff allow-list. Why: on-screen choices and sign-up must never grant privileges.
- Coach applications collect identity details through submit_coach_application; email is taken from the authenticated claim and team name from the team record, and staff approval rejects incomplete applications. Why: applicants cannot spoof the account contact or bypass required review details.
- Account resolves its code-generation view from the authenticated household verification/team associations; existing RPCs authorize generation. Why: presentation preferences must not expose unauthorized code types.
- Identity approvals are owner-scoped RPCs: managing coaches review players, verified players review family links; only approved links to verified players can read private team content. Existing family links are preserved as approved during the additive transition. Why: redeeming an invitation must not grant private access by itself.

- Startup uses an SSR-safe root overlay with a one-shot timer and CSS motion while routes load underneath. Why: navigation must not replay it or change identity logic.
- Portraits scale to panels; announcements use fixed previews. Why: text length cannot alter proportions.
- Signup drafts are account-bound; auth metadata is presentation only. Account checks getUser email confirmation and shares the session listener before resuming setup. Why: cross-tab recovery must not grant approval.
