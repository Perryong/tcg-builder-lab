import {test, expect} from '@playwright/test';
import {rankMovers, summarizePriceHistory} from '../../src/prices/model.ts';

const priceRows = Array.from({length: 600}, (_, i) => ({
  snapshot_date: new Date(Date.now() - (600 - i) * 86400000).toISOString().slice(0, 10),
  market: (10 + i * 0.01).toFixed(2), low: '9.00',
}));

test('Pokémon and One Piece price labs show exact products, history, forecasts, and source attribution', async ({page}) => {
  await page.route('**/functions/v1/card-prices?*', async route => {
    const url = new URL(route.request().url());
    if (url.searchParams.get('kind') === 'search') {
      const pokemon = url.searchParams.get('game') === 'pokemon';
      await route.fulfill({json: [{product_id: pokemon ? 123 : 456, name: pokemon ? 'Umbreon VMAX (Alternate Art Secret)' : 'Roronoa Zoro (Parallel)',
        set_name: pokemon ? 'Evolving Skies' : 'Romance Dawn', card_number: pokemon ? '215/203' : 'OP01-001',
        market: '14.19', game: pokemon ? 'pokemon' : 'one-piece', image_url: null}]});
    } else if (url.searchParams.get('kind') === 'movers') await route.fulfill({json: {gainers: [], fallers: []}});
    else await route.fulfill({json: {series: summarizePriceHistory({Holofoil: priceRows})}});
  });
  await page.goto('./');
  await page.getByLabel('Choose card game').selectOption('pokemon');
  await page.getByRole('button', {name: 'Price lab'}).click();
  await page.getByRole('textbox', {name: 'Search Pokémon prices'}).fill('Umbreon VMAX');
  await page.getByRole('button', {name: 'Find prices'}).click();
  await page.getByRole('button', {name: /Umbreon VMAX.*Evolving Skies/}).click();
  await expect(page.getByRole('heading', {name: '30-day outlook'})).toBeVisible();
  await expect(page.getByRole('heading', {name: '90-day outlook'})).toBeVisible();
  await expect(page.getByText('Historical market price', {exact: true})).toBeVisible();
  await expect(page.getByRole('link', {name: /Prices: TickerMint/})).toHaveAttribute('href', 'https://tickermint.cards/card/123');

  await page.getByLabel('Choose card game').selectOption('onepiece');
  await page.getByRole('button', {name: 'Price lab'}).click();
  await page.getByRole('textbox', {name: 'Search One Piece prices'}).fill('OP01-001');
  await page.getByRole('button', {name: 'Find prices'}).click();
  await page.getByRole('button', {name: /Roronoa Zoro.*Romance Dawn/}).click();
  await expect(page.getByRole('heading', {name: '30-day outlook'})).toBeVisible();
  await page.getByLabel('Choose card game').selectOption('yugioh');
  await expect(page.getByRole('button', {name: 'Price lab'})).toHaveCount(0);
});

test('each game shows its own top ten weekly gainers and fallers and opens a mover history', async ({page}) => {
  await page.setViewportSize({width: 1440, height: 720});
  const requestedGames: string[] = [];
  await page.route('**/functions/v1/card-prices?*', async route => {
    const url = new URL(route.request().url());
    if (url.searchParams.get('kind') === 'movers') {
      const game = url.searchParams.get('game')!;
      requestedGames.push(game);
      const prefix = game === 'pokemon' ? 'Pikachu' : 'Nami';
      const rows = Array.from({length: 10}, (_, i) => ({product_id: i + 1, name: `${prefix} Gain ${i + 1}`, set_name: 'Test Set', sub_type_name: 'Foil', base_market: '10', market: String(21 - i)}));
      rows.push(...Array.from({length: 10}, (_, i) => ({product_id: i + 101, name: `${prefix} Fall ${i + 1}`, set_name: 'Test Set', sub_type_name: 'Foil', base_market: '20', market: String(9 + i)})));
      await route.fulfill({json: rankMovers(rows)});
    } else await route.fulfill({json: {series: summarizePriceHistory({Holofoil: priceRows})}});
  });
  await page.goto('./');
  await page.getByRole('button', {name: 'Price lab'}).click();
  await expect(page.getByRole('heading', {name: 'One Piece price movers'})).toBeVisible();
  await expect(page.locator('.mover-group.positive .mover-row')).toHaveCount(10);
  await expect(page.locator('.mover-group.negative .mover-row')).toHaveCount(10);
  await expect(page.getByText('Nami Gain 1', {exact: true})).toBeVisible();
  await expect(page.getByText('Pikachu Gain 1', {exact: true})).toHaveCount(0);
  await page.getByRole('button', {name: 'View Nami Gain 1 price history'}).click();
  await expect(page.getByRole('heading', {name: 'Nami Gain 1'})).toBeVisible();
  await expect(page.locator('.price-analysis')).toBeInViewport();

  await page.getByLabel('Choose card game').selectOption('pokemon');
  await page.getByRole('button', {name: 'Price lab'}).click();
  await expect(page.getByRole('heading', {name: 'Pokémon price movers'})).toBeVisible();
  const visibleGame = page.locator('.game-screen:not([hidden])');
  await expect(visibleGame.getByText('Pikachu Gain 1', {exact: true})).toBeVisible();
  await expect(visibleGame.getByText('Nami Gain 1', {exact: true})).toHaveCount(0);
  await page.setViewportSize({width: 390, height: 844});
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  expect(requestedGames).toContain('pokemon');
  expect(requestedGames).toContain('one-piece');
});

test('a mover opens the matching foil finish rather than the first available series', async ({page}) => {
  const day = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
  await page.route('**/functions/v1/card-prices?*', async route => {
    const kind = new URL(route.request().url()).searchParams.get('kind');
    if (kind === 'movers') await route.fulfill({json: {gainers: [], fallers: [{product_id: 87066, name: 'Magnemite', set_name: 'Test Set',
      finish: 'Reverse Holofoil', before: 20, after: 10, changePercent: -50, image_url: null}]}});
    else await route.fulfill({json: {series: summarizePriceHistory({Normal: [{snapshot_date: day, market: '1'}],
      'Reverse Holofoil': [{snapshot_date: day, market: '10'}]})}});
  });
  await page.goto('./');
  await page.getByLabel('Choose card game').selectOption('pokemon');
  await page.getByRole('button', {name: 'Price lab'}).click();
  await page.getByRole('button', {name: 'View Magnemite price history'}).click();
  await expect(page.getByLabel('Price finish')).toHaveValue('Reverse Holofoil');
  await expect(page.locator('.price-current strong')).toHaveText('$10.00');
  await expect(page.locator('.price-product-heading p:last-child')).toHaveText('Test Set');
});

test('mover choices cannot replace an in-flight card history with the wrong product', async ({page}) => {
  let releaseFirst: (() => void) | undefined;
  const firstRequest = new Promise<void>(resolve => {releaseFirst = resolve;});
  await page.route('**/functions/v1/card-prices?*', async route => {
    const params = new URL(route.request().url()).searchParams;
    if (params.get('kind') === 'movers') await route.fulfill({json: {gainers: [
      {product_id: 1, name: 'Card A', set_name: 'Set', finish: 'Foil', before: 10, after: 12, changePercent: 20, image_url: null},
      {product_id: 2, name: 'Card B', set_name: 'Set', finish: 'Foil', before: 10, after: 11, changePercent: 10, image_url: null}], fallers: []}});
    else {
      if (params.get('productId') === '1') await firstRequest;
      const market = params.get('productId') === '1' ? 12 : 11;
      await route.fulfill({json: {series: [{finish: 'Foil', latest: {date: '2026-10-12', market}, chart: [{date: '2026-10-12', market}], observations: 1, forecasts: {30: null, 90: null}}]}});
    }
  });
  await page.goto('./');
  await page.getByRole('button', {name: 'Price lab'}).click();
  await page.getByRole('button', {name: 'View Card A price history'}).click();
  await expect(page.getByRole('button', {name: 'View Card B price history'})).toBeDisabled();
  releaseFirst!();
  await expect(page.locator('.price-current strong')).toHaveText('$12.00');
  await page.getByRole('button', {name: 'View Card B price history'}).click();
  await expect(page.locator('.price-current strong')).toHaveText('$11.00');
  await expect(page.locator('.price-product-heading h2')).toHaveText('Card B');
});
