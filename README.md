# Grand Line — One Piece TCG companion

A local React/TypeScript application for exploring One Piece cards, building decks, and studying dated regional tournament evidence.

## Run

Requires Node.js 22.18+ (Node 26 used during development).

```sh
npm install
npm run dev
```

Open the URL printed by Vite. The default is http://127.0.0.1:5173; if occupied, Vite chooses the next free port.

```sh
npm test
npm run build
npx playwright install chromium
npm run test:e2e
```

`test:e2e` starts a test server on port 5180. Optional `PLAYWRIGHT_CHROMIUM_EXECUTABLE` selects an existing Chromium executable. Tests cover search, leader details, image rendering, browser saves, import errors, sourced deck loading, and mobile navigation.

## Update data

```sh
npm run update:catalog
npm run repair:artwork
npm run update:meta
```

The catalog updater fetches each official Asia catalog group sequentially, reconciles advertised artwork counts, attaches public artwork URLs, and runs exact-variant artwork repair. Artwork repair checks missing variants against public OPTCG.GG and Limitless image URLs, four requests at a time; HTML or failed responses are not accepted as artwork. It never substitutes a different artwork for an unavailable variant. Both catalog and meta importers validate before atomically replacing the previous snapshot. Failed import commands preserve the previous data.

The catalog snapshot includes all 62 available official Asia catalog groups: 2,815 unique card numbers and 4,915 artwork records. Artwork repair restored 702 illustrations, bringing public image coverage to 4,774 records; 141 exact variants remain unavailable. Counts are imported artwork records, not the total number of physically printed copies. Worldwide completeness, some product release dates, and unpublished promotions are not certified. Exact variants without a displayable public image remain explicitly unavailable, with an official source link.

Artwork is loaded remotely, not copied into this repository. Providers may remove images or have network outages; the UI handles failures. Card metadata and rules originate from [Bandai's Asia catalog](https://asia-en.onepiece-cardgame.com/cardlist/). Public artwork links come from [OPTCG API](https://optcgapi.com/documentation), [OPTCG.GG](https://www.optcg.gg/), and [Limitless](https://onepiece.limitlesstcg.com/). This is an unofficial local fan companion. Bandai's site states that reproduction of its images, text, and data requires permission; public deployment and artwork reuse permissions have not been assessed or authorized by this project.

## Decks and restrictions

Decks use explicit **Save deck**. Without a username they stay in this browser's localStorage. With a username they are cached locally and synced to Supabase; the header distinguishes synced, pending and failed work. Export to text for a separate backup. Corrupt existing storage is preserved rather than silently overwritten. Starting or loading another deck warns about unsaved changes.

Checks cover main-deck size, Leader selection, DON!! count, card colors, card-number copy limits across illustrations, known card/leader construction exceptions, current bans, and banned pairs. Purple Enel's six-DON rule is supported. The rules snapshot records current restrictions observed on September 27, 2026, and Mihawk's announced October 12 ban separately. Earlier historical ban legality is not reconstructed. Rules are not refreshed by the meta command; recheck and update `public/data/rules.json` against official sources when announcements change.

The app intentionally does **not certify tournament legality**: product release dates, regional language eligibility, and Standard Regulation block-number updates require verification with the event organizer. A deck can pass structural checks and still need format verification. Rules older than 14 days are flagged.

Official references: [comprehensive rules](https://asia-en.onepiece-cardgame.com/pdf/rule_comprehensive.pdf?20260911=), [restrictions](https://asia-en.onepiece-cardgame.com/news/restriction.html), [Standard and Extra Regulation](https://asia-en.onepiece-cardgame.com/topics/021.php).

## Competitive evidence and guidance

The initial meta snapshot contains 242 records from [One Piece Top Decks' OP-17 results](https://onepiecetopdecks.com/deck-list/japan-op17-deck-list-the-worlds-strongest-warriors/), including 28 non-Japan Asia records and 212 Japan records. Two other-region records are not included by default filters. This is a sample of published lists, not complete tournament participation or global popularity. Store, team, and regional events can all appear; source and country are shown for each result. Complete known-card 50-card lists can be loaded as new decks. The date and region filters are applied before computing any shares.

Eight leader guides provide qualitative strengths, weaknesses, and construction suggestions based on printed leader effects. They are explicitly labeled as analysis, not measured matchup evidence. Custom decks receive structural observations, not fictional win rates. No matchup simulation or strength score is implemented. Current guidance does not claim to provide exhaustive matchup analysis.

Snapshots older than 14 days are labeled stale. Card and meta updates remain manual commands.
# tcg-builder-lab

## GitHub Pages and CI/CD

Live site: https://perryong.github.io/tcg-builder-lab/

`.github/workflows/pages.yml` runs on pull requests, pushes to `main`, and manual dispatch. It runs unit and browser checks, plus pgTAP and account browser checks against an isolated local Supabase stack. Successful `main` builds deploy the same artifact to GitHub Pages after both jobs pass. Pull requests only run checks. Pages uses GitHub Actions as its publishing source; no personal access token is stored in the workflow.

To reproduce the production checks locally:

```sh
npm run build -- --base=/tcg-builder-lab/
PLAYWRIGHT_PREVIEW=1 npm run test:e2e
```

Data snapshots remain manual updates; commit refreshed snapshots to `main` to publish them. Guest decks are specific to the site's origin; use text export/import to move guest decks from localhost to the hosted site.

## Username and cloud decks

Enter a username and choose **Continue with username**. An unused username creates an empty cloud account; an existing one opens its One Piece, Pokémon and Yu-Gi-Oh! decks. Names are case-insensitive and allow 3–24 ASCII letters, numbers or underscores. A “New username created” notice helps flag accidental typos. **Anyone who knows or guesses a username can view and edit its decks.** There is no email, password, ownership check, recovery or revocation. A username is a shared edit handle, not a private account credential.

When you open a username, guest decks saved on that device stay local. Choose **Import this device's decks** and confirm the exact username before uploading them; declining leaves the guest decks and import action intact. Signing out removes the active username from this browser, while pending account saves remain in its account-scoped local cache until that username is reopened. An existing 48-character access ID can still be entered under **Move old decks**; claim a username after opening it. Claiming keeps the same decks and account, and the old ID remains usable during this compatibility period. New access IDs are no longer created by the UI.

Cloud saves require an anonymous Supabase Auth session and the SQL migration in `supabase/migrations`. The browser build uses only `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY`. Do not use a secret or service-role key in Vite or GitHub Pages. Set those two GitHub repository variables for deployment, and set them in an ignored `.env.local` for local development. Enable anonymous sign-ins in the Supabase project's Auth settings before deployment. The catalog, artwork links and tournament evidence remain static files in this repository; only personal decks sync.

For isolated local account checks, run `supabase start` and `supabase test db`, then supply the local API URL and publishable key in `.env.local`; set `ACCOUNT_TEST_SUPABASE_URL` and `ACCOUNT_TEST_DB_CONTAINER` when running `tests/e2e/account.spec.ts`. Ordinary browser checks skip account cases without the local stack and never use the production database.

## Pokémon support

Choose **Pokémon** in the game selector to explore 21,290 English physical card printings in 201 set groups, with 20,369 remote artwork links. Pokémon TCG Pocket is excluded. The catalog comes from a pinned TCGdex public metadata repository revision recorded in the snapshot; counts describe available source records, not certified worldwide completeness. Missing images and untranslated/omitted records remain explicit limitations. Foil finishes do not inflate artwork counts.

The Pokémon builder checks 60 cards, Basic Pokémon, copy limits across official card names, Basic Energy exceptions, sourced ACE SPEC/Radiant limits, regulation marks and dated rotation. English international Standard is the default. Equivalent reprint/errata mappings, individual promo releases, complete restrictions and event-specific rules are not fully verified; structural checks do not certify tournament legality. Older same-name printings are not automatically granted eligibility. Ambiguous upstream Energy metadata remains unknown rather than receiving the Basic Energy exception.

Pokémon guest saves use a separate browser storage key; One Piece saves are preserved. Account decks also stay separate by game. Both unsaved drafts survive switching games within the session. Save explicitly or export before closing/reloading. Text imports accept exact quantity-plus-card-ID lines and verified set-code/collector-number lines with matching names. Unknown or ambiguous printings are rejected, without replacing the draft.

The initial Pokémon meta sample contains 64 top-16 Masters records from four completed August/September 2026 events, with international Standard and Japan Standard separated. Sixty lists resolve to known 60-card decks; four retain source links without a load action. Nine guides explain printed-card strategy and trade-offs, labeled qualitative analysis. Sample shares are not global rankings or win rates. Unsupported custom decks receive limited structural observations.

```sh
npm run update:pokemon
npm run update:pokemon-meta
```

The catalog updater clones a single upstream revision, interprets literal metadata without executing upstream code, fetches the artwork manifest, validates counts and publishes atomically. `POKEMON_SOURCE=/path/to/cards-database` can select an existing checkout; its revision is recorded. Catalog import also writes candidate construction exceptions to `scripts/pokemon-exceptions.json`; review and copy updated exceptions into the dated rules snapshot when refreshing rules. Meta import checks source totals and exact printing mappings before allowing deck loading. Failed commands preserve the previous catalog/evidence. Rules dates are not refreshed automatically merely because data was downloaded.

Sources: [TCGdex metadata](https://github.com/tcgdex/cards-database), [TCGdex assets](https://tcgdex.dev/assets), [official Pokémon rules](https://play.pokemon.com/en-us/resources/rules/), [Limitless tournaments](https://limitlesstcg.com/tournaments). Pokémon images/text remain copyright Pokémon, Nintendo, Creatures and GAME FREAK. Metadata licensing does not grant artwork ownership. This site is an unofficial fan companion.

Pokémon artwork repair: `npm run repair:pokemon-artwork` fills missing links from the public [Pokémon TCG data repository](https://github.com/PokemonTCG/pokemon-tcg-data), matching an unambiguous English set name, collector number and card name. Each additional link must return successful image content; a missing high-resolution image can use the same card’s small image. Failed requests abort publication, and confirmed missing images remain unavailable. Existing TCGdex images stay intact. `npm run update:pokemon` also runs this repair. The current snapshot has 20,369 artwork links; 921 printings still have no exact image mapping. Artwork stays remote; no substitute printings or generated illustrations are used.

30th Anniversary artwork uses [TCGJoin’s 30th Celebration catalog](https://tcgjoin.com/en/pokemon-30th-celebration-cards) to resolve exact TCGplayer artwork URLs. All 30 Classic Collection cards and all 161 main-set printings have verified image responses. Classic Collection mapping accounts for original printed collector numbers versus TCGdex’s sequential IDs. The seven last-revealed cards use individually reviewed, attributed image mappings in `scripts/pokemon-30th-artwork.json`; their English artwork, collector numbers and RGB colors were visually checked. The standard artwork repair command refreshes these mappings too.

### Yu-Gi-Oh! English / Japanese

Select Yu-Gi-Oh! to browse localized cards and sets, build separate Main/Extra/Side sections, save decks locally or with a username, and import/export exact card IDs or `.ydk` passwords. Card language does not change TCG/OCG deck format. Tournament evidence is separated by format and date window.

Catalog metadata: [YAML Yugi](https://github.com/DawnbrandBots/yaml-yugi). Genuine language-specific art: [YGOResources artwork index](https://github.com/yugioh-artworks/artworks-index). Browser image serving follows that provider’s documented web-app usage. Images are not generated and are not guaranteed for every printing. Set counts represent imported unique identities and printing records, not certified advertised product totals.

Rebuild metadata from a pinned local YAML Yugi checkout and downloaded artwork manifest and YGOPRODeck card metadata:

```sh
YUGIOH_SOURCE=/path/to/yaml-yugi YUGIOH_ART_MANIFEST=/path/to/manifest.json YUGIOH_PASSCODE_SOURCE=/path/to/cardinfo.json node scripts/import-yugioh.mjs
node scripts/import-yugioh-meta.mjs
```

Restriction flags and regional releases are not fully certified; deck legality stays **unverified** when evidence is incomplete. The meta snapshot is five published placements from two September 2026 events, with qualitative guidance derived from printed effects. It is a small sample, not a global ranking or measured win rate.
