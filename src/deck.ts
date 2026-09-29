import type { Card, RulesSnapshot } from './data.ts';
export type Deck = { id: string; name: string; leaderNumber: string | null; cards: Record<string, number>; donCount: number };
export const storageKey = 'grand-line.decks.v1';
export function newDeck(): Deck { return { id: crypto.randomUUID(), name: 'My next adventure', leaderNumber: null, cards: {}, donCount: 10 }; }
export function validateDeck(deck: Deck, cards: Card[], rules: RulesSnapshot, date: string): { issues: string[]; status: 'valid' | 'invalid' | 'unverified' } {
  const index = new Map(cards.map(c => [c.number, c]));
  const leader = index.get(deck.leaderNumber ?? '');
  const issues: string[] = [];
  const exception = rules.leaderExceptions[deck.leaderNumber ?? ''];
  const total = Object.values(deck.cards).reduce((a,b) => a+b, 0);
  const required = exception?.mainCount ?? rules.mainCount;
  if (!leader || leader.type !== 'LEADER') issues.push('Choose exactly one Leader card.');
  if (total !== required) issues.push(`Main deck needs ${required} cards; currently ${total}.`);
  const donRequired = exception?.donCount ?? rules.donCount;
  if (deck.donCount !== donRequired) issues.push(`DON!! deck needs exactly ${donRequired} cards.`);
  for (const [number, qty] of Object.entries(deck.cards)) {
    const card = index.get(number);
    if (!Number.isSafeInteger(qty) || qty < 1) { issues.push(`Invalid quantity for ${number}.`); continue; }
    if (!card) { issues.push(`Unknown card ${number}.`); continue; }
    if (!['CHARACTER','EVENT','STAGE'].includes(card.type)) issues.push(`${number} cannot be in the main deck.`);
    const limit = rules.copyExceptions[number] ?? rules.copyLimit;
    if (qty > limit) issues.push(`${number} exceeds its ${limit}-copy limit (all artworks combined).`);
    if (leader && !card.colors.some(color => leader.colors.includes(color))) issues.push(`${card.name} (${number}) does not match your Leader's colors.`);
    if (exception?.onlyTraits && !card.traits.some(t => exception.onlyTraits!.includes(t))) issues.push(`${number} must have the ${exception.onlyTraits.join(' / ')} type for this Leader.`);
    if (exception?.maxCost !== undefined && card.cost !== null && card.cost > exception.maxCost) issues.push(`${number} is too expensive for this Leader's construction rule.`);
    if (exception?.maxEventCost !== undefined && card.type === 'EVENT' && card.cost !== null && card.cost > exception.maxEventCost) issues.push(`${number} exceeds this Leader's allowed Event cost.`);
  }
  for (const restriction of rules.restrictions) {
    if (restriction.effectiveFrom <= date && (deck.cards[restriction.number] ?? (deck.leaderNumber === restriction.number ? 1 : 0)) > restriction.limit) issues.push(`${restriction.number} is ${restriction.limit === 0 ? 'banned' : `restricted to ${restriction.limit} copy`} from ${restriction.effectiveFrom}.`);
  }
  for (const pair of rules.bannedPairs) {
    if (pair.effectiveFrom <= date && pair.numbers.every(n => deck.cards[n] || deck.leaderNumber === n)) issues.push(`Banned pair: ${pair.numbers.join(' + ')} cannot be used together.`);
  }
  if (issues.length) return { issues, status: 'invalid' };
  const stale = (Date.parse(date) - Date.parse(rules.checkedAt)) / 86400000 > 14;
  return { issues: (!rules.verified || stale) ? [stale ? 'Rules snapshot is older than 14 days. Recheck official restrictions.' : 'Construction checks passed. Release dates and tournament format eligibility still need verification.'] : [], status: !rules.verified || stale ? 'unverified' : 'valid' };
}
export function parseDeck(text: string, cards: Card[]): Deck {
  if (text.length > 50000) throw new Error('Deck text is too long.');
  const deck = newDeck();
  deck.name = 'Imported crew';
  const index = new Map(cards.map(c => [c.number,c]));
  const lines = text.split(/\r?\n/).map(s=>s.trim()).filter(s=>s && !s.startsWith('#'));
  if (!lines.length) throw new Error('Paste a deck list first.');
  let donSeen = false;
  for (const line of lines) {
    const match = /^(\d+)\s*(?:x\s*)?((?:OP|ST|EB|PRB)\d{2}-\d{3}|P-\d{3}|DON!!)$/i.exec(line);
    if (!match) throw new Error(`Invalid line: ${line}. Use “4 OP17-002”.`);
    const qty = Number(match[1]); const number = match[2].toUpperCase();
    if (!Number.isSafeInteger(qty) || qty < 1 || qty > 100) throw new Error(`Invalid quantity: ${line}.`);
    if (number === 'DON!!') { if (donSeen) throw new Error('DON!! count can only be specified once.'); deck.donCount=qty;donSeen=true;continue; }
    const card = index.get(number);
    if (!card) throw new Error(`Unknown card: ${number}.`);
    if (card.type === 'LEADER') { if (deck.leaderNumber || qty !== 1) throw new Error('A deck has exactly one Leader.');deck.leaderNumber=number; }
    else { deck.cards[number]=(deck.cards[number] ?? 0)+qty; }
  }
  return deck;
}
export function exportDeck(deck: Deck): string {
  return [`# ${deck.name.replace(/[\r\n]/g,' ')}`, ...(deck.leaderNumber ? [`1 ${deck.leaderNumber}`] : []), ...Object.entries(deck.cards).sort(([a],[b])=>a.localeCompare(b)).map(([n,q])=>`${q} ${n}`), `${deck.donCount} DON!!`].join('\n');
}
export function isOnePieceDeck(d: unknown): d is Deck {
  const v=d as Deck;
  return !!v && typeof v.id==='string' && typeof v.name==='string' && (v.leaderNumber===null || typeof v.leaderNumber==='string') && Number.isSafeInteger(v.donCount) && v.donCount>=0 && !!v.cards && typeof v.cards==='object' && !Array.isArray(v.cards) && Object.entries(v.cards).every(([n,q])=>/^(?:(?:OP|ST|EB|PRB)\d{2}|P)-\d{3}$/.test(n) && Number.isSafeInteger(q) && q>0 && q<=100);
}
export function loadDecks(storage: Storage): { decks: Deck[]; error: string | null } {
  try { const data=JSON.parse(storage.getItem(storageKey) ?? '[]');if(!Array.isArray(data) || !data.every(isOnePieceDeck)) throw new Error('Invalid saved decks');return { decks:data, error:null }; }
  catch { return { decks:[],error:'Saved decks could not be read. Original storage has been preserved. Export your current deck before closing.' }; }
}
export function saveDecks(storage: Storage, decks: Deck[]): { error: string | null } {
  try { if (!decks.every(isOnePieceDeck)) throw new Error('Invalid deck'); storage.setItem(storageKey,JSON.stringify(decks));return {error:null}; }
  catch { return {error:'Deck could not be saved in this browser. Export it to avoid losing your changes.'}; }
}
