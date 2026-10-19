const { getManualPracticeDisplayText } = require('../src/Quizmam.Api/wwwroot/manual-practice-display.js');
const assert = require('node:assert/strict');
const test = require('node:test');

test('shows the expected target translation after a wrong answer', () => {
  assert.equal(
    getManualPracticeDisplayText('salon', {
      outcome: 'wrong',
      expectedText: 'living room',
      enteredText: 'asdf',
    }, 'living room'),
    'living room',
  );
});

test('shows the expected translation even when the answer is blank', () => {
  assert.equal(
    getManualPracticeDisplayText('salon', {
      outcome: 'wrong',
      expectedText: 'living room',
      enteredText: '',
    }, 'living room'),
    'living room',
  );
});
