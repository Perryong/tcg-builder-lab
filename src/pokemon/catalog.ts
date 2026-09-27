import {pokemonEligibility} from './deck.ts';
import {safeUrl} from '../catalog.ts';
import type {PokemonCatalog,PokemonCard,PokemonSet,PokemonRules} from './data.ts';
export function normalizePokemonCatalog(raw:unknown):PokemonCatalog{
 const d=raw as PokemonCatalog;if(!d||!Array.isArray(d.sets)||!d.sets.length||!Array.isArray(d.cards)||!d.cards.length||!/^\d{4}-\d{2}-\d{2}/.test(d.checkedAt)||!d.sourceRevision)throw Error('Invalid Pokémon snapshot.');
 const sets=new Map(d.sets.map(s=>[s.id,s]));const ids=new Set<string>();
 for(const s of d.sets)if(!s.id||!s.name||!safeUrl(s.sourceUrl)||s.series==='tcgp'||/pocket/i.test(s.series)||!Number.isSafeInteger(s.importedCount)||s.importedCount<1)throw Error('Invalid physical Pokémon set.');
 for(const c of d.cards){if(!c.id||ids.has(c.id)||!sets.has(c.setId)||!c.name||!['Pokemon','Trainer','Energy'].includes(c.category)||!safeUrl(c.sourceUrl)||(c.imageUrl!==null&&!safeUrl(c.imageUrl)))throw Error(`Invalid Pokémon card ${c.id}`);for(const k of ['hp','retreat'] as const)if(c[k]!=null&&(!Number.isSafeInteger(c[k])||c[k]!<0))throw Error(`Invalid ${k}`);ids.add(c.id);}
 for(const s of d.sets)if(d.cards.filter(c=>c.setId===s.id).length!==s.importedCount||s.totalCount!==null&&s.totalCount!==s.importedCount)throw Error(`Set count mismatch: ${s.id}`);
 return d;
}
export type PokemonQuery={search:string;setId:string;category:string;type:string;stage:string;rarity:string;eligibility:string};
export function filterPokemonCards(cards:PokemonCard[],sets:PokemonSet[],q:PokemonQuery,_rules:PokemonRules,_date:string):PokemonCard[]{
 const names=new Map(sets.map(s=>[s.id,s.name]));const search=q.search.toLowerCase().trim();
 return cards.filter(c=>(!search||`${c.id} ${c.name} ${names.get(c.setId)} ${c.effect} ${c.attacks.map(a=>a.name+' '+a.effect).join(' ')} ${c.abilities.map(a=>a.name+' '+a.effect).join(' ')}`.toLowerCase().includes(search))&&(!q.setId||q.setId===c.setId)&&(!q.category||q.category===c.category)&&(!q.type||c.types.includes(q.type))&&(!q.stage||q.stage===c.stage)&&(!q.rarity||q.rarity===c.rarity)&&(!q.eligibility||pokemonEligibility(c,cards,_rules,_date).status===q.eligibility));
}
