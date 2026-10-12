import assert from 'node:assert/strict';
import test from 'node:test';
import {handleCardPrices} from '../supabase/functions/card-prices/handler.ts';

test('rejects an unsupported game before contacting the price provider', async () => {
  const response = await handleCardPrices(new Request('https://example.test/?kind=search&game=yugioh&q=dragon'),
    () => { throw new Error('Provider must not be called'); });
  assert.equal(response.status, 400);
});

test('search returns only bounded product choices and allows the app origin', async () => {
  let called = '';
  const response = await handleCardPrices(new Request('https://example.test/?kind=search&game=pokemon&q=Umbreon%20VMAX', {headers: {origin: 'https://perryong.github.io'}}),
    async input => { called = String(input); return new Response('[{"product_id":246723,"game":"pokemon","name":"Umbreon","set_name":"Evolving Skies","card_number":"215/203","market":"200"}]', {status: 200, headers: {'content-type': 'application/json'}}); });
  assert.equal(called, 'https://api.tickermint.cards/products/search?q=Umbreon+VMAX&game=pokemon');
  assert.equal(response.headers.get('access-control-allow-origin'), 'https://perryong.github.io');
  assert.deepEqual(await response.json(), [{product_id: 246723, game: 'pokemon', name: 'Umbreon', set_name: 'Evolving Skies', card_number: '215/203'}]);
});

test('history refuses nonnumeric IDs and propagates provider rate limits', async () => {
  const invalid = await handleCardPrices(new Request('https://example.test/?kind=history&game=pokemon&productId=https://evil.test'),
    () => { throw new Error('Provider must not be called'); });
  assert.equal(invalid.status, 400);
  const limited = await handleCardPrices(new Request('https://example.test/?kind=history&game=pokemon&productId=246723'),
    async () => new Response('{}', {status: 429}));
  assert.equal(limited.status, 429);
});

test('history refuses a product from another game', async () => {
  const response = await handleCardPrices(new Request('https://example.test/?kind=history&game=one-piece&productId=246723'),
    async () => new Response('{"game":"pokemon"}', {status: 200, headers: {'content-type': 'application/json'}}));
  assert.equal(response.status, 400);
});

test('history checks the product game and returns summaries rather than raw daily rows', async () => {
  const calls: string[] = [];
  const response = await handleCardPrices(new Request('https://example.test/?kind=history&game=pokemon&productId=246723'),
    async input => {
      calls.push(String(input));
      return new Response(calls.length === 1 ? '{"game":"pokemon"}' : '{"Holofoil":[{"snapshot_date":"2026-01-01","market":"1.00","low":"0.50"},{"snapshot_date":"2026-01-02","market":"2.00","low":"0.60"}]}', {status: 200, headers: {'content-type': 'application/json'}});
    });
  assert.deepEqual(calls, ['https://api.tickermint.cards/products/246723', 'https://api.tickermint.cards/products/246723/prices']);
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.series[0].latest.market, 2);
  assert.equal(body.series[0].observations, 2);
  assert.equal(body.series[0].chart.length, 1);
  assert.equal(body.series[0].Holofoil, undefined);
  assert.equal(JSON.stringify(body).includes('"low"'), false);
});
