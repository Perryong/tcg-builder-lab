import {test,expect} from '@playwright/test';

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
