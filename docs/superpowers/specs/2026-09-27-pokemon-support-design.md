# Pokémon support — full experience

## Purpose and approved direction

Extend the existing TCG Builder Lab with Pokémon alongside One Piece. The user selected the full experience: illustrated cards, sets, deck building, and current meta guidance. Default scope is the English physical Pokémon TCG and international Standard format. Pokémon TCG Pocket, Japanese card catalogs, Expanded-format certification, prices, accounts, and gameplay simulation are outside this release.

Success means a visitor can select Pokémon, explore available English card printings and sets, assemble/save/export a Pokémon deck, load a sourced tournament list, and read dated strengths and weaknesses. Existing One Piece cards and saved decks must continue working. Publishing continues through the existing GitHub Pages CI/CD workflow after verification.

## Approach and alternatives

Use the existing React shell, navigation, CSS, image rendering, and accessible native dialogs. Add Pokémon-specific catalog, deck, and meta components with pure functions for their rules. Keep the One Piece implementation intact except for extracting its screen into a game-specific component and adding a switcher.

A generic rules/plugin engine would introduce abstractions before a second game's actual needs are known. Converting Pokémon into the current One Piece model would mix HP with Power, Energy with DON!!, and archetypes with Leaders. Separate small game modules are the chosen approach; share presentational helpers only where the interfaces already match.

## Navigation, appearance, and draft safety

The sidebar game selector offers One Piece and Pokémon. The three existing destinations remain Card library, Deck builder, and Meta & insights. Use neutral TCG Builder Lab branding in the shared shell and game-specific titles, attribution, and official links. Pokémon retains the current editorial layout with a restrained yellow/blue accent; no elaborate redesign.

Each game's screen owns its data, draft, and save state. Switching games preserves both in-session drafts; no new game writes to the existing `grand-line.decks.v1` storage. Pokémon uses a separate versioned storage key. Explicit saves, corrupted-storage protection, text exports, and confirmation before replacing a changed draft apply to both games. Switching games itself must not discard edits. Data failure in one game must not disable the other.

## Pokémon catalog and illustrations

Import English physical-TCG metadata from TCGdex, preserving upstream IDs and source URLs. Exclude Pocket sets explicitly. Scope is all English physical sets and card records available in the chosen source snapshot, including historical expansions and promotional groups; record actual reconciled coverage instead of promising worldwide completeness.

Bundle validated static snapshots under `public/data/pokemon/`. Fetch Pokémon data only when the user first selects that game. The deployed app uses snapshots, not a runtime API key or live third-party metadata dependency. Update tooling uses timeouts and bounded concurrency, validates the complete candidate, and atomically replaces snapshots only after success. Record upstream revision/date and local check date. TCGdex's public database repository is a possible ingestion source if the API is unavailable; it must use an explicit upstream revision and equivalent validation. Do not silently combine mismatched source revisions.

A card retains ID, set ID, collector number, official name, category (Pokémon/Trainer/Energy), rarity, illustrator, remote image URL, regulation mark, release date, and optional known legality. Pokémon fields include HP, type, stage, evolves-from, abilities, attacks and energy costs, Weakness, Resistance, and Retreat. Trainer and Energy cards retain their effect and subtype. Missing information stays unknown, never zero or inferred official legality. Limitless/TCG Live set codes are recorded as explicit mappings where verified, separate from upstream IDs.

A set retains source ID, name, series, release date, official numbered count, total source count, and imported count. Foil availability is metadata, not automatically a separate artwork record. Secret-numbered and alternate illustrations with distinct source IDs remain distinct printings. Show available artwork counts separately from source set totals and report discrepancies.

Search names, IDs, collector numbers, effects, and set names. Filter set, category, Pokémon type, stage, rarity, and Standard eligibility (eligible/ineligible/unknown). Browse all historical printings by default; provide a visible Standard filter for deck selection. Card detail shows relevant fields for its category and an add-to-deck action. Missing or failed artwork gets an accessible placeholder and source link; never substitute unrelated art. No card images are copied into the repository.

## Pokémon deck builder and checks

Deck state is `{id, name, cards: Record<cardId, quantity>}` with no Leader or DON!! fields. Show Pokémon/Trainer/Energy totals, Basic count, evolution-line observations, and a 60-card progress indicator. Support search/add/remove, explicit save/load/new, text import/export, and download/copy. Unknown IDs, ambiguous set codes, invalid quantities, and malformed storage produce actionable errors without replacing a good draft or save.

Construction checks enforce 60 cards, at least one Basic Pokémon, and no more than four cards with the same official name across sets/artworks. Distinct printed names (including suffixes) remain distinct. Basic Energy is exempt from the four-copy limit. Apply known printed construction exceptions and special limits, including one ACE SPEC across all ACE SPEC names, from sourced rule metadata; do not infer exceptions merely from an image or loose name substring.

Standard checks use a dated rules snapshot with effective dates, bans, regulation marks, release eligibility, and explicit reprint/errata mappings. Rotation is not a timeless `legal.standard` Boolean from the data provider. Do not grant older cards eligibility merely because some unrelated card shares their name. Only a verified equivalent reprint/errata mapping can override its printed mark; otherwise mark eligibility unverified. Distinguish invalid construction from a structurally complete deck whose tournament eligibility is unverified. Missing rules, uncertain release/format metadata, or rules older than 14 days cannot produce a certified legal verdict.

Text transfer supports the application's unambiguous quantity-plus-ID format and Pokémon TCG Live-style quantity/name/set-code/number lists where source mappings exist. Reject unresolved lines rather than guessing; comments and category totals are tolerated. Export includes exact printing identifiers and verified Live codes when available. Loading tournament decks requires every printing to resolve and a 60-card total; otherwise show the original source link without claiming an importable deck.

## Current meta and deck guidance

Import public completed Pokémon tournament results and deck lists from Limitless. Each record includes event/date/format/country/region, division, player, placement, archetype, source URL, and optional fully resolved list. Use Masters international Standard as the default; separate Japan and exclude Pocket, Expanded, Juniors/Seniors, future, and unknown-format records from default rankings.

Initial evidence must include accessible recent international Standard results and at least one complete importable list. Reconcile source list totals and card identities. If a recent tournament or printing cannot be ingested, report it as excluded coverage, not an invented result. Store a reproducible dated snapshot, and provide a manual update command that preserves the previous snapshot on source/parse failures.

Provide date windows and region/country filters before calculating counts. Display share of collected deck records with its denominator, never global popularity or a fabricated win rate. Each result links to its original event/list. Stale snapshots (older than 14 days) and empty evidence windows have clear states.

Archetype guides cover each archetype displayed in the initial top sample, with source links, dates, game plan, strengths, weaknesses, and deck-building suggestions. Use printed cards and attributed published strategy as evidence. Label original reasoning as qualitative analysis. Matchup claims need attributed evidence; do not invent percentages. Custom deck guidance reports counts, missing evolution prerequisites, draw/search/energy setup observations where supported by explicit card metadata, and relevant matching archetype guidance. A deck with unsupported cards gets limited observations, not a fictitious strength score.

## Verification and deployment

Keep existing One Piece unit/browser checks. Add runnable regression checks for Pokémon ingestion, source count reconciliation, unknown fields/images, four-copy aggregation across printings, Basic Energy exceptions, Basic requirement, ACE SPEC limits, dated Standard eligibility/reprints, malformed imports/storage, preservation of good data after failed updates, and regional/date meta filtering.

Playwright verifies game switching, preservation of both drafts/saves, Pokémon search/set filters and real image rendering, category-specific detail, deck edits/import/export/reload, malformed import safety, sourced list loading, dated meta, keyboard dialogs, mobile navigation, and no horizontal overflow. Test the production build at the GitHub Pages subpath. CI must pass unit checks, production build, and browser flows before deploying. Verify the public site after deployment.

## Sources and confirmed constraints

- TCGdex card fields: https://tcgdex.dev/reference/card
- TCGdex set fields: https://tcgdex.dev/reference/set
- TCGdex image format: https://tcgdex.dev/assets
- Upstream metadata repository: https://github.com/tcgdex/cards-database (repository license does not license Pokémon artwork).
- Official competitive rules and reprint/errata guidance: https://play.pokemon.com/en-us/resources/rules/
- Official 2026 rotation announcement: https://www.pokemon.com/fr/actualites/rotation-de-la-saison-2026-du-format-standard-pour-le-jcc-pokemon ; verify accessible official rule documents during ingestion rather than assume the data provider is current.
- Limitless completed events: https://limitlesstcg.com/tournaments
- Recent international sample: https://limitlesstcg.com/tournaments/577 (Baltimore, September 19, 2026).

Read-only discovery found the TCGdex API timed out from the local runtime; the public documentation and metadata repository are accessible. Import implementation must verify actual coverage and artwork availability before reporting counts. Remote media remains third-party copyrighted material; use correct attribution and do not infer reproduction rights from metadata licensing.
