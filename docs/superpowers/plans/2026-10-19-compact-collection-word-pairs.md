# Compact Collection Word-Pair Editor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make collection word entry compact, keep row numbering, select sensible distinct source/target defaults, and block saving when both languages are the same.

**Architecture:** Keep the existing wizard state and static jQuery frontend. Add small pure helpers to `wizard-pairs.js` for language defaults and language validation, render pair inputs as rows in a three-column HTML table, and append new rows without recreating existing inputs.

**Tech Stack:** ASP.NET Core static files, HTML, CSS, jQuery, Node.js built-in test runner.

## Global Constraints

- Use the existing static HTML + jQuery frontend; do not introduce React, Vite, or new dependencies.
- For a new collection, choose `Polski` as source when available and choose the first different available language as target.
- If no different language is available, set target to the selected source and prevent saving with a visible validation error.
- Preserve the saved languages when editing an existing collection.
- Keep the word-pair editor to three columns: row number, source word, target translation; show language names once in the column headers.
- Start with one blank pair row and append one blank row after both values in the final row are nonblank, without rebuilding existing rows or losing focus.
- Do not run or leave any app running in the background.
- Do not commit without the user's explicit confirmation.

---

## File Map

- `src/Quizmam.Api/wwwroot/wizard-pairs.js` — pure helpers for appending completed pairs, choosing initial language IDs, and checking that language IDs are distinct.
- `src/Quizmam.Api/wwwroot/index.html` — table shell and ordered script loading for the wizard helper.
- `src/Quizmam.Api/wwwroot/app.js` — language selection initialization, table headers and row rendering, input/state updates, and save validation.
- `src/Quizmam.Api/wwwroot/styles.css` — compact table spacing and narrow-screen horizontal scrolling.
- `tests/wizard-pairs.test.cjs` — Node built-in tests for language defaults, same-language validation, pair row appending, and table shell markup.

### Task 1: Add tested language selection helpers

**Files:**
- Modify: `src/Quizmam.Api/wwwroot/wizard-pairs.js`
- Modify: `tests/wizard-pairs.test.cjs`

**Interfaces:**
- Produces `getDefaultLanguageIds(languages)`, returning `{ sourceLanguageId, targetLanguageId }` using language objects with `id` and `name` fields.
- Produces `hasDistinctLanguageIds(sourceLanguageId, targetLanguageId)`, returning `true` only when both IDs are present and unequal.
- Preserves the existing `completePairAndAppendBlank(pairs, index)` export.

- [ ] **Step 1: Write failing tests for Polish defaults, fallback defaults, and language validity**

Add these imports to `tests/wizard-pairs.test.cjs`:

```js
const {
  completePairAndAppendBlank,
  getDefaultLanguageIds,
  hasDistinctLanguageIds,
} = require('../src/Quizmam.Api/wwwroot/wizard-pairs.js');
```

Add these tests:

```js
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
```

- [ ] **Step 2: Run the focused test and verify it fails because the new helpers are missing**

Run: `node --test tests/wizard-pairs.test.cjs`

Expected: FAIL with `getDefaultLanguageIds is not a function`.

- [ ] **Step 3: Implement the two pure helpers and preserve the existing append helper**

Replace the contents of `wizard-pairs.js` with:

```js
(function (root, factory) {
  const helpers = factory();

  if (typeof module === 'object' && module.exports) {
    module.exports = helpers;
  } else {
    Object.assign(root, helpers);
  }
})(globalThis, function () {
  function completePairAndAppendBlank(pairs, index) {
    const pair = pairs[index];
    if (
      index !== pairs.length - 1
      || !pair
      || !pair.sourceText.trim()
      || !pair.targetText.trim()
    ) {
      return false;
    }

    pairs.push({ sourceText: '', targetText: '' });
    return true;
  }

  function getDefaultLanguageIds(languages) {
    const source = languages.find((language) => language.name === 'Polski') || languages[0];
    if (!source) {
      return { sourceLanguageId: '', targetLanguageId: '' };
    }

    const target = languages.find((language) => language.id !== source.id) || source;
    return {
      sourceLanguageId: source.id,
      targetLanguageId: target.id,
    };
  }

  function hasDistinctLanguageIds(sourceLanguageId, targetLanguageId) {
    return Boolean(sourceLanguageId && targetLanguageId && sourceLanguageId !== targetLanguageId);
  }

  return {
    completePairAndAppendBlank,
    getDefaultLanguageIds,
    hasDistinctLanguageIds,
  };
});
```

- [ ] **Step 4: Run the focused tests and verify they pass**

Run: `node --test tests/wizard-pairs.test.cjs`

Expected: all pair-append and language helper tests PASS.

### Task 2: Render word pairs in a compact three-column table

**Files:**
- Modify: `src/Quizmam.Api/wwwroot/index.html`
- Modify: `src/Quizmam.Api/wwwroot/app.js`
- Modify: `src/Quizmam.Api/wwwroot/styles.css`
- Modify: `tests/wizard-pairs.test.cjs`

**Interfaces:**
- Consumes `completePairAndAppendBlank(pairs, index)` from Task 1.
- Keeps `#wordPairsContainer` as the `<tbody>` receiving dynamically rendered pair rows.
- Each row has a numbered row header, one source input, and one target input.

- [ ] **Step 1: Add a failing test for the three-column table shell**

Add:

```js
const fs = require('node:fs');
const path = require('node:path');
const indexHtml = fs.readFileSync(
  path.join(__dirname, '../src/Quizmam.Api/wwwroot/index.html'),
  'utf8',
);

test('provides a numbered three-column word-pair table body', () => {
  assert.match(indexHtml, /<table[^>]*class="[^"]*word-pairs-table/);
  assert.match(indexHtml, /<th[^>]*scope="col"[^>]*>#<\/th>/);
  assert.match(indexHtml, /id="sourceWordHeader"/);
  assert.match(indexHtml, /id="targetWordHeader"/);
  assert.match(indexHtml, /<tbody id="wordPairsContainer"><\/tbody>/);
});
```

- [ ] **Step 2: Run the focused test and verify it fails on the current div-based markup**

Run: `node --test tests/wizard-pairs.test.cjs`

Expected: FAIL because the word-pair table shell does not exist yet.

- [ ] **Step 3: Replace the word-pair container with the table shell**

Replace the existing `#wordPairsContainer` div in `index.html` with:

```html
<div class="table-responsive word-pairs-table-wrap">
  <table class="table table-sm align-middle word-pairs-table mb-0">
    <thead>
      <tr>
        <th class="pair-number-column" scope="col">#</th>
        <th id="sourceWordHeader" scope="col"></th>
        <th id="targetWordHeader" scope="col"></th>
      </tr>
    </thead>
    <tbody id="wordPairsContainer"></tbody>
  </table>
</div>
```

- [ ] **Step 4: Render a numbered table row for each pair and update headers from selected language IDs**

In `app.js`, update `renderWizard()` to set `#sourceWordHeader` and `#targetWordHeader` from `getLanguageLabel(state.wizard.sourceLanguageId, 'Source')` and `getLanguageLabel(state.wizard.targetLanguageId, 'Target')`. Make `createWizardPairRow(index)` return a `<tr>` using this complete function:

```js
function createWizardPairRow(index) {
  const pair = state.wizard.pairs[index];
  const rowNumber = index + 1;
  const sourceLanguage = getLanguageLabel(state.wizard.sourceLanguageId, 'Source');
  const targetLanguage = getLanguageLabel(state.wizard.targetLanguageId, 'Target');
  const row = $(`
    <tr class="pair-row" data-row-index="${index}">
      <th scope="row">${rowNumber}</th>
      <td>
        <input class="form-control pair-source-input" data-row-index="${index}" aria-label="${escapeAttribute(`${sourceLanguage} ${rowNumber}`)}" value="${escapeAttribute(pair.sourceText)}" placeholder="Source word" />
      </td>
      <td>
        <input class="form-control pair-target-input" data-row-index="${index}" aria-label="${escapeAttribute(`${targetLanguage} ${rowNumber}`)}" value="${escapeAttribute(pair.targetText)}" placeholder="Translation" />
      </td>
    </tr>
  `);

  row.find('.pair-source-input').on('input', function () {
    updateWizardPair(index, 'sourceText', $(this).val());
  });
  row.find('.pair-target-input').on('input', function () {
    updateWizardPair(index, 'targetText', $(this).val());
  });

  return row;
}
```

Set each input's `aria-label` to its language name followed by its row number. Keep the existing `input` handlers and `updateWizardPair` behavior; after `completePairAndAppendBlank` returns true, append only the new row to the tbody. Do not call `renderWizard()` from an input handler.

- [ ] **Step 5: Add compact table styles**

Add:

```css
.word-pairs-table-wrap {
  max-height: 55vh;
  overflow: auto;
}

.word-pairs-table {
  min-width: 520px;
}

.word-pairs-table th,
.word-pairs-table td {
  padding: 0.35rem 0.5rem;
}

.word-pairs-table .pair-number-column,
.word-pairs-table tbody th {
  width: 3rem;
  text-align: center;
  color: var(--muted);
  font-weight: 600;
}
```

- [ ] **Step 6: Run the table and row-append tests**

Run: `node --test tests/wizard-pairs.test.cjs`

Expected: table shell, append-on-completion, and incomplete-pair tests PASS.

### Task 3: Wire language defaults and block same-language saves

**Files:**
- Modify: `src/Quizmam.Api/wwwroot/app.js`
- Modify: `tests/wizard-pairs.test.cjs`

**Interfaces:**
- Consumes `getDefaultLanguageIds(languages)` and `hasDistinctLanguageIds(sourceLanguageId, targetLanguageId)` from Task 1.
- New collection initialization uses default IDs; edit initialization retains API-provided IDs.
- Save validation displays `Source and target languages must be different.` and returns before making an API request when IDs are equal or missing.

- [ ] **Step 1: Use language defaults only for new collections**

In `openNewWizard()`, set:

```js
const languageDefaults = getDefaultLanguageIds(state.languages);
state.wizard = {
  editingCollection: null,
  step: 0,
  name: '',
  sourceLanguageId: languageDefaults.sourceLanguageId,
  targetLanguageId: languageDefaults.targetLanguageId,
  pairs: [{ sourceText: '', targetText: '' }],
};
```

In `renderLanguageSelects()`, preserve nonempty IDs already in `state.wizard`; use `getDefaultLanguageIds(state.languages)` only when an ID is uninitialized. Leave `openEditWizard()` initialized from `details.sourceLanguageId` and `details.targetLanguageId`.

When either language selector changes, update its state ID and refresh both table headers without rebuilding word-pair rows.

- [ ] **Step 2: Reject invalid source/target language selections before saving**

At the beginning of `saveCollection()`, before collection-name or pair-count checks, add:

```js
if (!hasDistinctLanguageIds(state.wizard.sourceLanguageId, state.wizard.targetLanguageId)) {
  showError('Source and target languages must be different.');
  return;
}
```

This prevents the API call and leaves the wizard open for correction.

- [ ] **Step 3: Run focused tests, syntax checks, and whitespace validation**

Run:

```powershell
node --test tests/wizard-pairs.test.cjs tests/manual-practice-display.test.cjs
node --check src/Quizmam.Api/wwwroot/app.js
node --check src/Quizmam.Api/wwwroot/wizard-pairs.js
git diff --check
```

Expected: tests pass, syntax checks exit 0, and `git diff --check` reports no whitespace errors. Do not launch the app as part of verification.

## Self-review

- Spec coverage: compact three-column table and headers are Task 2; single-row append and focus preservation are Task 2; Polish/other-language defaults, edit preservation, and invalid same-language save prevention are Task 3; focused tests and constraints appear in all relevant tasks.
- Placeholder scan: no TBD/TODO or deferred implementation steps are present.
- Interface consistency: helpers are named `getDefaultLanguageIds`, `hasDistinctLanguageIds`, and `completePairAndAppendBlank` consistently in tests, implementation steps, and app integration.
- Commit instructions are intentionally omitted: the user requires explicit confirmation before any commit.
