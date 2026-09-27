# Yu-Gi-Oh! English and Japanese support

## Intent and scope

Add the same practical experience as Pokémon: illustrated cards and set information, deck construction, and recent competitive guidance explaining strengths and weaknesses. The user requested both English and Japanese versions. Interpret these as international English TCG and Japanese OCG; Asian-English, Master Duel, Rush Duel, Speed Duel and Genesys are outside this initial release. English is the default interface; Japanese card names and printed text are available without requiring Japanese interface translation.

## Approach

Recommended: add a Yu-Gi-Oh! screen using the existing navigation, image presentation, static snapshot imports and Pages deployment. Keep its data and construction rules separate from Pokémon and One Piece. Reuse presentation where appropriate without introducing a generic rules engine.

Alternatives: a live API-only screen would simplify importing but tie availability to upstream access and make dated rules harder to reproduce. A separate application would duplicate navigation, saves and deployment. Neither serves this existing multi-game builder as well.

## Catalog and artwork

Use stable Konami IDs and verified passcode mappings to join English and Japanese records. YGOPRODeck supplies English metadata, alternate-art identifiers and set memberships. Its API does not provide Japanese text or images; obtain Japanese records from multilingual YGOResources metadata and check them against the official Japanese database. Reject ambiguous joins rather than matching translated names heuristically.

The library offers English/Japanese card-text selection, search by either name, card ID or printed effect, and filters for set, card category, monster subtype, attribute, level/rank, Link rating, Pendulum scale and archetype. Details display printed effects, ATK/DEF where applicable, material requirements, Link arrows, scales, release metadata, source links and language-specific artwork. Unknown values stay unknown. English artwork must never be labeled Japanese artwork.

Set browsing separates English and Japanese product records and reports imported unique-card counts, printing records and advertised source counts separately. Artwork variants are not assumed to correspond to every rarity or set printing. Source omissions and unavailable translations/artwork are visible coverage limitations.

Respect image-provider requirements: YGOPRODeck requires re-hosting rather than continuous hotlinking. Verify an appropriate image distribution/hosting source before publishing. Download only verified card images for application hosting, retain attribution, validate successful image content, and record coverage. Japanese images require an exact language/card/variant match. Never generate replacements or use a different printing to conceal missing artwork.

## Deck builder

Support Main, Extra and Side Deck sections, with saved deck format TCG or OCG independent from card display language. Changing language preserves the draft and its format. Changing format preserves cards and reruns construction checks; it counts as an unsaved edit.

Check Main Deck 40–60, Extra Deck 0–15, Side Deck 0–15, section eligibility and up to three copies across all sections. Use sourced identity/treated-as mappings for shared name limits; alternate illustrations and translations share construction identity. Enforce Forbidden/Limited/Semi-Limited limits using the selected format's dated official list and release availability. Tokens are not playable deck entries. Unknown mappings, incomplete lists or rules older than 14 days cannot certify tournament legality. Provider banlist flags alone do not establish current legality.

Provide quantity editing, explicit save/load, separate Yu-Gi-Oh! storage, corruption-safe reads and writes, exact-ID text transfer, and .ydk import/export through verified passcodes. Unknown IDs or invalid section markers reject import without replacing the draft. Confirm replacement of unsaved drafts. Switching games preserves existing drafts and saves.

## Meta and guidance

Maintain separate dated TCG and Japanese OCG tournament samples, with event date, region, format, placement and original source. Show shares only within the collected sample and disclose its denominator. Exclude future events and incompatible formats. Source lists must resolve to exact known identities and valid section totals before enabling loading.

Provide qualitative guides for the initially displayed leading archetypes in each supported format: game plan, core cards, strengths, weaknesses and build considerations. Explain custom-deck section counts and supported structural observations; do not invent matchup win rates or simulated strength scores. Stale and empty evidence remains explicit. A selected tournament list loads into the correct game/format with dirty-draft protection.

## Implementation and verification constraints

Reuse installed dependencies and existing CI/CD. Import bounded requests into validated snapshots, publish atomically, and preserve prior data on failure. Do not scrape or download entire image collections speculatively. Lazy-load Yu-Gi-Oh! metadata when selected; another game's data failure must remain isolated.

Regression checks cover bilingual identity joins, genuine language-specific artwork, set count reconciliation, copy limits across sections and artwork variants, section eligibility, treated-as identities, dated TCG/OCG restrictions, transfer errors, corruption-safe saves and draft preservation. Browser checks cover both languages, both formats, real images, sets, deck editing, sourced guides, mobile overflow and the existing two games. Release requires a successful Pages workflow and public-site verification.

## Sources and confirmed constraints

- YGOPRODeck API documentation: https://ygoprodeck.com/api-guide/ — English metadata, artwork variants and set records; explicitly English-only images and no Japanese API locale; image re-hosting required.
- Multilingual record probe: https://db.ygoresources.com/data/card/4007 — structured language-specific card records with Konami identity and printing codes.
- Official bilingual database: https://www.db.yugioh-card.com/yugiohdb/card_search.action?request_locale=ja
- Official TCG restrictions: https://www.yugioh-card.com/en/limited/
- Japanese OCG construction rules: https://www.yugioh-card.com/japan/event/regulation/duel/

Actual imported counts and Japanese artwork coverage must be reported from verified sources during implementation, not promised as worldwide completeness.
