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
test('Pokémon meta sources load complete lists and transfer rejects bad input',async({page})=>{
 await page.goto('./');await page.getByLabel('Choose card game').selectOption('pokemon');await page.getByRole('button',{name:'Meta & insights',exact:true}).click();
 await expect(page.getByRole('heading',{name:'Study the field.'})).toBeVisible();await expect(page.locator('.pokemon-results tbody tr')).not.toHaveCount(0);await expect(page.locator('.pokemon-results tbody')).not.toContainText('JP');
 await page.getByRole('button',{name:'Strategy & trade-offs'}).first().click();await expect(page.getByText('Qualitative strategy analysis · 2026-09-27').first()).toBeVisible();
 page.once('dialog',d=>d.accept());await page.getByRole('button',{name:'Try a Pokémon list'}).first().click();await expect(page.locator('.pokemon-screen .deck-count-line')).toContainText('60 / 60');
 await page.getByRole('button',{name:'Import',exact:true}).click();await page.getByRole('textbox',{name:'Pokémon deck list text'}).fill('4 not-a-card');await page.getByRole('button',{name:'Import as new deck',exact:true}).click();await expect(page.getByRole('dialog').getByRole('alert')).toContainText('Unknown');await page.getByRole('button',{name:'Close Pokémon transfer'}).click();await expect(page.locator('.pokemon-screen .deck-count-line')).toContainText('60 / 60');
});
test('Pokémon mobile navigation and data failures preserve One Piece',async({page})=>{
 await page.setViewportSize({width:390,height:844});await page.goto('./');await page.getByLabel('Choose card game').selectOption('pokemon');await expect(page.getByRole('textbox',{name:'Search Pokémon cards'})).toBeVisible();expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await page.getByRole('button',{name:'Open navigation',exact:true}).click();await page.getByRole('button',{name:'Deck builder',exact:true}).click();await expect(page.getByRole('textbox',{name:'Pokémon deck name'})).toBeVisible();expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await page.getByRole('button',{name:'Open navigation',exact:true}).click();await page.getByRole('button',{name:'Meta & insights',exact:true}).click();await expect(page.getByRole('heading',{name:'Study the field.'})).toBeVisible();expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);expect(await page.locator('.pokemon-screen .meta-summary').evaluate(e=>e.scrollWidth<=e.clientWidth)).toBe(true);
 await page.route('**/data/pokemon/catalog.json',r=>r.fulfill({status:500,body:'Unavailable'}));await page.reload();await page.getByLabel('Choose card game').selectOption('pokemon');await expect(page.getByRole('heading',{name:'Pokémon data unavailable.'})).toBeVisible();await page.getByLabel('Choose card game').selectOption('onepiece');await expect(page.getByRole('textbox',{name:'Search cards or sets'})).toBeVisible();
});
test('corrupt Pokémon saves are preserved and exact text exports retain the draft',async({page})=>{
 await page.addInitScript(()=>localStorage.setItem('tcg-builder.pokemon.decks.v1','broken'));
 await page.goto('./');await page.getByLabel('Choose card game').selectOption('pokemon');await page.getByRole('button',{name:'Deck builder',exact:true}).click();await expect(page.getByRole('alert')).toContainText('Original storage is preserved');await page.getByRole('button',{name:'Save deck',exact:true}).click();expect(await page.evaluate(()=>localStorage.getItem('tcg-builder.pokemon.decks.v1'))).toBe('broken');
 await page.getByRole('textbox',{name:'Search Pokémon deck cards'}).fill('sv06-130');await page.getByRole('button',{name:'Add Dragapult ex sv06-130 to deck',exact:true}).click();await page.getByRole('button',{name:'Export deck',exact:true}).click();await expect(page.getByRole('textbox',{name:'Pokémon deck list text'})).toHaveValue(/1 sv06-130/);
});

test('repaired Pokémon subsets render exact card artwork',async({page})=>{
 await page.goto('./');await page.getByLabel('Choose card game').selectOption('pokemon');
 for(const [id,name] of [['swsh4.5sv-SV001','Rowlet'],['swsh12.5gg-GG01','Hisuian Voltorb'],['sm7.5-1','Charmander'],['xyp-XY46','Xerneas']]){
  await page.getByRole('textbox',{name:'Search Pokémon cards'}).fill(id);await page.getByRole('button',{name:`View ${name} ${id}`,exact:true}).click();
  await expect.poll(()=>page.getByRole('dialog').locator('img').evaluate(i=>(i as HTMLImageElement).naturalWidth)).toBeGreaterThan(0);await page.keyboard.press('Escape');
 }
});
