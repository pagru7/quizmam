# Compact Collection Word-Pair Editor

## Goal

Make the collection wizard's word-pair step more compact and easier to scan while reliably choosing distinct default source and target languages for new collections.

## Approved behavior

- Display word pairs in a compact three-column table: row number, source word, and target translation.
- Display the selected source and target language names once in the column headers, rather than repeating language names beside each input.
- Start the word-pair step with one blank pair row.
- Append one blank row when the last row has nonblank source and target values. Append the row without rebuilding existing rows so typing focus remains in place.
- For new collections, select the language named `Polski` as source when available.
- Select as target the first available language whose ID differs from the selected source language ID. If none exists, temporarily select the source language as the target.
- When editing an existing collection, preserve its saved source and target language selections.
- If only one language is available, source and target default to that same language. Show a clear validation error and prevent saving until the source and target languages differ.

## Scope and files

- `src/Quizmam.Api/wwwroot/index.html`: provide table structure or a table container in the existing word-pair wizard step.
- `src/Quizmam.Api/wwwroot/app.js`: set defaults for new collections, preserve edit selections, render compact rows and language headers, append a row without replacing existing inputs, and validate distinct languages before save.
- `src/Quizmam.Api/wwwroot/styles.css`: add only the compact table styling required for desktop and narrow screens.
- `tests/`: add focused tests for language default selection, same-language validation, and append-row behavior, following the existing Node test convention.

## Data flow

The wizard keeps source and target language IDs and word-pair values in its existing state. Rendering derives the table headers from the selected language IDs. Input events update only the corresponding state pair. Completing both fields in the final row appends a new empty row while preserving existing DOM nodes and focus.

New-collection initialization chooses `Polski` by name when present, then chooses a different language ID for the target. If Polish is unavailable, use the first available source language and select the first different language for target. If no different target exists, select the source language so the invalid same-language selection is explicit. Edit initialization uses the saved language IDs. Save validation rejects equal source and target IDs with a user-visible error before sending the API request.

## Error handling

When there are fewer than two distinct available languages, do not silently save a collection with identical source and target languages. Display a clear validation message and keep the wizard open so the user can correct the selection when possible.

## Verification

- Automated tests verify defaults with Polish present, fallback when Polish is absent, and inability to save when source and target IDs match.
- Automated tests verify completing the last pair appends exactly one blank row and does not append while the pair is incomplete.
- Run the focused Node tests, JavaScript syntax checks, and `git diff --check`.
- Do not start the app in the background and do not commit without explicit user confirmation.
