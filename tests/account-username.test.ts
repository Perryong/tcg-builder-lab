import {test} from 'node:test';
import assert from 'node:assert/strict';
import {normalizeUsername} from '../src/account/username.ts';

test('username entry ignores surrounding space and ASCII case',()=>{
 assert.equal(normalizeUsername(' Perry_1 '),'perry_1');
 assert.equal(normalizeUsername('abc'),'abc');
});

test('username entry rejects names outside the published grammar',()=>{
 for(const value of ['ab','a'.repeat(25),'name-with-dash','pérson','']){
  assert.throws(()=>normalizeUsername(value),/3–24/);
 }
});
