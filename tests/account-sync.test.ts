import {test} from 'node:test';
import assert from 'node:assert/strict';
import {accountCacheKey,clearPending,mergeDecks,queueDeck,readAccountCache,writeAccountCache} from '../src/account/sync.ts';

const account='11111111-1111-4111-8111-111111111111';
const crew={id:'deck-a',name:'Crew',leaderNumber:null,cards:{'OP01-001':4},donCount:10};
function memory():Storage{const data=new Map<string,string>();return {getItem:k=>data.get(k)??null,setItem:(k,v)=>{data.set(k,v);},removeItem:k=>{data.delete(k);},clear:()=>data.clear(),key:i=>[...data.keys()][i]??null,get length(){return data.size;}};}

test('merge deduplicates JSONB key order and preserves differing same-ID edits as copies',()=>{
 const equivalent={donCount:10,cards:{'OP01-001':4},leaderNumber:null,name:'Crew',id:'deck-a'};
 assert.deepEqual(mergeDecks([crew],[equivalent],()=> 'copy'),{decks:[equivalent],uploads:[],conflicts:0});
 const edited={...crew,name:'Crew edited'};
 const result=mergeDecks([edited],[crew],()=> 'copy');
 assert.equal(result.conflicts,1);
 assert.deepEqual(result.decks,[crew,{...edited,id:'copy',name:'Crew edited (from this device)'}]);
 assert.deepEqual(result.uploads,[{...edited,id:'copy',name:'Crew edited (from this device)'}]);
 assert.deepEqual(mergeDecks([{...crew,id:'new'}],[crew],()=> 'unused').uploads,[{...crew,id:'new'}]);
});

test('account cache and pending saves survive reload without touching guest storage',()=>{
 const s=memory();s.setItem('grand-line.decks.v1','guest bytes');
 assert.equal(writeAccountCache(s,account,'onepiece',[crew]).error,null);
 assert.equal(queueDeck(s,account,'onepiece',crew,0).error,null);
 const other={...crew,id:'deck-b'};assert.equal(queueDeck(s,account,'onepiece',other,0).error,null);
 assert.equal(readAccountCache(s,account,'onepiece').pending.length,2);
 assert.equal(clearPending(s,account,'onepiece','deck-a',crew,0).error,null);
 assert.deepEqual(readAccountCache(s,account,'onepiece').pending.map(p=>p.deck.id),['deck-b']);
 assert.equal(s.getItem('grand-line.decks.v1'),'guest bytes');
});

test('failed validation or corrupt cache never overwrites original bytes',()=>{
 const s=memory(),key=accountCacheKey(account,'onepiece');s.setItem(key,'{damaged');
 assert.match(readAccountCache(s,account,'onepiece').error??'',/preserved/);
 assert.match(queueDeck(s,account,'onepiece',crew,0).error??'',/preserved/);
 assert.equal(s.getItem(key),'{damaged');
 const clean=memory();assert.match(queueDeck(clean,account,'pokemon',crew,0).error??'',/Invalid/);
 assert.equal(clean.length,0);
});

test('new local edit is not acknowledged by an older in-flight save',()=>{
 const s=memory();queueDeck(s,account,'onepiece',crew,0);
 queueDeck(s,account,'onepiece',{...crew,name:'Newer'},0);
 clearPending(s,account,'onepiece','deck-a',crew,0);
 assert.equal(readAccountCache(s,account,'onepiece').pending[0].deck.name,'Newer');
});
