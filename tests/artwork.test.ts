import{test}from'node:test';import assert from'node:assert/strict';
import * as artwork from '../scripts/repair-artwork.mjs';
test('repair accepts exact-variant image responses and preserves unavailable artwork honestly',async()=>{
 const snapshot={cards:[{id:'PROMO:P-001',imageUrl:'https://example.com/old',artworkAvailable:false},{id:'PRB:EB01-015_r2',imageUrl:'https://example.com/variant',artworkAvailable:false}]};
 const requests=[];
 const head=async url=>{requests.push(url);return new Response(null,{status:url.endsWith('/P-001.png')?200:404,headers:{'Content-Type':url.endsWith('/P-001.png')?'image/png':'text/html'}});};
 const result=await artwork.repairArtwork(snapshot,head);
 assert.equal(result.cards[0].imageUrl,'https://image.optcg.gg/images/en/P-001.png');
 assert.equal(result.cards[0].artworkAvailable,true);
 assert.equal(result.cards[1].artworkAvailable,false);
 assert.ok(requests.every(u=>u.includes('P-001.')||u.includes('EB01-015_r2')));
});
test('successful HTML response cannot masquerade as card artwork',async()=>{
 const snapshot={cards:[{id:'PROMO:P-001',imageUrl:'https://example.com/old',artworkAvailable:false}]};
 const result=await artwork.repairArtwork(snapshot,async()=>new Response(null,{status:200,headers:{'Content-Type':'text/html'}}));
 assert.equal(result.cards[0].artworkAvailable,false);
});
