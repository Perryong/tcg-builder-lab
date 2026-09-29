import {test} from 'node:test';
import assert from 'node:assert/strict';
import {accountConfig} from '../src/account/client.ts';

test('missing browser config stays local-only',()=>{
 assert.equal(accountConfig({}),null);
 assert.equal(accountConfig({VITE_SUPABASE_URL:'https://example.supabase.co'}),null);
 assert.equal(accountConfig({VITE_SUPABASE_PUBLISHABLE_KEY:'key'}),null);
 assert.deepEqual(accountConfig({VITE_SUPABASE_URL:'https://example.supabase.co',VITE_SUPABASE_PUBLISHABLE_KEY:'key'}),{url:'https://example.supabase.co',key:'key'});
});
