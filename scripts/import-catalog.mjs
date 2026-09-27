import { load } from 'cheerio';
import { writeFile, rename, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { normalizeCatalog } from '../src/catalog.ts';
const base = 'https://asia-en.onepiece-cardgame.com/cardlist/';
const clean = s => s.replace(/\s+/g, ' ').trim();
export function parseSets(html) {
  const $ = load(html);
  return $('#series option').toArray().filter(e => /^\d+$/.test($(e).attr('value') ?? '')).map(e => {
    const series = $(e).attr('value');
    const name = clean(load($(e).text()).text());
    const code = name.match(/\[((?:OP|EB|ST|PRB)-\d+)\]/)?.[1] ?? `PROMO-${series}`;
    return { code, series, name, category: name.includes('PREMIUM') ? 'Premium' : name.includes('EXTRA') ? 'Extra booster' : name.includes('BOOSTER') ? 'Booster' : name.includes('DECK') ? 'Starter deck' : 'Promotional', releaseDate: null, sourceUrl: `${base}?series=${series}`, expectedArtworks: 0 };
  });
}
export function parseCards(html, set) {
  const $ = load(html);
  return $('dl.modalCol').toArray().map(e => {
    const node = $(e);
    const info = node.find('.infoCol span').toArray().map(e => clean($(e).text()));
    const value = selector => {
      const part = node.find(selector).first().clone();
      part.find('h3').remove();
      part.find('br').replaceWith('\n');
      return part.text().trim();
    };
    const num = selector => /^\d+$/.test(value(selector)) ? Number(value(selector)) : null;
    const id = node.attr('id');
    const image = node.find('.frontCol img').first();
    return {
      id: `${set.code}:${id}`, number: info[0], setCode: set.code, name: clean(node.find('.cardName').text()),
      colors: value('.color').split(/[\/\s]+/).filter(Boolean), type: info[2], rarity: info[1],
      cost: node.find('.cost h3').text().trim() === 'Life' ? null : num('.cost'), power: num('.power'), counter: num('.counter'), life: num('.life') ?? (node.find('.cost h3').text().trim() === 'Life' ? num('.cost') : null),
      traits: value('.feature').split('/').filter(Boolean), text: value('.text'), trigger: value('.trigger'),
      imageUrl: new URL(image.attr('data-src') ?? image.attr('src'), base).href,
      sourceUrl: `${set.sourceUrl}#${id}`, block: value('.block') || null, attribute: value('.attribute')
    };
  });
}
export async function publishCatalog(path, candidate) {
  const normalized = normalizeCatalog(candidate);
  const temporary = `${path}.${crypto.randomUUID()}.tmp`;
  await writeFile(temporary, JSON.stringify(normalized));
  await rename(temporary, path);
}
export function attachArtwork(snapshot, imageRecords) {
  const index = new Map(imageRecords.filter(r => typeof r.card_image === 'string' && r.card_image.startsWith('https://optcgapi.com/media/')).map(r => [r.card_image_id, r.card_image]));
  return { ...snapshot, cards: snapshot.cards.map(card => {
    const variant = card.id.includes(':') ? card.id.split(':')[1] : card.id;
    const image = index.get(variant);
    return { ...card, imageUrl: image ?? card.imageUrl, artworkAvailable: !!image };
  }) };
}
async function get(url) {
  const response = await fetch(url, { signal: AbortSignal.timeout(30000), headers: { 'User-Agent': 'GrandLineLocalCatalog/0.1' } });
  if (!response.ok) throw new Error(`${response.status}: ${url}`);
  return response.text();
}
async function main() {
  const initial = await get(base);
  const sets = parseSets(initial);
  if (!sets.length) throw new Error('Source format changed: no set options.');
  const cards = [];
  for (const set of sets) {
    const html = await get(set.sourceUrl);
    const parsed = parseCards(html, set);
    const match = html.match(/([\d,]+)\s+results/);
    if (!match || !parsed.length || parsed.length !== Number(match[1].replaceAll(',', ''))) throw new Error(`Coverage mismatch for ${set.code}: ${parsed.length} imported / ${match?.[1] ?? 'unknown'} advertised. Nothing published.`);
    set.expectedArtworks = parsed.length;
    cards.push(...parsed);
    console.log(`${set.code}: ${parsed.length} artworks`);
    await new Promise(r => setTimeout(r, 250));
  }
  // ponytail: official catalog only; add licensed sources for worldwide and missing-product coverage.
  const snapshot = { region: 'Asia', checkedAt: new Date().toISOString(), coverage: 'partial', coverageNotes: `All ${sets.length} available official Asia catalog groups imported and artwork counts reconciled. Worldwide coverage and release-date legality are not certified. Artwork is linked from Bandai; this local app is unofficial.`, sets, cards };
  const imageRows = [];
  for (const endpoint of ['allSetCards','allSTCards']) {
    const response = await fetch(`https://optcgapi.com/api/${endpoint}/`, {signal: AbortSignal.timeout(30000)});
    if (!response.ok) throw new Error(`Public artwork API unavailable: ${endpoint}. Previous snapshot preserved.`);
    const rows = await response.json();
    if (!Array.isArray(rows) || !rows.length) throw new Error('Artwork API format changed.');
    imageRows.push(...rows);
  }
  const enriched = attachArtwork(snapshot, imageRows);
  const displayed = enriched.cards.filter(c => c.artworkAvailable).length;
  enriched.coverageNotes += ` ${displayed} illustrations have public OPTCG API image links; other artwork is available via the official card link. Release dates are unverified.`;
  await publishCatalog(resolve('public/data/catalog.json'), enriched);
  console.log(`Published ${cards.length} illustrations / ${new Set(cards.map(c => c.number)).size} unique cards / ${sets.length} groups.`);
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch(error => { console.error(error.message); process.exitCode = 1; });
}
