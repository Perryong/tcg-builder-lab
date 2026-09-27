import {useState} from 'react';
import OnePieceApp from './OnePieceApp.tsx';
import PokemonApp from './pokemon/PokemonApp.tsx';
export default function App(){const [game,setGame]=useState('onepiece');const [visited,setVisited]=useState(false);return <><div className="game-selector"><strong>TCG BUILDER LAB</strong><label>Explore <select aria-label="Choose card game" value={game} onChange={e=>{setGame(e.target.value);if(e.target.value==='pokemon')setVisited(true);}}><option value="onepiece">One Piece</option><option value="pokemon">Pokémon</option></select></label></div><section className="game-screen" hidden={game!=='onepiece'}><OnePieceApp/></section>{visited&&<section className="game-screen pokemon-screen" hidden={game!=='pokemon'}><PokemonApp/></section>}</>;}
