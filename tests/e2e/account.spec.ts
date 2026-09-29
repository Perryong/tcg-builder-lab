import {test,expect} from '@playwright/test';
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
