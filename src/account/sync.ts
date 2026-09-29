import type {Deck} from '../deck.ts';
import {isOnePieceDeck} from '../deck.ts';
import type {PokemonDeck} from '../pokemon/data.ts';
import {isPokemonDeck} from '../pokemon/deck.ts';
import type {YugiohDeck} from '../yugioh/data.ts';
import {isYugiohDeck} from '../yugioh/deck.ts';

export type DeckByGame={onepiece:Deck;pokemon:PokemonDeck;yugioh:YugiohDeck};
export type Game=keyof DeckByGame;
export type Pending<G extends Game>={deck:DeckByGame[G];expectedRevision:number};
const invalid='Invalid deck or account cache; original data preserved.';
const validators={onepiece:isOnePieceDeck,pokemon:(v:unknown):v is PokemonDeck=>isPokemonDeck(v)&&!('leaderNumber' in v)&&!('main' in v),yugioh:isYugiohDeck};
const canonical=(v:unknown):string=>JSON.stringify(v,(_,value)=>value&&typeof value==='object'&&!Array.isArray(value)?Object.fromEntries(Object.entries(value).sort(([a],[b])=>a.localeCompare(b))):value);
export const sameDeck=(a:unknown,b:unknown)=>canonical(a)===canonical(b);

export function mergeDecks<T extends {id:string;name:string}>(local:T[],remote:T[],newId:()=>string):{decks:T[];uploads:T[];conflicts:number}{
 const decks=[...remote],uploads:T[]=[],ids=new Set(remote.map(d=>d.id));let conflicts=0;
 for(const deck of local){const existing=remote.find(d=>d.id===deck.id);if(!existing){decks.push(deck);uploads.push(deck);ids.add(deck.id);continue;}if(canonical(existing)===canonical(deck))continue;conflicts++;let id=newId();while(ids.has(id))id=newId();const copy={...deck,id,name:deck.name+' (from this device)'};decks.push(copy);uploads.push(copy);ids.add(id);}
 return {decks,uploads,conflicts};
}
export function accountCacheKey(accountId:string,game:Game){return `tcg-builder.account.${accountId}.${game}.v1`;}
export function readAccountCache<G extends Game>(storage:Storage,accountId:string,game:G):{decks:DeckByGame[G][];pending:Pending<G>[];error:string|null}{
 try{const raw=storage.getItem(accountCacheKey(accountId,game));if(!raw)return {decks:[],pending:[],error:null};const data=JSON.parse(raw);const valid=validators[game] as (v:unknown)=>v is DeckByGame[G];if(data.version!==1||!Array.isArray(data.decks)||!data.decks.every(valid)||!Array.isArray(data.pending)||!data.pending.every((p:Pending<G>)=>p&&valid(p.deck)&&Number.isSafeInteger(p.expectedRevision)&&p.expectedRevision>=0))throw Error();return {decks:data.decks,pending:data.pending,error:null};}catch{return {decks:[],pending:[],error:invalid};}
}
function write<G extends Game>(storage:Storage,accountId:string,game:G,decks:DeckByGame[G][],pending:Pending<G>[]){
 try{storage.setItem(accountCacheKey(accountId,game),JSON.stringify({version:1,decks,pending}));return {error:null};}catch{return {error:'Account deck could not be saved on this device.'};}
}
export function writeAccountCache<G extends Game>(storage:Storage,accountId:string,game:G,decks:DeckByGame[G][]):{error:string|null}{
 const old=readAccountCache(storage,accountId,game);if(old.error)return {error:old.error};const valid=validators[game] as (v:unknown)=>v is DeckByGame[G];if(!Array.isArray(decks)||!decks.every(valid))return {error:invalid};return write(storage,accountId,game,decks,old.pending);
}
export function queueDeck<G extends Game>(storage:Storage,accountId:string,game:G,deck:DeckByGame[G],expectedRevision:number):{error:string|null}{
 const old=readAccountCache(storage,accountId,game);if(old.error)return {error:old.error};const valid=validators[game] as (v:unknown)=>v is DeckByGame[G];if(!valid(deck)||!Number.isSafeInteger(expectedRevision)||expectedRevision<0||new TextEncoder().encode(JSON.stringify(deck)).length>100000)return {error:invalid};const previous=old.pending.find(p=>p.deck.id===deck.id);return write(storage,accountId,game,[...old.decks.filter(d=>d.id!==deck.id),deck],[...old.pending.filter(p=>p.deck.id!==deck.id),{deck,expectedRevision:previous?.expectedRevision??expectedRevision}]);
}
export function clearPending<G extends Game>(storage:Storage,accountId:string,game:G,deckId:string,acknowledged:DeckByGame[G],expectedRevision:number):{error:string|null}{
 const old=readAccountCache(storage,accountId,game);if(old.error)return {error:old.error};return write(storage,accountId,game,old.decks,old.pending.filter(p=>p.deck.id!==deckId||p.expectedRevision!==expectedRevision||canonical(p.deck)!==canonical(acknowledged)));
}
