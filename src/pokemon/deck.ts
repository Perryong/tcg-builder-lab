import type {PokemonCard,PokemonDeck,PokemonRules} from './data.ts';
export const pokemonStorageKey='tcg-builder.pokemon.decks.v1';
export function newPokemonDeck():PokemonDeck{return {id:crypto.randomUUID(),name:'My Pokémon deck',cards:{}};}
export function pokemonEligibility(card:PokemonCard,cards:PokemonCard[],rules:PokemonRules,date:string):{status:'eligible'|'ineligible'|'unknown';reason:string}{
 const banned=rules.bans.some(b=>b.effectiveFrom<=date&&b.cardIds.includes(card.id));if(banned)return {status:'ineligible',reason:'Banned in this rules snapshot.'};
 if(card.category==='Energy'&&card.energyType==='Basic')return {status:'eligible',reason:'Basic Energy is permitted.'};
 const equivalent=rules.reprints[card.id]?cards.find(c=>c.id===rules.reprints[card.id]):undefined;const c=equivalent??card;
 if(!c.releaseDate)return {status:'unknown',reason:'Release eligibility unavailable.'};
 if(Date.parse(c.releaseDate)+14*86400000>Date.parse(date))return {status:'ineligible',reason:'Not yet eligible under the two-week release rule.'};
 const rotation=rules.rotations.filter(r=>r.effectiveFrom<=date).sort((a,b)=>b.effectiveFrom.localeCompare(a.effectiveFrom))[0];
 if(!rotation||!c.regulationMark)return {status:'unknown',reason:'Regulation mark or dated rotation unavailable; check equivalent reprints.'};
 return rotation.allowedMarks.includes(c.regulationMark)?{status:'eligible',reason:`Regulation ${c.regulationMark}; verify event rules.`}:{status:'ineligible',reason:`Regulation ${c.regulationMark} is outside this Standard rotation. Equivalent reprints need verification.`};
}
export function validatePokemonDeck(deck:PokemonDeck,cards:PokemonCard[],rules:PokemonRules,date:string){
 const index=new Map(cards.map(c=>[c.id,c]));const issues:string[]=[];const unknown:string[]=[];let total=0,basic=0;const names=new Map<string,{qty:number,limit:number}>(),groups=new Map<string,{qty:number,limit:number}>();
 for(const [id,q] of Object.entries(deck.cards)){if(!Number.isSafeInteger(q)||q<1||q>60){issues.push(`Invalid quantity for ${id}.`);continue;}total+=q;const c=index.get(id);if(!c){issues.push(`Unknown printing ${id}.`);continue;}if(c.category==='Pokemon'&&c.stage==='Basic')basic+=q;
 const ex=rules.exceptions[id];if(!(c.category==='Energy'&&c.energyType==='Basic')){const n=names.get(c.name)??{qty:0,limit:ex?.copyLimit??4};n.qty+=q;n.limit=Math.min(n.limit,ex?.copyLimit??4);names.set(c.name,n);}
 if(ex?.group){const g=groups.get(ex.group)??{qty:0,limit:ex.groupLimit??1};g.qty+=q;groups.set(ex.group,g);}
 const eligibility=pokemonEligibility(c,cards,rules,date);if(eligibility.status==='ineligible')issues.push(`${c.name} (${id}): ${eligibility.reason}`);if(eligibility.status==='unknown')unknown.push(`${c.name}: ${eligibility.reason}`);
 }
 if(total!==60)issues.unshift(`Deck needs 60 cards; currently ${total}.`);if(!basic)issues.push('Include at least one Basic Pokémon.');for(const [name,n] of names)if(n.qty>n.limit)issues.push(`${name} exceeds ${n.limit} copies across all printings.`);for(const [group,g] of groups)if(g.qty>g.limit)issues.push(`Only ${g.limit} ${group} card allowed in total.`);
 if(issues.length)return {status:'invalid' as const,issues};const stale=!Number.isFinite(Date.parse(rules.checkedAt))||(Date.parse(date)-Date.parse(rules.checkedAt))/86400000>14;
 if(stale||!rules.verified||unknown.length)return {status:'unverified' as const,issues:[...unknown,...(stale?['Rules snapshot is stale. Recheck official rules.']:[]),...(!rules.verified?['Construction checked; equivalent reprints, releases and event eligibility require verification.']:[])]};return {status:'valid' as const,issues:[]};
}
export function parsePokemonDeck(text:string,cards:PokemonCard[]):PokemonDeck{
 if(text.length>50000)throw Error('Deck text is too long.');const deck=newPokemonDeck();deck.name='Imported Pokémon deck';
 for(const line of text.split(/\r?\n/).map(s=>s.trim()).filter(Boolean)){
 if(line.startsWith('#')||/^(?:Pok[eé]mon|Trainer|Energy|Total Cards|Pok[eé]mon Cards|Trainer Cards|Energy Cards)\s*[:\-]\s*\d+$/i.test(line))continue;
 const exact=/^(\d+)\s+(\S+)$/.exec(line),live=/^(\d+)\s+(.+?)\s+([\w-]+)\s+([\w-]+)$/.exec(line);let q:number,c:PokemonCard|undefined;
 if(exact){q=Number(exact[1]);c=cards.find(c=>c.id===exact[2]);}else if(live){q=Number(live[1]);const matches=cards.filter(c=>c.liveCode?.toUpperCase()===live[3].toUpperCase()&&c.localId.replace(/^0+(?=\d)/,'')===live[4].replace(/^0+(?=\d)/,'')&&c.name.toLowerCase()===live[2].toLowerCase());if(matches.length>1)throw Error(`Ambiguous printing: ${line}`);c=matches[0];}else throw Error(`Invalid line: ${line}. Use quantity and exact card ID.`);
 if(!Number.isSafeInteger(q)||q<1||q>60)throw Error(`Invalid quantity: ${line}`);if(!c)throw Error(`Unknown or unresolved printing: ${line}`);deck.cards[c.id]=(deck.cards[c.id]??0)+q;if(deck.cards[c.id]>60)throw Error('Quantity exceeds deck size.');
 }if(!Object.keys(deck.cards).length)throw Error('Paste a deck list first.');return deck;
}
export function exportPokemonDeck(deck:PokemonDeck,_cards:PokemonCard[]):string{return [`# ${deck.name.replace(/[\r\n]/g,' ')}`, ...Object.entries(deck.cards).sort(([a],[b])=>a.localeCompare(b)).map(([id,q])=>`${q} ${id}`)].join('\n');}
function isDeck(v:unknown):v is PokemonDeck{const d=v as PokemonDeck;return !!d&&typeof d.id==='string'&&typeof d.name==='string'&&!!d.cards&&typeof d.cards==='object'&&!Array.isArray(d.cards)&&Object.entries(d.cards).every(([id,q])=>/^[a-zA-Z0-9][\w.-]*$/.test(id)&&Number.isSafeInteger(q)&&q>0&&q<=60);}
export function loadPokemonDecks(storage:Storage):{decks:PokemonDeck[],error:string|null}{try{const d=JSON.parse(storage.getItem(pokemonStorageKey)??'[]');if(!Array.isArray(d)||!d.every(isDeck))throw Error();return {decks:d,error:null};}catch{return {decks:[],error:'Saved Pokémon decks could not be read. Original storage is preserved; export your draft.'};}}
export function savePokemonDecks(storage:Storage,decks:PokemonDeck[]):{error:string|null}{try{if(!decks.every(isDeck))throw Error();storage.setItem(pokemonStorageKey,JSON.stringify(decks));return {error:null};}catch{return {error:'Deck could not be saved. Export your draft to keep it.'};}}
