# Passwordless Access ID and Deck Sync Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a person reopen their saved One Piece, Pokémon, and Yu-Gi-Oh! decks on another device using one generated access ID, without email or password.

**Architecture:** Supabase anonymous Auth identifies each browser; restricted SQL functions issue/redeem a 192-bit access ID and save revisioned decks. RLS allows only linked Auth users to read an account's decks. Existing browser storage remains the guest cache and signed-in decks use account-scoped cache plus a retry queue.

**Tech Stack:** React 19, TypeScript, Vite 8, `@supabase/supabase-js` (new runtime dependency for Auth/session refresh and Data API), Supabase Postgres/pgTAP/CLI, Node test runner, Playwright, GitHub Pages.

**Spec:** `docs/superpowers/specs/2026-09-29-passwordless-access-id-sync-design.md`

## Global Constraints

- Project ref: `fxclxyussohwxhamsqxh`; browser uses the publishable key only. Never print, commit, deploy, or call the supplied secret key.
- Access IDs are generated 192-bit/48-hex bearer credentials, not user-chosen; anyone holding one has full read/write access. There is no recovery after losing the ID and all linked browser sessions.
- Only personal deck data goes to Supabase; bundled card catalogs and rules remain on GitHub Pages.
- Preserve all existing guest storage formats/bytes on parse failure. Never replace a dirty draft or a differing cloud deck silently.
- Every account-scoped write must verify membership and expected revision. Offline saves remain local with a durable pending marker and explicit status.
- No new backend, Edge Function, generic TCG rules engine, or service-role key. Keep the three existing game validators and save buttons.

## Review Focus

1. A valid-looking but wrong access ID must reveal no account existence or deck data; Task 1 SQL tests and Task 3 client tests pin this.
2. A second anonymous Auth user must not read/write another account through direct table calls or forged RPC account IDs; Task 1 tests pin this.
3. JSONB key ordering must not duplicate logically identical decks; Task 2 canonical-comparison test pins this.
4. Corrupt local or cloud data must remain untouched and must not be uploaded; Tasks 2 and 4–6 tests pin this.
5. Offline save followed by reload and a concurrent edit must retain both user edits; Task 2 and Task 7 browser tests pin this.

## File map

- `supabase/config.toml`: local Supabase project with anonymous Auth enabled.
- `supabase/migrations/20260929000000_access_id_decks.sql`: tables, grants, RLS and the three narrowly scoped RPCs.
- `supabase/tests/access_id_decks.test.sql`: two-user/unauthenticated authorization and revision tests.
- `src/account/sync.ts`: typed game/deck mapping, canonical deck comparison, merge and account-scoped cache/pending-record helpers; pure logic where possible.
- `src/account/client.ts`: Supabase browser client and project configuration; exports one initialized client or an explicit local-only state.
- `src/account/AccountProvider.tsx`: session/account lifecycle, cloud load/save/retry, guest-to-account migration and context consumed by builders.
- `src/account/AccountControls.tsx`: account ID/create/redeem/copy/sign-out and sync status UI.
- `src/App.tsx`: wraps all three screens in the provider and displays account controls once.
- `src/{deck.ts,OnePieceApp.tsx,pokemon/deck.ts,pokemon/PokemonApp.tsx,yugioh/deck.ts,yugioh/YugiohApp.tsx}`: reuse validators and connect each explicit save/list to the account context.
- `tests/account-sync.test.ts`, `tests/account-client.test.ts`, `tests/e2e/account.spec.ts`: pure merge/config cases and browser account journeys. Existing game tests remain intact.
- `.github/workflows/pages.yml`, `.gitignore`, `README.md`: build configuration, ignored local env, and deployment/user setup.

### Task 1: Database access contract

**Files:** Create `supabase/config.toml`, `supabase/migrations/20260929000000_access_id_decks.sql`, and `supabase/tests/access_id_decks.test.sql`.

**Interfaces:** `public.create_access_id() → (account_id uuid, access_id text)`; `public.redeem_access_id(access_id text) → account_id uuid`; `public.save_deck(account_id uuid, game text, deck_id text, payload jsonb, expected_revision bigint) → revision bigint`. Client reads `public.saved_decks(account_id,game,deck_id,payload,revision,updated_at)`.

- [ ] **Step 1: Run `supabase init` and set `[auth] enable_anonymous_sign_ins = true` in `supabase/config.toml`.** This initializes the local test stack; it does not link or modify the remote project.
- [ ] **Step 2: Write failing pgTAP tests** for 48-hex creation (`is(length(access_id), 48, 'generated ID length')`), redemption from a second Auth user, malformed/wrong ID generic denial, no anonymous-role access, no cross-account table read/direct write/forged RPC save, valid insert/update, stale revision rejection, invalid game, mismatched payload ID and oversized payload rejection.
- [ ] **Step 3: Run `supabase start && supabase test db`; confirm the tests fail** because tables/functions do not exist. `supabase` and Docker are installed on the host.
- [ ] **Step 4: Add migration** with a hash-only account table, Auth-user memberships, and one row per `(account_id,game,deck_id)`; enable RLS, revoke browser write grants, grant membership-scoped SELECT, and implement the three `SECURITY DEFINER SET search_path = ''` RPCs with schema-qualified relations and restricted EXECUTE. Generate ID via cryptographic random bytes. `save_deck` checks the caller's membership before mutation and atomically compares `expected_revision` (zero means insert).
- [ ] **Step 5: Run `supabase test db`; require all authorization/revision tests green.** Inspect `supabase db lint` output where available and correct actionable warnings.
- [ ] **Step 6: Commit** migration and SQL tests (`git commit -m "Add scoped access ID and deck storage schema"`). Do not push the migration to the remote project until the client and release checks are ready.

### Task 2: Merge and durable local queue

**Files:** Create `src/account/sync.ts`; modify the three deck modules to export their existing deck-shape validators; add `tests/account-sync.test.ts`.

**Interfaces:** `Game = 'onepiece'|'pokemon'|'yugioh'`; `DeckByGame = {onepiece:Deck;pokemon:PokemonDeck;yugioh:YugiohDeck}`; `mergeDecks<T extends {id:string;name:string}>(local:T[],remote:T[],newId:()=>string):{decks:T[];uploads:T[];conflicts:number}`; `readAccountCache(storage:Storage,accountId:string,game:Game)` and `queueDeck(storage:Storage,accountId:string,game:Game,deck:unknown,expectedRevision:number)` return explicit errors without deleting bytes; `clearPending` removes only acknowledged records.

- [ ] **Step 1: Write failing tests**: same logical deck with reordered JSON keys deduplicates; differing same-ID local copy gets a fresh ID/name; unrelated decks merge; wrong-game/corrupt payload is preserved and not uploaded; queued save survives reload; acknowledging one pending deck leaves others; guest keys are unchanged.
- [ ] **Step 2: Run `node --test tests/account-sync.test.ts`; confirm RED.**
- [ ] **Step 3: Implement minimal pure merge/canonical comparison and namespaced account cache/pending helpers.** Export the existing One Piece/Pokémon validators and extract the Yu-Gi-Oh! shape check from its loader so one validator handles both local and cloud records. Cap queued data to the database payload limit. No automatic browser-storage migration before an account is linked.
- [ ] **Step 4: Run targeted tests and `npm test`; require GREEN.**
- [ ] **Step 5: Commit** (`git commit -m "Preserve local decks across account merge and retry"`).

### Task 3: Supabase session and access-ID controls

**Files:** Create `src/account/client.ts`, `src/account/AccountProvider.tsx`, `src/account/AccountControls.tsx`, `tests/account-client.test.ts`; modify `src/App.tsx`, `.gitignore`, and `package.json`/lockfile; add focused `tests/e2e/account.spec.ts` cases.

**Interfaces:** `useAccount()` exposes `{accountId,status,error,collections,createAccount(),enterAccessId(id),saveDeck<G extends Game>(game:G,deck:DeckByGame[G]),retry(),signOut()}`; `collections` contains arrays for all three keys in `DeckByGame`; status distinguishes `local`, `loading`, `synced`, `pending`, and `error`. The provider uses the Task 1 RPC names and Task 2 cache helpers.

- [ ] **Step 1: Write a failing `tests/account-client.test.ts` check** that missing URL/key yields local-only mode, plus browser tests for generated-ID display/copy, wrong-ID denial without replacing guest decks, reload of persisted anonymous session, and sign-out hiding the account while preserving guest cache. Use a deterministic intercepted Supabase API or a dedicated test project; do not depend on the production database in ordinary CI.
- [ ] **Step 2: Run `node --test tests/account-client.test.ts` and `npm run test:e2e -- tests/e2e/account.spec.ts`; confirm RED.**
- [ ] **Step 3: Install `@supabase/supabase-js` and implement the client/provider/UI.** Read `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY`; absent config retains local-only behavior. Create/redeem only after an anonymous Auth session exists. Do not log or place the raw ID in a URL; retain it only in current-browser account-scoped storage until sign-out. Give malformed/wrong IDs the same user-facing failure. Confirm before sign-out, warn about pending changes, and reload guest state.
- [ ] **Step 4: Run targeted browser tests, `npm test`, and `npm run build`; require GREEN.**
- [ ] **Step 5: Commit** (`git commit -m "Add passwordless access ID controls"`).

### Task 4: One Piece saves and initial migration

**Files:** Modify `src/OnePieceApp.tsx`, `src/deck.ts`; extend `tests/e2e/account.spec.ts`.

**Interfaces:** One Piece passes `'onepiece'` and its existing `Deck` object to `useAccount().saveDeck`; its saved selector consumes `collections.onepiece` after account load. Existing guest `loadDecks/saveDecks` continue for signed-out users.

- [ ] **Step 1: Write failing browser test**: guest One Piece deck is saved; a new access ID is created; its deck appears after reload; a different browser entering the ID sees it; dirty draft is not replaced during link; a corrupt guest storage value remains unchanged and is not uploaded.
- [ ] **Step 2: Run targeted test; confirm RED.**
- [ ] **Step 3: Connect existing Save/load UI to provider state**, keeping One Piece validation, export, replacement confirmation and local-only behavior. Show account save/pending/error status without claiming cloud sync before acknowledgment.
- [ ] **Step 4: Run the targeted test and `tests/e2e/app.spec.ts`; require GREEN.**
- [ ] **Step 5: Commit** (`git commit -m "Sync One Piece decks by access ID"`).

### Task 5: Pokémon saves

**Files:** Modify `src/pokemon/PokemonApp.tsx`, `src/pokemon/deck.ts`; extend `tests/e2e/account.spec.ts`.

**Interfaces:** Same provider contract as Task 4 with game `'pokemon'` and existing `PokemonDeck`; Pokémon storage stays separate from the other games.

- [ ] **Step 1: Write failing browser test**: a Pokémon deck saved under the same access ID loads in a second browser alongside One Piece; invalid Pokémon storage never overwrites a valid remote row; switching games preserves unsaved drafts.
- [ ] **Step 2: Run targeted test; confirm RED.**
- [ ] **Step 3: Connect the Pokémon Save/list to provider state** while preserving its existing card/format validation and guest fallback.
- [ ] **Step 4: Run targeted test plus `tests/e2e/pokemon.spec.ts`; require GREEN.**
- [ ] **Step 5: Commit** (`git commit -m "Sync Pokemon decks by access ID"`).

### Task 6: Yu-Gi-Oh! saves

**Files:** Modify `src/yugioh/YugiohApp.tsx`, `src/yugioh/deck.ts`; extend `tests/e2e/account.spec.ts`.

**Interfaces:** Same provider contract as Task 4 with game `'yugioh'` and existing `YugiohDeck`; TCG/OCG format and card language remain independent.

- [ ] **Step 1: Write failing browser test**: a saved TCG or OCG deck appears on a second browser under the same ID; format/sections survive reload; a stale revision produces a visible conflict copy; malformed cloud payload is preserved and excluded from display/upload.
- [ ] **Step 2: Run targeted test; confirm RED.**
- [ ] **Step 3: Connect the Yu-Gi-Oh! Save/list to provider state** while preserving section counts, import/export, and dirty-draft confirmation.
- [ ] **Step 4: Run targeted test plus `tests/e2e/yugioh.spec.ts`; require GREEN.**
- [ ] **Step 5: Commit** (`git commit -m "Sync Yugioh decks by access ID"`).

### Task 7: Release configuration and real-project verification

**Files:** Modify `.github/workflows/pages.yml`, `README.md`; complete `tests/e2e/account.spec.ts`; review `src/account/*` and migration as needed.

**Interfaces:** The public build receives only `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY`; the Supabase project has anonymous Auth enabled and the Task 1 migration applied before the UI deploys.

- [ ] **Step 1: Add the account browser tests for offline Save → reload → Retry, simultaneous edits on two sessions, sign-out with pending work, and no horizontal overflow on mobile.** Require local pending state to survive network failure and preserve both concurrent edits.
- [ ] **Step 2: Run `npm test`, `npm run build -- --base=/tcg-builder-lab/`, `PLAYWRIGHT_PREVIEW=1 npm run test:e2e`, and `supabase test db`; require all green.** Add a dedicated CI database-test job with `supabase/setup-cli@v3`, `supabase start`, and `supabase test db`; Pages deployment must depend on that job and its timeout must fit the local stack startup. Keep ordinary browser tests independent of production Supabase.
- [ ] **Step 3: Complete an independent security/code review before deployment.** Inspect RLS grants, SECURITY DEFINER calls, raw-ID handling, corrupt data preservation, conflict saves, and absence of secret-key text in `git diff`/built assets. Fix important findings and rerun relevant checks.
- [ ] **Step 4: Link/apply the migration to project `fxclxyussohwxhamsqxh`, enable anonymous Auth, and run two real browser sessions against the project to prove create/redeem, cross-account denial and all three deck round-trips.** If the CLI requires a DB password not available in the authorized session, use the authenticated Supabase Dashboard workflow or request only that missing credential/setup action; never put it in the repo.
- [ ] **Step 5: Configure GitHub Actions build variables for the Supabase URL and publishable key; update `.gitignore` for `.env.local` and document ID-sharing/no-recovery/setup.** Confirm no secret key is stored in source, CI or local tracked files.
- [ ] **Step 6: Commit, integrate the verified branch into `main`, push, watch the Pages workflow, and verify the public site with two fresh browser contexts.** Report revision, checks, deployment URL, and any remaining operational limitation.

## Final handoff

Use an isolated worktree at execution time. After each task's tests and commit, update the task checkbox. An independent reviewer must inspect the whole branch before release. A failed SQL authorization test, invalid data overwrite, or lost pending save blocks deployment.
