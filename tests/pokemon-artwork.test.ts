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
