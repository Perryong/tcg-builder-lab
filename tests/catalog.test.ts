import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import * as catalog from '../src/catalog.ts';
import * as importer from '../scripts/import-catalog.mjs';
const c = { id: 'OP01-001', number: 'OP01-001', setCode: 'OP-01', name: 'Luffy', colors: ['Red'], type: 'LEADER', rarity: 'L', cost: null, power: 5000, counter: null, life: 5, traits: ['Straw Hat Crew'], text: '', trigger: '', imageUrl: 'https://asia-en.onepiece-cardgame.com/images/cardlist/card/OP01-001.png', sourceUrl: 'https://asia-en.onepiece-cardgame.com/cardlist/', block: '1', attribute: 'Strike' };
const snapshot = { region: 'Asia', checkedAt: '2026-09-27', coverage: 'partial', coverageNotes: 'Test', sets: [{ code: 'OP-01', name: 'Romance Dawn', series: '556101', category: 'Booster', releaseDate: null, sourceUrl: c.sourceUrl, expectedArtworks: 2 }], cards: [c, { ...c, id: 'OP01-001_p1' }] };
test('alternate artwork does not inflate unique card count', () => {
  assert.deepEqual(catalog.setCounts(snapshot.cards, 'OP-01'), { uniqueCards: 1, artworks: 2 });
});
test('normalization preserves unavailable values and rejects unsafe URLs', () => {
  assert.equal(catalog.normalizeCatalog(snapshot).cards[0].cost, null);
  assert.throws(() => catalog.normalizeCatalog({ ...snapshot, cards: [{ ...c, imageUrl: 'javascript:alert(1)' }] }));
});
test('official HTML parser extracts rules text and null counters', () => {
  const html = `<p class="result">1 results</p><dl class="modalCol" id="OP01-001"><div class="infoCol"><span>OP01-001</span><span>L</span><span>LEADER</span></div><div class="cardName">Luffy</div><div class="frontCol"><img data-src="../images/cardlist/card/OP01-001.png"></div><div class="life"><h3>Life</h3>5</div><div class="color"><h3>Color</h3>Red</div><div class="counter"><h3>Counter</h3>-</div><div class="text"><h3>Effect</h3>[When Attacking]<br>Draw 1 card.</div></dl>`;
  const result = importer.parseCards(html, snapshot.sets[0]);
  assert.equal(result[0].life, 5);
  assert.equal(result[0].counter, null);
  assert.equal(result[0].text, '[When Attacking]\nDraw 1 card.');
});
test('invalid update leaves last successful snapshot unchanged', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'tcg-catalog-'));
  const path = join(dir, 'catalog.json');
  try {
    await writeFile(path, 'old snapshot');
    await assert.rejects(importer.publishCatalog(path, { ...snapshot, cards: [] }));
    assert.equal(await readFile(path, 'utf8'), 'old snapshot');
    await importer.publishCatalog(path, snapshot);
    assert.equal(JSON.parse(await readFile(path, 'utf8')).cards.length, 2);
  } finally { await rm(dir, { recursive: true }); }
});
test('combined filters intersect and zero-cost cards remain searchable', () => {
  const cards = [c, { ...c, id: 'OP01-002', number: 'OP01-002', name: 'Nami', type: 'CHARACTER', cost: 0 }];
  assert.deepEqual(catalog.filterCards(cards, { search: 'nAmI', setCode: 'OP-01', color: 'Red', type: 'CHARACTER', rarity: '', cost: '0' }).map(c => c.number), ['OP01-002']);
  assert.equal(catalog.filterCards(cards, { search: 'op01-001', setCode: '', color: 'Blue', type: '', rarity: '', cost: '' }).length, 0);
});
test('public artwork links match exact variants and missing art is marked unavailable',()=>{
 const mapped=importer.attachArtwork({...snapshot,cards:[{...c,id:'OP-01:OP01-001'},{...c,id:'OP-01:OP01-001_p1'}]},[{card_image_id:'OP01-001',card_image:'https://optcgapi.com/media/static/Card_Images/OP01-001.jpg'}]);
 assert.equal(mapped.cards[0].imageUrl,'https://optcgapi.com/media/static/Card_Images/OP01-001.jpg');
 assert.equal(mapped.cards[1].artworkAvailable,false);
});
test('official leaders use the shared cost class for Life, not a playable cost',()=>{
 const html='<dl class="modalCol" id="OP17-001"><div class="infoCol"><span>OP17-001</span><span>L</span><span>LEADER</span></div><div class="cardName">Edward.Newgate</div><div class="frontCol"><img data-src="../images/cardlist/card/OP17-001.png"></div><div class="cost"><h3>Life</h3>5</div><div class="color"><h3>Color</h3>Red</div></dl>';
 const [leader]=importer.parseCards(html,snapshot.sets[0]);
 assert.equal(leader.life,5);assert.equal(leader.cost,null);
});
test('alternate artwork shares base gameplay stats despite source transcription errors',()=>{
 const base={...c,id:'OP-01:OP01-001',power:12000,counter:null};
 const variant={...base,id:'OP-01:OP01-001_p3',power:null,counter:12000};
 const result=catalog.normalizeCatalog({...snapshot,cards:[variant,base]});
 assert.equal(result.cards[0].power,12000);
 assert.equal(result.cards[0].counter,null);
 assert.equal(result.cards[0].id,variant.id);
});
