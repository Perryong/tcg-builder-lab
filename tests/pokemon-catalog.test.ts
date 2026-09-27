import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {normalizePokemonCatalog} from '../src/pokemon/catalog.ts';
import {publishPokemonCatalog,readDataModule} from '../scripts/import-pokemon.mjs';
const raw={checkedAt:'2026-09-27',sourceRevision:'abc',coverageNotes:'Partial',sets:[{id:'sv06',name:'Twilight',series:'sv',releaseDate:'2024-05-24',sourceUrl:'https://tcgdex.net/sets/sv06',officialCount:1,totalCount:1,importedCount:1}],cards:[{id:'sv06-130',setId:'sv06',localId:'130',name:'Dragapult ex',category:'Pokemon',hp:null,imageUrl:null,sourceUrl:'https://tcgdex.net/cards/sv06-130'}]};
test('missing stats remain unknown and Pocket is excluded',()=>{
 const d=normalizePokemonCatalog(raw);assert.equal(d.cards[0].hp,null);assert.equal(d.cards[0].imageUrl,null);
 assert.throws(()=>normalizePokemonCatalog({...raw,sets:[{...raw.sets[0],series:'tcgp'}]}));
});
test('source totals reconcile and bad publication preserves previous snapshot',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'pokemon-'));const path=join(dir,'data.json');
 try{await writeFile(path,'good');await assert.rejects(publishPokemonCatalog(path,{...raw,cards:[]}));assert.equal(await readFile(path,'utf8'),'good');assert.throws(()=>normalizePokemonCatalog({...raw,sets:[{...raw.sets[0],importedCount:2}]}));}finally{await rm(dir,{recursive:true});}
});
test('metadata parser evaluates literal imports without executing source code',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'pokemon-ts-'));
 try{await writeFile(join(dir,'base.ts'),'const card = {hp:100}; export default card');await writeFile(join(dir,'card.ts'),'import base from "./base"; const card = {...base,name:{en:"Pikachu"}}; export default card');assert.equal((await readDataModule(join(dir,'card.ts'))).hp,100);await writeFile(join(dir,'bad.ts'),'const card = process.exit(); export default card');await assert.rejects(readDataModule(join(dir,'bad.ts')));}finally{await rm(dir,{recursive:true});}
});
