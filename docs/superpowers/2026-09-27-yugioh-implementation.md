# Yu-Gi-Oh! implementation record

Implemented English/Japanese card library, bilingual search, artwork variants, localized set groups and printing counts, independent language and TCG/OCG format controls, Main/Extra/Side construction, copy/count checks, browser saves, exact-ID text and .ydk transfer, and separately dated TCG/OCG placement evidence with sourced qualitative guidance.

Snapshot: 14,281 canonical identities, 2,422 localized set groups, 29,145 artwork links. Source YAML Yugi revision ca66e41dce3632c9e616f09b5780dbea17636d2f. Exact Konami IDs join metadata and artwork; YGOPRODeck metadata supplies verified canonical password aliases for source-list transfer. Five complete source lists resolve across both formats.

Rulings: provider explicitly allows browser hotlinks, so locale-specific YGOResources images are served remotely instead of bulk copying its collection. Printing artwork mappings, advertised product counts, regional release dates and complete official restrictions remain unknown and visible as such. Imported set records exclude Speed Duel. No new dependencies, backend or generic game engine were introduced.

Independent final review found canonical-copy fallback, empty edited draft replacement, locale artwork reference checks, evidence publication totals/format validation, dated evidence selection, and Speed Duel coverage issues. Fixed all reported issues, including the saved-empty-draft default-format edge. Regression checks cover the critical transfer and copy-limit cases.

Validation: 48 unit tests; production TypeScript/Vite build; existing 11 One Piece/Pokémon browser flows plus bilingual artwork, saved section transfer and mobile format-separated evidence flows. See repository test results/CI for the final run. Known limits: artwork links can fail remotely; full official legality cannot be certified from current provider restriction flags; evidence sample is deliberately small.
