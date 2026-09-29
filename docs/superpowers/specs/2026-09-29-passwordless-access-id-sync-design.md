# Passwordless access ID and deck sync

## Intent and scope

Give a person one transferable ID that reopens their saved decks on another device without an email address or password. This covers the existing One Piece, Pokémon, and Yu-Gi-Oh! builders. Keep the bundled card catalogs, artwork, rules, and meta snapshots on the static site; Supabase stores only personal deck records. Existing browser saves must survive migration and remain useful when the network is unavailable.

The user selected ID-only access and accepted that anyone who knows an ID can open its decks. The application generates a random 192-bit access ID (48 hexadecimal characters); it does not allow short or user-chosen IDs. The ID is a bearer credential despite the absence of a separate password. Losing it and clearing every previously linked browser means there is no recovery method in this release. Sharing it intentionally shares full read/write access. Explain both facts before creation and whenever the ID is shown.

## Approach and alternatives

Use the supplied Supabase project `fxclxyussohwxhamsqxh`. Its publishable key is the only project key used by the static browser app. Supabase Auth anonymous sign-in gives each browser a JWT-backed device identity. A database function creates or redeems the access ID and associates that identity with one account. Row-level security limits deck reads to associated identities, while a checked database function handles saves. This supports access from a new device without exposing broad table access.

A plain, human-chosen ID with public table reads would be easier to type but would make guessing and enumeration practical. Email one-time codes would provide recoverability and stronger ownership proof, but the user chose an ID-only flow. A custom server or Edge Function adds operational work without a current need. The supplied secret key must never enter source, GitHub variables used by browser builds, logs, or the browser bundle; it is not needed for this design. Rotate it because it was shared in conversation.

## Data model and authorization

Add a migration under `supabase/migrations/` with three tables: a restricted account table containing account UUID and SHA-256 hash of the access ID; a membership table mapping account UUIDs to Supabase Auth user UUIDs; and a `saved_decks` table keyed by `(account_id, game, deck_id)` with JSONB payload, revision, and server timestamp. Restrict `game` to the three existing builders. Never store the raw access ID in the database. Bound payload size and validate game/deck identity at the save boundary.

`create_access_id()` generates the ID with PostgreSQL cryptographic randomness, stores only its hash, links the caller's anonymous-auth UUID, and returns the ID once. `redeem_access_id(id)` accepts only the exact generated format, hashes it, and links the caller to the matching account. Both functions require the `authenticated` role, verify `auth.uid()` is present, use `SECURITY DEFINER` only for the restricted account/membership operation, have an empty search path with schema-qualified references, and expose no account enumeration. Revoke default function execution from public/anon and grant only the required calls.

Enable row-level security on every new public table. Browser roles get no direct access to account hashes and no insert/update/delete access to membership. Membership reads, if needed by a policy, expose only the caller's membership. Deck SELECT is limited to accounts linked to `auth.uid()`. A `save_deck(...)` function checks membership and uses an expected revision for atomic insert/update; a stale revision returns a conflict rather than replacing remote data. Browser roles have no direct deck-write grant. Test both grants and RLS with two distinct anonymous users and an unauthenticated request. Do not rely on anonymity alone for authorization: anonymous Auth users have the `authenticated` database role.

## Client and data flow

Add one account control at the application level: Create access ID, Enter access ID, Copy/show current ID, sync status/retry, and Sign out. A saved anonymous session restores the linked account after reload on the same browser. The raw ID may be kept in that browser's account-scoped local storage while signed in so it can be copied later; clear it on sign-out. Do not place it in URLs, analytics, error messages, or logs. A new device creates its own anonymous Auth session and redeems the ID. Unknown or malformed IDs leave current local decks and session untouched and display a non-enumerating error.

Keep the existing per-game storage validators and explicit Save buttons. Signed-out saves remain local-only. On first link, read all three local collections, validate them, fetch cloud records, and merge by game and deck ID. Identical decks deduplicate. If the same ID contains different content, retain the cloud version and give the local version a fresh deck ID and a visible “from this device” label. Upload local-only records, then show the merged lists. Never silently overwrite remote data or discard a dirty open draft. A damaged local or cloud record is reported and preserved in place rather than uploaded or replaced.

When signed in, Save first updates the account-scoped local cache and pending-sync record, then sends that deck to Supabase with the last known revision. Successful acknowledgement clears the pending marker. Offline or server failure keeps the deck and retry marker locally and shows “Saved on this device; waiting to sync.” Reconnect, reload, or Retry sync processes pending records. A stale remote revision preserves both versions by saving the local edit as a new deck, with a visible notice. The catalog and meta fetches continue to work independently of Supabase failures. Switching games does not change the account or lose a draft. Sign-out returns the UI to its preexisting local-only collections and warns if pending changes have not synced.

## Deployment and verification

Use the installed Supabase CLI's authorized project connection to apply the reviewed migration. Configure the publishable key as a GitHub Actions build variable and a local ignored environment variable; it is safe in the browser only because grants and RLS enforce access. Add no service-role/secret key to client configuration. Enable anonymous Auth in project settings, and confirm the project accepts anonymous sign-ins before enabling the UI on the public Pages site.

Focused tests cover generated-ID shape, create/redeem, wrong-ID denial, unauthorized cross-account reads/writes, cache merge and conflict copies, corruption preservation, and pending-sync retry. Browser tests cover create, reload, a second isolated browser entering the ID, decks in all three games, sign-out, offline save, and existing builder flows. Verify the production Pages workflow and public site. Document setup, threat model, and the no-recovery limitation without including any credential value.

## Source constraints

- Supabase anonymous Auth issues a per-device authenticated identity but cannot itself restore an account on another device: https://supabase.com/docs/guides/auth/auth-anonymous
- Published client keys require RLS and least-privilege grants; secret keys bypass RLS: https://supabase.com/docs/guides/database/secure-data
- RLS, grants, and membership policy rules: https://supabase.com/docs/guides/database/postgres/row-level-security
- Restrict `SECURITY DEFINER` functions and set an empty search path: https://supabase.com/docs/guides/database/functions
