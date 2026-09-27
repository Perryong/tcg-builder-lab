import type { ArchetypeNote, Card, EventRecord, MetaSnapshot } from './data.ts';
import type { Deck } from './deck.ts';
export function selectEvidence(snapshot: MetaSnapshot, region: string, from: string, to: string): EventRecord[] {
  return snapshot.events.filter(e=>e.region===region && e.date>=from && e.date<=to).sort((a,b)=>b.date.localeCompare(a.date));
}
export function analyzeDeck(deck: Deck, cards: Card[], snapshot: MetaSnapshot): { observations: string[]; archetypeNotes: ArchetypeNote | null } {
  const index=new Map(cards.map(c=>[c.number,c]));
  const rows=Object.entries(deck.cards);
  const total=rows.reduce((n,[,q])=>n+q,0);
  const count=(predicate:(c:Card)=>boolean)=>rows.reduce((n,[number,qty])=>n+(index.has(number)&&predicate(index.get(number)!)?qty:0),0);
  const unknown=rows.reduce((n,[number,qty])=>n+(!index.has(number)||index.get(number)!.counter===null?qty:0),0);
  const cheap=count(c=>c.cost!==null&&c.cost<=3);
  const expensive=count(c=>c.cost!==null&&c.cost>=7);
  const counter=count(c=>c.counter!==null&&c.counter>=2000);
  const observations=total ? [
    `${cheap} of ${total} cards cost 3 or less: your early-turn options.`,
    `${expensive} cards cost 7 or more. Plan your DON!! curve before committing to a top-heavy hand.`,
    `${counter} cards have a printed counter of 2000 or more. Review your defensive hand alongside Counter Events.`,
    ...(unknown?[`${unknown} cards have unknown or unavailable printed counter values; they are not counted as zero.`]:[]),
    ...(total!==50?[`This is a ${total}-card draft. Finish construction before comparing it with tournament lists.`]:[])
  ] : ['Add cards to your deck to see its cost curve, counter coverage, and structural trade-offs.'];
  const archetypeNotes=snapshot.archetypes.find(a=>a.leaderNumber===deck.leaderNumber && a.region===snapshot.region)??null;
  return {observations,archetypeNotes};
}
