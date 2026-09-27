import {readFile,writeFile,rename,readdir,mkdtemp,rm} from 'node:fs/promises';
import {resolve,dirname,basename} from 'node:path';
import {tmpdir} from 'node:os';
import {stripTypeScriptTypes} from 'node:module';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {parseAst} from 'rolldown/parseAst';
import {normalizePokemonCatalog} from '../src/pokemon/catalog.ts';
const cache=new Map();
export async function readDataModule(path){
 path=resolve(path);if(cache.has(path))return cache.get(path);
 const ast=parseAst(stripTypeScriptTypes(await readFile(path,'utf8')));const vars=new Map();let result;
 const value=n=>{if(n.type==='Literal')return n.value;if(n.type==='BinaryExpression'&&n.operator==='+')return value(n.left)+value(n.right);if(n.type==='Identifier'){if(n.name==='undefined')return undefined;if(vars.has(n.name))return vars.get(n.name);throw Error(`Unknown literal ${n.name}`);}if(n.type==='ArrayExpression')return n.elements.map(value);if(n.type==='ObjectExpression'){const o={};for(const p of n.properties){if(p.type==='SpreadElement')Object.assign(o,value(p.argument));else if(p.type==='Property'&&!p.method&&!p.computed){const k=p.key.name??p.key.value;if(['__proto__','constructor','prototype'].includes(k))throw Error('Unsafe key');o[k]=value(p.value);}else throw Error('Unsupported object');}return o;}if(n.type==='MemberExpression'&&!n.computed)return value(n.object)?.[n.property.name];if(n.type==='UnaryExpression'&&n.operator==='-')return -value(n.argument);throw Error(`Non-literal source expression: ${n.type}`);};
 for(const n of ast.body){if(n.type==='ImportDeclaration'){if(/interfaces$/.test(n.source.value))continue;for(const s of n.specifiers){if(s.type!=='ImportDefaultSpecifier')throw Error(`Unsupported runtime import in ${path}`);const p=resolve(dirname(path),n.source.value);vars.set(s.local.name,await readDataModule(p.endsWith('.ts')?p:p+'.ts'));}}else if(n.type==='VariableDeclaration'){for(const v of n.declarations)vars.set(v.id.name,value(v.init));}else if(n.type==='ExportDefaultDeclaration')result=value(n.declaration);else throw Error(`Unsupported source statement ${n.type}`);}
 if(!result)throw Error('Missing metadata export');cache.set(path,result);return result;
}
export async function publishPokemonCatalog(path,candidate){const data=normalizePokemonCatalog(candidate);const temporary=path+'.'+crypto.randomUUID()+'.tmp';await writeFile(temporary,JSON.stringify(data));await rename(temporary,path);}
const en=v=>typeof v==='string'?v:v?.en??'';
export async function importRepository(root,images){
 const cards=[],sets=[],exceptions={};let excluded=0;const date=new Date().toISOString().slice(0,10);
 for(const serie of await readdir(resolve(root,'data'),{withFileTypes:true})){
  if(!serie.isDirectory())continue;if(serie.name==='Pokémon TCG Pocket'){excluded++;continue;}
  for(const entry of await readdir(resolve(root,'data',serie.name),{withFileTypes:true})){
   if(!entry.isDirectory())continue;const set=await readDataModule(resolve(root,'data',serie.name,entry.name+'.ts'));if(!en(set.name))continue;const setCards=[];
   for(const file of await readdir(resolve(root,'data',serie.name,entry.name))){if(!file.endsWith('.ts'))continue;const c=await readDataModule(resolve(root,'data',serie.name,entry.name,file));if(!en(c.name))continue;
    const localId=basename(file,'.ts'),id=`${set.id}-${localId}`;const hasImage=!!images.en?.[set.serie.id]?.[set.id]?.[localId];
    const card={id,setId:set.id,localId,name:en(c.name),category:c.category,types:c.types??[],stage:c.stage??null,evolveFrom:en(c.evolveFrom)||null,hp:c.hp??null,rarity:c.rarity??null,illustrator:c.illustrator??null,imageUrl:hasImage?`https://assets.tcgdex.net/en/${set.serie.id}/${set.id}/${localId}/high.webp`:null,sourceUrl:`https://www.tcgdex.net/database/${set.serie.id}/${set.id}/${localId}`,regulationMark:c.regulationMark??null,releaseDate:set.releaseDate??null,abilities:(c.abilities??[]).map(a=>({name:en(a.name),effect:en(a.effect)})),attacks:(c.attacks??[]).map(a=>({name:en(a.name),cost:a.cost??[],damage:a.damage==null?null:String(a.damage),effect:en(a.effect)})),weaknesses:(c.weaknesses??[]).map(a=>({type:a.type,value:String(a.value)})),resistances:(c.resistances??[]).map(a=>({type:a.type,value:String(a.value)})),retreat:c.retreat??null,effect:en(c.effect),trainerType:c.trainerType??null,energyType:c.energyType==='Normal'?(/^(?:Basic )?(?:Grass|Fire|Water|Lightning|Psychic|Fighting|Darkness|Metal|Fairy) Energy$/.test(en(c.name))&&!en(c.effect)?'Basic':'Unknown'):c.energyType??null,variants:Array.isArray(c.variants)?Object.fromEntries(c.variants.map(v=>[v.type,true])):c.variants??{},liveCode:set.abbreviations?.official??null};
    if(c.trainerType==='ACE SPEC'||c.rarity==='ACE SPEC Rare'||/ACE SPEC/i.test(c.trainerType??''))exceptions[id]={group:'ACE SPEC',groupLimit:1};
    if(c.rarity==='Radiant Rare')exceptions[id]={group:'Radiant',groupLimit:1};
    setCards.push(card);
   }
   if(!setCards.length)continue;cards.push(...setCards);sets.push({id:set.id,name:en(set.name),series:set.serie.id,releaseDate:set.releaseDate??null,sourceUrl:`https://www.tcgdex.net/database/${set.serie.id}/${set.id}`,officialCount:set.cardCount?.official??null,totalCount:set.cardCount?.total??null,importedCount:setCards.length});
  }
 }
 sets.sort((a,b)=>(b.releaseDate??'').localeCompare(a.releaseDate??''));const rank=new Map(sets.map((s,i)=>[s.id,i]));cards.sort((a,b)=>rank.get(a.setId)-rank.get(b.setId)||a.localId.localeCompare(b.localId,undefined,{numeric:true}));
 const revision=execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim();
 return {catalog:{checkedAt:date,sourceRevision:revision,coverageNotes:`${sets.length} physical English set groups; ${cards.length} card printings from pinned TCGdex metadata. ${cards.filter(c=>c.imageUrl).length} artwork links. Pocket excluded. Counts are available English source records; missing translations and source omissions are not certified complete.`,sets,cards},exceptions,excluded};
}
async function main(){let temp;const root=process.env.POKEMON_SOURCE??await mkdtemp(resolve(tmpdir(),'tcgdex-'));if(!process.env.POKEMON_SOURCE){temp=root;execFileSync('git',['clone','--depth','1','https://github.com/tcgdex/cards-database.git',root],{stdio:'inherit'});}try{const response=await fetch('https://assets.tcgdex.net/datas.json',{signal:AbortSignal.timeout(30000)});if(!response.ok)throw Error('Artwork manifest unavailable');const {catalog,exceptions}=await importRepository(root,await response.json());await publishPokemonCatalog(resolve('public/data/pokemon/catalog.json'),catalog);console.log(catalog.coverageNotes);await writeFile(resolve('scripts/pokemon-exceptions.json'),JSON.stringify(exceptions));}finally{if(temp)await rm(temp,{recursive:true});}}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url))main().catch(e=>{console.error(e);process.exitCode=1;});
