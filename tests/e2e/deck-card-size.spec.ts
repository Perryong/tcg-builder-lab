import {test,expect} from '@playwright/test';

for(const game of ['onepiece','pokemon'])for(const width of [1440,1000,800,390])test(`${game} cards stay catalog-sized after adding one to a deck at ${width}px`,async({page})=>{
 await page.setViewportSize({width,height:900});
 await page.goto('./',{waitUntil:'domcontentloaded'});
 if(game==='pokemon')await page.getByLabel('Choose card game').selectOption('pokemon');
 const screen=page.locator('.game-screen:not([hidden])');
 const catalogCard=screen.locator('.library .card-grid .card-tile').first();
 const before=await catalogCard.getByRole('button',{name:/View /}).evaluate(el=>el.getBoundingClientRect().width);
 await catalogCard.locator('.add-card').click();
 const deckCard=screen.locator('.deck-pool .card-tile').first();
 const after=await deckCard.getByRole('button',{name:/View |Inspect /}).evaluate(el=>el.getBoundingClientRect().width);
 expect(after).toBeLessThanOrEqual(before+1);
});
