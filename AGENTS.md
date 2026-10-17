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
