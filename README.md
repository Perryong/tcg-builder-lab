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

Decks use explicit **Save deck** and are stored in this browser's localStorage. Export to text to move them or back them up. Failed saves display an error. Corrupt existing storage is preserved rather than silently overwritten; export drafts before closing. Starting or loading another deck warns about unsaved changes.

Checks cover main-deck size, Leader selection, DON!! count, card colors, card-number copy limits across illustrations, known card/leader construction exceptions, current bans, and banned pairs. Purple Enel's six-DON rule is supported. The rules snapshot records current restrictions observed on September 27, 2026, and Mihawk's announced October 12 ban separately. Earlier historical ban legality is not reconstructed. Rules are not refreshed by the meta command; recheck and update `public/data/rules.json` against official sources when announcements change.

The app intentionally does **not certify tournament legality**: product release dates, regional language eligibility, and Standard Regulation block-number updates require verification with the event organizer. A deck can pass structural checks and still need format verification. Rules older than 14 days are flagged.

Official references: [comprehensive rules](https://asia-en.onepiece-cardgame.com/pdf/rule_comprehensive.pdf?20260911=), [restrictions](https://asia-en.onepiece-cardgame.com/news/restriction.html), [Standard and Extra Regulation](https://asia-en.onepiece-cardgame.com/topics/021.php).

## Competitive evidence and guidance

The initial meta snapshot contains 242 records from [One Piece Top Decks' OP-17 results](https://onepiecetopdecks.com/deck-list/japan-op17-deck-list-the-worlds-strongest-warriors/), including 28 non-Japan Asia records and 212 Japan records. Two other-region records are not included by default filters. This is a sample of published lists, not complete tournament participation or global popularity. Store, team, and regional events can all appear; source and country are shown for each result. Complete known-card 50-card lists can be loaded as new decks. The date and region filters are applied before computing any shares.

Eight leader guides provide qualitative strengths, weaknesses, and construction suggestions based on printed leader effects. They are explicitly labeled as analysis, not measured matchup evidence. Custom decks receive structural observations, not fictional win rates. No matchup simulation or strength score is implemented. Current guidance does not claim to provide exhaustive matchup analysis.

Snapshots older than 14 days are labeled stale. Updates are manual commands; no unattended job, account, database, or public hosting was added.
