import {test,expect} from '@playwright/test';
test('Pokémon library, exact artwork, category details and game isolation',async({page})=>{
 await page.goto('./');await page.getByLabel('Choose card game').selectOption('pokemon');
 await page.getByRole('textbox',{name:'Search Pokémon cards'}).fill('sv06-130');
 await expect(page.locator('.pokemon-screen .card-tile')).toHaveCount(1);
 await page.getByRole('button',{name:'View Dragapult ex sv06-130',exact:true}).click();
 await expect(page.getByRole('dialog')).toContainText('320');await expect(page.getByRole('dialog')).toContainText('Phantom Dive');
 await expect.poll(()=>page.getByRole('dialog').locator('img').evaluate(i=>(i as HTMLImageElement).naturalWidth)).toBeGreaterThan(0);
 await page.keyboard.press('Escape');await page.getByLabel('Choose card game').selectOption('onepiece');
 await expect(page.getByRole('textbox',{name:'Search cards or sets'})).toBeVisible();
});
test('Pokémon deck survives game switching and saves separately',async({page})=>{
 await page.goto('./');await page.getByLabel('Choose card game').selectOption('pokemon');await page.getByRole('button',{name:'Deck builder',exact:true}).click();
 await page.getByRole('textbox',{name:'Pokémon deck name'}).fill('Pokémon draft');await page.getByRole('textbox',{name:'Search Pokémon deck cards'}).fill('sv06-130');await page.getByRole('button',{name:'Add Dragapult ex sv06-130 to deck',exact:true}).click();
 await page.getByLabel('Choose card game').selectOption('onepiece');await page.getByRole('button',{name:'Deck builder',exact:true}).click();await page.getByRole('textbox',{name:'Deck name'}).fill('One Piece draft');
 await page.getByLabel('Choose card game').selectOption('pokemon');await expect(page.getByRole('textbox',{name:'Pokémon deck name'})).toHaveValue('Pokémon draft');await expect(page.locator('.pokemon-screen .deck-row')).toHaveCount(1);
 await page.getByRole('button',{name:'Save deck',exact:true}).click();await page.reload();await page.getByLabel('Choose card game').selectOption('pokemon');await page.getByRole('button',{name:'Deck builder',exact:true}).click();await expect(page.getByRole('textbox',{name:'Pokémon deck name'})).toHaveValue('Pokémon draft');
});
