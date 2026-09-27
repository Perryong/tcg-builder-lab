import { useEffect, useState } from 'react';
import { ArrowUpRight, BookOpen, Compass, ExternalLink, Layers3, Menu, Plus, TrendingUp, X } from 'lucide-react';
import type { Card, CatalogSnapshot, RulesSnapshot, MetaSnapshot, EventRecord } from './data.ts';
import { normalizeCatalog } from './catalog.ts';
import Catalog from './Catalog.tsx';
import DeckBuilder from './DeckBuilder.tsx';
import Meta from './Meta.tsx';
import { loadDecks, newDeck, saveDecks } from './deck.ts';
import type { Deck } from './deck.ts';
export default function App() {
  const [snapshot, setSnapshot] = useState<CatalogSnapshot | null>(null);
  const [error, setError] = useState('');
  const [meta,setMeta]=useState<MetaSnapshot|null>(null);
  const [rules,setRules]=useState<RulesSnapshot|null>(null);
  const [initial]=useState(()=>{try{return loadDecks(localStorage);}catch{return {decks:[] as Deck[],error:'Browser storage unavailable. Export your deck before closing.'};}});
  const [saved,setSaved]=useState<Deck[]>(initial.decks);
  const [deck,setDeck]=useState<Deck>(()=>initial.decks[0]??newDeck());
  const [storageError,setStorageError]=useState(initial.error??'');
  const dirty=!saved.some(d=>d.id===deck.id&&JSON.stringify(d)===JSON.stringify(deck));
  const [view, setView] = useState('cards');
  const [menu, setMenu] = useState(false);
  const [notice, setNotice] = useState('');
  useEffect(()=>{fetch(`${import.meta.env.BASE_URL}data/meta.json`).then(r=>{if(!r.ok)throw new Error('Meta evidence could not be loaded.');return r.json();}).then(d=>{if(!Array.isArray(d.events)||!Array.isArray(d.archetypes))throw new Error('Invalid meta snapshot.');setMeta(d);}).catch(e=>setError(e.message));},[]);
  useEffect(()=>{fetch(`${import.meta.env.BASE_URL}data/rules.json`).then(r=>{if(!r.ok)throw new Error('Rules could not be loaded.');return r.json();}).then(setRules).catch(e=>setError(e.message));},[]);
  useEffect(() => { fetch(`${import.meta.env.BASE_URL}data/catalog.json`).then(r => { if (!r.ok) throw new Error('The card library could not be loaded.');return r.json(); }).then(d => setSnapshot(normalizeCatalog(d))).catch(e => setError(e.message)); }, []);
  useEffect(() => { if (!notice) return;const t=setTimeout(() => setNotice(''),4000);return ()=>clearTimeout(t); }, [notice]);
  const navigate=(next:string)=>{setView(next);setMenu(false);window.scrollTo({top:0});};
  const onAdd=(card:Card)=>{
    if(card.type==='DON!!'){setNotice('Set your DON!! count in the deck builder.');navigate('deck');return;}
    setDeck(d=>card.type==='LEADER'?{...d,leaderNumber:card.number,donCount:rules?.leaderExceptions[card.number]?.donCount??10}:{...d,cards:{...d.cards,[card.number]:(d.cards[card.number]??0)+1}});
    setNotice(card.type==='LEADER'?`${card.name} is your leader. Existing cards are preserved.`:`Added ${card.name} to your crew.`);navigate('deck');
  };
  const useList=(event:EventRecord)=>{
    if(!event.list)return;
    if(dirty && !window.confirm('Open this tournament list as a new deck? Unsaved draft changes will be replaced.'))return;
    setDeck({...newDeck(),name:`${event.player}'s ${snapshot?.cards.find(c=>c.number===event.leaderNumber)?.name??'crew'}`,leaderNumber:event.leaderNumber,cards:{...event.list},donCount:rules?.leaderExceptions[event.leaderNumber]?.donCount??10});
    setNotice(`Loaded sourced list from ${event.date}. Check your event's format before playing.`);navigate('deck');
  };
  const save=()=>{
    if(initial.error){setStorageError(initial.error+' Saving is disabled to protect the original storage.');return;}
    const next=saved.some(d=>d.id===deck.id)?saved.map(d=>d.id===deck.id?deck:d):[...saved,deck];
    try{const result=saveDecks(localStorage,next);if(result.error){setStorageError(result.error);return;}setSaved(next);setStorageError('');setNotice('Deck saved in this browser.');}catch{setStorageError('Storage unavailable. Export your deck to keep it.');}
  };
  const create=()=>{if(dirty&&!window.confirm('Start a new deck? Unsaved changes in this draft will be replaced.'))return;setDeck(newDeck());navigate('deck');};
  const load=(id:string)=>{if(dirty&&!window.confirm('Load this saved deck? Unsaved changes in this draft will be replaced.'))return;const next=saved.find(d=>d.id===id);if(next)setDeck(next);};
  return <div className="app-shell"><a className="skip-link" href="#main">Skip to content</a><aside className={`sidebar ${menu ? 'open' : ''}`}><a className="brand" href="#cards" onClick={()=>navigate('cards')}><span className="brand-icon"><Compass size={26} strokeWidth={1.5}/></span><span>GRAND LINE<small>THE TCG COMPANION</small></span></a><button className="mobile-close icon-button" onClick={()=>setMenu(false)} aria-label="Close navigation"><X/></button><div className="game-switch"><span className="game-monogram">OP</span><div>One Piece<small>CARD GAME</small></div><span className="status-dot"/></div><p className="nav-label">YOUR EXPLORER</p><nav aria-label="Main navigation">{[{id:'cards',name:'Card library',Icon:Layers3},{id:'deck',name:'Deck builder',Icon:BookOpen},{id:'meta',name:'Meta & insights',Icon:TrendingUp}].map(({id,name,Icon})=><button key={id} className={`nav-item ${view===id?'active':''}`} onClick={()=>navigate(id)} aria-current={view===id?'page':undefined}><Icon size={19}/>{name}{view===id&&<span/>}</button>)}</nav><div className="sidebar-decks"><p className="nav-label">YOUR NEXT ADVENTURE</p><button className="new-deck-link" onClick={create}><Plus size={16}/> Build a new deck</button></div><div className="sidebar-bottom"><div className="sidebar-quote"><Compass size={22}/><p>Find your cards.<br/>Build your crew.</p><span>MAKE YOUR OWN WAY.</span></div><a href="https://asia-en.onepiece-cardgame.com/" target="_blank" rel="noreferrer">Official One Piece site <ArrowUpRight size={15}/></a><small>AN UNOFFICIAL FAN COMPANION</small></div></aside>{menu&&<button className="menu-scrim" onClick={()=>setMenu(false)} aria-label="Dismiss navigation"/>}<div className="workspace"><header className="topbar"><div><button className="mobile-menu icon-button" aria-label="Open navigation" onClick={()=>setMenu(true)}><Menu size={20}/></button><span>ONE PIECE</span><span className="breadcrumb-divider">/</span><strong>{view==='cards'?'Card library':view==='deck'?'Deck builder':'Meta & insights'}</strong></div><div className="region-pill"><span className="status-dot"/> Singapore / Asia <span className="region-language">EN</span></div></header><main id="main">{error?<div className="empty-state" role="alert"><h1>Something went adrift.</h1><p>{error}</p><button className="button primary" onClick={()=>location.reload()}>Try again</button></div>:(!snapshot||!rules||!meta)?<div className="empty-state" role="status"><Compass className="loading-compass" size={38}/><p>Charting the card library…</p></div>:view==='cards'?<Catalog snapshot={snapshot} onAdd={onAdd}/>:view==='deck'?<DeckBuilder cards={snapshot.cards} deck={deck} saved={saved} rules={rules} onChange={setDeck} onSave={save} onLoad={load} onNew={create} dirty={dirty} storageError={storageError}/>:<Meta snapshot={meta} cards={snapshot.cards} rules={rules} deck={deck} onUseList={useList} onOpenBuilder={()=>navigate('deck')}/>}</main><footer className="footer"><p><Compass size={14}/> GRAND LINE <span>Built for the love of the game.</span></p><a href="https://asia-en.onepiece-cardgame.com/cardlist/" target="_blank" rel="noreferrer">Card art © Eiichiro Oda / Shueisha / Toei Animation / Bandai <ExternalLink size={12}/></a></footer></div>{notice&&<div className="toast" role="status">{notice}<button aria-label="Dismiss notification" onClick={()=>setNotice('')}><X size={14}/></button></div>}</div>;
}
