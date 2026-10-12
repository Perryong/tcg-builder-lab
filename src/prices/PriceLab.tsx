import {useEffect, useRef, useState} from 'react';
import type {FormEvent} from 'react';
import {ExternalLink, Search, TrendingUp} from 'lucide-react';
import type {MoverBoard, PriceMover, PricePoint, PriceSummary} from './model.ts';

type Game = 'pokemon' | 'one-piece';
type Product = {product_id: number; name: string; set_name: string; card_number: string; game: Game};

const money = (value: number) => new Intl.NumberFormat('en-US', {style: 'currency', currency: 'USD'}).format(value);
const dateLabel = (date: string) => new Date(`${date}T12:00:00Z`).toLocaleDateString('en-US', {month: 'short', day: 'numeric', year: 'numeric'});

async function pricesRequest(params: Record<string, string>): Promise<unknown> {
  const base = import.meta.env.VITE_SUPABASE_URL;
  if (!base) throw new Error('Price service is not configured.');
  const url = new URL(`${base.replace(/\/$/, '')}/functions/v1/card-prices`);
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
  const response = await fetch(url);
  const body = await response.json().catch(() => null);
  if (!response.ok) throw new Error(typeof body?.error === 'string' ? body.error : 'Price service unavailable.');
  return body;
}

function PriceChart({points, label}: {points: PricePoint[]; label: string}) {
  const sample = points.slice(-365);
  const values = sample.map(point => point.market);
  const floor = Math.min(...values) * 0.94;
  const ceiling = Math.max(...values) * 1.06;
  const range = Math.max(ceiling - floor, 0.01);
  const path = sample.map((point, i) => `${i ? 'L' : 'M'}${(i / Math.max(sample.length - 1, 1) * 760 + 20).toFixed(1)},${(230 - (point.market - floor) / range * 200).toFixed(1)}`).join(' ');
  return <div className="price-chart"><div className="price-chart-heading"><strong>Historical market price</strong><span>{dateLabel(sample[0].date)} – {dateLabel(sample.at(-1)!.date)}</span></div><svg viewBox="0 0 800 260" role="img" aria-label={`${label} market price history from ${dateLabel(sample[0].date)} to ${dateLabel(sample.at(-1)!.date)}`} preserveAspectRatio="none"><line x1="20" y1="230" x2="780" y2="230" stroke="#d9ded5"/><path d={path} fill="none" stroke="#b72d37" strokeWidth="3" vectorEffect="non-scaling-stroke" strokeLinejoin="round"/></svg><div className="price-chart-axis"><span>{money(floor)}</span><span>{money(ceiling)}</span></div></div>;
}

function MoverGroup({title, rows, direction, disabled, onChoose}: {title: string; rows: PriceMover[]; direction: 'positive' | 'negative'; disabled: boolean; onChoose: (row: PriceMover) => void}) {
  return <div className={`mover-group ${direction}`}><h3>{title}</h3><div className="mover-list">{rows.map((row, index) => <div className="mover-row" key={`${row.product_id}:${row.finish}`}>
    <button type="button" disabled={disabled} onClick={() => onChoose(row)} aria-label={`View ${row.name} price history`}><span className="mover-rank">{index + 1}</span><span className="mover-art">{row.image_url && <img src={row.image_url} alt="" loading="lazy" onError={event => {event.currentTarget.hidden = true;}}/>}</span><span className="mover-identity"><strong>{row.name}</strong><small>{row.set_name} · {row.finish}</small></span><span className="mover-values"><strong>{direction === 'positive' ? '+' : ''}{row.changePercent.toFixed(1)}%</strong><small>{money(row.before)} → {money(row.after)}</small></span></button>
    <a href={`https://tickermint.cards/card/${row.product_id}`} target="_blank" rel="noreferrer" aria-label={`${row.name} on TickerMint`} title="View source on TickerMint"><ExternalLink size={15}/></a>
  </div>)}</div>{rows.length === 0 && <p className="coverage-note">No qualifying {direction === 'positive' ? 'gainers' : 'fallers'} are available right now.</p>}</div>;
}

export default function PriceLab({game}: {game: Game}) {
  const gameName = game === 'pokemon' ? 'Pokémon' : 'One Piece';
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Product[]>([]);
  const [product, setProduct] = useState<Product | null>(null);
  const [series, setSeries] = useState<PriceSummary[]>([]);
  const [finish, setFinish] = useState('');
  const [busy, setBusy] = useState<'search' | 'history' | null>(null);
  const [searched, setSearched] = useState(false);
  const [error, setError] = useState('');
  const [movers, setMovers] = useState<MoverBoard | null>(null);
  const [moversError, setMoversError] = useState('');
  const [moversBusy, setMoversBusy] = useState(true);
  const [moversReload, setMoversReload] = useState(0);
  const analysisRef = useRef<HTMLDivElement>(null);
  const selected = series.find(item => item.finish === finish);
  const latest = selected?.latest;
  const stale = latest ? Date.now() - Date.parse(`${latest.date}T00:00:00Z`) > 7 * 86400000 : false;

  useEffect(() => { setResults([]); setProduct(null); setSeries([]); setFinish(''); setError(''); setQuery(''); setSearched(false); }, [game]);
  useEffect(() => {if (product) analysisRef.current?.scrollIntoView({block: 'start'});}, [product]);

  useEffect(() => {
    let active = true;
    setMoversBusy(true); setMoversError(''); setMovers(null);
    pricesRequest({kind: 'movers', game}).then(data => {
      if (!data || typeof data !== 'object' || !('gainers' in data) || !Array.isArray(data.gainers) ||
          !('fallers' in data) || !Array.isArray(data.fallers)) throw new Error('Price movers returned unexpected data.');
      if (active) setMovers(data as MoverBoard);
    }).catch(cause => {if (active) setMoversError((cause as Error).message);})
      .finally(() => {if (active) setMoversBusy(false);});
    return () => {active = false;};
  }, [game, moversReload]);

  const search = async (event: FormEvent) => {
    event.preventDefault();
    if (query.trim().length < 2) { setError('Enter at least two characters.'); return; }
    setBusy('search'); setError(''); setProduct(null); setSeries([]); setSearched(false);
    try {
      const data = await pricesRequest({kind: 'search', game, q: query.trim()});
      if (!Array.isArray(data)) throw new Error('Price search returned unexpected data.');
      const products = data.filter((row): row is Product => row && typeof row === 'object' &&
        Number.isInteger(row.product_id) && typeof row.name === 'string' && typeof row.set_name === 'string' &&
        typeof row.card_number === 'string' && row.game === game).slice(0, 30);
      setResults(products);
      setSearched(true);
    } catch (cause) { setError((cause as Error).message); setResults([]); }
    finally { setBusy(null); }
  };
  const choose = async (item: Product, preferredFinish?: string) => {
    setProduct(item); setSeries([]); setFinish(''); setBusy('history'); setError('');
    try {
      const data = await pricesRequest({kind: 'history', game, productId: String(item.product_id)});
      if (!data || typeof data !== 'object' || !('series' in data) || !Array.isArray(data.series)) throw new Error('Price history returned unexpected data.');
      const summaries = data.series as PriceSummary[];
      setSeries(summaries); setFinish(summaries.find(summary => summary.finish === preferredFinish)?.finish ?? summaries[0]?.finish ?? '');
    } catch (cause) { setError((cause as Error).message); }
    finally { setBusy(null); }
  };

  return <section className="price-lab"><div className="page-heading"><div><p className="eyebrow"><TrendingUp size={15}/> {gameName.toUpperCase()} MARKET DATA</p><h1>{gameName} <em>Price Lab.</em></h1><p>See which {gameName} cards moved this week, then explore an exact printing’s history and 30- or 90-day outlook.</p></div></div>
    <section className="mover-board" aria-label={`${gameName} price movers`}><div className="mover-board-heading"><div><p className="eyebrow">SEVEN-DAY MARKET MOVEMENT</p><h2>{gameName} price movers</h2><p>Top 10 gainers and fallers by percentage change, starting at $5. Thin markets are excluded.</p></div><span>USD · 7 DAYS</span></div>
      {moversBusy && <p role="status" className="muted">Loading {gameName} market movers…</p>}
      {moversError && <div className="mover-error"><p role="alert">{moversError}</p><button type="button" className="button" onClick={() => setMoversReload(value => value + 1)}>Retry movers</button></div>}
      {movers && <div className="mover-columns"><MoverGroup title="Top 10 gainers" rows={movers.gainers} direction="positive" disabled={busy !== null} onChoose={row => choose({product_id: row.product_id, name: row.name, set_name: row.set_name, card_number: '', game}, row.finish)}/><MoverGroup title="Top 10 fallers" rows={movers.fallers} direction="negative" disabled={busy !== null} onChoose={row => choose({product_id: row.product_id, name: row.name, set_name: row.set_name, card_number: '', game}, row.finish)}/></div>}
      <p className="mover-source">Source: <a href="https://tickermint.cards/" target="_blank" rel="noreferrer">TickerMint</a> market-price snapshots. Changes are not individual sales or investment advice.</p>
    </section>
    <form className="price-search" onSubmit={search}><label className="search-field"><Search size={18}/><input aria-label={`Search ${gameName} prices`} value={query} onChange={event => setQuery(event.target.value)} placeholder={game === 'pokemon' ? 'Card name and collector number, e.g. Umbreon VMAX 215/203' : 'Card name or number, e.g. OP01-001'}/></label><button className="button primary" disabled={busy !== null}>Find prices</button></form>
    {error && <p className="alert" role="alert">{error}</p>}
    {busy === 'search' && <p role="status" className="muted">Finding priced printings…</p>}
    {!busy && results.length === 0 && !product && <p className="coverage-note">{searched ? 'No priced printings matched. Try the card name and collector number.' : 'Search by name and number, then choose the exact set or alternate art. Prices are in USD.'}</p>}
    {results.length > 0 && <div className="price-results"><h2>Choose a printing</h2><div>{results.map(item => <button type="button" disabled={busy !== null} className={product?.product_id === item.product_id ? 'selected' : ''} key={item.product_id} onClick={() => choose(item)}><strong>{item.name}</strong><span>{item.set_name} · {item.card_number}</span></button>)}</div></div>}
    {product && <div className="price-analysis" ref={analysisRef}><div className="price-product-heading"><div><p className="eyebrow">EXACT MARKET PRODUCT</p><h2>{product.name}</h2><p>{product.set_name}{product.card_number && ` · ${product.card_number}`}</p></div><a href={`https://tickermint.cards/card/${product.product_id}`} target="_blank" rel="noreferrer">Prices: TickerMint ↗</a></div>
      {busy === 'history' && <p role="status">Loading price history…</p>}
      {!busy && !error && !series.length && <p className="alert">No market-price history is available for this printing.</p>}
      {series.length > 0 && <><label className="price-finish">Finish <select aria-label="Price finish" value={finish} onChange={event => setFinish(event.target.value)}>{series.map(item => <option key={item.finish}>{item.finish}</option>)}</select></label>
        {selected && <><div className="price-current"><div><small>Latest market price</small><strong>{money(latest!.market)}</strong><span>As of {dateLabel(latest!.date)} · {selected.observations.toLocaleString()} daily observations</span></div><p>Market-price snapshots are indicative, not individual sale prices.</p></div><PriceChart points={selected.chart} label={`${product.name} ${finish}`}/>
          {stale ? <p className="alert">The latest price is more than a week old. Forecasts are paused until the source updates.</p> : <div className="forecast-grid">{([30, 90] as const).map(days => { const forecast = selected.forecasts[days]; return <article className="forecast-card" key={days}><h3>{days}-day outlook</h3>{forecast?.reliable ? <><strong>{money(forecast.estimate)}</strong><p>Historical error band: {money(forecast.bandLow)}–{money(forecast.bandHigh)}</p><small>{forecast.model} · {forecast.backtestCount} held-out windows · average error {forecast.backtestError.toFixed(1)}%</small></> : forecast ? <><p>Too volatile for a useful estimate.</p><small>{forecast.backtestCount} held-out windows · average error {forecast.backtestError.toFixed(1)}%</small></> : <p>Not enough dated history for a held-out outlook.</p>}</article>; })}</div>}
        </>}
      </>}
      <p className="coverage-note">The chart shows monthly summaries of daily prices. Experimental trend forecasts use only past prices. The band shows the 80th percentile of held-out model errors, with a 5% minimum; it is not a guarantee. Estimates are withheld when average held-out error exceeds 40%. Reprints, bans, and market shocks may change prices abruptly.</p>
    </div>}
    <p className="price-attribution">Market data: <a href="https://tickermint.cards/" target="_blank" rel="noreferrer">TickerMint</a>. This fan project is non-commercial.</p>
  </section>;
}
