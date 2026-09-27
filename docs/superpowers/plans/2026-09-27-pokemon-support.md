# Pokémon Support Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Add illustrated English Pokémon cards and sets, a safe Standard deck builder, and dated competitive guidance alongside One Piece, then deploy through existing CI/CD.

**Architecture:** Keep each game's data and deck rules separate. Extract the current One Piece screen from `App.tsx`, add a shared game selector, and reuse CSS/native dialogs and the existing image renderer. Bundle Pokémon metadata and evidence as validated static snapshots; update them with manual commands.

**Tech Stack:** Existing React, TypeScript, Vite, Node.js 22.18+, cheerio, node:test, Playwright, GitHub Actions/Pages. No new product dependencies or backend.

**Spec:** `docs/superpowers/specs/2026-09-27-pokemon-support-design.md` (approved September 27, 2026).

## Global Constraints

- English physical Pokémon TCG and international Standard format by default. Exclude Pocket; Japanese catalogs, Expanded certification, prices, accounts, and simulation are outside this release.
- Preserve One Piece behavior and `grand-line.decks.v1`; Pokémon saves use `tcg-builder.pokemon.decks.v1`.
- Switching games preserves both in-session drafts. One game's data failure does not disable the other.
- Missing information stays unknown, never zero or inferred official legality. Artwork remains remote, with placeholders/source links on failure.
- 60 cards, at least one Basic Pokémon, four copies per official name across printings, Basic Energy exemption, sourced printed construction exceptions, and one ACE SPEC total.
- Standard eligibility depends on dated rules, release dates, bans, regulation marks, and explicit equivalent-reprint mappings. Unknown metadata or rules older than 14 days cannot certify legality.
- Masters international Standard evidence by default; separate Japan. Display share of collected records with denominator, never global popularity or invented win rates.
- Data updates validate before atomic publication and preserve the last good snapshot on failure. Production builds remain at `/tcg-builder-lab/`.

## Review Focus

1. Two printings with the same name must share a copy limit, while distinct official names/suffixes remain distinct — Task 3.
2. A stale provider legality Boolean or same-name older printing must not bypass rotation/release checks — Task 3.
3. Switching games or replacing a leader-only/named draft must not lose unsaved work or overwrite another game's storage — Tasks 2/5.
4. A source-count mismatch, truncated response, or unresolved tournament printing must not silently publish incomplete data or an importable false list — Tasks 1/4.
5. Wrong-format/division/region/future events must not enter current Standard sample shares — Task 4.

## File map

- `src/pokemon/data.ts`: Pokémon card/set/catalog/rules/event/guide/deck types.
- `src/pokemon/catalog.ts`: snapshot validation, catalog filtering, set counts, source normalization.
- `src/pokemon/Catalog.tsx`: illustrated library, sets, Pokémon-specific detail dialog.
- `src/pokemon/deck.ts`: construction/eligibility, text transfer, storage, summaries.
- `src/pokemon/DeckBuilder.tsx`: Pokémon deck editing and validation UI.
- `src/pokemon/meta.ts`, `src/pokemon/Meta.tsx`: evidence filtering, structural observations, meta/guide UI.
- `src/pokemon/PokemonApp.tsx`: lazy data load, draft/save ownership, navigation callbacks.
- `src/OnePieceApp.tsx`: extracted existing One Piece application; behavior preserved.
- `src/App.tsx`: shared game switcher that retains previously visited game instances.
- `src/Catalog.tsx`: widen only `CardImage` presentation props to fields already consumed (`imageUrl`, `artworkAvailable`, `name`, `sourceUrl`); keep One Piece detail behavior.
- `src/styles.css`: shared selector and restrained Pokémon accents/layout adjustments.
- `scripts/import-pokemon.mjs`, `scripts/import-pokemon-meta.mjs`: reproducible validated imports.
- `scripts/pokemon-guides.json`, `public/data/pokemon/{catalog,rules,meta}.json`: bundled attributed snapshots.
- `tests/pokemon-{catalog,deck,meta}.test.ts`, `tests/e2e/pokemon.spec.ts`: meaningful regression checks.
- `README.md`, `package.json`, `.github/workflows/pages.yml`: update commands, documentation, deployment verification.

## Task 1: Validated Pokémon catalog and rules snapshot

**Consumes:** `safeUrl(value: unknown): value is string` from `src/catalog.ts`; documented TCGdex metadata/image formats and official rules.

**Produces:** In `src/pokemon/data.ts`, `PokemonCard` has `id,setId,localId,name,category:'Pokemon'|'Trainer'|'Energy',types:string[],stage:string|null,evolveFrom:string|null,hp:number|null,rarity:string|null,illustrator:string|null,imageUrl:string|null,sourceUrl:string,regulationMark:string|null,releaseDate:string|null,abilities:{name:string,effect:string}[],attacks:{name:string,cost:string[],damage:string|null,effect:string}[],weaknesses:{type:string,value:string}[],resistances:{type:string,value:string}[],retreat:number|null,effect:string,trainerType:string|null,energyType:string|null,variants:Record<string,boolean>,liveCode:string|null`.

`PokemonSet` has `id,name,series,releaseDate,sourceUrl,officialCount:number|null,totalCount:number|null,importedCount:number`. `PokemonCatalog` has `checkedAt,sourceRevision,coverageNotes,sets:PokemonSet[],cards:PokemonCard[]`. `PokemonRules` has `checkedAt,sourceUrls:string[],verified:boolean,rotations:{effectiveFrom:string,allowedMarks:string[]}[],bans:{cardIds:string[],effectiveFrom:string}[],reprints:Record<string,string>,exceptions:Record<string,{copyLimit?:number,group?:string,groupLimit?:number}>,notes:string[]`.

Export `normalizePokemonCatalog(raw:unknown):PokemonCatalog`, `filterPokemonCards(cards:PokemonCard[],sets:PokemonSet[],query:PokemonQuery,rules:PokemonRules,date:string):PokemonCard[]`, where `PokemonQuery` is `{search,setId,category,type,stage,rarity,eligibility}` strings. Export importer `publishPokemonCatalog(path:string,candidate:unknown):Promise<void>`.

- [x] Write failing node:test checks named `missing stats remain unknown`, `Pocket sets are excluded`, `physical set totals reconcile`, and `invalid candidate preserves previous snapshot`. Assert null HP remains null, Pocket records are absent, mismatched source totals reject publication unless recorded as explicit upstream coverage discrepancy, and existing file bytes survive rejected publication.
- [x] Run `node --test tests/pokemon-catalog.test.ts`; confirm failure from missing implementation.
- [x] Implement types/normalization/filtering and importer. Use TCGdex API with timeout/retries and at most four simultaneous requests; if unreachable, select a pinned upstream repository revision as the whole import's source. Retain all available physical English records and record real count discrepancies. Do not merge arbitrary revisions. Validate URL/identity/category/quantities at trust boundaries; preserve unknown fields. Use temp-file rename for publication.
- [x] Research accessible official rule documents and prepare `rules.json` with explicit effective dates, reprints/exceptions and source links. Remain `verified:false` wherever tournament eligibility is incomplete. Never derive ACE SPEC by rarity alone or grant reprint eligibility by name alone. Confirm exact remote image URL syntax in a browser before declaring available artwork.
- [x] Add `update:pokemon` to `package.json`. Generate and reconcile the snapshot; document imported/source counts, excluded Pocket records, unknown images, and source revision. Run `npm test` and `npm run build`; both pass. Commit this deliverable.

## Task 2: Game switcher and illustrated Pokémon library

**Consumes:** Task 1 types, `normalizePokemonCatalog`, `filterPokemonCards`, bundled catalog/rules.

**Produces:** `PokemonApp` owns `PokemonDeck={id:string,name:string,cards:Record<string,number>}` and exposes the same three destinations. `PokemonCatalogView` props are `{snapshot:PokemonCatalog,rules:PokemonRules,onAdd:(card:PokemonCard)=>void}`. `PokemonCardDetail` props are `{card:PokemonCard,onClose:()=>void,onAdd:(card:PokemonCard)=>void}`. Task 3 replaces the temporary draft summary with the complete deck editor.

- [x] Write a failing Playwright flow for the game selector, Pokémon search/set/category filtering and detail (HP/attack for Pokémon, effect for Trainer). Verify actual image naturalWidth >0 and no One Piece Leader/DON fields in Pokémon detail. Add a failure case: intercept Pokémon snapshot request with 500, then switch back and verify One Piece search still works.
- [x] Run `npx playwright test tests/e2e/pokemon.spec.ts`; confirm the new flow fails before implementation.
- [x] Extract existing app to `OnePieceApp.tsx` without changing save/rule behavior. Implement shared selector in `App.tsx` and keep visited instances mounted with hidden inactive screens. Restrict hidden screens from keyboard focus/accessibility tree. Fetch Pokémon snapshots only on first selection, using `import.meta.env.BASE_URL`.
- [x] Reuse `CardImage` with the minimal presentation-only prop shape; implement Pokémon detail, paging 30 cards, set browsing/counts, filters, source/coverage dates, and accessible empty/loading/error states. Apply neutral shell branding and game-specific accents/attribution. The Pokémon draft summary accepts added cards and retains state across switching.
- [x] Run existing One Piece browser tests and new library flows, `npm test`, and `npm run build`. Commit.

## Task 3: Pokémon deck rules, saves and text transfer

**Consumes:** `PokemonCard`, `PokemonRules`, `PokemonDeck` and the add-card callbacks from Task 2.

**Produces:** Export `newPokemonDeck():PokemonDeck`, `pokemonEligibility(card:PokemonCard,cards:PokemonCard[],rules:PokemonRules,date:string):{status:'eligible'|'ineligible'|'unknown',reason:string}`, `validatePokemonDeck(deck:PokemonDeck,cards:PokemonCard[],rules:PokemonRules,date:string):{status:'valid'|'invalid'|'unverified',issues:string[]}`, `parsePokemonDeck(text:string,cards:PokemonCard[]):PokemonDeck`, `exportPokemonDeck(deck:PokemonDeck,cards:PokemonCard[]):string`, `loadPokemonDecks(storage:Storage):{decks:PokemonDeck[],error:string|null}`, `savePokemonDecks(storage:Storage,decks:PokemonDeck[]):{error:string|null}`. `PokemonDeckBuilder` props are `{cards,rules,deck,saved,onChange,onSave,onLoad,onNew,dirty,storageError}` with the same callback shapes as the existing builder, specialized to `PokemonDeck`.

- [x] Write failing checks: `60 cards and Basic required`, `same-name printings aggregate and suffix names stay distinct`, `Basic Energy exceeds four safely`, `ACE SPEC group has one total`, `printed copy exception is respected`, `dated rotation ignores stale provider booleans`, `old printing needs explicit equivalent reprint`, `unknown release and stale rules cannot certify`, `text transfer rejects ambiguity and roundtrips`, and `corrupt storage remains unchanged`. Use a 60-card fixture with four name-aggregated copies versus five; Basic Energy quantity 40; two different ACE SPEC IDs; rules checked 15 days earlier; date just before/after a rotation.
- [x] Run `node --test tests/pokemon-deck.test.ts`; confirm missing implementation fails.
- [x] Implement pure validation/eligibility functions; distinguish construction errors from unknown tournament eligibility. Use curated IDs/groups and Basic Energy metadata, not loose name matching. Validate import size/quantity/ID boundaries; accept exact IDs and verified Live set-code/collector-number mappings, category headers/comments. Preserve exact printings on export; unresolved Live codes produce explicit errors.
- [x] Implement builder quantity controls, 60-card progress, category/Basic totals, eligible pool filter, checks, explicit save/load/new, transfer dialog/download/copy. Pokémon storage is separate; failed reads block overwriting the original. Confirm any replacement of a dirty name-only/cards-only draft. Switching games retains unsaved edits.
- [x] Extend browser flow: add cards, save/reload, export/import, reject unknown line without replacing draft; edit drafts in both games, switch back and forth, verify original names/quantities. Run all checks and build. Commit.

## Task 4: Dated Pokémon competitive evidence and guidance

**Consumes:** Task 1 catalog/rules and Task 3 deck/transfer functions.

**Produces:** `PokemonEvent={id,name,date,format:'standard'|'standard-jp'|'expanded'|'pocket'|'unknown',division:'Masters'|'Seniors'|'Juniors'|'unknown',region,country,player,placement,archetypeId,sourceUrl,list:Record<string,number>|null}`. `PokemonGuide={id,title,publishedAt,sourceUrls:string[],signatureCards:string[],gamePlan,strengths:string[],weaknesses:string[],suggestions:string[]}`. `PokemonMeta={checkedAt,coverageNotes,events:PokemonEvent[],guides:PokemonGuide[]}`. Export `selectPokemonEvidence(snapshot:PokemonMeta,region:string,from:string,to:string,country:string):PokemonEvent[]`, `analyzePokemonDeck(deck:PokemonDeck,cards:PokemonCard[],snapshot:PokemonMeta):{observations:string[],guides:PokemonGuide[]}`, and importer `publishPokemonMeta(path:string,candidate:unknown,cards:PokemonCard[]):Promise<void>`.

- [x] Write failing checks named `meta excludes wrong division format region and future dates`, `unresolved printing is not importable`, `bad update preserves previous evidence`, and `custom analysis preserves unknowns without fictional scores`. Assert only Masters Standard dated records enter international results; a source list with one unresolved ID is null with an exclusion note; bad candidate cannot replace file bytes; unsupported custom decks get structural observations and no score/win rate.
- [x] Run `node --test tests/pokemon-meta.test.ts`; confirm failure before implementation.
- [x] Implement bounded-concurrency Limitless import of completed results (recent international events first). Resolve exact set-code/number printings using Task 1 mappings and Task 3 parser. Require known IDs and total 60 for loadable lists. Record date, event/format/division, original source, exclusion coverage, check timestamp. Source changes/invalid snapshots cannot replace prior evidence. Add `update:pokemon-meta` command.
- [x] Bundle recent evidence and at least one fully resolved 60-card list. Write a sourced guide for every initial displayed top archetype, dated and labeled qualitative where original analysis. Match custom decks by explicit signature IDs/equivalent known printings; report category counts/evolution prerequisites and only verified effect-role observations. Do not invent draw/search tags from unsupported text parsing.
- [x] Build meta UI with 14/30/90/365-day windows, international/Japan and country filters, filtered denominators, event/list links, guides, stale/empty states, and safe load-list callback. Require dirty-draft confirmation and run validation after loading.
- [x] Verify a sourced list loads into Pokémon builder, Japan/other format does not enter default share, a guide is visible, and an empty window stays honest. Run all checks/build and commit.

## Task 5: Integrated review, Pages verification and release

**Consumes:** All preceding deliverables and existing Pages CI/CD workflow.

**Produces:** Deployed, verified two-game site, README commands/coverage, and a permanent implementation report.

- [x] Extend `tests/e2e/pokemon.spec.ts` to cover mobile selector/library/builder/meta, keyboard dialog closure, no horizontal overflow, corruption-safe save, failed Pokémon fetch isolation, and preservation of One Piece saves/drafts. Keep `tests/e2e/app.spec.ts` passing. Limit browser tests to user-visible flows; no implementation-mirroring suites.
- [x] Run `npm test`, `npm run build -- --base=/tcg-builder-lab/`, and `CI=1 PLAYWRIGHT_PREVIEW=1 npm run test:e2e`; all pass. Inspect desktop/mobile screenshots with rendered artwork. Check failed importer cases through runnable tests; do not deliberately damage published snapshots.
- [x] Perform one independent whole-branch review with Superpowers requesting-code-review; fix Important/Critical findings with regressions and rerun affected checks. Preserve implementation decisions and actual source counts/limitations in `docs/superpowers/pokemon-implementation-report.md`.
- [x] Update README with game scope, source revision/artwork counts, Standard limitations, Live import behavior, separate browser saves, refresh commands, and attribution. Verify the existing workflow runs all new tests and the subpath remains correct.
- [ ] Commit final corrections, integrate the verified feature into `main` without force pushing, push to the authorized repository, and watch CI/deploy to completion. Verify public game switching, Pokémon artwork, deck editing, and meta at `https://perryong.github.io/tcg-builder-lab/`. Report deployed URL, check results and real remaining data limitations.

## Plan self-review

Each spec section has an owner: navigation/drafts Task 2/3, catalog/artwork Task 1/2, deck rules/storage/transfer Task 3, evidence/guides Task 4, production/mobile/review/deployment Task 5. Review Focus inputs each have explicit regression checks. Task 1 filtering consumes `pokemonEligibility` defined in Task 3; implement a temporary unknown eligibility result in Task 1, then wire the actual predicate in Task 3 and add filter assertions there. No legality Boolean is treated as authority. Meta types are Pokémon-specific, and all imports consume the same exact card identifiers.
