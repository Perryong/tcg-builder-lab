import {useEffect,useState} from 'react';
import {accountClient} from './client.ts';
import {useAccount} from './AccountProvider.tsx';

export default function AccountControls(){
 const {accountId,accessId,status,error,createAccount,enterAccessId,retry,signOut}=useAccount();
 const [entry,setEntry]=useState(''),[copied,setCopied]=useState(false);
 useEffect(()=>{if(accountId)setEntry('');},[accountId]);
 return <div className="account-controls" aria-label="Deck cloud account">
  {!accountClient?<span>Decks saved on this device</span>:accountId?<>
   <span className="account-status" role="status">{status==='synced'?'Cloud synced':status==='pending'?'Pending sync':status==='loading'?'Syncing…':'Sync error'}</span>
   <label>Your access ID <input aria-label="Your access ID" readOnly value={accessId} onFocus={e=>e.currentTarget.select()}/></label>
   <button onClick={async()=>{await navigator.clipboard.writeText(accessId);setCopied(true);}} disabled={!accessId}>{copied?'Copied':'Copy ID'}</button>
   {(status==='pending'||status==='error')&&<button onClick={()=>retry()}>Retry sync</button>}
   <button onClick={signOut}>Sign out</button>
  </>:<>
   <button onClick={createAccount} disabled={status==='loading'}>Create access ID</button>
   <label>Enter access ID <input aria-label="Enter access ID" value={entry} onChange={e=>setEntry(e.target.value.trim().toLowerCase())} autoComplete="off" spellCheck={false}/></label>
   <button onClick={()=>enterAccessId(entry)} disabled={status==='loading'}>Open saved decks</button>
  </>}
  {error&&<span className="account-error" role="alert">{error}</span>}
  <small>Anyone with your ID can view and edit your decks. Keep it safe; there is no recovery.</small>
 </div>;
}
