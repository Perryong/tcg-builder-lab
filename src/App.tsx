import {useState} from 'react';
import OnePieceApp from './OnePieceApp.tsx';
import YugiohApp from './yugioh/YugiohApp.tsx';
import PokemonApp from './pokemon/PokemonApp.tsx';
import {AccountProvider} from './account/AccountProvider.tsx';
import AccountControls from './account/AccountControls.tsx';
export default function App(){const [game,setGame]=useState('onepiece');const [visited,setVisited]=useState(false);const [ygo,setYgo]=useState(false);return <AccountProvider><div className="game-selector"><strong>TCG BUILDER LAB</strong><AccountControls/><label>Explore <select aria-label="Choose card game" value={game} onChange={e=>{setGame(e.target.value);if(e.target.value==='pokemon')setVisited(true);if(e.target.value==='yugioh')setYgo(true);}}><option value="onepiece">One Piece</option><option value="pokemon">Pokémon</option><option value="yugioh">Yu-Gi-Oh!</option></select></label></div><section className="game-screen" hidden={game!=='onepiece'}><OnePieceApp/></section>{visited&&<section className="game-screen pokemon-screen" hidden={game!=='pokemon'}><PokemonApp/></section>}{ygo&&<section className="game-screen pokemon-screen yugioh-screen" hidden={game!=='yugioh'}><YugiohApp/></section>}</AccountProvider>;}
