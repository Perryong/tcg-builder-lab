# Pokémon implementation report

Implemented September 27, 2026, alongside the existing One Piece application.

## Delivered

- English physical catalog: 201 set groups, 21,290 printings, 19,508 remote artwork links. Pocket is excluded. Illustrated library, set browsing, filters, and card detail dialogs expose printed attacks, abilities, evolution and category metadata.
- Independent Pokémon drafts and saves, 60-card construction checks, same-name copy limits, Basic Energy exemption, ACE SPEC and printed exceptions, exact-ID text transfer and verified set-code/number import resolution.
- Competitive evidence: 64 top-16 Masters records from four completed events, 60 fully resolved lists, nine qualitative strategy guides. International and Japan samples remain separate; sample shares show their denominator and original sources.
- Shared game selector preserves drafts. Failed Pokémon data and corrupt Pokémon saves preserve One Piece usability and original storage.

## Decisions and limits

Executed inline in a native managed worktree. Pure deck rules preceded catalog UI so eligibility used the real predicate from the outset. Existing dependencies and image rendering were reused.

The pinned TCGdex repository replaced an unreliable API import. Missing translations, fields and artwork remain unknown. Official numbered set counts differ from alternate-art printings: upstream does not advertise total printing counts, so `totalCount` remains null and imported counts reconcile snapshot records.

Basic Energy recognition is conservative because upstream Normal energy metadata also contains special effects. Standard rules are explicitly unverified: release dates, promo exceptions, errata and complete ban/reprint coverage are not certified. Old cards do not become legal merely by sharing a name. Rules older than 14 days cannot certify legality. Review official tournament rules before competitive play.

Four source lists could not resolve every exact English printing and remain source links rather than substituting cards. Guidance describes strengths, weaknesses and structural observations; it does not invent matchup win rates or global deck popularity. Snapshot refresh commands are manual and documented in README.

## Verification and review

One independent whole-branch review identified two important corrections. The mobile meta table now uses the existing scrolling wrapper; a browser regression failed before the fix and passed afterwards. The shared source-list parser rejects HTTP-success error pages and incomplete lists before publication; its regression also failed before the fix and passed afterwards. A fresh source import retained 64 records and 60 loadable lists.

Final local verification: 36 unit checks passed; production build passed with `/tcg-builder-lab/`; all 10 Playwright flows passed, including existing One Piece behavior, live artwork, game switching, saves, transfer errors, mobile navigation/overflow, corrupt storage and fetch failure isolation. Desktop library and mobile meta screenshots were inspected.

GitHub Actions runs these checks before deploying through the existing Pages workflow. Release completion additionally requires a successful workflow and checks against the public site.

Release verified: application commit `dc0044f` was integrated into main and published successfully by [GitHub Actions run 36315185892](https://github.com/Perryong/tcg-builder-lab/actions/runs/36315185892). Public checks confirmed real Dragapult artwork and effects, deck editing, dated guidance, loading a 60-card list, and switching back to One Piece. A final mobile typography refinement also passed the complete local suite.
