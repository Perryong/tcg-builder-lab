import {test} from 'node:test';
import assert from 'node:assert/strict';
import{mkdtemp,readFile,writeFile,rm}from'node:fs/promises';
import{tmpdir}from'node:os';import{join}from'node:path';
import * as meta from '../src/meta.ts';
import * as importer from '../scripts/import-meta.mjs';
import type {Card,MetaSnapshot} from '../src/data.ts';
const event={id:'event',name:'Flagship',date:'2026-09-20',region:'Asia',country:'Singapore',sourceUrl:'https://example.com/event',placement:'1st',player:'Player',leaderNumber:'OP17-001',list:{'OP17-002':4}};
const snapshot:MetaSnapshot={checkedAt:'2026-09-27',region:'Asia',coverageNotes:'Test',events:[event,{...event,id:'japan',region:'Japan'},{...event,id:'old',date:'2025-09-20'}],archetypes:[]};
test('regional evidence selection excludes old and future results',()=>{
 assert.deepEqual(meta.selectEvidence(snapshot,'Asia','2026-09-01','2026-09-27').map(e=>e.id),['event']);
 assert.deepEqual(meta.selectEvidence({...snapshot,events:[]},'Asia','2026-09-01','2026-09-27'),[]);
});
test('custom deck observations preserve unknown counters and avoid invented strength scores',()=>{
 const c={id:'x',number:'OP17-002',setCode:'OP-17',name:'Card',colors:['Red'],type:'CHARACTER',rarity:'C',cost:8,power:8000,counter:null,life:null,traits:[],text:'',trigger:'',imageUrl:'https://example.com/a',sourceUrl:'https://example.com/',block:'5',attribute:''} as Card;
 const result=meta.analyzeDeck({id:'d',name:'Crew',leaderNumber:'OP17-001',cards:{'OP17-002':4},donCount:10},[c],snapshot);
 assert.equal(result.archetypeNotes,null);
 assert.ok(result.observations.some(s=>s.includes('4')&&/unknown|unavailable/.test(s)));
 assert.equal('winRate' in result,false);
});
test('event HTML import extracts exact card quantities and separates Japan from Asia',()=>{
 const details='1nOP17-001a4nOP17-002a2nOP17-003';
 const html=`<table><tbody><tr>${[details,'','Red','','Newgate','9/20/2026','Singapore','Player','1st Place','FS','Store'].map(s=>`<td>${s}</td>`).join('')}</tr></tbody></table>`;
 const result=importer.parseEvents(html,'https://example.com/results');
 assert.equal(result[0].region,'Asia');assert.equal(result[0].leaderNumber,'OP17-001');
 assert.deepEqual(result[0].list,{'OP17-002':4,'OP17-003':2});
 assert.equal(result[0].date,'2026-09-20');
});
test('bad meta updates preserve original snapshot',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'tcg-meta-'));const path=join(dir,'meta.json');
 try{await writeFile(path,'old');await assert.rejects(importer.publishMeta(path,{...snapshot,events:[{...event,sourceUrl:'javascript:alert(1)'}]}));assert.equal(await readFile(path,'utf8'),'old');await importer.publishMeta(path,snapshot);assert.equal(JSON.parse(await readFile(path,'utf8')).events.length,3);}finally{await rm(dir,{recursive:true});}
});
