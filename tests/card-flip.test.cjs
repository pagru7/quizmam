const { flipCard, shouldFlipCardFromKey } = require('../src/Quizmam.Api/wwwroot/card-flip.js');
const assert = require('node:assert/strict');
const test = require('node:test');

test('calls the reveal callback when flipping from prompt to translation', () => {
  let speechCount = 0;

  const nextFlipped = flipCard(false, () => {
    speechCount += 1;
  });

  assert.equal(nextFlipped, true);
  assert.equal(speechCount, 1);
});

test('does not call the reveal callback when flipping back to the prompt', () => {
  let speechCount = 0;

  const nextFlipped = flipCard(true, () => {
    speechCount += 1;
  });

  assert.equal(nextFlipped, false);
  assert.equal(speechCount, 0);
});

test('recognizes Space key events by key value or physical key code', () => {
  assert.equal(shouldFlipCardFromKey({ key: ' ', code: '' }), true);
  assert.equal(shouldFlipCardFromKey({ key: 'Space', code: '' }), true);
  assert.equal(shouldFlipCardFromKey({ key: '', code: 'Space' }), true);
  assert.equal(shouldFlipCardFromKey({ key: 'Enter', code: 'Enter' }), false);
});

test('ignores repeated Space keydown events while the key is held', () => {
  assert.equal(shouldFlipCardFromKey({ key: ' ', code: 'Space', repeat: true }), false);
});
