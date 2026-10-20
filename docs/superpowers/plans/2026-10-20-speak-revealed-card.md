# Speak Revealed Card Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Automatically speak a card's translation only when the user flips from the prompt side to the answer side.

**Architecture:** Add a small browser/CommonJS helper that flips card state and invokes a callback only when revealing the answer. Route click and Space through the same app action, passing the revealed translation and target language to the existing `speakWord` function.

**Tech Stack:** Static HTML, jQuery, browser SpeechSynthesis API, Node.js built-in test runner.

## Global Constraints

- Speak the revealed target translation on card flip using the existing voice preference and target language.
- Do not automatically speak when showing a new card or flipping back to the source side.
- Keep the existing speaker button behavior unchanged.
- Do not add dependencies.
- Do not run or leave any app running in the background.
- Do not commit without the user's explicit confirmation.

---

## File Map

- `src/Quizmam.Api/wwwroot/card-flip.js` — small pure callback helper for deciding whether a flip reveals the translation.
- `src/Quizmam.Api/wwwroot/index.html` — load the helper before `app.js`.
- `src/Quizmam.Api/wwwroot/app.js` — share one flip action between click and Space and speak only on reveal.
- `tests/card-flip.test.cjs` — tests for reveal speech versus flip-back silence.

### Task 1: Add tested shared flip behavior

**Files:**
- Create: `src/Quizmam.Api/wwwroot/card-flip.js`
- Modify: `src/Quizmam.Api/wwwroot/index.html`
- Modify: `src/Quizmam.Api/wwwroot/app.js`
- Create: `tests/card-flip.test.cjs`

**Interfaces:**
- `flipCard(isFlipped, onReveal)` returns the next flipped state.
- `onReveal` is called with no arguments only when `isFlipped` was false; it is not called when flipping back.
- Browser global: `window.flipCard`; CommonJS export: `{ flipCard }`.

- [ ] **Step 1: Write tests for reveal speech callback and flip-back silence**

Create `tests/card-flip.test.cjs`:

```js
const { flipCard } = require('../src/Quizmam.Api/wwwroot/card-flip.js');
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
```

- [ ] **Step 2: Run the tests and verify the helper is missing**

Run: `node --test tests/card-flip.test.cjs`

Expected: FAIL with `Cannot find module '../src/Quizmam.Api/wwwroot/card-flip.js'`.

- [ ] **Step 3: Implement the minimal helper**

Create `src/Quizmam.Api/wwwroot/card-flip.js`:

```js
(function (root, factory) {
  const flipCard = factory();

  if (typeof module === 'object' && module.exports) {
    module.exports = { flipCard };
  } else {
    root.flipCard = flipCard;
  }
})(globalThis, function () {
  return function flipCard(isFlipped, onReveal) {
    const nextFlipped = !isFlipped;
    if (nextFlipped) {
      onReveal();
    }
    return nextFlipped;
  };
});
```

- [ ] **Step 4: Run the tests and verify both behaviors pass**

Run: `node --test tests/card-flip.test.cjs`

Expected: both tests PASS.

- [ ] **Step 5: Load the helper before the application script**

In `src/Quizmam.Api/wwwroot/index.html`, add this immediately before `/app.js`:

```html
<script src="/card-flip.js"></script>
```

- [ ] **Step 6: Route Space and click through one flip action**

In `src/Quizmam.Api/wwwroot/app.js`, add this shared function:

```js
function togglePracticeCard() {
  const $card = $('#cardsPracticeCard');
  if (!$card.length) return;

  const isFlipped = $card.data('flipped') === true;
  const nextFlipped = flipCard(isFlipped, () => {
    const activeWord = getActiveWord();
    if (!activeWord) return;

    const translation = state.direction === 'source-to-target'
      ? activeWord.targetText
      : activeWord.sourceText;
    speakWord(translation, getExpectedLanguageName());
  });

  $card.data('flipped', nextFlipped);
  renderCardsPractice();
}
```

Replace the body of the Space-key card toggle block with:

```js
if ($('#cardsPracticeCard').length) {
  event.preventDefault();
  togglePracticeCard();
}
```

Replace the click handler in `renderCardsPractice()` with:

```js
$('#cardsPracticeCard').on('click', togglePracticeCard);
```

Do not add speech to `nextPracticeWord()` or `renderCardsPractice()`, so opening and advancing cards remain silent.

- [ ] **Step 7: Run focused tests, syntax checks, and whitespace validation**

Run:

```powershell
node --test tests/card-flip.test.cjs tests/wizard-pairs.test.cjs tests/manual-practice-display.test.cjs
node --check src/Quizmam.Api/wwwroot/app.js
node --check src/Quizmam.Api/wwwroot/card-flip.js
git diff --check
```

Expected: tests pass, syntax checks exit 0, and `git diff --check` reports no whitespace errors. Do not run the app.

## Self-review

- Spec coverage: reveal speech through click and Space is covered in Step 6; no speech on initial/new cards or flip-back is covered by the helper contract and tests; existing speaker button remains untouched.
- Placeholder scan: no deferred or placeholder implementation steps.
- Interface consistency: helper signature `flipCard(isFlipped, onReveal)` is used consistently by the test and app.
- No commit step is included because explicit user confirmation is required before committing.
