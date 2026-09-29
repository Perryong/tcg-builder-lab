import {createContext,useCallback,useContext,useEffect,useRef,useState} from 'react';
import type {ReactNode} from 'react';
import {accountClient} from './client.ts';
import {clearPending,mergeDecks,queueDeck,readAccountCache,writeAccountCache} from './sync.ts';
import type {DeckByGame,Game} from './sync.ts';
import {loadDecks} from '../deck.ts';
import {loadPokemonDecks} from '../pokemon/deck.ts';
import {loadYugiohDecks} from '../yugioh/deck.ts';
import {isOnePieceDeck} from '../deck.ts';
import {isPokemonDeck} from '../pokemon/deck.ts';
import {isYugiohDeck} from '../yugioh/deck.ts';

type Status='local'|'loading'|'synced'|'pending'|'error';
type Collections={[G in Game]:DeckByGame[G][]};
type Account={accountId:string|null;accessId:string;status:Status;error:string;collections:Collections;createAccount:()=>Promise<void>;enterAccessId:(id:string)=>Promise<void>;saveDeck:<G extends Game>(game:G,deck:DeckByGame[G])=>Promise<void>;retry:()=>Promise<void>;signOut:()=>Promise<void>};
const empty=():Collections=>({onepiece:[],pokemon:[],yugioh:[]});
const games:Game[]=['onepiece','pokemon','yugioh'];
const activeKey='tcg-builder.active-account.v1';
const idKey=(accountId:string)=>`tcg-builder.access-id.${accountId}.v1`;
const importedKey=(accountId:string)=>`tcg-builder.guest-imported.${accountId}.v1`;
const guest={onepiece:loadDecks,pokemon:loadPokemonDecks,yugioh:loadYugiohDecks};
const valid={onepiece:isOnePieceDeck,pokemon:(v:unknown)=>isPokemonDeck(v)&&!('leaderNumber' in (v as object))&&!('main' in (v as object)),yugioh:isYugiohDeck};
const AccountContext=createContext<Account|null>(null);

export function AccountProvider({children}:{children:ReactNode}){
 const [accountId,setAccountId]=useState<string|null>(null),[accessId,setAccessId]=useState(''),[status,setStatus]=useState<Status>('local'),[error,setError]=useState(''),[collections,setCollections]=useState<Collections>(empty);
 const revisions=useRef(new Map<string,number>());
 const rowKey=(game:Game,id:string)=>`${game}:${id}`;
 const fail=(message:string)=>{setError(message);setStatus('error');};
 const session=async()=>{if(!accountClient)throw Error('Cloud access is not configured.');const current=await accountClient.auth.getSession();if(current.data.session)return;const created=await accountClient.auth.signInAnonymously();if(created.error)throw created.error;};
 const readCloud=useCallback(async(account:string)=>{
  if(!accountClient)throw Error('Cloud access is not configured.');
  const result=await accountClient.from('saved_decks').select('game,deck_id,payload,revision').eq('account_id',account);
  if(result.error)throw result.error;
  const rows=result.data??[];
  for(const row of rows){const check=valid[row.game as Game] as ((v:unknown)=>boolean)|undefined;if(!check||!check(row.payload)||row.payload.id!==row.deck_id||!Number.isSafeInteger(row.revision))throw Error('Cloud deck data is invalid. Original data was preserved.');}
  revisions.current=new Map(rows.map(r=>[rowKey(r.game as Game,r.deck_id),r.revision]));
  return rows;
 },[]);
 const upload=useCallback(async(account:string,game:Game,deck:DeckByGame[Game],expected:number)=>{
  if(!accountClient)return;
  const result=await accountClient.rpc('save_deck',{p_account_id:account,p_game:game,p_deck_id:deck.id,p_payload:deck,p_expected_revision:expected});
  if(result.error){if(result.error.message.includes('stale revision')){
   const remote=await readCloud(account);const current=remote.find(r=>r.game===game&&r.deck_id===deck.id);
   if(current){const copy={...deck,id:crypto.randomUUID(),name:deck.name+' (from this device)'} as DeckByGame[Game];
    const cached=readAccountCache(localStorage,account,game);if(cached.error)throw Error(cached.error);
    const preserved=cached.decks.filter(d=>d.id!==deck.id);
    const written=writeAccountCache(localStorage,account,game,[...preserved,current.payload,copy] as never);if(written.error)throw Error(written.error);
    const queued=queueDeck(localStorage,account,game,copy as never,0);if(queued.error)throw Error(queued.error);
    const cleared=clearPending(localStorage,account,game,deck.id,deck as never,expected);if(cleared.error)throw Error(cleared.error);
    setCollections(c=>({...c,[game]:[...c[game].filter(d=>d.id!==deck.id),current.payload,copy]}));
    await upload(account,game,copy,0);return;
   }
  }throw result.error;}
  revisions.current.set(rowKey(game,deck.id),result.data as number);
  const cleared=clearPending(localStorage,account,game,deck.id,deck as never,expected);if(cleared.error)throw Error(cleared.error);
 },[readCloud]);
 const retry=useCallback(async(accountOverride?:string)=>{
  const account=accountOverride??accountId;if(!account||!accountClient)return;
  setStatus('loading');setError('');
  try{
   const rows=await readCloud(account);const next=empty();
   for(const game of games){
    const cached=readAccountCache(localStorage,account,game);if(cached.error)throw Error(cached.error);
    const remote=rows.filter(r=>r.game===game).map(r=>r.payload) as never[];
    let uploads=cached.pending.map(p=>p.deck) as DeckByGame[Game][];
    let merged=[...remote] as DeckByGame[Game][];
    for(const deck of uploads){const index=merged.findIndex(d=>d.id===deck.id);if(index>=0)merged[index]=deck;else merged.push(deck);}
    if(!localStorage.getItem(importedKey(account))){
     const source=guest[game](localStorage);if(source.error)throw Error(source.error);
     const result=mergeDecks(source.decks as never[],merged as never[],()=>crypto.randomUUID());
     merged=result.decks as DeckByGame[Game][];uploads=[...uploads,...result.uploads as DeckByGame[Game][]];
    }
    const written=writeAccountCache(localStorage,account,game,merged as never);if(written.error)throw Error(written.error);
    for(const deck of uploads){const revision=revisions.current.get(rowKey(game,deck.id))??0;const queued=queueDeck(localStorage,account,game,deck as never,revision);if(queued.error)throw Error(queued.error);}
    (next as Record<Game,DeckByGame[Game][]>)[game]=merged;
   }
   localStorage.setItem(importedKey(account),'1');setCollections(next);
   for(const game of games){const cached=readAccountCache(localStorage,account,game);for(const item of cached.pending){await upload(account,game,item.deck,item.expectedRevision);}}
   setStatus('synced');
  }catch(e){const hasPending=games.some(game=>readAccountCache(localStorage,account,game).pending.length);setError((e as Error).message||'Cloud sync failed. Retry when connected.');setStatus(hasPending?'pending':'error');}
 },[accountId,readCloud,upload]);
 useEffect(()=>{if(!accountClient)return;let cancelled=false;(async()=>{try{const active=localStorage.getItem(activeKey);if(!active)return;const current=await accountClient.auth.getSession();if(!current.data.session||cancelled)return;setAccountId(active);setAccessId(localStorage.getItem(idKey(active))??'');await retry(active);}catch(e){if(!cancelled)fail((e as Error).message);}})();return()=>{cancelled=true;};},[retry]);
 const link=async(id?:string)=>{if(!accountClient){fail('Cloud access is not configured.');return;}setStatus('loading');setError('');try{await session();let account:string,code='';if(id!==undefined){if(!/^[0-9a-f]{48}$/.test(id))throw Error('invalid');const found=await accountClient.rpc('redeem_access_id',{p_access_id:id});if(found.error||!found.data)throw Error('invalid');account=found.data as string;code=id;}else{const created=await accountClient.rpc('create_access_id');if(created.error||!created.data?.[0])throw created.error??Error('Access ID could not be created');account=created.data[0].account_id;code=created.data[0].access_id;}
   localStorage.setItem(activeKey,account);localStorage.setItem(idKey(account),code);setAccountId(account);setAccessId(code);await retry(account);
  }catch(e){if(id!==undefined){setError('Access ID could not be opened. Check the ID and try again.');setStatus(accountId?'synced':'local');}else fail((e as Error).message);}};
 const saveDeck=async<G extends Game>(game:G,deck:DeckByGame[G])=>{if(!accountId)return;const revision=revisions.current.get(rowKey(game,deck.id))??0;const queued=queueDeck(localStorage,accountId,game,deck,revision);if(queued.error){fail(queued.error);return;}setCollections(c=>({...c,[game]:[...c[game].filter(d=>d.id!==deck.id),deck]}));setStatus('pending');await retry(accountId);};
 const signOut=async()=>{if(!window.confirm('Sign out? Keep your access ID safe. Pending changes will remain on this device until you sign in and retry.'))return;await accountClient?.auth.signOut();if(accountId){localStorage.removeItem(activeKey);localStorage.removeItem(idKey(accountId));}setAccountId(null);setAccessId('');setCollections(empty());setError('');setStatus('local');revisions.current.clear();};
 return <AccountContext.Provider value={{accountId,accessId,status,error,collections,createAccount:()=>link(),enterAccessId:(id)=>link(id),saveDeck,retry:()=>retry(),signOut}}>{children}</AccountContext.Provider>;
}
export function useAccount(){const account=useContext(AccountContext);if(!account)throw Error('AccountProvider is missing');return account;}
