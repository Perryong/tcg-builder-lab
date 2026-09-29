import {test,expect} from '@playwright/test';
import {execFileSync} from 'node:child_process';
test.setTimeout(60000);

test('generated access ID restores after reload and links a second browser',async({page,browser})=>{
 test.skip(!process.env.ACCOUNT_TEST_SUPABASE_URL,'Requires isolated local Supabase Auth and database');
 await page.goto('./');await page.getByRole('button',{name:'Create access ID'}).click();
 const id=await page.getByLabel('Your access ID').inputValue();expect(id).toMatch(/^[0-9a-f]{48}$/);
 await page.reload();await expect(page.getByLabel('Your access ID')).toHaveValue(id);
 const second=await browser.newContext();const other=await second.newPage();await other.goto('./');
 await other.getByLabel('Enter access ID').fill('0'.repeat(48));await other.getByRole('button',{name:'Open saved decks'}).click();
 await expect(other.getByRole('alert')).toContainText('Access ID could not be opened');
 await other.getByLabel('Enter access ID').fill(id);await other.getByRole('button',{name:'Open saved decks'}).click();
 await expect(other.getByLabel('Your access ID')).toHaveValue(id);
 other.once('dialog',d=>d.accept());await other.getByRole('button',{name:'Sign out'}).click();
 await expect(other.getByRole('button',{name:'Create access ID'})).toBeVisible();await second.close();
});

test('One Piece guest deck moves to an access ID without replacing a draft',async({page,browser})=>{
 test.skip(!process.env.ACCOUNT_TEST_SUPABASE_URL,'Requires isolated local Supabase Auth and database');
 await page.goto('./');await page.getByRole('button',{name:'Deck builder',exact:true}).click();
 await page.getByRole('textbox',{name:'Deck name'}).fill('Cloud crew');
 await page.getByRole('button',{name:'Save deck',exact:true}).click();
 await page.getByRole('textbox',{name:'Deck name'}).fill('Unsaved draft');
 await page.getByRole('button',{name:'Create access ID'}).click();
 await expect(page.getByRole('textbox',{name:'Deck name'})).toHaveValue('Unsaved draft');
 await expect(page.locator('.account-status')).toHaveText('Cloud synced',{timeout:20000});
 const id=await page.getByLabel('Your access ID').inputValue();
 await expect(page.getByLabel('Load saved deck')).toContainText('Cloud crew');
 await page.reload();await page.getByRole('button',{name:'Deck builder',exact:true}).click();
 await expect(page.getByLabel('Load saved deck')).toContainText('Cloud crew');
 const other=await browser.newContext();const second=await other.newPage();await second.goto('./');
 await second.getByLabel('Enter access ID').fill(id);await second.getByRole('button',{name:'Open saved decks'}).click();
 await second.getByRole('button',{name:'Deck builder',exact:true}).click();
 await expect(second.getByLabel('Load saved deck')).toContainText('Cloud crew');await other.close();
});

test('corrupt One Piece guest storage remains untouched during account link',async({page})=>{
 test.skip(!process.env.ACCOUNT_TEST_SUPABASE_URL,'Requires isolated local Supabase Auth and database');
 await page.goto('./');await page.evaluate(()=>localStorage.setItem('grand-line.decks.v1','{broken'));
 await page.reload();await page.getByRole('button',{name:'Create access ID'}).click();
 await expect(page.getByRole('alert')).toContainText('Saved decks could not be read',{timeout:20000});
 expect(await page.evaluate(()=>localStorage.getItem('grand-line.decks.v1'))).toBe('{broken');
});

test('Pokémon and One Piece decks share an ID but remain separate',async({page,browser})=>{
 test.skip(!process.env.ACCOUNT_TEST_SUPABASE_URL,'Requires isolated local Supabase Auth and database');
 await page.goto('./');await page.getByRole('button',{name:'Create access ID'}).click();
 await expect(page.locator('.account-status')).toHaveText('Cloud synced',{timeout:20000});
 const id=await page.getByLabel('Your access ID').inputValue();
 await page.getByRole('button',{name:'Deck builder',exact:true}).click();
 await page.getByRole('textbox',{name:'Deck name'}).fill('One Piece account deck');await page.getByRole('button',{name:'Save deck',exact:true}).click();
 await expect(page.locator('.account-status')).toHaveText('Cloud synced',{timeout:20000});
 await page.getByLabel('Choose card game').selectOption('pokemon');await page.getByRole('button',{name:'Deck builder',exact:true}).click();
 await page.getByRole('textbox',{name:'Pokémon deck name'}).fill('Pokémon account deck');await page.getByRole('button',{name:'Save deck',exact:true}).click();
 await expect(page.locator('.account-status')).toHaveText('Cloud synced',{timeout:20000});
 await page.getByRole('textbox',{name:'Pokémon deck name'}).fill('Unsaved Pokémon draft');
 await page.getByLabel('Choose card game').selectOption('onepiece');await page.getByLabel('Choose card game').selectOption('pokemon');
 await expect(page.getByRole('textbox',{name:'Pokémon deck name'})).toHaveValue('Unsaved Pokémon draft');
 const other=await browser.newContext();const second=await other.newPage();await second.goto('./');
 await second.getByLabel('Enter access ID').fill(id);await second.getByRole('button',{name:'Open saved decks'}).click();
 await expect(second.locator('.account-status')).toHaveText('Cloud synced',{timeout:20000});
 await second.getByRole('button',{name:'Deck builder',exact:true}).click();await expect(second.getByLabel('Load saved deck')).toContainText('One Piece account deck');
 await second.getByLabel('Choose card game').selectOption('pokemon');await second.getByRole('button',{name:'Deck builder',exact:true}).click();
 await expect(second.getByLabel('Saved Pokémon decks')).toContainText('Pokémon account deck');await other.close();
 const corrupt=await browser.newContext();await corrupt.addInitScript(()=>localStorage.setItem('tcg-builder.pokemon.decks.v1','{broken'));
 const blocked=await corrupt.newPage();await blocked.goto('./');await blocked.getByLabel('Enter access ID').fill(id);
 await blocked.getByRole('button',{name:'Open saved decks'}).click();
 await expect(blocked.getByRole('alert')).toContainText('Saved Pokémon decks could not be read',{timeout:20000});
 expect(await blocked.evaluate(()=>localStorage.getItem('tcg-builder.pokemon.decks.v1'))).toBe('{broken');
 await corrupt.close();
});

test('Yu-Gi-Oh! OCG sections reopen under the same access ID',async({page,browser})=>{
 test.skip(!process.env.ACCOUNT_TEST_SUPABASE_URL,'Requires isolated local Supabase Auth and database');
 await page.goto('./');await page.getByRole('button',{name:'Create access ID'}).click();
 await expect(page.locator('.account-status')).toHaveText('Cloud synced',{timeout:20000});
 const id=await page.getByLabel('Your access ID').inputValue();
 await page.getByLabel('Choose card game').selectOption('yugioh');await page.getByRole('button',{name:'Yu-Gi-Oh! deck builder'}).click();
 await page.getByLabel('Deck import and export').fill('[main]\n3 4007\n[extra]\n1 18823\n[side]\n1 4041');
 await page.getByRole('button',{name:'Import deck',exact:true}).click();
 await page.getByLabel('Yu-Gi-Oh! deck name').fill('OCG account deck');await page.getByLabel('Deck format').selectOption('ocg');
 await page.getByRole('button',{name:'Save deck',exact:true}).click();await expect(page.locator('.account-status')).toHaveText('Cloud synced',{timeout:20000});
 const other=await browser.newContext();const second=await other.newPage();await second.goto('./');
 await second.getByLabel('Enter access ID').fill(id);await second.getByRole('button',{name:'Open saved decks'}).click();
 await expect(second.locator('.account-status')).toHaveText('Cloud synced',{timeout:20000});
 await second.getByLabel('Choose card game').selectOption('yugioh');await second.getByRole('button',{name:'Yu-Gi-Oh! deck builder'}).click();
 await expect(second.getByLabel('Saved decks')).toContainText('OCG account deck');
 await second.getByLabel('Saved decks').selectOption({label:'OCG account deck'});
 await expect(second.getByLabel('Deck format')).toHaveValue('ocg');
 await expect(second.getByRole('heading',{name:'MAIN · 3'})).toBeVisible();
 await expect(second.getByRole('heading',{name:'EXTRA · 1'})).toBeVisible();
 await expect(second.getByRole('heading',{name:'SIDE · 1'})).toBeVisible();await other.close();
});

test('concurrent Yu-Gi-Oh! edits keep a conflict copy',async({page,browser})=>{
 test.skip(!process.env.ACCOUNT_TEST_SUPABASE_URL,'Requires isolated local Supabase Auth and database');
 await page.goto('./',{waitUntil:'domcontentloaded'});await page.getByRole('button',{name:'Create access ID'}).click();
 await expect(page.locator('.account-status')).toHaveText('Cloud synced',{timeout:20000});const id=await page.getByLabel('Your access ID').inputValue();
 await page.getByLabel('Choose card game').selectOption('yugioh');await page.getByRole('button',{name:'Yu-Gi-Oh! deck builder'}).click();
 await page.getByLabel('Yu-Gi-Oh! deck name').fill('Original duel');await page.getByRole('button',{name:'Save deck',exact:true}).click();
 await expect(page.locator('.account-status')).toHaveText('Cloud synced',{timeout:20000});
 const other=await browser.newContext();const second=await other.newPage();await second.goto('./',{waitUntil:'domcontentloaded'});
 await second.getByLabel('Enter access ID').fill(id);await second.getByRole('button',{name:'Open saved decks'}).click();
 await expect(second.locator('.account-status')).toHaveText('Cloud synced',{timeout:20000});
 await second.getByLabel('Choose card game').selectOption('yugioh');await second.getByRole('button',{name:'Yu-Gi-Oh! deck builder'}).click();
 await second.getByLabel('Saved decks').selectOption({label:'Original duel'});
 await page.getByLabel('Yu-Gi-Oh! deck name').fill('First edit');await page.getByRole('button',{name:'Save deck',exact:true}).click();
 await expect(page.locator('.account-status')).toHaveText('Cloud synced',{timeout:20000});
 await second.getByLabel('Yu-Gi-Oh! deck name').fill('Second edit');await second.getByRole('button',{name:'Save deck',exact:true}).click();
 await expect(second.locator('.account-status')).toHaveText('Cloud synced',{timeout:20000});
 await expect(second.getByLabel('Saved decks')).toContainText('First edit');
 await expect(second.getByLabel('Saved decks')).toContainText('Second edit (from this device)');await other.close();
});

test('invalid cloud deck stays in the database and is not shown',async({page})=>{
 test.skip(!process.env.ACCOUNT_TEST_DB_CONTAINER,'Requires isolated local Supabase database container');
 await page.goto('./',{waitUntil:'domcontentloaded'});await page.getByRole('button',{name:'Create access ID'}).click();
 await expect(page.locator('.account-status')).toHaveText('Cloud synced',{timeout:20000});
 const account=await page.evaluate(()=>localStorage.getItem('tcg-builder.active-account.v1'));
 expect(account).toMatch(/^[0-9a-f-]{36}$/);
 const sql=`insert into public.saved_decks(account_id,game,deck_id,payload) values ('${account}','yugioh','malformed','{"id":"malformed","name":7}'::jsonb)`;
 execFileSync('docker',['exec',process.env.ACCOUNT_TEST_DB_CONTAINER!,'psql','-U','postgres','-d','postgres','-tAc',sql]);
 await page.reload({waitUntil:'domcontentloaded'});
 await expect(page.getByRole('alert')).toContainText('Cloud deck data is invalid',{timeout:20000});
 await page.getByLabel('Choose card game').selectOption('yugioh');await page.getByRole('button',{name:'Yu-Gi-Oh! deck builder'}).click();
 await expect(page.getByLabel('Saved decks').locator('option')).toHaveCount(1);
 const check=execFileSync('docker',['exec',process.env.ACCOUNT_TEST_DB_CONTAINER!,'psql','-U','postgres','-d','postgres','-tAc',`select revision from public.saved_decks where account_id='${account}' and deck_id='malformed'`],{encoding:'utf8'});
 expect(check.trim()).toBe('1');
});

test('offline save survives reload and retries to another browser',async({page,browser})=>{
 test.skip(!process.env.ACCOUNT_TEST_SUPABASE_URL,'Requires isolated local Supabase Auth and database');
 await page.goto('./',{waitUntil:'domcontentloaded'});await page.getByRole('button',{name:'Create access ID'}).click();
 await expect(page.locator('.account-status')).toHaveText('Cloud synced',{timeout:20000});const id=await page.getByLabel('Your access ID').inputValue();
 await page.getByRole('button',{name:'Deck builder',exact:true}).click();
 await page.route('**/rest/v1/**',route=>route.abort());
 await page.getByRole('textbox',{name:'Deck name'}).fill('Offline crew');await page.getByRole('button',{name:'Save deck',exact:true}).click();
 await expect(page.locator('.account-status')).toHaveText('Pending sync',{timeout:20000});
 await page.reload({waitUntil:'domcontentloaded'});await page.getByRole('button',{name:'Deck builder',exact:true}).click();
 await expect(page.getByLabel('Load saved deck')).toContainText('Offline crew');
 await expect(page.locator('.account-status')).toHaveText('Pending sync',{timeout:20000});
 await page.unroute('**/rest/v1/**');await page.getByRole('button',{name:'Retry sync'}).click();
 await expect(page.locator('.account-status')).toHaveText('Cloud synced',{timeout:20000});
 const other=await browser.newContext();const second=await other.newPage();await second.goto('./',{waitUntil:'domcontentloaded'});
 await second.getByLabel('Enter access ID').fill(id);await second.getByRole('button',{name:'Open saved decks'}).click();
 await expect(second.locator('.account-status')).toHaveText('Cloud synced',{timeout:20000});
 await second.getByRole('button',{name:'Deck builder',exact:true}).click();await expect(second.getByLabel('Load saved deck')).toContainText('Offline crew');await other.close();
});

test('signing out retains pending account work for the same ID',async({page})=>{
 test.skip(!process.env.ACCOUNT_TEST_SUPABASE_URL,'Requires isolated local Supabase Auth and database');
 await page.goto('./',{waitUntil:'domcontentloaded'});await page.getByRole('button',{name:'Create access ID'}).click();
 await expect(page.locator('.account-status')).toHaveText('Cloud synced',{timeout:20000});const id=await page.getByLabel('Your access ID').inputValue();
 await page.getByRole('button',{name:'Deck builder',exact:true}).click();
 await page.route('**/rest/v1/rpc/save_deck',route=>route.abort());
 await page.getByRole('textbox',{name:'Deck name'}).fill('Pending after signout');await page.getByRole('button',{name:'Save deck',exact:true}).click();
 await expect(page.locator('.account-status')).toHaveText('Pending sync',{timeout:20000});
 page.once('dialog',d=>d.accept());await page.getByRole('button',{name:'Sign out'}).click();
 await expect(page.getByRole('button',{name:'Create access ID'})).toBeVisible();
 await page.unroute('**/rest/v1/rpc/save_deck');await page.getByLabel('Enter access ID').fill(id);await page.getByRole('button',{name:'Open saved decks'}).click();
 await expect(page.locator('.account-status')).toHaveText('Cloud synced',{timeout:20000});
 await expect(page.getByLabel('Load saved deck')).toContainText('Pending after signout');
});

test('account controls fit a narrow mobile viewport',async({page})=>{
 test.skip(!process.env.ACCOUNT_TEST_SUPABASE_URL,'Requires isolated local Supabase Auth and database');
 await page.setViewportSize({width:390,height:844});await page.goto('./',{waitUntil:'domcontentloaded'});
 await page.getByRole('button',{name:'Create access ID'}).click();
 await expect(page.locator('.account-status')).toHaveText('Cloud synced',{timeout:20000});
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});
