const {
  completePairAndAppendBlank,
  getDefaultLanguageIds,
  hasDistinctLanguageIds,
} = require('../src/Quizmam.Api/wwwroot/wizard-pairs.js');
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const test = require('node:test');
const indexHtml = fs.readFileSync(
  path.join(__dirname, '../src/Quizmam.Api/wwwroot/index.html'),
  'utf8',
);

test('appends one blank row when the final word pair becomes complete', () => {
  const pairs = [{ sourceText: 'rower', targetText: 'bike' }];

  const appended = completePairAndAppendBlank(pairs, 0);

  assert.equal(appended, true);
  assert.deepEqual(pairs, [
    { sourceText: 'rower', targetText: 'bike' },
    { sourceText: '', targetText: '' },
  ]);
});

test('does not append a row while the final word pair is incomplete', () => {
  const pairs = [{ sourceText: 'rower', targetText: '' }];

  const appended = completePairAndAppendBlank(pairs, 0);

  assert.equal(appended, false);
  assert.equal(pairs.length, 1);
});

test('defaults new collections to Polish and the first different language', () => {
  assert.deepEqual(
    getDefaultLanguageIds([
      { id: 'en', name: 'Angielski' },
      { id: 'pl', name: 'Polski' },
      { id: 'de', name: 'Niemiecki' },
    ]),
    { sourceLanguageId: 'pl', targetLanguageId: 'en' },
  );
});

test('falls back to the first language and a different target when Polish is unavailable', () => {
  assert.deepEqual(
    getDefaultLanguageIds([
      { id: 'de', name: 'Niemiecki' },
      { id: 'en', name: 'Angielski' },
    ]),
    { sourceLanguageId: 'de', targetLanguageId: 'en' },
  );
});

test('uses the only language for both defaults so the invalid selection is explicit', () => {
  assert.deepEqual(
    getDefaultLanguageIds([{ id: 'pl', name: 'Polski' }]),
    { sourceLanguageId: 'pl', targetLanguageId: 'pl' },
  );
  assert.equal(hasDistinctLanguageIds('pl', 'pl'), false);
});

test('requires two nonempty and different language IDs', () => {
  assert.equal(hasDistinctLanguageIds('pl', 'en'), true);
  assert.equal(hasDistinctLanguageIds('', 'en'), false);
  assert.equal(hasDistinctLanguageIds('pl', ''), false);
});

test('provides a numbered three-column word-pair table body', () => {
  assert.match(indexHtml, /<table[^>]*class="[^"]*word-pairs-table/);
  assert.match(indexHtml, /<th[^>]*scope="col"[^>]*>#<\/th>/);
  assert.match(indexHtml, /id="sourceWordHeader"/);
  assert.match(indexHtml, /id="targetWordHeader"/);
  assert.match(indexHtml, /<tbody id="wordPairsContainer"><\/tbody>/);
});
