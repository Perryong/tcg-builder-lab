import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {resolve} from 'node:path';
import {publishCatalog} from './import-catalog.mjs';
export async function repairArtwork(snapshot, head = url => fetch(url,{method:'HEAD',signal:AbortSignal.timeout(10000)}), onProgress = () => {}) {
  const cards=snapshot.cards.map(c=>({...c}));
  const missing=cards.filter(c=>c.artworkAvailable===false);
  let cursor=0,done=0,repaired=0;
  const worker=async()=>{
    while(cursor<missing.length){
      const card=missing[cursor++];
      const variant=card.id.split(':').at(-1);
      if(!/^(?:(?:OP|ST|EB|PRB)\d{2}|P)-\d{3}(?:_[a-z]\d+)?$/.test(variant))continue;
      const set=variant.split('-')[0];
      const urls=[`https://image.optcg.gg/images/en/${variant}.png`,`https://limitlesstcg.nyc3.cdn.digitaloceanspaces.com/one-piece/${set}/${variant}_EN.webp`];
      for(const url of urls){
        try{const response=await head(url);if(response.ok && response.headers.get('content-type')?.startsWith('image/')){card.imageUrl=url;card.artworkAvailable=true;repaired++;break;}}
        catch{/* Preserve unavailable state when public providers cannot be reached. */}
      }
      done++;onProgress({done,total:missing.length,repaired});
    }
  };
  await Promise.all(Array.from({length:4},worker));
  return {...snapshot,cards};
}
async function main(){
  const path=resolve('public/data/catalog.json');
  const snapshot=JSON.parse(await readFile(path,'utf8'));
  const next=await repairArtwork(snapshot,undefined,({done,total,repaired})=>{if(done%100===0||done===total)console.log(`Checked ${done}/${total} missing illustrations; repaired ${repaired}.`);});
  const count=next.cards.filter(c=>c.artworkAvailable).length;
  next.coverageNotes=`All ${next.sets.length} official Asia catalog groups imported and artwork counts reconciled. ${count.toLocaleString()} of ${next.cards.length.toLocaleString()} illustrations have public image links from OPTCG API, OPTCG.GG, or Limitless. Unavailable exact variants link to the official card. Worldwide coverage and release dates are not certified.`;
  await publishCatalog(path,next);
  console.log(`Artwork coverage: ${count}/${next.cards.length}.`);
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url))main().catch(e=>{console.error(e.message);process.exitCode=1;});
