import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as builder from '../src/deck.ts';
import type { Card, RulesSnapshot } from '../src/data.ts';
const card = (number:string, extra: Partial<Card> = {}):Card => ({ id:number, number, setCode:'OP-17', name:number, colors:['Red'], type:'CHARACTER', rarity:'C', cost:3, power:5000, counter:1000, life:null, traits:['Crew'], text:'',trigger:'',imageUrl:'https://example.com/card.png', sourceUrl:'https://example.com/',block:'5',attribute:'Strike', ...extra });
const leader=card('OP17-001',{type:'LEADER'});
const cards=[leader,...Array.from({length:13},(_,i)=>card(`OP17-${String(i+2).padStart(3,'0')}`))];
const rules:RulesSnapshot={ region:'Asia', checkedAt:'2026-09-27',verified:true,sourceUrls:[], mainCount:50,donCount:10,copyLimit:4,restrictions:[],bannedPairs:[],copyExceptions:{},leaderExceptions:{},notes:[] };
const deck={id:'test',name:'Crew',leaderNumber:leader.number,donCount:10,cards:Object.fromEntries(cards.slice(1).map((c,i)=>[c.number,i===12?2:4]))};
test('verified legal deck passes and wrong counts or colors fail',()=>{
  assert.equal(builder.validateDeck(deck,cards,rules,'2026-09-27').status,'valid');
  assert.equal(builder.validateDeck({...deck,donCount:9},cards,rules,'2026-09-27').status,'invalid');
  assert.equal(builder.validateDeck({...deck,cards:{}},cards,rules,'2026-09-27').status,'invalid');
  assert.equal(builder.validateDeck(deck,cards.map(c=>c.number==='OP17-002'?{...c,colors:['Blue']}:c),rules,'2026-09-27').status,'invalid');
});
test('card number copy limits survive reprints and honor explicit exceptions',()=>{
  const more=[...cards,card('OP17-002',{id:'OP17-002_p1'})];
  const d={...deck,cards:{...deck.cards,'OP17-002':5,'OP17-014':1}};
  assert.equal(builder.validateDeck(d,more,rules,'2026-09-27').status,'invalid');
  assert.equal(builder.validateDeck(d,more,{...rules,copyExceptions:{'OP17-002':50}},'2026-09-27').status,'valid');
});
test('future restrictions apply only on their effective date and include leaders and pairs',()=>{
  const banned={...rules,restrictions:[{number:'OP17-001',limit:0,effectiveFrom:'2026-10-12'}]};
  assert.equal(builder.validateDeck(deck,cards,banned,'2026-09-27').status,'valid');
  assert.equal(builder.validateDeck(deck,cards,banned,'2026-10-12').status,'invalid');
  const paired={...rules,bannedPairs:[{numbers:['OP17-001','OP17-002'] as [string,string],effectiveFrom:'2026-09-01'}]};
  assert.equal(builder.validateDeck(deck,cards,paired,'2026-09-27').status,'invalid');
});
test('unverified rules and stale rules cannot certify legality',()=>{
  assert.equal(builder.validateDeck(deck,cards,{...rules,verified:false},'2026-09-27').status,'unverified');
  assert.equal(builder.validateDeck(deck,cards,rules,'2026-12-01').status,'unverified');
});
test('leader construction exceptions are enforced',()=>{
  const r={...rules,leaderExceptions:{'OP17-001':{maxCost:4,onlyTraits:['Crew']}}};
  assert.equal(builder.validateDeck(deck,cards.map(c=>c.number==='OP17-002'?{...c,cost:5}:c),r,'2026-09-27').status,'invalid');
});
test('text import roundtrips while malformed quantities and unknown identifiers are rejected',()=>{
  const imported=builder.parseDeck(builder.exportDeck(deck),cards);
  assert.equal(imported.leaderNumber,deck.leaderNumber);
  assert.deepEqual(imported.cards,deck.cards);
  assert.equal(imported.donCount,10);
  for(const text of ['-1 OP17-002','0 OP17-002','1.5 OP17-002','2 OP99-999','2 OP17-001','hello','1 OP17-001\n1 OP17-001']) assert.throws(()=>builder.parseDeck(text,cards));
  assert.equal(builder.parseDeck('1 OP17-001\n2 OP17-002\n2 OP17-002\n10 DON!!',cards).cards['OP17-002'],4);
});
test('malformed or unavailable browser storage reports errors without overwriting it',()=>{
  const storage={getItem:()=>'{bad',setItem:()=>{throw new Error('full');}} as unknown as Storage;
  assert.equal(builder.loadDecks(storage).decks.length,0);
  assert.ok(builder.loadDecks(storage).error);
  assert.ok(builder.saveDecks(storage,[deck]).error);
  const invalid={getItem:()=>JSON.stringify([{...deck,cards:{'OP17-002':-1}}])} as unknown as Storage;
  assert.ok(builder.loadDecks(invalid).error);
});
test('Enel special DON deck count replaces the default ten',()=>{
 const r={...rules,leaderExceptions:{'OP17-001':{donCount:6}}};
 assert.equal(builder.validateDeck({...deck,donCount:6},cards,r,'2026-09-27').status,'valid');
 assert.equal(builder.validateDeck(deck,cards,r,'2026-09-27').status,'invalid');
});
