# One Piece TCG builder

## Purpose and scope

Build a responsive web app that lets players explore One Piece cards and sets, create legal decks, and understand their deck's strategy and its place in the current competitive environment. Start with Singapore/Asia and English card information. Region must be visible because releases, restrictions, and tournament environments differ.

The first release covers One Piece only. Other games, accounts, payments, card pricing, and a playable game simulator are outside this release.

## Card catalog

Provide searchable illustrated cards with filters for set, color, type, rarity, cost, and leader. Card details include number, name, rules text, traits, color, cost, power, counter, life where applicable, rarity, and artwork variants. Display missing fields as unavailable rather than inventing values.

Sets show their code, name, release date when verified, unique card-number count, and artwork count separately. Include boosters, starter decks, special products, and promotional cards represented by the chosen source. Reprints and alternate illustrations do not inflate unique-card counts.

Use Bandai's regional catalog and rules as authoritative references. Before importing, verify available access methods and image-use conditions. Maintain a local normalized catalog with source URLs and an import timestamp. Imports run outside user page requests and preserve the last successful snapshot on failure. Claim completeness only when imported set coverage and counts have been checked; otherwise clearly label coverage as partial.

## Deck builder

Select one leader and add cards from the catalog. Show card quantities, deck total, color compatibility, and cost distribution. Validate the current regional rules, including leader, main deck, DON!! deck, copy limits by card number across artworks, and effective restrictions. Verify exceptions against official rules before implementing them. Explain invalid choices without silently deleting cards.

Save decks locally in the browser. Support text import/export using card numbers and quantities, with errors for unknown identifiers or malformed quantities. No account or backend persistence is required initially.

## Meta and deck analysis

Show archetypes and example lists drawn from attributable tournament results. Every result includes region, event date, source, and placement when available. Explain the sample window and denominator for any popularity statistic. Do not present tournament share as matchup win rate.

Provide strengths, weaknesses, core game plan, and suggested card changes for supported archetypes, with evidence links. Distinguish sourced matchup evidence from qualitative advice. For an unfamiliar or incomplete deck, show structural observations such as curve, counters, and color legality; do not invent matchup percentages or a universal strength score.

Display when meta data was last checked. If no verified recent data is available, show an explicit empty or stale state. A failed refresh retains previously verified data and its original date. The initial update mechanism is a repeatable import command, rather than an unattended scheduler.

## Interface

Use three primary views: Cards & Sets, Deck Builder, and Meta. Prioritize card artwork, readable card text, filters, and a persistent deck summary while building. Support mobile layouts, keyboard navigation, labeled controls, visible focus, and useful image alternative text. Indicate loading, empty, stale, and error states.

## Implementation approach

Use a single TypeScript React app with Vite and ordinary CSS, plus small import scripts that generate local JSON snapshots. Reuse installed tools if the project gains existing infrastructure before implementation. Keep data ingestion separate from rendering so catalog and meta snapshots can update without changing UI code. Prefer browser localStorage for saved decks. No database, authentication service, or AI service is needed for the first release.

## Verification and acceptance

- Confirm source availability and import coverage before promising all published cards.
- Exercise search, set filtering, artwork selection, and the distinction between card and artwork counts.
- Leave runnable checks for normalization, deck validation, and import/export, including duplicate artwork copies, incompatible colors, unknown cards, and regional restrictions.
- Verify that missing and stale data are visibly identified and refresh failures preserve the last good snapshot.
- Run production build and inspect the catalog, deck builder, and meta views on desktop and mobile sizes.
- A user can find a card, inspect its illustration and set, build and save a deck, and see supported strategic advice with source dates.

## Assumptions and open external dependencies

Singapore/Asia is the initial region, inferred from the workspace timezone. The app is initially local and does not require public hosting. Full catalog coverage depends on a verifiable usable source; current meta coverage depends on accessible event evidence. These are implementation discovery tasks, and unavailable data must remain explicit rather than be substituted with fictional examples.
