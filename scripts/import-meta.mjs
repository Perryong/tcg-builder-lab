import { load } from 'cheerio';
import { readFile, writeFile, rename } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { safeUrl } from '../src/catalog.ts';
const source='https://onepiecetopdecks.com/deck-list/japan-op17-deck-list-the-worlds-strongest-warriors/';
export function parseEvents(html, sourceUrl) {
  const $=load(html);
  return $('table tbody tr').toArray().map((row,i)=>{
    const cells=$(row).find('td').toArray().map(e=>$(e).text().trim());
    if(cells.length!==11)throw new Error('Tournament table format changed.');
    const parts=cells[0].split('a').map(part=>part.match(/^(\d+)n((?:OP|ST|EB|PRB)\d{2}-\d{3}|P-\d{3})$/));
    if(parts.some(p=>!p)||parts.length<2 || Number(parts[0][1])!==1)throw new Error('Invalid tournament deck encoding.');
    const list={};for(const part of parts.slice(1))list[part[2]]=(list[part[2]]??0)+Number(part[1]);
    const match=cells[5].match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if(!match)throw new Error('Invalid event date.');
    const date=`${match[3]}-${match[1].padStart(2,'0')}-${match[2].padStart(2,'0')}`;
    if(new Date(`${date}T00:00:00Z`).toISOString().slice(0,10)!==date)throw new Error('Invalid calendar date.');
    const country=cells[6];
    const region=['JP','Japan'].includes(country)?'Japan':['Singapore','SG','Thailand','TH','Indonesia','ID','Malaysia','MY','PH','Philippines','Taiwan','TW','Hong Kong','HK','Vietnam','VN','China','CN','Korea','KR'].includes(country)?'Asia':'Other';
    const details=$(row).find('a[href*="deckgen"]').first().attr('href');
    return { id:`${country}-${date}-${i}`, name:`${cells[9]} · ${cells[10]}`, date,region,country,sourceUrl:details?new URL(details,sourceUrl).href:sourceUrl,placement:cells[8],player:cells[7],leaderNumber:parts[0][2],list };
  });
}
export async function publishMeta(path,snapshot) {
  if(!snapshot || snapshot.region!=='Asia' || !/^\d{4}-\d{2}-\d{2}/.test(snapshot.checkedAt) || !Array.isArray(snapshot.events) || !Array.isArray(snapshot.archetypes))throw new Error('Invalid meta snapshot.');
  for(const e of snapshot.events) {
    if(!safeUrl(e.sourceUrl)||!/^\d{4}-\d{2}-\d{2}$/.test(e.date)||!e.leaderNumber||!e.region||!e.placement||!e.player||e.list && Object.entries(e.list).some(([n,q])=>!/^(?:(?:OP|ST|EB|PRB)\d{2}|P)-\d{3}$/.test(n)||!Number.isSafeInteger(q)||q<1))throw new Error('Invalid event record. Previous snapshot preserved.');
  }
  for(const a of snapshot.archetypes) if(!a.sourceUrls?.length || !a.sourceUrls.every(safeUrl) || !a.leaderNumber)throw new Error('Unsourced strategy note.');
  const tmp=`${path}.${crypto.randomUUID()}.tmp`;await writeFile(tmp,JSON.stringify(snapshot));await rename(tmp,path);
}
async function main() {
  const response=await fetch(source,{signal:AbortSignal.timeout(30000)});
  if(!response.ok)throw new Error(`Tournament source unavailable: ${response.status}`);
  const rows=parseEvents(await response.text(),source);
  if(!rows.length)throw new Error('No tournament evidence found. Previous snapshot preserved.');
  const now=new Date().toISOString();
  const catalog=JSON.parse(await readFile(resolve('public/data/catalog.json'),'utf8'));
  const known=new Set(catalog.cards.map(c=>c.number));
  const seen=new Set();
  const events=rows.filter(e=>e.date<=now.slice(0,10)).filter(e=>{const key=`${e.country}|${e.date}|${e.player}|${e.leaderNumber}|${e.name}`;if(seen.has(key))return false;seen.add(key);return true;}).map(e=>({...e,list:e.list && Object.values(e.list).reduce((a,b)=>a+b,0)===50 && Object.keys(e.list).every(n=>known.has(n)) && known.has(e.leaderNumber)?e.list:null}));
  const archetypes=JSON.parse(await readFile(resolve('scripts/archetypes.json'),'utf8'));
  const snapshot={checkedAt:now,region:'Asia',coverageNotes:'OP-17 results reported by One Piece Top Decks, not a census of all events. Asia excludes Japan in these filters. Team, store, and regional events may all appear. Shares describe collected published lists, not field share or win rate. Example decks may use Extra Regulation cards; check your event format.',events,archetypes};
  await publishMeta(resolve('public/data/meta.json'),snapshot);
  console.log(`Published ${events.length} dated results (${events.filter(e=>e.region==='Asia').length} Asia, ${events.filter(e=>e.region==='Japan').length} Japan) and ${archetypes.length} qualitative archetype guides.`);
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url))main().catch(e=>{console.error(e.message);process.exitCode=1;});
