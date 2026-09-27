import type { Card, CatalogSnapshot } from './data.ts';
export const colors = ['Red', 'Green', 'Blue', 'Purple', 'Black', 'Yellow'];
export function safeUrl(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  try { const u = new URL(value); return u.protocol === 'https:' && !u.username && !u.password; } catch { return false; }
}
export function normalizeCatalog(raw: unknown): CatalogSnapshot {
  const data = raw as CatalogSnapshot;
  if (!data || !Array.isArray(data.cards) || !data.cards.length || !Array.isArray(data.sets) || !data.sets.length || !/^\d{4}-\d{2}-\d{2}/.test(data.checkedAt) || data.region !== 'Asia' || !['partial', 'complete'].includes(data.coverage)) throw new Error('Invalid catalog snapshot. Previous data preserved.');
  const ids = new Set<string>();
  const codes = new Set(data.sets.map(s => s.code));
  for (const s of data.sets) {
    if (!s.code || !s.name || !safeUrl(s.sourceUrl) || !Number.isInteger(s.expectedArtworks) || s.expectedArtworks < 1) throw new Error('Invalid set metadata.');
  }
  for (const card of data.cards) {
    if (!card.id || ids.has(card.id) || !/^(?:OP|ST|EB|PRB|P|DON)\d*-\d{3}$/.test(card.number) || !codes.has(card.setCode) || !card.name || !Array.isArray(card.colors) || card.colors.some(c => !colors.includes(c)) || !Array.isArray(card.traits) || !['LEADER', 'CHARACTER', 'EVENT', 'STAGE', 'DON!!'].includes(card.type) || !safeUrl(card.imageUrl) || !safeUrl(card.sourceUrl)) throw new Error(`Invalid card: ${card.id ?? 'unknown'}`);
    for (const key of ['cost', 'power', 'counter', 'life'] as const) {
      if (card[key] !== null && (!Number.isInteger(card[key]) || card[key]! < 0)) throw new Error(`Invalid ${key}: ${card.id}`);
    }
    ids.add(card.id);
  }
  return data;
}
export function setCounts(cards: Card[], setCode: string): { uniqueCards: number; artworks: number } {
  const set = cards.filter(c => c.setCode === setCode);
  return { uniqueCards: new Set(set.map(c => c.number)).size, artworks: set.length };
}
export type CardQuery = { search: string; setCode: string; color: string; type: string; rarity: string; cost: string };
export function filterCards(cards: Card[], query: CardQuery): Card[] {
  const search = query.search.trim().toLowerCase();
  return cards.filter(card => (!search || `${card.number} ${card.name} ${card.text} ${card.traits.join(' ')}`.toLowerCase().includes(search))
    && (!query.setCode || card.setCode === query.setCode)
    && (!query.color || (query.color === 'Multicolor' ? card.colors.length > 1 : card.colors.includes(query.color)))
    && (!query.type || card.type === query.type)
    && (!query.rarity || card.rarity === query.rarity)
    && (query.cost === '' || card.cost === Number(query.cost)));
}
