# Username-only deck access

## Intent and success criteria

Replace the generated access-ID workflow with a username people choose and type whenever they need to open their cloud decks on a different or signed-out browser. One field and one Continue action either open an existing username or create it if unused. The current browser may resume its session after reload until Sign out. No email, password, code, or second identifier is required for normal use. One Piece, Pokémon, and Yu-Gi-Oh! decks continue to share the account while remaining separate by game.

The user approved preserving existing access-ID decks. A browser already linked to an old account can claim a username without moving or rewriting its decks. Someone who signed out but still has the old ID can use a secondary, clearly labeled migration form, then claim a username. Guest decks and pending local saves retain the merge, conflict, and offline behavior of the current implementation.

This is deliberately not private authentication. Anyone who knows or guesses a username can open and edit its decks; common names are especially easy to discover. The UI must say this next to the username field and when signed in. There is no ownership recovery or revocation in this design. Do not describe a username as a secret or as protecting decks.

## Approach and alternatives

Keep the existing Supabase anonymous Auth session, account UUID, membership table, deck table, RLS, revisioned save RPC, and account-scoped local cache. Add a normalized username to the private account table and an RPC that creates or opens the account atomically. This changes the account locator while minimizing changes to deck storage and sync.

A username alias that still asks for the old ID would preserve the old security model but fail the requested one-field access. A browser-only username would be shorter to implement but could not load decks across devices. Email one-time codes would verify ownership, but the user explicitly wants username-only access. These alternatives are out of scope.

## Username and database behavior

Normalize input by trimming surrounding whitespace and lowercasing ASCII. Accept 3–24 characters from `a-z`, `0-9`, and `_`; reject everything else on both client and server. Store only the normalized form and enforce uniqueness with a database constraint. Thus `Perry_1` and `perry_1` open the same account. The form shows the allowed characters, labels names as case-insensitive, and uses `autocomplete="username"`.

Add a nullable `username` column to `private.access_accounts`. Existing rows have no username until claimed. Allow `access_hash` to be null for new username accounts; retain old hashes on legacy rows. A constraint prevents a row with neither locator. `open_username(p_username)` requires a Supabase Auth user, validates the normalized name, inserts a new account if it is unused or selects the existing account if it is used, and links the caller in `account_memberships`. A uniqueness race must resolve to the same account, not create two. Return account UUID, normalized username, and whether the account was newly created, never account hashes.

`claim_username(p_account_id, p_username)` requires the caller to be a member of that account and assigns an unused username only if the account has none. A taken name reports a clear error and does not link the legacy decks to the other account. `account_username(p_account_id)` requires membership and returns the current username or null, so an already-linked browser can resume and know whether it needs a claim. Keep `redeem_access_id` for the migration form and compatibility with old clients. An old ID remains a working alternate locator during this compatibility period; claiming a username does not revoke it. Stop exposing ID creation in the new UI; the existing server function remains callable during rollout to avoid breaking cached old clients. No raw ID enters new username accounts, URLs, analytics, or logs.

All new or changed RPCs require `authenticated`, check `auth.uid()`, use a pinned empty search path with schema-qualified references, and have execute grants limited to that role. Browser roles cannot select private accounts or write memberships/decks directly. Existing `saved_decks` RLS and `save_deck` membership/revision checks remain in force. These controls prevent a browser from reading an account it has not opened, but opening any known username intentionally grants access. The UI must not imply otherwise.

## Client flow and errors

When signed out, show one username input and Continue button. A valid unused name creates an empty account; a valid existing name opens its decks. Show a clear “new username created” notice when the RPC reports creation, so a typo does not look like missing cloud data. Invalid names, network failures, or malformed server responses leave the current guest decks and account-scoped cache unchanged. The legacy migration form is behind “Have an old access ID?” and never generates a new ID. After redemption, the UI prompts to claim a username before treating migration as complete. The user can retry a failed claim or sign out; existing decks remain under the same account UUID.

When signed in, show the current username, cloud sync state, Retry sync when needed, and Sign out. A legacy account without a username shows the claim form in place of a username. Local storage keeps the active account UUID and normalized username for display; startup verifies membership through the RPC before trusting the label. Clear these markers on Sign out but retain pending account-scoped deck data so reopening the same username can sync it. Remove the old raw access-ID local-storage entry when a username is claimed or on sign-out. Switching accounts must clear in-memory revisions and collections before loading the next account so stale decks cannot appear under a different username.

Saving, merging guest decks, conflict copies, offline queuing, reconnect retry, and corruption preservation continue to use the existing account UUID and game keys. Before the first guest-deck import into any username, ask the user to confirm the exact destination name; a mistyped username must not silently upload local decks to someone else's account. Declining keeps guest decks untouched and leaves an “Import this device's decks” action available later. A fresh browser typing the same username sees all synced decks; the original browser's unsaved draft is not silently replaced. A username collision during claiming reports that the name is in use and leaves the old account untouched. Do not promise that a newly entered username belongs to the person typing it.

## Verification and rollout

Add pgTAP coverage for validation, case folding, create/open from distinct anonymous users, concurrent creation, claim authorization and duplicate rejection, direct-table denial, and old ID migration. Browser tests cover the single-field flow, reload, a second isolated browser, all three games, sign-out/re-entry, legacy claim, confirmed/declined guest import, offline retry, conflict copies, narrow screens, and invalid input without data loss. Keep the existing deck and artwork tests.

Deploy the additive database migration before the UI; old clients continue working during rollout. Verify the hosted project with two fresh browser sessions and an unauthorized direct-table access check. Keep GitHub Pages build variables limited to the Supabase URL and publishable key; no secret/service-role key is needed. Update README and visible copy to explain that usernames are guessable shared edit handles, and document the legacy migration path. Publish only after local and CI tests pass; check the live Pages site after deployment.

## Source constraints

- Supabase anonymous users have the authenticated database role: https://supabase.com/docs/guides/auth/auth-anonymous
- RLS requires appropriate grants and policies; membership still scopes direct deck reads: https://supabase.com/docs/guides/database/postgres/row-level-security
- `SECURITY DEFINER` functions must pin `search_path` and qualify object names: https://supabase.com/docs/guides/database/functions
