import {useEffect,useState} from 'react';
import {accountClient} from './client.ts';
import {useAccount} from './AccountProvider.tsx';

export default function AccountControls(){
 const {accountId,username,needsUsername,createdNotice,guestImportAvailable,status,error,continueWithUsername,redeemLegacyId,claimUsername,importGuestDecks,retry,signOut}=useAccount();
 const [entry,setEntry]=useState(''),[oldId,setOldId]=useState('');
 useEffect(()=>{if(username)setEntry('');},[username]);
 return <div className="account-controls" aria-label="Deck cloud account">
  {!accountClient?<span>Decks saved on this device</span>:accountId?<>
   <span className="account-status" role="status">{status==='synced'?'Cloud synced':status==='pending'?'Pending sync':status==='loading'?'Syncing…':'Sync error'}</span>
   {needsUsername?<form onSubmit={e=>{e.preventDefault();void claimUsername(entry);}}><label>Choose username <input aria-label="Choose username" value={entry} onChange={e=>setEntry(e.target.value)} autoComplete="username" spellCheck={false}/></label><button disabled={status==='loading'}>Claim username</button></form>
    :<label>Current username <input aria-label="Current username" readOnly value={username}/></label>}
   {createdNotice&&<span className="account-created" role="status">New username created</span>}
   {username&&guestImportAvailable&&<button onClick={()=>void importGuestDecks()}>Import this device&apos;s decks</button>}
   {(status==='pending'||status==='error')&&<button onClick={()=>retry()}>Retry sync</button>}
   <button onClick={signOut}>Sign out</button>
  </>:<>
   <form onSubmit={e=>{e.preventDefault();void continueWithUsername(entry);}}><label>Username <input aria-label="Username" value={entry} onChange={e=>setEntry(e.target.value)} autoComplete="username" spellCheck={false}/></label><button disabled={status==='loading'}>Continue with username</button></form>
   <details><summary>Move old decks</summary><form onSubmit={e=>{e.preventDefault();void redeemLegacyId(oldId.trim().toLowerCase());}}><label>Enter old access ID <input aria-label="Enter old access ID" value={oldId} onChange={e=>setOldId(e.target.value)} autoComplete="off" spellCheck={false}/></label><button disabled={status==='loading'}>Move old decks</button></form></details>
  </>}
  {error&&<span className="account-error" role="alert">{error}</span>}
 </div>;
}
