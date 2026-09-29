import {test,expect} from '@playwright/test';
import type {Page} from '@playwright/test';
import {execFileSync} from 'node:child_process';
import {readFileSync} from 'node:fs';
import {createClient} from '@supabase/supabase-js';
test.setTimeout(90000);

const uniqueName=()=>`crew_${crypto.randomUUID().replaceAll('-','').slice(0,16)}`;
async function openUsername(page:Page,name:string){await page.getByLabel('Username',{exact:true}).fill(name);await page.getByRole('button',{name:'Continue with username'}).click();await expect(page.getByLabel('Current username')).toHaveValue(name);}
async function createUsername(page:Page){const name=uniqueName();await openUsername(page,name);return name;}

async function legacyAccount(){
 const values=Object.fromEntries(readFileSync('.env.local','utf8').split('\n').filter(Boolean).map(line=>{const cut=line.indexOf('=');return [line.slice(0,cut),line.slice(cut+1)];}));
 const client=createClient(values.VITE_SUPABASE_URL,values.VITE_SUPABASE_PUBLISHABLE_KEY,{auth:{persistSession:false}});
 const signed=await client.auth.signInAnonymously();expect(signed.error).toBeNull();
 const result=await client.rpc('create_access_id');expect(result.error).toBeNull();
 return result.data![0] as {account_id:string;access_id:string};
}

test('username entry creates once and reopens from another browser',async({page,browser})=>{
 test.skip(!process.env.ACCOUNT_TEST_SUPABASE_URL,'Requires isolated local Supabase');
 const name='crew_'+crypto.randomUUID().replaceAll('-','').slice(0,16);
 await page.goto('./',{waitUntil:'domcontentloaded'});
 await expect(page.getByText('Anyone who knows or guesses a username')).toBeVisible();
 await page.getByLabel('Username', {exact:true}).fill(' '+name.toUpperCase()+' ');
 await page.getByRole('button',{name:'Continue with username'}).click();
 await expect(page.getByText('New username created')).toBeVisible();
 await expect(page.getByLabel('Current username')).toHaveValue(name);
 await page.reload({waitUntil:'domcontentloaded'});
 await expect(page.getByLabel('Current username')).toHaveValue(name);
 const other=await browser.newContext();const second=await other.newPage();
 await second.goto('./',{waitUntil:'domcontentloaded'});
 await second.getByLabel('Username',{exact:true}).fill(name.toUpperCase());
 await second.getByRole('button',{name:'Continue with username'}).click();
 await expect(second.getByLabel('Current username')).toHaveValue(name);
 await expect(second.getByText('New username created')).toHaveCount(0);
 await other.close();
});

test('simultaneous first opens share one account',async({browser})=>{
 test.skip(!process.env.ACCOUNT_TEST_SUPABASE_URL,'Requires isolated local Supabase');
 const name=uniqueName();const first=await browser.newContext();const second=await browser.newContext();
 const a=await first.newPage(),b=await second.newPage();
 await Promise.all([a.goto('./',{waitUntil:'domcontentloaded'}),b.goto('./',{waitUntil:'domcontentloaded'})]);
 await Promise.all([a.getByLabel('Username',{exact:true}).fill(name),b.getByLabel('Username',{exact:true}).fill(name)]);
 await Promise.all([a.getByRole('button',{name:'Continue with username'}).click(),b.getByRole('button',{name:'Continue with username'}).click()]);
 await Promise.all([expect(a.getByLabel('Current username')).toHaveValue(name),expect(b.getByLabel('Current username')).toHaveValue(name)]);
 const [one,two]=await Promise.all([a.evaluate(()=>localStorage.getItem('tcg-builder.active-account.v1')),b.evaluate(()=>localStorage.getItem('tcg-builder.active-account.v1'))]);
 expect(one).toBeTruthy();expect(two).toBe(one);
 expect((await a.getByText('New username created').count())+(await b.getByText('New username created').count())).toBe(1);
 await Promise.all([first.close(),second.close()]);
});

test('username entry retries a brief Auth clock-skew response',async({page})=>{
 test.skip(!process.env.ACCOUNT_TEST_SUPABASE_URL,'Requires isolated local Supabase');
 let calls=0;await page.route('**/rest/v1/rpc/open_username',route=>{calls++;if(calls===1)void route.fulfill({status:401,contentType:'application/json',body:JSON.stringify({code:'PGRST301',message:'JWT issued at future'})});else void route.continue();});
 await page.goto('./',{waitUntil:'domcontentloaded'});await openUsername(page,uniqueName());expect(calls).toBe(2);
});

test('invalid username keeps guest decks and switching names clears account decks',async({page})=>{
 test.skip(!process.env.ACCOUNT_TEST_SUPABASE_URL,'Requires isolated local Supabase');
 const first='crew_'+crypto.randomUUID().replaceAll('-','').slice(0,16);
 const second='crew_'+crypto.randomUUID().replaceAll('-','').slice(0,16);
 await page.goto('./',{waitUntil:'domcontentloaded'});
 await page.getByRole('button',{name:'Deck builder',exact:true}).click();await page.getByRole('textbox',{name:'Deck name'}).fill('Unsynced guest');await page.getByRole('button',{name:'Save deck',exact:true}).click();
 const guestBytes=await page.evaluate(()=>localStorage.getItem('grand-line.decks.v1'));
 await page.getByLabel('Username',{exact:true}).fill('no spaces');
 await page.getByRole('button',{name:'Continue with username'}).click();
 await expect(page.getByRole('alert')).toContainText('Use 3–24');
 expect(await page.evaluate(()=>localStorage.getItem('grand-line.decks.v1'))).toBe(guestBytes);
 await expect(page.getByLabel('Username',{exact:true})).toBeVisible();
 await page.getByLabel('Username',{exact:true}).fill(first);
 await page.getByRole('button',{name:'Continue with username'}).click();
 await expect(page.getByLabel('Current username')).toHaveValue(first);
 await page.getByRole('button',{name:'Deck builder',exact:true}).click();
 await page.getByRole('textbox',{name:'Deck name'}).fill('First account only');
 await page.getByRole('button',{name:'Save deck',exact:true}).click();
 await expect(page.locator('.account-status')).toHaveText('Cloud synced',{timeout:40000});
 page.once('dialog',d=>d.accept());await page.getByRole('button',{name:'Sign out'}).click();
 await page.getByLabel('Username',{exact:true}).fill(second);
 await page.getByRole('button',{name:'Continue with username'}).click();
 await expect(page.getByLabel('Current username')).toHaveValue(second);
 await page.getByRole('button',{name:'Deck builder',exact:true}).click();
 await expect(page.getByLabel('Load saved deck')).toHaveCount(0);
});

test('a stored account marker without membership cannot display its cached decks',async({page})=>{
 test.skip(!process.env.ACCOUNT_TEST_SUPABASE_URL,'Requires isolated local Supabase');
 await page.goto('./',{waitUntil:'domcontentloaded'});const first=await createUsername(page);
 await page.getByRole('button',{name:'Deck builder',exact:true}).click();await page.getByRole('textbox',{name:'Deck name'}).fill('Cached old crew');await page.getByRole('button',{name:'Save deck',exact:true}).click();
 await expect(page.locator('.account-status')).toHaveText('Cloud synced',{timeout:40000});
 const old=await page.evaluate(()=>localStorage.getItem('tcg-builder.active-account.v1'));
 page.once('dialog',d=>d.accept());await page.getByRole('button',{name:'Sign out'}).click();
 await createUsername(page);
 await page.evaluate(({old,first})=>{localStorage.setItem('tcg-builder.active-account.v1',old!);localStorage.setItem(`tcg-builder.username.${old}.v1`,first);},{old,first});
 let release!:()=>void;const gate=new Promise<void>(resolve=>{release=resolve;});let seen!:()=>void;const intercepted=new Promise<void>(resolve=>{seen=resolve;});
 await page.route('**/rest/v1/rpc/account_username',async route=>{seen();await gate;await route.continue();});
 await page.reload({waitUntil:'domcontentloaded'});
 await intercepted;
 await expect(page.getByLabel('Username',{exact:true})).toBeVisible();
 release();
 await expect(page.getByLabel('Username',{exact:true})).toBeVisible();
 await expect(page.getByText('Cached old crew')).toHaveCount(0);
});

test('guest import requires confirmation and remains available after decline',async({page,browser})=>{
 test.skip(!process.env.ACCOUNT_TEST_SUPABASE_URL,'Requires isolated local Supabase');
 const name='crew_'+crypto.randomUUID().replaceAll('-','').slice(0,16);
 await page.goto('./',{waitUntil:'domcontentloaded'});
 await page.getByRole('button',{name:'Deck builder',exact:true}).click();
 await page.getByRole('textbox',{name:'Deck name'}).fill('Private guest crew');
 await page.getByRole('button',{name:'Save deck',exact:true}).click();
 await page.getByLabel('Choose card game').selectOption('pokemon');await page.getByRole('button',{name:'Deck builder',exact:true}).click();
 await page.getByRole('textbox',{name:'Pokémon deck name'}).fill('Private guest Pokémon');await page.getByRole('button',{name:'Save deck',exact:true}).click();
 const guestBytes=await page.evaluate(()=>[localStorage.getItem('grand-line.decks.v1'),localStorage.getItem('tcg-builder.pokemon.decks.v1')]);
 await page.getByLabel('Username',{exact:true}).fill(name);
 await page.getByRole('button',{name:'Continue with username'}).click();
 await expect(page.getByRole('button',{name:"Import this device's decks"})).toBeVisible();
 const other=await browser.newContext();const second=await other.newPage();
 await second.goto('./',{waitUntil:'domcontentloaded'});
 await second.getByLabel('Username',{exact:true}).fill(name);await second.getByRole('button',{name:'Continue with username'}).click();
 await second.getByRole('button',{name:'Deck builder',exact:true}).click();
 await expect(second.getByLabel('Load saved deck')).toHaveCount(0);
 page.once('dialog',d=>{expect(d.message()).toContain(name);void d.dismiss();});
 await page.getByRole('button',{name:"Import this device's decks"}).click();
 await expect(page.getByRole('button',{name:"Import this device's decks"})).toBeVisible();
 expect(await page.evaluate(()=>[localStorage.getItem('grand-line.decks.v1'),localStorage.getItem('tcg-builder.pokemon.decks.v1')])).toEqual(guestBytes);
 page.once('dialog',d=>{expect(d.message()).toContain(name);void d.accept();});
 await page.getByRole('button',{name:"Import this device's decks"}).click();
 await expect(page.locator('.account-status')).toHaveText('Cloud synced',{timeout:40000});
 await second.reload({waitUntil:'domcontentloaded'});await second.getByRole('button',{name:'Deck builder',exact:true}).click();
 await expect(second.getByLabel('Load saved deck')).toContainText('Private guest crew');
 await second.getByLabel('Choose card game').selectOption('pokemon');await second.getByRole('button',{name:'Deck builder',exact:true}).click();
 await expect(second.getByLabel('Saved Pokémon decks')).toContainText('Private guest Pokémon');
 await other.close();
});

test('new guest decks can be imported after an earlier confirmed import',async({page,browser})=>{
 test.skip(!process.env.ACCOUNT_TEST_SUPABASE_URL,'Requires isolated local Supabase');
 const name=uniqueName();await page.goto('./',{waitUntil:'domcontentloaded'});
 await page.getByRole('button',{name:'Deck builder',exact:true}).click();await page.getByRole('textbox',{name:'Deck name'}).fill('First guest');await page.getByRole('button',{name:'Save deck',exact:true}).click();
 await openUsername(page,name);page.once('dialog',d=>d.accept());await page.getByRole('button',{name:"Import this device's decks"}).click();
 await expect(page.locator('.account-status')).toHaveText('Cloud synced',{timeout:40000});
 page.once('dialog',d=>d.accept());await page.getByRole('button',{name:'Sign out'}).click();
 await page.getByRole('button',{name:'Deck builder',exact:true}).click();await page.getByRole('button',{name:'New deck',exact:true}).click();
 await page.getByRole('textbox',{name:'Deck name'}).fill('Later guest');await page.getByRole('button',{name:'Save deck',exact:true}).click();
 await openUsername(page,name);
 await expect(page.getByRole('button',{name:"Import this device's decks"})).toBeVisible();
 page.once('dialog',d=>d.accept());await page.getByRole('button',{name:"Import this device's decks"}).click();
 await expect(page.locator('.account-status')).toHaveText('Cloud synced',{timeout:40000});
 const other=await browser.newContext();const second=await other.newPage();await second.goto('./',{waitUntil:'domcontentloaded'});await openUsername(second,name);
 await second.getByRole('button',{name:'Deck builder',exact:true}).click();await expect(second.getByLabel('Load saved deck')).toContainText('First guest');await expect(second.getByLabel('Load saved deck')).toContainText('Later guest');
 await other.close();
});

test('old access ID claims a username without moving its decks',async({page,browser})=>{
 test.skip(!process.env.ACCOUNT_TEST_SUPABASE_URL,'Requires isolated local Supabase Auth and database');
 const old=await legacyAccount();const taken=uniqueName();const claimed=uniqueName();
 const other=await browser.newContext();const second=await other.newPage();await second.goto('./',{waitUntil:'domcontentloaded'});await openUsername(second,taken);
 await page.goto('./',{waitUntil:'domcontentloaded'});
 await page.getByText('Have an old access ID?').click();
 await page.getByLabel('Enter old access ID').fill('0'.repeat(48));await page.getByRole('button',{name:'Move old decks'}).click();
 await expect(page.getByRole('alert')).toContainText('Old access ID could not be opened');
 await page.getByLabel('Enter old access ID').fill(old.access_id);await page.getByRole('button',{name:'Move old decks'}).click();
 await expect(page.getByLabel('Choose username')).toBeVisible();
 expect(await page.evaluate(()=>localStorage.getItem('tcg-builder.active-account.v1'))).toBe(old.account_id);
 await page.getByRole('button',{name:'Deck builder',exact:true}).click();
 await page.getByRole('textbox',{name:'Deck name'}).fill('Old crew');await page.getByRole('button',{name:'Save deck',exact:true}).click();
 await expect(page.locator('.account-status')).toHaveText('Cloud synced',{timeout:40000});
 await page.getByLabel('Choose username').fill(taken);await page.getByRole('button',{name:'Claim username'}).click();
 await expect(page.getByRole('alert')).toContainText('username unavailable');
 await expect(page.getByLabel('Load saved deck')).toContainText('Old crew');
 await page.getByLabel('Choose username').fill(claimed);await page.getByRole('button',{name:'Claim username'}).click();
 await expect(page.getByLabel('Current username')).toHaveValue(claimed);
 expect(await page.evaluate(()=>localStorage.getItem('tcg-builder.active-account.v1'))).toBe(old.account_id);
 second.once('dialog',d=>d.accept());await second.getByRole('button',{name:'Sign out'}).click();
 await openUsername(second,claimed);await second.getByRole('button',{name:'Deck builder',exact:true}).click();
 await expect(second.getByLabel('Load saved deck')).toContainText('Old crew');await other.close();
});

test('an upgraded legacy browser keeps its account marker through an offline reload',async({page})=>{
 test.skip(!process.env.ACCOUNT_TEST_SUPABASE_URL,'Requires isolated local Supabase');
 const old=await legacyAccount();await page.goto('./',{waitUntil:'domcontentloaded'});
 await page.getByText('Have an old access ID?').click();await page.getByLabel('Enter old access ID').fill(old.access_id);await page.getByRole('button',{name:'Move old decks'}).click();
 await expect(page.getByLabel('Choose username')).toBeVisible();
 await page.getByRole('button',{name:'Deck builder',exact:true}).click();await page.getByRole('textbox',{name:'Deck name'}).fill('Legacy offline crew');await page.getByRole('button',{name:'Save deck',exact:true}).click();
 await expect(page.locator('.account-status')).toHaveText('Cloud synced',{timeout:40000});
 await page.evaluate(id=>localStorage.removeItem(`tcg-builder.auth-user.${id}.v1`),old.account_id);
 await page.route('**/rest/v1/rpc/account_username',route=>route.abort());await page.reload({waitUntil:'domcontentloaded'});
 await expect(page.getByRole('alert')).toContainText('Connect to verify');
 expect(await page.evaluate(()=>localStorage.getItem('tcg-builder.active-account.v1'))).toBe(old.account_id);
 await page.unroute('**/rest/v1/rpc/account_username');await page.evaluate(()=>window.dispatchEvent(new Event('online')));
 await expect(page.getByLabel('Choose username')).toBeVisible();
 await page.getByRole('button',{name:'Deck builder',exact:true}).click();await expect(page.getByLabel('Load saved deck')).toContainText('Legacy offline crew');
});

test('One Piece guest deck imports to a username without replacing a draft',async({page,browser})=>{
 test.skip(!process.env.ACCOUNT_TEST_SUPABASE_URL,'Requires isolated local Supabase Auth and database');
 await page.goto('./',{waitUntil:'domcontentloaded'});await page.getByRole('button',{name:'Deck builder',exact:true}).click();
 await page.getByRole('textbox',{name:'Deck name'}).fill('Cloud crew');
 await page.getByRole('button',{name:'Save deck',exact:true}).click();
 await page.getByRole('textbox',{name:'Deck name'}).fill('Unsaved draft');
 await createUsername(page);
 page.once('dialog',d=>d.accept());await page.getByRole('button',{name:"Import this device's decks"}).click();
 await expect(page.getByRole('textbox',{name:'Deck name'})).toHaveValue('Unsaved draft');
 await expect(page.locator('.account-status')).toHaveText('Cloud synced',{timeout:40000});
 const id=await page.getByLabel('Current username').inputValue();
 await expect(page.getByLabel('Load saved deck')).toContainText('Cloud crew');
 await page.reload({waitUntil:'domcontentloaded'});await page.getByRole('button',{name:'Deck builder',exact:true}).click();
 await expect(page.getByLabel('Load saved deck')).toContainText('Cloud crew');
 const other=await browser.newContext();const second=await other.newPage();await second.goto('./',{waitUntil:'domcontentloaded'});
 await second.getByLabel('Username',{exact:true}).fill(id);await second.getByRole('button',{name:'Continue with username'}).click();
 await second.getByRole('button',{name:'Deck builder',exact:true}).click();
 await expect(second.getByLabel('Load saved deck')).toContainText('Cloud crew');await other.close();
});

test('corrupt One Piece guest storage remains untouched during import',async({page})=>{
 test.skip(!process.env.ACCOUNT_TEST_SUPABASE_URL,'Requires isolated local Supabase Auth and database');
 await page.goto('./',{waitUntil:'domcontentloaded'});await page.evaluate(()=>localStorage.setItem('grand-line.decks.v1','{broken'));
 await page.reload({waitUntil:'domcontentloaded'});await createUsername(page);
 page.once('dialog',d=>d.accept());await page.getByRole('button',{name:"Import this device's decks"}).click();
 await expect(page.getByRole('alert')).toContainText('Saved decks could not be read',{timeout:40000});
 expect(await page.evaluate(()=>localStorage.getItem('grand-line.decks.v1'))).toBe('{broken');
});

test('Pokémon and One Piece decks share a username but remain separate',async({page,browser})=>{
 test.skip(!process.env.ACCOUNT_TEST_SUPABASE_URL,'Requires isolated local Supabase Auth and database');
 await page.goto('./',{waitUntil:'domcontentloaded'});await createUsername(page);
 await expect(page.locator('.account-status')).toHaveText('Cloud synced',{timeout:40000});
 const id=await page.getByLabel('Current username').inputValue();
 await page.getByRole('button',{name:'Deck builder',exact:true}).click();
 await page.getByRole('textbox',{name:'Deck name'}).fill('One Piece account deck');await page.getByRole('button',{name:'Save deck',exact:true}).click();
 await expect(page.locator('.account-status')).toHaveText('Cloud synced',{timeout:40000});
 await page.getByLabel('Choose card game').selectOption('pokemon');await page.getByRole('button',{name:'Deck builder',exact:true}).click();
 await page.getByRole('textbox',{name:'Pokémon deck name'}).fill('Pokémon account deck');await page.getByRole('button',{name:'Save deck',exact:true}).click();
 await expect(page.locator('.account-status')).toHaveText('Cloud synced',{timeout:40000});
 await page.getByRole('textbox',{name:'Pokémon deck name'}).fill('Unsaved Pokémon draft');
 await page.getByLabel('Choose card game').selectOption('onepiece');await page.getByLabel('Choose card game').selectOption('pokemon');
 await expect(page.getByRole('textbox',{name:'Pokémon deck name'})).toHaveValue('Unsaved Pokémon draft');
 const other=await browser.newContext();const second=await other.newPage();await second.goto('./',{waitUntil:'domcontentloaded'});
 await second.getByLabel('Username',{exact:true}).fill(id);await second.getByRole('button',{name:'Continue with username'}).click();
 await expect(second.locator('.account-status')).toHaveText('Cloud synced',{timeout:40000});
 await second.getByRole('button',{name:'Deck builder',exact:true}).click();await expect(second.getByLabel('Load saved deck')).toContainText('One Piece account deck');
 await second.getByLabel('Choose card game').selectOption('pokemon');await second.getByRole('button',{name:'Deck builder',exact:true}).click();
 await expect(second.getByLabel('Saved Pokémon decks')).toContainText('Pokémon account deck');await other.close();
 const corrupt=await browser.newContext();await corrupt.addInitScript(()=>localStorage.setItem('tcg-builder.pokemon.decks.v1','{broken'));
 const blocked=await corrupt.newPage();await blocked.goto('./',{waitUntil:'domcontentloaded'});await blocked.getByLabel('Username',{exact:true}).fill(id);
 await blocked.getByRole('button',{name:'Continue with username'}).click();
 blocked.once('dialog',d=>d.accept());await blocked.getByRole('button',{name:"Import this device's decks"}).click();
 await expect(blocked.getByRole('alert')).toContainText('Saved Pokémon decks could not be read',{timeout:40000});
 expect(await blocked.evaluate(()=>localStorage.getItem('tcg-builder.pokemon.decks.v1'))).toBe('{broken');
 await corrupt.close();
});

test('Yu-Gi-Oh! OCG sections reopen under the same username',async({page,browser})=>{
 test.skip(!process.env.ACCOUNT_TEST_SUPABASE_URL,'Requires isolated local Supabase Auth and database');
 await page.goto('./',{waitUntil:'domcontentloaded'});await createUsername(page);
 await expect(page.locator('.account-status')).toHaveText('Cloud synced',{timeout:40000});
 const id=await page.getByLabel('Current username').inputValue();
 await page.getByLabel('Choose card game').selectOption('yugioh');await page.getByRole('button',{name:'Yu-Gi-Oh! deck builder'}).click();
 await page.getByLabel('Deck import and export').fill('[main]\n3 4007\n[extra]\n1 18823\n[side]\n1 4041');
 await page.getByRole('button',{name:'Import deck',exact:true}).click();
 await page.getByLabel('Yu-Gi-Oh! deck name').fill('OCG account deck');await page.getByLabel('Deck format').selectOption('ocg');
 await page.getByRole('button',{name:'Save deck',exact:true}).click();await expect(page.locator('.account-status')).toHaveText('Cloud synced',{timeout:40000});
 const other=await browser.newContext();const second=await other.newPage();await second.goto('./',{waitUntil:'domcontentloaded'});
 await second.getByLabel('Username',{exact:true}).fill(id);await second.getByRole('button',{name:'Continue with username'}).click();
 await expect(second.locator('.account-status')).toHaveText('Cloud synced',{timeout:40000});
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
 await page.goto('./',{waitUntil:'domcontentloaded'});await createUsername(page);
 await expect(page.locator('.account-status')).toHaveText('Cloud synced',{timeout:40000});const id=await page.getByLabel('Current username').inputValue();
 await page.getByLabel('Choose card game').selectOption('yugioh');await page.getByRole('button',{name:'Yu-Gi-Oh! deck builder'}).click();
 await page.getByLabel('Yu-Gi-Oh! deck name').fill('Original duel');await page.getByRole('button',{name:'Save deck',exact:true}).click();
 await expect(page.locator('.account-status')).toHaveText('Cloud synced',{timeout:40000});
 const other=await browser.newContext();const second=await other.newPage();await second.goto('./',{waitUntil:'domcontentloaded'});
 await second.getByLabel('Username',{exact:true}).fill(id);await second.getByRole('button',{name:'Continue with username'}).click();
 await expect(second.locator('.account-status')).toHaveText('Cloud synced',{timeout:40000});
 await second.getByLabel('Choose card game').selectOption('yugioh');await second.getByRole('button',{name:'Yu-Gi-Oh! deck builder'}).click();
 await second.getByLabel('Saved decks').selectOption({label:'Original duel'});
 await page.getByLabel('Yu-Gi-Oh! deck name').fill('First edit');await page.getByRole('button',{name:'Save deck',exact:true}).click();
 await expect(page.locator('.account-status')).toHaveText('Cloud synced',{timeout:40000});
 await second.getByLabel('Yu-Gi-Oh! deck name').fill('Second edit');await second.getByRole('button',{name:'Save deck',exact:true}).click();
 await expect(second.locator('.account-status')).toHaveText('Cloud synced',{timeout:40000});
 await expect(second.getByLabel('Saved decks')).toContainText('First edit');
 await expect(second.getByLabel('Saved decks')).toContainText('Second edit (from this device)');
 await second.getByLabel('Yu-Gi-Oh! deck name').fill('Third edit');await second.getByRole('button',{name:'Save deck',exact:true}).click();
 await expect(second.locator('.account-status')).toHaveText('Cloud synced',{timeout:40000});
 await expect(second.getByLabel('Saved decks')).toContainText('First edit');
 await expect(second.getByLabel('Saved decks')).toContainText('Third edit (from this device)');await other.close();
});

test('a delayed old-account response cannot set the next account revision',async({page})=>{
 test.skip(!process.env.ACCOUNT_TEST_SUPABASE_URL,'Requires isolated local Supabase');
 const first=uniqueName(),second=uniqueName();await page.goto('./',{waitUntil:'domcontentloaded'});
 await page.getByRole('button',{name:'Deck builder',exact:true}).click();await page.getByRole('textbox',{name:'Deck name'}).fill('Same card ID');await page.getByRole('button',{name:'Save deck',exact:true}).click();
 await openUsername(page,first);page.once('dialog',d=>d.accept());await page.getByRole('button',{name:"Import this device's decks"}).click();await expect(page.locator('.account-status')).toHaveText('Cloud synced',{timeout:40000});
 await page.getByRole('textbox',{name:'Deck name'}).fill('First account version two');await page.getByRole('button',{name:'Save deck',exact:true}).click();await expect(page.locator('.account-status')).toHaveText('Cloud synced',{timeout:40000});
 const firstId=await page.evaluate(()=>localStorage.getItem('tcg-builder.active-account.v1'));
 page.once('dialog',d=>d.accept());await page.getByRole('button',{name:'Sign out'}).click();
 await openUsername(page,second);page.once('dialog',d=>d.accept());await page.getByRole('button',{name:"Import this device's decks"}).click();await expect(page.locator('.account-status')).toHaveText('Cloud synced',{timeout:40000});
 page.once('dialog',d=>d.accept());await page.getByRole('button',{name:'Sign out'}).click();
 await openUsername(page,first);await expect(page.locator('.account-status')).toHaveText('Cloud synced',{timeout:40000});
 let release!:()=>void;const gate=new Promise<void>(resolve=>{release=resolve;});let seen!:()=>void;const intercepted=new Promise<void>(resolve=>{seen=resolve;});let held=false;
 await page.route('**/rest/v1/saved_decks*',async route=>{if(!held&&route.request().url().includes(firstId!)){held=true;seen();await gate;}await route.continue();});
 await page.evaluate(()=>window.dispatchEvent(new Event('online')));await intercepted;
 page.once('dialog',d=>d.accept());await page.getByRole('button',{name:'Sign out'}).click();
 await openUsername(page,second);release();await expect(page.locator('.account-status')).toHaveText('Cloud synced',{timeout:40000});
 await page.getByRole('button',{name:'Deck builder',exact:true}).click();await page.getByLabel('Load saved deck').selectOption({label:'Same card ID'});
 await page.getByRole('textbox',{name:'Deck name'}).fill('Second account edit');await page.getByRole('button',{name:'Save deck',exact:true}).click();
 await expect(page.locator('.account-status')).toHaveText('Cloud synced',{timeout:40000});
 await expect(page.getByLabel('Load saved deck')).toContainText('Second account edit');
 await expect(page.getByLabel('Load saved deck')).not.toContainText('(from this device)');
});

test('invalid cloud deck stays in the database and is not shown',async({page})=>{
 test.skip(!process.env.ACCOUNT_TEST_DB_CONTAINER,'Requires isolated local Supabase database container');
 await page.goto('./',{waitUntil:'domcontentloaded'});await createUsername(page);
 await expect(page.locator('.account-status')).toHaveText('Cloud synced',{timeout:40000});
 const account=await page.evaluate(()=>localStorage.getItem('tcg-builder.active-account.v1'));
 expect(account).toMatch(/^[0-9a-f-]{36}$/);
 const sql=`insert into public.saved_decks(account_id,game,deck_id,payload) values ('${account}','yugioh','malformed','{"id":"malformed","name":7}'::jsonb)`;
 execFileSync('docker',['exec',process.env.ACCOUNT_TEST_DB_CONTAINER!,'psql','-U','postgres','-d','postgres','-tAc',sql]);
 await page.reload({waitUntil:'domcontentloaded'});
 await expect(page.getByRole('alert')).toContainText('Cloud deck data is invalid',{timeout:40000});
 await page.getByLabel('Choose card game').selectOption('yugioh');await page.getByRole('button',{name:'Yu-Gi-Oh! deck builder'}).click();
 await expect(page.getByLabel('Saved decks').locator('option')).toHaveCount(1);
 const check=execFileSync('docker',['exec',process.env.ACCOUNT_TEST_DB_CONTAINER!,'psql','-U','postgres','-d','postgres','-tAc',`select revision from public.saved_decks where account_id='${account}' and deck_id='malformed'`],{encoding:'utf8'});
 expect(check.trim()).toBe('1');
});

test('offline save survives reload and retries to another browser',async({page,browser})=>{
 test.skip(!process.env.ACCOUNT_TEST_SUPABASE_URL,'Requires isolated local Supabase Auth and database');
 await page.goto('./',{waitUntil:'domcontentloaded'});await createUsername(page);
 await expect(page.locator('.account-status')).toHaveText('Cloud synced',{timeout:40000});const id=await page.getByLabel('Current username').inputValue();
 await page.getByRole('button',{name:'Deck builder',exact:true}).click();
 await page.route('**/rest/v1/**',route=>route.abort());
 await page.getByRole('textbox',{name:'Deck name'}).fill('Offline crew');await page.getByRole('button',{name:'Save deck',exact:true}).click();
 await expect(page.locator('.account-status')).toHaveText('Pending sync',{timeout:40000});
 await page.reload({waitUntil:'domcontentloaded'});await page.getByRole('button',{name:'Deck builder',exact:true}).click();
 await expect(page.getByLabel('Load saved deck')).toContainText('Offline crew');
 await expect(page.locator('.account-status')).toHaveText('Pending sync',{timeout:40000});
 await page.unroute('**/rest/v1/**');await page.evaluate(()=>window.dispatchEvent(new Event('online')));
 await expect(page.locator('.account-status')).toHaveText('Cloud synced',{timeout:40000});
 const other=await browser.newContext();const second=await other.newPage();await second.goto('./',{waitUntil:'domcontentloaded'});
 await second.getByLabel('Username',{exact:true}).fill(id);await second.getByRole('button',{name:'Continue with username'}).click();
 await expect(second.locator('.account-status')).toHaveText('Cloud synced',{timeout:40000});
 await second.getByRole('button',{name:'Deck builder',exact:true}).click();await expect(second.getByLabel('Load saved deck')).toContainText('Offline crew');await other.close();
});

test('signing out retains pending account work for the same username',async({page})=>{
 test.skip(!process.env.ACCOUNT_TEST_SUPABASE_URL,'Requires isolated local Supabase Auth and database');
 await page.goto('./',{waitUntil:'domcontentloaded'});await createUsername(page);
 await expect(page.locator('.account-status')).toHaveText('Cloud synced',{timeout:40000});const id=await page.getByLabel('Current username').inputValue();
 await page.getByRole('button',{name:'Deck builder',exact:true}).click();
 await page.route('**/rest/v1/rpc/save_deck',route=>route.abort());
 await page.getByRole('textbox',{name:'Deck name'}).fill('Pending after signout');await page.getByRole('button',{name:'Save deck',exact:true}).click();
 await expect(page.locator('.account-status')).toHaveText('Pending sync',{timeout:40000});
 page.once('dialog',d=>d.accept());await page.getByRole('button',{name:'Sign out'}).click();
 await expect(page.getByRole('button',{name:'Continue with username'})).toBeVisible();
 await expect(page.getByLabel('Username',{exact:true})).toHaveValue('');
 await page.unroute('**/rest/v1/rpc/save_deck');await page.getByLabel('Username',{exact:true}).fill(id);await page.getByRole('button',{name:'Continue with username'}).click();
 await expect(page.locator('.account-status')).toHaveText('Cloud synced',{timeout:40000});
 await expect(page.getByLabel('Load saved deck')).toContainText('Pending after signout');
});

test('account controls fit a narrow mobile viewport',async({page})=>{
 test.skip(!process.env.ACCOUNT_TEST_SUPABASE_URL,'Requires isolated local Supabase Auth and database');
 await page.setViewportSize({width:390,height:844});await page.goto('./',{waitUntil:'domcontentloaded'});
 await createUsername(page);
 await expect(page.locator('.account-status')).toHaveText('Cloud synced',{timeout:40000});
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});

test('syncing another game never advances the base of an unsaved draft',async({page,browser})=>{
 test.skip(!process.env.ACCOUNT_TEST_SUPABASE_URL,'Requires isolated local Supabase Auth and database');
 await page.goto('./',{waitUntil:'domcontentloaded'});await createUsername(page);
 await expect(page.locator('.account-status')).toHaveText('Cloud synced',{timeout:40000});const id=await page.getByLabel('Current username').inputValue();
 await page.getByRole('button',{name:'Deck builder',exact:true}).click();await page.getByRole('textbox',{name:'Deck name'}).fill('Base crew');
 await page.getByRole('button',{name:'Save deck',exact:true}).click();await expect(page.locator('.account-status')).toHaveText('Cloud synced',{timeout:40000});
 const other=await browser.newContext();const second=await other.newPage();await second.goto('./',{waitUntil:'domcontentloaded'});
 await second.getByLabel('Username',{exact:true}).fill(id);await second.getByRole('button',{name:'Continue with username'}).click();
 await expect(second.locator('.account-status')).toHaveText('Cloud synced',{timeout:40000});
 await second.getByRole('button',{name:'Deck builder',exact:true}).click();second.once('dialog',d=>d.accept());
 await second.getByLabel('Load saved deck').selectOption({label:'Base crew'});
 await expect(second.getByRole('textbox',{name:'Deck name'})).toHaveValue('Base crew');
 await second.getByRole('textbox',{name:'Deck name'}).fill('Unsaved second-device crew');
 await page.getByRole('textbox',{name:'Deck name'}).fill('First-device crew');await page.getByRole('button',{name:'Save deck',exact:true}).click();
 await expect(page.locator('.account-status')).toHaveText('Cloud synced',{timeout:40000});
 await second.getByLabel('Choose card game').selectOption('pokemon');await second.getByRole('button',{name:'Deck builder',exact:true}).click();
 await second.getByRole('textbox',{name:'Pokémon deck name'}).fill('Other game');await second.getByRole('button',{name:'Save deck',exact:true}).click();
 await expect(second.locator('.account-status')).toHaveText('Cloud synced',{timeout:40000});
 await second.getByLabel('Choose card game').selectOption('onepiece');await second.getByRole('button',{name:'Save deck',exact:true}).click();
 await expect(second.locator('.account-status')).toHaveText('Cloud synced',{timeout:40000});
 await expect(second.getByLabel('Load saved deck')).toContainText('First-device crew');
 await expect(second.getByLabel('Load saved deck')).toContainText('Unsaved second-device crew (from this device)');await other.close();
});

test('a failed device-cache write never claims a deck was saved',async({page})=>{
 test.skip(!process.env.ACCOUNT_TEST_SUPABASE_URL,'Requires isolated local Supabase Auth and database');
 await page.goto('./',{waitUntil:'domcontentloaded'});await createUsername(page);
 await expect(page.locator('.account-status')).toHaveText('Cloud synced',{timeout:40000});
 await page.getByRole('button',{name:'Deck builder',exact:true}).click();
 await page.evaluate(()=>{const original=Storage.prototype.setItem;Storage.prototype.setItem=function(key,value){if(key.startsWith('tcg-builder.account.'))throw new DOMException('Quota exceeded','QuotaExceededError');return original.call(this,key,value);};});
 await page.getByRole('textbox',{name:'Deck name'}).fill('Unsaved due to quota');await page.getByRole('button',{name:'Save deck',exact:true}).click();
 expect(await page.locator('.toast').count()).toBe(0);
 await expect(page.locator('.account-error')).toContainText('could not be saved on this device');
});

test('an acknowledged save with a lost response does not create a conflict copy',async({page})=>{
 test.skip(!process.env.ACCOUNT_TEST_SUPABASE_URL,'Requires isolated local Supabase Auth and database');
 await page.goto('./',{waitUntil:'domcontentloaded'});await createUsername(page);
 await expect(page.locator('.account-status')).toHaveText('Cloud synced',{timeout:40000});
 await page.getByRole('button',{name:'Deck builder',exact:true}).click();
 let lost=false;await page.route('**/rest/v1/rpc/save_deck',async route=>{if(!lost){lost=true;await route.fetch();await route.abort();}else await route.continue();});
 await page.getByRole('textbox',{name:'Deck name'}).fill('Acknowledged crew');await page.getByRole('button',{name:'Save deck',exact:true}).click();
 await expect(page.locator('.account-status')).toHaveText('Pending sync',{timeout:40000});
 await page.getByRole('button',{name:'Retry sync'}).click();await expect(page.locator('.account-status')).toHaveText('Cloud synced',{timeout:40000});
 await expect(page.getByLabel('Load saved deck').locator('option')).toHaveCount(2);
 await expect(page.getByLabel('Load saved deck')).not.toContainText('(from this device)');
});

test('overlapping retries send one revisioned write',async({page})=>{
 test.skip(!process.env.ACCOUNT_TEST_SUPABASE_URL,'Requires isolated local Supabase Auth and database');
 await page.goto('./',{waitUntil:'domcontentloaded'});await createUsername(page);
 await expect(page.locator('.account-status')).toHaveText('Cloud synced',{timeout:40000});
 await page.getByRole('button',{name:'Deck builder',exact:true}).click();
 let calls=0;let release!:()=>void;const gate=new Promise<void>(resolve=>{release=resolve;});
 await page.route('**/rest/v1/rpc/save_deck',async route=>{calls++;if(calls===1)await gate;await route.continue();});
 await page.getByRole('textbox',{name:'Deck name'}).fill('One write');await page.getByRole('button',{name:'Save deck',exact:true}).click();
 await expect(page.locator('.account-status')).toHaveText('Syncing…',{timeout:40000});
 await page.evaluate(()=>window.dispatchEvent(new Event('online')));
 release();
 await expect(page.locator('.account-status')).toHaveText('Cloud synced',{timeout:40000});
 expect(calls).toBe(1);await expect(page.getByLabel('Load saved deck').locator('option')).toHaveCount(2);
});
