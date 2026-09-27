# Yu-Gi-Oh! English TCG and Japanese OCG Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add illustrated bilingual Yu-Gi-Oh! cards and sets, Main/Extra/Side deck construction, and separate dated TCG/OCG guidance, then publish through existing Pages CI/CD.

**Architecture:** Add an independent Yu-Gi-Oh! screen following the Pokémon screen's ownership and snapshot pattern. Share existing presentation and navigation styles, preserving all three games' drafts and separate storage. Join language records by verified Konami IDs/passcodes; keep language, deck format and printing identity distinct.

**Tech Stack:** Existing React, TypeScript, Vite, Node.js 22.18+, cheerio, node:test, Playwright and GitHub Actions/Pages. No new runtime dependencies, generic rules engine, accounts or backend.

**Spec:** `docs/superpowers/specs/2026-09-27-yugioh-support-design.md` (approved September 27, 2026).

## Global Constraints

- English international TCG and Japanese OCG only. Exclude Asian-English certification, Master Duel, Rush Duel, Speed Duel and Genesys.
- English interface; selectable English/Japanese card names, printed text, set records and genuine language-specific artwork. Search both names. Language changes preserve deck format and draft.
- Main Deck 40–60, Extra Deck 0–15, Side Deck 0–15; three copies combined across sections, with sourced treated-as identities and format-specific restrictions.
- Unknown mappings, incomplete lists or rules older than 14 days cannot certify tournament legality. Provider banlist flags alone do not establish current legality.
- TCG/OCG evidence stays separate and dated; sample shares disclose denominators, with no invented win rates or simulated strength scores.
- Preserve One Piece/Pokémon saves and in-session drafts. Yu-Gi-Oh! uses `tcg-builder.yugioh.decks.v1`.
- Validate snapshots before atomic publication. Failed fetches/parsing cannot replace good snapshots. Image-provider re-hosting requirements must be followed.
- Do not invent artwork-to-printing matches, use English artwork as Japanese, or generate replacement illustrations. Missing source data remains explicit.
- Keep production base `/tcg-builder-lab/`; run existing and new tests through the current Pages workflow.

## Review Focus

1. English and Japanese names, alternate art IDs and .ydk passcodes must join the same verified construction identity; ambiguous joins stay unresolved — Tasks 1/2.
2. Switching display language must not silently change format; a format change must revalidate the same draft without deleting cards — Tasks 2/3.
3. Three-copy and Limited counts aggregate Main/Extra/Side and treated-as names; Extra monsters and tokens cannot bypass section checks — Task 2.
4. A successful HTML response, untranslated record, incorrect-language image or partial rules/evidence page must not become valid published data — Tasks 1/4.
5. Japanese OCG, future events and unrelated game formats must not enter TCG sample percentages; bad imports and corrupt storage must preserve drafts/data — Tasks 2/4/5.

## File Map

- `src/yugioh/data.ts`: card, localized printing/artwork, set, rules, deck and evidence types.
- `src/yugioh/catalog.ts`: validation, lookup and bilingual filtering.
- `scripts/import-yugioh.mjs`: bounded metadata imports, stable identity joins and atomic publication.
- `scripts/import-yugioh-artwork.mjs`: verified language-specific image manifest and re-hosted assets.
- `public/data/yugioh/{catalog,rules,meta}.json`, `public/data/yugioh/art/`: bundled snapshots and verified artwork assets.
- `src/yugioh/deck.ts`, `src/yugioh/DeckBuilder.tsx`: construction, transfer, storage and editing.
- `src/yugioh/Catalog.tsx`, `src/yugioh/YugiohApp.tsx`: bilingual library/sets/details and screen state.
- `src/yugioh/meta.ts`, `src/yugioh/Meta.tsx`, `scripts/import-yugioh-meta.mjs`, `scripts/yugioh-guides.json`: evidence, observations and sourced guides.
- `src/App.tsx`, `src/styles.css`, `index.html`: third game, responsive presentation and app metadata.
- `tests/yugioh-{catalog,deck,meta}.test.ts`, `tests/e2e/yugioh.spec.ts`: meaningful regressions.
- `package.json`, `README.md`, `docs/superpowers/yugioh-implementation-report.md`: update commands, coverage, attribution and release evidence.

## Task 1: Bilingual catalog and genuine artwork

**Interfaces:** `YugiohLanguage='en'|'ja'`; `YugiohFormat='tcg'|'ocg'`. `YugiohCard` has canonical `id:string` (Konami ID), `passcodes:string[]`, `copyIdentity:string|null`, `type`, `category:'Monster'|'Spell'|'Trap'|'Token'`, `extraDeck:boolean`, `attribute:string|null`, `race:string|null`, `atk/def/level/rank/linkRating/pendulumScale:number|null`, `linkArrows:string[]`, `archetype:string|null`, and `locales:Partial<Record<YugiohLanguage,{name:string,text:string,pendulumText:string|null,releaseDate:string|null,sourceUrl:string,artworkIds:string[]}>>`.

`YugiohArtwork={id,cardId,language,variantId:string|null,imagePath:string|null,sourceUrl,verified:boolean}`. `YugiohPrinting={id,cardId,setId,language,code,rarity:string|null,artworkId:string|null}`. `YugiohSet={id,language,name,releaseDate:string|null,sourceUrl,advertisedCount:number|null,importedUniqueCount,importedPrintingCount}`. `YugiohCatalog={checkedAt,sourceUrls:string[],coverageNotes,cards,artworks,printings,sets}`. `YugiohQuery={search,setId,category,type,attribute,level,rank,linkRating,pendulumScale,archetype}` with empty-string filters.

Produce `normalizeYugiohCatalog(raw:unknown):YugiohCatalog`, `filterYugiohCards(snapshot:YugiohCatalog,query:YugiohQuery,language:YugiohLanguage):YugiohCard[]`, `joinYugiohRecords(english:unknown,japanese:unknown):YugiohCatalog`, `publishYugiohCatalog(path:string,candidate:unknown):Promise<void>` and `acceptYugiohImage(response:Response):boolean`.

- [ ] Inspect small English/Japanese metadata and image samples before full import. Confirm stable ID/passcode joins, genuine Japanese images and source access requirements. Record provider/revision/access method. A Japanese name paired only with English artwork does not satisfy this milestone. Do not guess Japanese image endpoints or download unrelated collections.
- [ ] Write failing catalog checks: `verified IDs join translated names and alternate art without inventing printing mappings`; `ambiguous identities and wrong-language art are rejected`; `counts reconcile and invalid publication preserves previous bytes`; `image responses reject HTML and failed status`. Assertions: one canonical card from two verified locales; alternate illustration does not increase unique-card count; unknown values remain null; duplicate/conflicting passcodes cannot resolve; mismatched set counts throw; HTTP 200 text/html is not artwork.
- [ ] Run `node --test tests/yugioh-catalog.test.ts`; inspect expected assertion failures before implementation.
- [ ] Implement literal metadata normalization, exact joins and bilingual filtering in the listed catalog files. Card type determines nullable fields; Link monsters do not get invented DEF or levels. Preserve printed material requirements inside source effect text. Keep null artwork-to-printing mappings where upstream does not establish the relationship.
- [ ] Implement bounded imports with 30-second request timeouts, provider-respecting request limits and validated atomic publication. Cache fetched metadata, record source dates, and reconcile imported records against available advertised counts. Add `update:yugioh` and `repair:yugioh-artwork` commands. Reuse existing installed libraries.
- [ ] Import only verified application artwork. Use an explicit manifest linking language/card/variant to a local file; validate image content and identity before accepting it. Build image URLs from `import.meta.env.BASE_URL` so nested Pages paths work. Track count/byte coverage and keep the Pages artifact within its documented size limit; do not silently truncate the metadata library to reduce image size.
- [ ] Bundle available English/Japanese catalog, set and artwork coverage; run `npm test` and `npm run build -- --base=/tcg-builder-lab/`. Report actual counts and genuine Japanese artwork examples. Commit `feat: add verified bilingual Yugioh catalog`.

## Task 2: Construction, rules, transfer and saves

**Consumes:** Task 1 canonical cards and passcode mappings. **Produces:** `YugiohDeck={id,name,format:YugiohFormat,main:Record<string,number>,extra:Record<string,number>,side:Record<string,number>}`. `YugiohRules={checkedAt,formats:Record<YugiohFormat,{verified:boolean,sourceUrls:string[],effectiveFrom:string,limits:Record<string,0|1|2>,releaseDates:Record<string,string>,coverageNotes:string}>}`.

Functions: `newYugiohDeck(format:YugiohFormat):YugiohDeck`; `validateYugiohDeck(deck:YugiohDeck,cards:YugiohCard[],rules:YugiohRules,date:string):{status:'valid'|'invalid'|'unverified',issues:string[],counts:{main:number,extra:number,side:number}}`; `parseYugiohDeck(text:string,cards:YugiohCard[],format:YugiohFormat):YugiohDeck`; `exportYugiohDeck(deck:YugiohDeck,cards:YugiohCard[],kind:'text'|'ydk'):string`; `loadYugiohDecks(storage:Storage):{decks:YugiohDeck[],error:string|null}`; `saveYugiohDecks(storage:Storage,decks:YugiohDeck[]):void`.

- [ ] Write failing checks: `40 to 60 Main and at most 15 Extra and Side`; `copy identity aggregates sections, languages, alternate art and treated-as names`; `TCG and OCG use their own effective restrictions and releases`; `tokens and misplaced Extra monsters are invalid`; `unknown or stale rules cannot certify legality`; `exact text and ydk roundtrip without guessing passcodes`; `corrupt storage is preserved`. Assert Main 39/61 and Extra/Side 16 fail; Limited one plus one in Side fails; unknown copy identity is unverified; rules older than 14 days are unverified; an OCG-only card does not become TCG eligible through English display text.
- [ ] Run `node --test tests/yugioh-deck.test.ts`; confirm expected assertion failures.
- [ ] Implement construction and dated rules in `src/yugioh/deck.ts`. Read official format lists separately, mark completeness/verification honestly, and preserve future effective dates. Missing metadata does not imply unlimited or released. Enforce copy identity across all three sections; do not certify using provider flags alone.
- [ ] Implement text headers `[main]`, `[extra]`, `[side]` with `quantity canonical-id`; .ydk markers `#main`, `#extra`, `!side` contain repeated verified passcodes. Accept conventional comment lines, cap input at 50 KB, reject duplicate/out-of-order section markers, unknown IDs and malformed quantities, and reject ambiguous passcode export rather than choosing arbitrarily.
- [ ] Implement independent save schema/version validation. Corrupt reads preserve original bytes and block overwrite until explicitly resolved; no automatic clearing. Run all unit tests and build. Commit `feat: add Yugioh construction and deck transfer`.

## Task 3: Library, sets, details and deck editing

**Consumes:** Tasks 1/2 types and functions. **Produces:** `YugiohApp` owns lazy snapshots, language, current deck, saved decks and dirty state. `Catalog` consumes snapshot/language/onAdd; `DeckBuilder` consumes cards/rules/language/deck/saved and edit/save/load callbacks. No other game consumes Yu-Gi-Oh! rules.

- [ ] Write failing Playwright flows named `bilingual library shows genuine art and searchable translated identities` and `language and game switches preserve draft while format changes revalidate`. Assert names/effects for the same verified card in both locales, natural image width >0 for English and Japanese assets, correct Main/Extra/Side totals, retained draft name/quantities, and format unchanged when display language changes.
- [ ] Run `CI=1 PLAYWRIGHT_PREVIEW=1 npm run test:e2e -- --grep 'bilingual library|language and game'`; confirm failures before UI implementation.
- [ ] Add the third game to `src/App.tsx`; retain previously visited game instances with independent state. Add the Yu-Gi-Oh! screen with fetch-error isolation, card language control, accessible navigation and source coverage. Reuse `CardImage` and existing CSS patterns without changing other games' construction or storage.
- [ ] Build illustrated library, paginated filters, language-specific sets and detail dialog showing printed monster/spell/trap fields and variant selection. Missing selected-language artwork gets an explicit placeholder/source link. Provide keyboard Escape closure and native select labels. Show available language coverage without switching the user's chosen language silently.
- [ ] Build three-section editing, format selection, section-aware add controls, quantities, validation issues, named saves and text/.ydk transfer. Dirty confirmation applies to source-list loading, importing, new decks and saved-deck replacement, including name-only edits. Language changes leave deck format untouched; changing format marks draft dirty and recalculates checks.
- [ ] Verify full save/reload/transfer and game-switch flows. Run `npm test`, production build and all browser tests. Commit `feat: add bilingual Yugioh explorer and deck builder`.

## Task 4: Separate TCG/OCG evidence and qualitative guidance

**Interfaces:** `YugiohEvent={id,name,date,format:YugiohFormat,region,placement,player,archetypeId,sourceUrl,list:YugiohDeck|null}`; `YugiohGuide={id,format,publishedAt,sourceUrls:string[],signatureCards:string[],title,gamePlan,strengths:string[],weaknesses:string[],suggestions:string[]}`; `YugiohMeta={checkedAt,coverageNotes,events:YugiohEvent[],guides:YugiohGuide[]}`.

Produce `selectYugiohEvidence(snapshot:YugiohMeta,format:YugiohFormat,from:string,to:string):YugiohEvent[]`, `analyzeYugiohDeck(deck:YugiohDeck,cards:YugiohCard[],snapshot:YugiohMeta):{observations:string[],guides:YugiohGuide[]}`, `resolveYugiohSourceList(raw:unknown,cards:YugiohCard[],format:YugiohFormat):YugiohDeck|null`, and `publishYugiohMeta(path:string,candidate:unknown,cards:YugiohCard[]):Promise<void>`.

- [ ] Write failing checks: `OCG and future results cannot enter TCG shares`; `unresolved or malformed source lists are not loadable`; `HTTP-success error pages preserve previous evidence`; `custom observations stay structural and format-specific`. Assert sample denominator includes only selected format/window; one unresolved card prevents loading; malformed section totals reject publication; unsupported custom decks get no invented matchup scores.
- [ ] Run `node --test tests/yugioh-meta.test.ts`; confirm expected failures.
- [ ] Import completed published tournament results with explicit region/date/format attribution. Use original organizer results or clearly labeled YGOPRODeck tournament records; ordinary user-uploaded decks are not evidence of placements. Keep TCG and Japanese OCG samples distinct. Resolve exact identities and section totals before offering list loading; record unresolved exclusions and fail changed/empty source parsing before atomic replacement.
- [ ] Bundle at least one fully resolved tournament list for each format and guides for the initially displayed top archetypes in each sample. Explain game plan, strengths, weaknesses and build considerations from printed effects and dated sources; do not invent draw/search classifications through unsupported text guessing. Add `update:yugioh-meta`.
- [ ] Build format/window selectors (14/30/90/365 days), sample shares with denominators, notebook/source links, guides, stale/empty states and custom structural observations. Loading a list adopts its format only after dirty-draft confirmation. Show printed card text in the selected display language without changing evidence format.
- [ ] Add browser checks for both format samples, guide visibility, list loading, rejected imports and dirty replacement. Run all tests/build. Commit `feat: add dated TCG and OCG Yugioh guidance`.

## Task 5: Integrated review, deployment and coverage report

- [ ] Extend `tests/e2e/yugioh.spec.ts` with mobile library/sets/builder/meta and no horizontal overflow, corrupted storage preservation, failed fetch isolation, Japanese asset subpath loading, and all three games' unsaved drafts. Keep existing 11 browser flows passing.
- [ ] Run `npm test`, `npm run build -- --base=/tcg-builder-lab/`, and `CI=1 PLAYWRIGHT_PREVIEW=1 npm run test:e2e`; require zero failed checks. Inspect desktop/mobile screenshots with real artwork in both languages. Confirm no English-only image is presented as Japanese.
- [ ] Perform one independent whole-branch review for native execution, or the selected per-task review workflow for subagent execution. Fix Important/Critical findings with regressions and rerun affected checks. Preserve decisions, actual import/artwork counts, providers, byte size and limitations in `docs/superpowers/yugioh-implementation-report.md`.
- [ ] Update README with both formats/languages, source attribution, separate storage, rules freshness limits, refresh commands, exact-ID/.ydk behavior and genuine artwork coverage. Update page metadata for three games. Verify workflow includes all new tests and the artifact remains within hosting limits.
- [ ] Commit final corrections, integrate into main without force pushing, push to the authorized repository and wait for successful CI/Pages deployment. Verify the public library in English and Japanese, genuine language-specific images, both deck formats, list loading and all three game switches. Record the deployed URL and actual remaining limitations.

## Plan Self-Review

Catalog/identity/artwork/set counts are owned by Task 1; construction, dated rules, transfer and corruption protection by Task 2; navigation, languages, UI and draft ownership by Task 3; separate evidence and guides by Task 4; responsive/full-game regression and deployment by Task 5. All five Review Focus conditions have corresponding checks. Artwork and rules coverage are evidence milestones, not claims of worldwide completeness. No game-wide abstraction or unrequested backend is introduced.
