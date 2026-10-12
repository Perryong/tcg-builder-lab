import {rankMovers, summarizePriceHistory} from '../../../src/prices/model.ts';

const cors = {
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'content-type, apikey, authorization',
  'Content-Type': 'application/json; charset=utf-8',
  Vary: 'Origin',
};

const responseCache = new Map<string, {expires: number; value: unknown}>();
const requestCounts = new Map<string, {until: number; count: number}>();

function headersFor(request: Request): Record<string, string> {
  const origin = request.headers.get('origin');
  return {...cors, ...(origin && (/^https:\/\/perryong\.github\.io$/.test(origin) || /^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(origin))
    ? {'Access-Control-Allow-Origin': origin} : {})};
}

function json(request: Request, value: unknown, status = 200): Response {
  return new Response(JSON.stringify(value), {status, headers: {...headersFor(request), 'Cache-Control': status === 200 ? 'public, max-age=3600' : 'no-store'}});
}

export async function handleCardPrices(request: Request, fetchUpstream: typeof fetch = fetch): Promise<Response> {
  if (request.method === 'OPTIONS') return new Response(null, {status: 204, headers: headersFor(request)});
  if (request.method !== 'GET') return json(request, {error: 'Method not allowed.'}, 405);
  const params = new URL(request.url).searchParams;
  const kind = params.get('kind');
  let upstream: URL;
  if (kind === 'search') {
    const game = params.get('game');
    const query = params.get('q')?.trim() ?? '';
    if ((game !== 'pokemon' && game !== 'one-piece') || query.length < 2 || query.length > 100) {
      return json(request, {error: 'Enter a card search of 2–100 characters for Pokémon or One Piece.'}, 400);
    }
    upstream = new URL('https://api.tickermint.cards/products/search');
    upstream.searchParams.set('q', query);
    upstream.searchParams.set('game', game);
  } else if (kind === 'history') {
    const game = params.get('game');
    const id = params.get('productId') ?? '';
    if ((game !== 'pokemon' && game !== 'one-piece') || !/^\d{1,9}$/.test(id)) return json(request, {error: 'Invalid game or product ID.'}, 400);
    upstream = new URL(`https://api.tickermint.cards/products/${id}/prices`);
  } else if (kind === 'movers') {
    const game = params.get('game');
    if (game !== 'pokemon' && game !== 'one-piece') return json(request, {error: 'Invalid game.'}, 400);
    upstream = new URL('https://api.tickermint.cards/desk/movers');
    upstream.searchParams.set('game', game);
    upstream.searchParams.set('days', '7');
    upstream.searchParams.set('min_market', '5');
    upstream.searchParams.set('min_liquidity', '6');
    upstream.searchParams.set('limit', '20');
  } else return json(request, {error: 'Unknown price request.'}, 400);

  // Supabase isolates may be recycled; these limits and caches are best-effort, not global quotas.
  if (fetchUpstream === fetch) {
    const now = Date.now();
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
    const usage = requestCounts.get(ip);
    const next = usage && usage.until > now ? {until: usage.until, count: usage.count + 1} : {until: now + 60000, count: 1};
    requestCounts.set(ip, next);
    if (next.count > 30) return json(request, {error: 'Too many price requests. Try again in a minute.'}, 429);
    if (requestCounts.size > 1000) {
      for (const [key, value] of requestCounts) if (value.until <= now) requestCounts.delete(key);
      if (requestCounts.size > 1000) requestCounts.delete(requestCounts.keys().next().value!);
    }
    const cached = responseCache.get(request.url);
    if (cached?.expires && cached.expires > now) return json(request, cached.value);
  }

  try {
    if (kind === 'history') {
      const identity = await fetchUpstream(new URL(`https://api.tickermint.cards/products/${params.get('productId')}`), {signal: AbortSignal.timeout(10000)});
      if (!identity.ok) return json(request, {error: identity.status === 429 ? 'Price source is busy. Try again shortly.' : 'Price source unavailable.'}, identity.status === 429 ? 429 : 502);
      const product = await identity.json();
      if (product?.game !== params.get('game')) return json(request, {error: 'Product does not belong to this game.'}, 400);
    }
    const result = await fetchUpstream(upstream, {signal: AbortSignal.timeout(10000)});
    if (!result.ok) return json(request, {error: result.status === 429 ? 'Price source is busy. Try again shortly.' : 'Price source unavailable.'}, result.status === 429 ? 429 : 502);
    const data = await result.json();
    if (!data || typeof data !== 'object' ||
        (kind === 'history' ? Array.isArray(data) : !Array.isArray(data))) {
      return json(request, {error: 'Price source returned unexpected data.'}, 502);
    }
    const value = kind === 'search'
      ? (data as Record<string, unknown>[]).filter(row => row && row.game === params.get('game') && Number.isInteger(row.product_id))
        .slice(0, 20).map(row => ({product_id: row.product_id, name: row.name, set_name: row.set_name, card_number: row.card_number, game: row.game}))
      : kind === 'movers' ? rankMovers(data) : {series: summarizePriceHistory(data)};
    if (fetchUpstream === fetch) {
      if (responseCache.size >= 200) responseCache.delete(responseCache.keys().next().value!);
      responseCache.set(request.url, {expires: Date.now() + 3600000, value});
    }
    return json(request, value);
  } catch (error) {
    console.error('Price provider request failed:', error);
    return json(request, {error: 'Price source could not be reached.'}, 502);
  }
}
