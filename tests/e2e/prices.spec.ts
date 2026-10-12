import {test, expect} from '@playwright/test';
import {summarizePriceHistory} from '../../src/prices/model.ts';

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
    } else await route.fulfill({json: {series: summarizePriceHistory({Holofoil: priceRows})}});
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
