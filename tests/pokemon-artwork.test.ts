import {test} from 'node:test';import assert from 'node:assert/strict';
import {repairPokemonArtwork} from '../scripts/repair-pokemon-artwork.mjs';
test('artwork repair requires exact set, number and name and preserves existing images',()=>{
 const snapshot={sets:[{id:'swsh4.5sv',name:'Shining Fates Shiny Vault'}],cards:[{id:'swsh4.5sv-SV001',setId:'swsh4.5sv',localId:'SV001',name:'Rowlet',imageUrl:null},{id:'wrong',setId:'swsh4.5sv',localId:'SV002',name:'Wrong name',imageUrl:null},{id:'existing',setId:'swsh4.5sv',localId:'SV001',name:'Rowlet',imageUrl:'https://assets.tcgdex.net/existing.webp'}]};
 const sourceSets=[{id:'swsh45sv',name:'Shining Fates Shiny Vault'}];const sourceCards=[{setId:'swsh45sv',number:'SV001',name:'Rowlet',images:{large:'https://images.pokemontcg.io/swsh45sv/SV001_hires.png'}},{setId:'swsh45sv',number:'SV002',name:'Dartrix',images:{large:'https://images.pokemontcg.io/swsh45sv/SV002_hires.png'}}];
 assert.equal(repairPokemonArtwork(snapshot,sourceSets,sourceCards),1);assert.equal(snapshot.cards[0].imageUrl,sourceCards[0].images.large);assert.equal(snapshot.cards[1].imageUrl,null);assert.equal(snapshot.cards[2].imageUrl,'https://assets.tcgdex.net/existing.webp');
 const unsafe={sets:snapshot.sets,cards:[{...snapshot.cards[0],imageUrl:null}]};assert.equal(repairPokemonArtwork(unsafe,sourceSets,[{...sourceCards[0],images:{large:'javascript:alert(1)'}}]),0);
 assert.equal(repairPokemonArtwork(unsafe,[...sourceSets,{id:'duplicate',name:sourceSets[0].name}],sourceCards),0);
});
test('artwork responses require successful image content and can use the same card small image',async()=>{
 const {validatePokemonArtwork}=await import('../scripts/repair-pokemon-artwork.mjs');const snapshot={cards:[{imageUrl:'https://images.pokemontcg.io/xyp/XY46_hires.png'},{imageUrl:'https://images.pokemontcg.io/mcd18/1_hires.png'}]};
 await validatePokemonArtwork(snapshot,async url=>new Response(null,{status:url.endsWith('/XY46.png')?200:404,headers:{'content-type':'image/png'}}));assert.equal(snapshot.cards[0].imageUrl,'https://images.pokemontcg.io/xyp/XY46.png');assert.equal(snapshot.cards[1].imageUrl,null);
 await assert.rejects(()=>validatePokemonArtwork({cards:[{imageUrl:'https://images.pokemontcg.io/a/1_hires.png'}]},async()=>new Response(null,{status:200,headers:{'content-type':'text/html'}})));
});
test('anniversary artwork separates normal and classic collector numbering',async()=>{
 const {repairAnniversaryArtwork}=await import('../scripts/repair-pokemon-artwork.mjs');const snapshot={cards:[{id:'30th-001',setId:'30th',localId:'001',name:'Exeggcute',imageUrl:null},{id:'30th-c-001',setId:'30th-c',localId:'001',name:'Charizard',imageUrl:null},{id:'30th-004',setId:'30th',localId:'004',name:'Illumise',imageUrl:null}]};
 const image=(alt,id)=>`<img alt="${alt}" src="https://api.tcgjoin.com/cards/image-proxy?url=https%3A%2F%2Ftcgplayer-cdn.tcgplayer.com%2Fproduct%2F${id}_200w.jpg">`;const html=`<noscript>${image('Exeggcute 001/128 · Pokémon TCG 30th Celebration',716435)}${image('Charizard 4 · 30th Celebration Classic Collection',714372)}</noscript>`;
 assert.equal(repairAnniversaryArtwork(snapshot,html),2);assert.equal(snapshot.cards[0].imageUrl,'https://tcgplayer-cdn.tcgplayer.com/product/716435_200w.jpg');assert.equal(snapshot.cards[1].imageUrl,'https://tcgplayer-cdn.tcgplayer.com/product/714372_200w.jpg');assert.equal(snapshot.cards[2].imageUrl,null);
});

test('reviewed anniversary supplements require exact identity and a trusted image host',async()=>{
 const {repairAnniversaryArtwork}=await import('../scripts/repair-pokemon-artwork.mjs');const snapshot={cards:[{id:'30th-B',setId:'30th',localId:'B',name:'Mew',imageUrl:null}]};const supplement=[{id:'30th-B',name:'Mew',imageUrl:'https://images.squarespace-cdn.com/content/checked/me5-5m_en_003-high.webp'}];assert.equal(repairAnniversaryArtwork(snapshot,'',supplement),1);assert.equal(snapshot.cards[0].imageUrl,supplement[0].imageUrl);
 const wrong={cards:[{...snapshot.cards[0],imageUrl:null,name:'Other card'}]};assert.equal(repairAnniversaryArtwork(wrong,'',supplement),0);assert.equal(repairAnniversaryArtwork({cards:[{...snapshot.cards[0],imageUrl:null}]},'',[{...supplement[0],imageUrl:'https://untrusted.example/card.webp'}]),0);
});
