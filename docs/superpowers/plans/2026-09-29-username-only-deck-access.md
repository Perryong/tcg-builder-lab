# Username-Only Deck Access Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace generated access IDs with a username that creates or opens the same cloud decks across devices, while preserving existing access-ID accounts.

**Architecture:** Supabase anonymous Auth still identifies each browser. Three narrowly granted RPCs create/open a normalized username, claim one for an existing account, and read the current account's username; account UUIDs, memberships, RLS, revisioned deck saves, and account-scoped caches remain. The React account UI becomes a username form with a legacy-ID migration path, and guest decks import only after confirming the destination username.

**Tech Stack:** React 19, TypeScript, Vite 8, `@supabase/supabase-js`, Supabase Postgres/pgTAP/CLI, Node test runner, Playwright, GitHub Pages.

**Spec:** `docs/superpowers/specs/2026-09-29-username-only-deck-access-design.md`

## Global Constraints

- Project ref `fxclxyussohwxhamsqxh`; browser and Actions use only URL and publishable key. Never use, print, or commit the supplied secret key.
- Username input is trimmed, lowercased ASCII, and must match `^[a-z0-9_]{3,24}$` on client and server. Store only normalized names; `Perry_1` and `perry_1` identify the same account.
- Anyone who knows or guesses a username can read and edit its decks. Do not claim privacy, ownership, recovery, or revocation; keep this warning visible in signed-out and signed-in states.
- Keep all three existing game validators, account UUID cache keys, explicit Save buttons, pending queue, revision conflict copies, and guest-storage byte preservation on parse failure.
- Existing access-ID accounts can claim one username without moving deck rows; the old ID remains valid through the compatibility RPC during this rollout. Do not expose creation of new IDs in the new UI.
- Local account tests use the isolated Supabase API at `http://127.0.0.1:54521` and an ignored `.env.local` containing only its URL and publishable key; never point ordinary tests at the hosted project.
- No new dependency, server, Edge Function, direct browser table write, or service-role key. Database migration precedes frontend deployment.

## Review Focus

1. A mistyped username may open or create a different account; existing guest decks must not upload until the exact destination is confirmed. Task 3's decline/confirm browser tests pin this.
2. Two browsers opening the same new name at once must get one account; mixed case must not create another. Task 1 pgTAP and Task 4 concurrent-browser checks pin this.
3. Claiming a taken username must leave the legacy account and decks untouched. Tasks 1 and 2 test this from distinct Auth users.
4. Sign-out or switching usernames must not show the previous account's cached decks or stale revision map. Task 2 browser tests pin this.
5. An unlinked Auth user must not read/write a known account UUID directly, while typing its username intentionally grants membership. Task 1 SQL and Task 4 hosted checks pin both sides.

## File map

- `supabase/migrations/20260929120000_username_accounts.sql`: nullable normalized username, compatible legacy locator, three username RPCs, scoped grants.
- `supabase/tests/username_accounts.test.sql`: validation, case folding, two-user access, claim, direct-table denial, legacy compatibility.
- `src/account/username.ts`: one client-side normalization/validation function; no new dependency.
- `src/account/AccountProvider.tsx`: username/legacy account lifecycle, verified resume, account switch, and existing deck sync.
- `src/account/AccountControls.tsx`: one-field username entry, legacy migration, claim, status, warning, and guest-import action.
- `tests/account-username.test.ts`: username normalization inputs and errors.
- `tests/e2e/account.spec.ts`: browser journeys for username, legacy claim, guest import, all games, offline and conflicts.
- `README.md`: new user flow, public-edit limitation, old-ID migration, and deployment behavior.
- `.github/workflows/pages.yml`: retain the existing isolated Supabase gate; change only if the new test needs a justified CI adjustment.

### Task 1: Username database contract

**Files:** Create `supabase/migrations/20260929120000_username_accounts.sql` and `supabase/tests/username_accounts.test.sql`.

**Interfaces:** `public.open_username(p_username text) → TABLE(account_id uuid, username text, created boolean)`; `public.claim_username(p_account_id uuid,p_username text) → text`; `public.account_username(p_account_id uuid) → text|null`. Existing `public.redeem_access_id(text)`, `public.save_deck(...)`, `public.saved_decks`, and account UUIDs are unchanged.

- [ ] **Step 1: Write failing pgTAP assertions** that `Perry_1` and `perry_1` give the same UUID across two Auth users; new name returns `created=true` once; invalid short, overlong, and punctuation names fail; unauthenticated callers cannot execute; an unlinked user cannot claim/read another account; claiming an old-ID account preserves its UUID/deck, rejects an already used name, and cannot be renamed; direct account-table access remains denied.
- [ ] **Step 2: Run `supabase start --exclude realtime,storage-api,imgproxy,mailpit,postgres-meta,studio,edge-runtime,logflare,vector,supavisor` and `supabase test db`; confirm the new tests fail** because the username column and RPCs do not exist. Use the repo's configured 5452x local ports.
- [ ] **Step 3: Implement the migration.** Make `private.access_accounts.access_hash` nullable; add unique nullable `username` with database validation and a constraint requiring at least one locator. Use `INSERT ... ON CONFLICT (username) DO NOTHING` followed by SELECT so concurrent opens converge. All functions require `auth.uid()`, use `SECURITY DEFINER SET search_path = ''` with schema-qualified references, and grant EXECUTE only to `authenticated`; preserve existing deck grants/RLS and legacy functions.
- [ ] **Step 4: Run `supabase test db` and `supabase db lint`; require the new and existing SQL tests green and correct actionable lint findings.**
- [ ] **Step 5: Commit** the migration and SQL tests (`git commit -m "Add username account lookup and claim RPCs"`).

### Task 2: Username and legacy account entry

**Files:** Create `src/account/username.ts`, `tests/account-username.test.ts`; modify `src/account/AccountProvider.tsx`, `src/account/AccountControls.tsx`, `tests/e2e/account.spec.ts`.

**Interfaces:** `normalizeUsername(input:string):string` returns the normalized valid name or throws a user-facing validation error. `useAccount()` replaces `accessId/createAccount/enterAccessId` with `username:string`, `needsUsername:boolean`, `createdNotice:boolean`, `continueWithUsername(name:string):Promise<void>`, `redeemLegacyId(id:string):Promise<void>`, and `claimUsername(name:string):Promise<void>`; existing `accountId/status/error/collections/saveDeck/retry/signOut` remain. Task 3 extends this context with guest-import controls.

- [ ] **Step 1: Write failing unit and browser tests.** Unit cases cover whitespace, case folding, valid underscores, short/long/punctuated input. Browser cases cover new name creation notice, reload, a second context opening the same mixed-case name, invalid input without account/cache mutation, a legacy ID claim retaining a saved deck, taken-name claim rejection, and sign-out/re-entry without stale previous-account collections.
- [ ] **Step 2: Run `node --test tests/account-username.test.ts` and the targeted `tests/e2e/account.spec.ts` cases; confirm RED.** Update old ID-focused tests to exercise the username flow rather than deleting their deck-sync assertions.
- [ ] **Step 3: Implement the provider and controls using Task 1 RPCs.** Keep anonymous Auth, UUID cache keys, deck upload/retry, and the existing `saveDeck` contract. Verify current account membership/username on reload through `account_username`; a null name shows claim UI. A legacy ID is accepted only in the secondary migration form. Do not automatically import guest decks in this task; they stay untouched until Task 3. Clear in-memory collections/revisions on account switch and raw-ID local storage on claim/sign-out. Show the guessable shared-edit warning in both account states.
- [ ] **Step 4: Run targeted unit/browser tests, `npm test`, and `npm run build`; require GREEN.**
- [ ] **Step 5: Commit** (`git commit -m "Open cloud decks by username and migrate legacy IDs"`).

### Task 3: Confirm guest-deck import and preserve sync behavior

**Files:** Modify `src/account/AccountProvider.tsx`, `src/account/AccountControls.tsx`, `tests/e2e/account.spec.ts`.

**Interfaces:** Extend `useAccount()` with `guestImportAvailable:boolean` and `importGuestDecks():Promise<void>`. The import is scoped to the active account UUID and displays its normalized username in the confirmation. The existing `mergeDecks`, `writeAccountCache`, and pending queue remain the sole merge/write path.

- [ ] **Step 1: Write failing browser tests.** A browser with guest One Piece and Pokémon decks opens a mistyped/new username and declines import: guest storage bytes and that account's cloud rows remain unchanged; “Import this device's decks” remains available. Reopen the intended username, confirm import with its exact name, and prove a second browser sees both games. A corrupt guest record blocks upload without overwriting its bytes; dirty open drafts stay unchanged.
- [ ] **Step 2: Run the targeted browser tests; confirm RED.**
- [ ] **Step 3: Implement an explicit guest-import gate.** On first link, load cloud/account cache without guest merge; only `importGuestDecks()` invokes the existing per-game validation/merge and queues uploads after the user confirms the destination. Decline does not mark import complete. Retain the import action until success and prevent duplicate imports after reload. Continue offline retry/conflict behavior for already account-scoped saves.
- [ ] **Step 4: Run targeted account browser tests and the existing One Piece, Pokémon, and Yu-Gi-Oh! browser suites; require GREEN.**
- [ ] **Step 5: Commit** (`git commit -m "Confirm username before importing guest decks"`).

### Task 4: Release and hosted verification

**Files:** Modify `README.md`, `tests/e2e/account.spec.ts`, and `.github/workflows/pages.yml` only if the existing CI gate needs adjustment; inspect all changed SQL and account files.

**Interfaces:** GitHub Pages still receives only `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY`; `supabase test db` and isolated account browser tests remain deployment gates. Apply the Task 1 migration before publishing the username UI.

- [ ] **Step 1: Complete account browser coverage** for two simultaneous first opens of one username, cross-game round-trips, offline Save/reload/retry, concurrent edits/conflict copies, sign-out with pending work, mobile controls, and no old-ID creation button. Run targeted tests and require GREEN.
- [ ] **Step 2: Update README** for single-field username use, guessable shared edit access, no recovery/revocation, confirmed guest import, old-ID migration, and public-key-only configuration. Keep CI database job working with the new migration; avoid unrelated workflow changes.
- [ ] **Step 3: Run `npm test`, `supabase test db`, `npm run build -- --base=/tcg-builder-lab/`, and `PLAYWRIGHT_PREVIEW=1 CI=1 ACCOUNT_TEST_SUPABASE_URL=http://127.0.0.1:54521 ACCOUNT_TEST_DB_CONTAINER=supabase_db_tcg-game-builder npm run test:e2e`; require all green.** Before the build, write the isolated stack's API URL and publishable key from `supabase status -o json` into ignored `.env.local` without printing the full status or any secret. Scan tracked files and built assets for secret-shaped values; review RLS grants, RPC search paths, wrong-account cache use, corrupted data handling, and the guest-import confirmation boundary.
- [ ] **Step 4: Commit the release changes, then obtain one independent whole-branch code/security review.** Fix Critical/Important findings with failing-then-passing tests and rerun the full suite before deployment.
- [ ] **Step 5: Inspect hosted migration history and dry-run the push; apply only the username migration to project `fxclxyussohwxhamsqxh`.** Prior unrelated remote migrations may need a temporary untracked fetch and `--include-all`; never commit those files. Test two hosted browser sessions for create/open, legacy claim, all three games, and direct cross-account denial. Do not use production data for corruption injection.
- [ ] **Step 6: Integrate the verified branch into `main`, push, watch the Pages workflow, and verify the public site in two fresh browser contexts.** Report revision, CI result, deployment URL, and the username-only access limitation.

## Final handoff

Create an isolated worktree at execution time. Each task ends with its named checks and a commit. Deployment is blocked by failed SQL authorization tests, lost guest or pending saves, an unconfirmed guest upload, or a failing CI gate. The old access-ID RPC remains a compatibility path for this release and can be retired in a separately reviewed migration after old clients are no longer in use.
