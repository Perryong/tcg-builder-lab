import {createContext,useCallback,useContext,useEffect,useRef,useState} from 'react';
import type {ReactNode} from 'react';
import {accountClient} from './client.ts';
import {clearPending,mergeDecks,queueDeck,readAccountCache,sameDeck,writeAccountCache} from './sync.ts';
import type {DeckByGame,Game} from './sync.ts';
import {loadDecks,storageKey as onePieceStorageKey} from '../deck.ts';
import {loadPokemonDecks,pokemonStorageKey} from '../pokemon/deck.ts';
import {loadYugiohDecks,storageKey as yugiohStorageKey} from '../yugioh/deck.ts';
import {isOnePieceDeck} from '../deck.ts';
import {isPokemonDeck} from '../pokemon/deck.ts';
import {isYugiohDeck} from '../yugioh/deck.ts';
import {normalizeUsername} from './username.ts';

type Status='local'|'loading'|'synced'|'pending'|'error';
type Collections={[G in Game]:DeckByGame[G][]};
type Account={accountId:string|null;username:string;needsUsername:boolean;createdNotice:boolean;guestImportAvailable:boolean;status:Status;error:string;collections:Collections;continueWithUsername:(name:string)=>Promise<void>;redeemLegacyId:(id:string)=>Promise<void>;claimUsername:(name:string)=>Promise<void>;importGuestDecks:()=>Promise<void>;saveDeck:<G extends Game>(game:G,deck:DeckByGame[G])=>boolean;retry:()=>Promise<void>;signOut:()=>Promise<void>};
const empty=():Collections=>({onepiece:[],pokemon:[],yugioh:[]});
const games:Game[]=['onepiece','pokemon','yugioh'];
const activeKey='tcg-builder.active-account.v1';
const idKey=(accountId:string)=>`tcg-builder.access-id.${accountId}.v1`;
const usernameKey=(accountId:string)=>`tcg-builder.username.${accountId}.v1`;
const userKey=(accountId:string)=>`tcg-builder.auth-user.${accountId}.v1`;
const importedKey=(accountId:string)=>`tcg-builder.guest-imported.${accountId}.v1`;
const guest={onepiece:loadDecks,pokemon:loadPokemonDecks,yugioh:loadYugiohDecks};
const guestKeys=[onePieceStorageKey,pokemonStorageKey,yugiohStorageKey];
const guestSnapshot=()=>JSON.stringify(guestKeys.map(key=>localStorage.getItem(key)));
const hasGuestDecks=(account:string)=>guestKeys.some(key=>localStorage.getItem(key))&&localStorage.getItem(importedKey(account))!==guestSnapshot();
const valid={onepiece:isOnePieceDeck,pokemon:(v:unknown)=>isPokemonDeck(v)&&!('leaderNumber' in (v as object))&&!('main' in (v as object)),yugioh:isYugiohDeck};
const AccountContext=createContext<Account|null>(null);

export function AccountProvider({children}:{children:ReactNode}){
 const [accountId,setAccountId]=useState<string|null>(null),[username,setUsername]=useState(''),[createdNotice,setCreatedNotice]=useState(false),[guestImportAvailable,setGuestImportAvailable]=useState(false),[status,setStatus]=useState<Status>('local'),[error,setError]=useState(''),[collections,setCollections]=useState<Collections>(empty);
 const revisions=useRef(new Map<string,number>());
 const activeRef=useRef<string|null>(null);
 const syncJobs=useRef<Promise<void>>(Promise.resolve());
 const rowKey=(account:string,game:Game,id:string)=>`${account}:${game}:${id}`;
 const fail=(message:string)=>{setError(message);setStatus('error');};
 const session=async()=>{if(!accountClient)throw Error('Cloud access is not configured.');const current=await accountClient.auth.getSession();if(current.data.session)return;const created=await accountClient.auth.signInAnonymously();if(created.error)throw created.error;};
 const readCloud=useCallback(async(account:string)=>{
  if(!accountClient)throw Error('Cloud access is not configured.');
  const result=await accountClient.from('saved_decks').select('game,deck_id,payload,revision').eq('account_id',account);
  if(result.error)throw result.error;
  const rows=result.data??[];
  for(const row of rows){const check=valid[row.game as Game] as ((v:unknown)=>boolean)|undefined;if(!check||!check(row.payload)||row.payload.id!==row.deck_id||!Number.isSafeInteger(row.revision))throw Error('Cloud deck data is invalid. Original data was preserved.');}
  if(activeRef.current===account)for(const row of rows){const key=rowKey(account,row.game as Game,row.deck_id);if(!revisions.current.has(key))revisions.current.set(key,row.revision);}
  return rows;
 },[]);
 const upload=useCallback(async(account:string,game:Game,deck:DeckByGame[Game],expected:number)=>{
  if(!accountClient)return;
  const result=await accountClient.rpc('save_deck',{p_account_id:account,p_game:game,p_deck_id:deck.id,p_payload:deck,p_expected_revision:expected});
  if(result.error){if(result.error.message.includes('stale revision')){
   const remote=await readCloud(account);const current=remote.find(r=>r.game===game&&r.deck_id===deck.id);
   if(current){if(sameDeck(current.payload,deck)){
     revisions.current.set(rowKey(account,game,deck.id),current.revision);
     const cleared=clearPending(localStorage,account,game,deck.id,deck as never,expected);if(cleared.error)throw Error(cleared.error);
     return;
   }
    const copy={...deck,id:crypto.randomUUID(),name:deck.name+' (from this device)'} as DeckByGame[Game];
    const cached=readAccountCache(localStorage,account,game);if(cached.error)throw Error(cached.error);
    const preserved=cached.decks.filter(d=>d.id!==deck.id);
    const written=writeAccountCache(localStorage,account,game,[...preserved,current.payload,copy] as never);if(written.error)throw Error(written.error);
    const queued=queueDeck(localStorage,account,game,copy as never,0);if(queued.error)throw Error(queued.error);
    const cleared=clearPending(localStorage,account,game,deck.id,deck as never,expected);if(cleared.error)throw Error(cleared.error);
    if(activeRef.current===account)setCollections(c=>({...c,[game]:[...c[game].filter(d=>d.id!==deck.id),current.payload,copy]}));
    await upload(account,game,copy,0);return;
   }
  }throw result.error;}
  revisions.current.set(rowKey(account,game,deck.id),result.data as number);
  const cleared=clearPending(localStorage,account,game,deck.id,deck as never,expected);if(cleared.error)throw Error(cleared.error);
 },[readCloud]);
 const sync=useCallback(async(account:string)=>{
  if(!accountClient||activeRef.current!==account)return;
  setStatus('loading');setError('');
  try{
   const local=empty();
   for(const game of games){const cached=readAccountCache(localStorage,account,game);if(cached.error)throw Error(cached.error);(local as Record<Game,DeckByGame[Game][]>)[game]=cached.decks;}
   if(activeRef.current!==account)return;setCollections(local);
   const verified=await accountClient.rpc('account_username',{p_account_id:account});
   if(verified.error){
    if(/not authorized|invalid input syntax for type uuid/i.test(verified.error.message)){
     localStorage.removeItem(activeKey);localStorage.removeItem(usernameKey(account));localStorage.removeItem(userKey(account));activeRef.current=null;revisions.current.clear();
     setAccountId(null);setUsername('');setGuestImportAvailable(false);setCollections(empty());setStatus('local');setError('This browser is no longer linked to that username. Enter it again to open its decks.');return;
    }
    throw verified.error;
   }
   const verifiedName=verified.data===null?'':normalizeUsername(verified.data as string);
   if(activeRef.current!==account)return;setUsername(verifiedName);if(verifiedName)localStorage.setItem(usernameKey(account),verifiedName);
   const rows=await readCloud(account);const next=empty();
   if(activeRef.current!==account)return;
   for(const game of games){
    const cached=readAccountCache(localStorage,account,game);if(cached.error)throw Error(cached.error);
    const remote=rows.filter(r=>r.game===game).map(r=>r.payload) as never[];
    const uploads=cached.pending.map(p=>p.deck) as DeckByGame[Game][];
    let merged=[...remote] as DeckByGame[Game][];
    for(const deck of uploads){const index=merged.findIndex(d=>d.id===deck.id);if(index>=0)merged[index]=deck;else merged.push(deck);}
    const written=writeAccountCache(localStorage,account,game,merged as never);if(written.error)throw Error(written.error);
    for(const deck of uploads){const revision=revisions.current.get(rowKey(account,game,deck.id))??0;const queued=queueDeck(localStorage,account,game,deck as never,revision);if(queued.error)throw Error(queued.error);}
    (next as Record<Game,DeckByGame[Game][]>)[game]=merged;
   }
   if(activeRef.current!==account)return;setCollections(next);
   for(const game of games){const cached=readAccountCache(localStorage,account,game);for(const item of cached.pending){if(activeRef.current!==account)return;await upload(account,game,item.deck,item.expectedRevision);}}
   if(activeRef.current===account)setStatus(games.some(game=>readAccountCache(localStorage,account,game).pending.length)?'pending':'synced');
  }catch(e){if(activeRef.current!==account)return;const hasPending=games.some(game=>readAccountCache(localStorage,account,game).pending.length);setError((e as Error).message||'Cloud sync failed. Retry when connected.');setStatus(hasPending?'pending':'error');}
 },[readCloud,upload]);
 const retry=useCallback((accountOverride?:string)=>{const account=accountOverride??accountId;if(!account)return Promise.resolve();const job=syncJobs.current.then(()=>sync(account));syncJobs.current=job.catch(()=>{});return job;},[accountId,sync]);
 useEffect(()=>{if(!accountClient)return;let cancelled=false;(async()=>{try{
  const active=localStorage.getItem(activeKey);if(!active)return;
  const current=await accountClient.auth.getSession();if(!current.data.session||cancelled)return;
  const found=await accountClient.rpc('account_username',{p_account_id:active});if(cancelled)return;
  if(found.error&&(!/failed to fetch|networkerror/i.test(found.error.message)||localStorage.getItem(userKey(active))!==current.data.session.user.id)){
   localStorage.removeItem(activeKey);localStorage.removeItem(usernameKey(active));localStorage.removeItem(userKey(active));setError('This browser is no longer linked to that username. Enter it again to open its decks.');return;
  }
  const name=found.error?localStorage.getItem(usernameKey(active))??'':found.data===null?'':normalizeUsername(found.data as string);
  activeRef.current=active;setAccountId(active);setUsername(name);setCreatedNotice(false);setGuestImportAvailable(hasGuestDecks(active));
  if(!found.error){localStorage.setItem(userKey(active),current.data.session.user.id);if(name)localStorage.setItem(usernameKey(active),name);}
  await retry(active);
 }catch(e){if(!cancelled)fail((e as Error).message);}})();return()=>{cancelled=true;};},[]);
 useEffect(()=>{if(!accountId)return;const reconnect=()=>{void retry(accountId);};window.addEventListener('online',reconnect);return()=>window.removeEventListener('online',reconnect);},[accountId,retry]);
 const activate=async(account:string,name:string,created=false)=>{if(activeRef.current&&activeRef.current!==account){revisions.current.clear();setCollections(empty());}const current=await accountClient!.auth.getSession();if(!current.data.session)throw Error('Sign in again to open this username.');activeRef.current=account;localStorage.setItem(activeKey,account);localStorage.setItem(userKey(account),current.data.session.user.id);if(name)localStorage.setItem(usernameKey(account),name);setAccountId(account);setUsername(name);setCreatedNotice(created);setGuestImportAvailable(hasGuestDecks(account));await retry(account);};
 const continueWithUsername=async(input:string)=>{if(!accountClient){fail('Cloud access is not configured.');return;}setStatus('loading');setError('');try{const name=normalizeUsername(input);await session();let result=await accountClient.rpc('open_username',{p_username:name});if(result.error?.message.includes('JWT issued at future')){await new Promise(resolve=>setTimeout(resolve,1100));result=await accountClient.rpc('open_username',{p_username:name});}const row=result.data?.[0];if(result.error||!row||typeof row.account_id!=='string'||row.username!==name||typeof row.created!=='boolean')throw result.error??Error('Invalid account response');await activate(row.account_id,name,row.created);}catch(e){fail((e as Error).message||'Username could not be opened.');}};
 const redeemLegacyId=async(id:string)=>{if(!accountClient){fail('Cloud access is not configured.');return;}setStatus('loading');setError('');try{if(!/^[0-9a-f]{48}$/.test(id))throw Error('invalid');await session();const found=await accountClient.rpc('redeem_access_id',{p_access_id:id});if(found.error||typeof found.data!=='string')throw Error('invalid');const result=await accountClient.rpc('account_username',{p_account_id:found.data});if(result.error)throw result.error;await activate(found.data,result.data===null?'':normalizeUsername(result.data as string));}catch{setError('Old access ID could not be opened. Check it and try again.');setStatus(accountId?'synced':'local');}};
 const claimUsername=async(input:string)=>{if(!accountClient||!accountId)return;setStatus('loading');setError('');try{const name=normalizeUsername(input);const result=await accountClient.rpc('claim_username',{p_account_id:accountId,p_username:name});if(result.error)throw result.error;if(result.data!==name)throw Error('Invalid account response');localStorage.setItem(usernameKey(accountId),name);localStorage.removeItem(idKey(accountId));setUsername(name);setCreatedNotice(false);await retry(accountId);}catch(e){fail((e as Error).message||'Username could not be claimed.');}};
 const importGuestDecks=async()=>{
  if(!accountId||!username||!guestImportAvailable)return;
  if(!window.confirm(`Import this device's decks into username "${username}"? Anyone using that username can view and edit them.`))return;
  setStatus('loading');setError('');
  try{
   await syncJobs.current;
   if(activeRef.current!==accountId)return;
   const sources=games.map(game=>{const result=guest[game](localStorage);if(result.error)throw Error(result.error);return result.decks;});
   for(const [index,game] of games.entries()){
    const cached=readAccountCache(localStorage,accountId,game);if(cached.error)throw Error(cached.error);
    const result=mergeDecks(sources[index] as never[],cached.decks as never[],()=>crypto.randomUUID());
    for(const deck of result.uploads){const queued=queueDeck(localStorage,accountId,game,deck as never,0);if(queued.error)throw Error(queued.error);}
   }
   localStorage.setItem(importedKey(accountId),guestSnapshot());setGuestImportAvailable(false);
   await retry(accountId);
  }catch(e){fail((e as Error).message||'Device decks could not be imported.');}
 };
 const saveDeck=<G extends Game>(game:G,deck:DeckByGame[G]):boolean=>{if(!accountId||activeRef.current!==accountId)return false;const revision=revisions.current.get(rowKey(accountId,game,deck.id))??0;const queued=queueDeck(localStorage,accountId,game,deck,revision);if(queued.error){fail(queued.error);return false;}setCollections(c=>({...c,[game]:[...c[game].filter(d=>d.id!==deck.id),deck]}));setStatus('pending');void retry(accountId);return true;};
 const signOut=async()=>{if(!window.confirm('Sign out? Pending changes will remain on this device until you reopen this username and retry.'))return;await accountClient?.auth.signOut();activeRef.current=null;if(accountId){localStorage.removeItem(activeKey);localStorage.removeItem(idKey(accountId));localStorage.removeItem(usernameKey(accountId));localStorage.removeItem(userKey(accountId));}setAccountId(null);setUsername('');setCreatedNotice(false);setGuestImportAvailable(false);setCollections(empty());setError('');setStatus('local');revisions.current.clear();};
 return <AccountContext.Provider value={{accountId,username,needsUsername:!!accountId&&!username,createdNotice,guestImportAvailable,status,error,collections,continueWithUsername,redeemLegacyId,claimUsername,importGuestDecks,saveDeck,retry:()=>retry(),signOut}}>{children}</AccountContext.Provider>;
}
export function useAccount(){const account=useContext(AccountContext);if(!account)throw Error('AccountProvider is missing');return account;}
