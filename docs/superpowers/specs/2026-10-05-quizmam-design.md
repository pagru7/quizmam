# Quizmam Product Design (Business Spec)

**Date:** 2026-10-11  
**Scope:** Business requirements and product behavior only (technology-agnostic)

## 1. Objective

Build a simple Quizlet-like language learning app where users can:
- identify themselves by name (no password/auth flow),
- create and manage word collections,
- practice with multiple learning modes,
- run tests and review performance statistics,
- focus practice on words they struggle with most.

## 2. Product Principles

- **No authentication complexity:** name-based identity only.
- **Fast start:** user enters/selects name and can begin immediately.
- **Learning-first UX:** actions are optimized for creating and practicing vocabulary.
- **Transparent feedback:** users can see collection-level and word-level progress.

## 3. User Identity and Entry Flow

1. On app open, user must provide a name before entering the main app.
2. Name input is an editable dropdown:
   - user can type a new name,
   - or select an existing saved name.
3. Name uniqueness is global across the app database.
4. No passwords, OTP, or secure auth session is required.
5. Once selected, a user should be recognized on next app open and can switch to another name when needed.

## 4. Main App Structure

1. **Home view:** list of collections (default to user-owned collections).
2. **Collection entry:** clicking a collection opens a dialog with:
   - manual translation mode,
   - flashcard mode,
   - test mode.
3. **Problematic practice entry:** dedicated entrypoint to practice top problematic words.

## 5. Collection Ownership and Access Rules

- Each collection has one owner (the creating user).
- Collection names are unique **per owner** (not globally).
- Users can CRUD only their own collections.
- Users can practice/test visible collections.

## 6. Collection Creation Wizard

### Step 1: Metadata
- Enter collection name (required, unique for current owner).
- Select source language and target language (required).

### Step 2: Word Pairs
- Editable table with two columns (source/target).
- Column headers show selected languages.
- Auto-growth rule: when current row is fully filled, a new empty row appears below.
- Minimum requirement: at least **2 complete pairs** to finish.

### Finalization
- User clicks **Done** and confirms.
- Collection is created only when all validation passes.

## 7. Languages

- Dedicated `languages` table exists.
- Seeded defaults:
  - **Polski**
  - **Angielski**
- Language catalog is extensible.
- Each collection has one fixed source-target language pair.

## 8. Learning Modes

### 8.1 Manual Translation
- User sees prompt word and types translation.
- Matching:
  - case-insensitive,
  - trims leading/trailing spaces,
  - diacritics must match.

### 8.2 Flashcards
- User clicks card to flip and reveal translation.
- Direction switch:
  - source → target
  - target → source

### 8.3 Test Mode
- Uses all words from selected collection.
- Each answer is classified:
  - `correct`,
  - `typo` (exactly one-letter edit distance),
  - `wrong` (all other incorrect answers).
- Test session result is persisted.

## 9. Statistics

### 9.1 Collection-Level
For each collection, show:
- number of tests,
- score history / aggregated score,
- counts of correct / typo / wrong.

### 9.2 Per-Translation Mistake Tracking
For each user + word pair, persist:
- typo count,
- wrong count,
- last mistake timestamp.

### 9.3 Problematic Ranking
- Scope: current user only.
- Source: all collections practiced by that user.
- Batch sizes: **10**, **20**, **30** words.
- Ranking formula: `score = (wrong_count * 2) + (typo_count * 1)`.
- Tie-breaker: most recent mistake first.

## 10. Conceptual Data Model

- `users`: id, unique name, created_at
- `languages`: id, unique name
- `collections`: id, owner_user_id, name (unique per owner), source_language_id, target_language_id, timestamps
- `word_pairs`: id, collection_id, source_text, target_text, sort_order
- `test_sessions`: id, user_id, collection_id, started_at, finished_at, totals and score
- `test_answers`: id, session_id, word_pair_id, direction, expected_text, entered_text, outcome
- `word_mistake_stats`: user_id + word_pair_id, typo_count, wrong_count, updated_at

## 11. Validation and Error Handling

User-facing validation must cover:
- empty/invalid name,
- duplicate name creation attempts,
- duplicate collection name for same owner,
- fewer than 2 complete word pairs,
- invalid/missing language selection,
- empty answer submissions in practice/test.

Data integrity rules:
- enforce uniqueness constraints,
- enforce referential integrity,
- cascade-delete dependent records when collection is deleted,
- persist test session, answers, and mistake-stat updates atomically.

## 12. Out of Scope (MVP)

- Password-based auth/authorization
- Social/community interactions (likes/comments/follows)
- Gamification (streaks/badges/leaderboards)
- Import/export and external dictionary integrations

## 13. Deployment and Runtime Constraints

- Application is deployed as a Docker container on a local server in a local network.
- API host and frontend are served by the same containerized ASP.NET application.
- SQLite data must persist across container restarts (mounted volume).
- Runtime configuration must support LAN access (binding to non-localhost interface).

## 14. Success Criteria

1. User can enter/select a globally unique name and reuse it later.
2. User can create, edit, and delete owned collections with at least 2 pairs.
3. Manual and flashcard learning modes work with direction switching.
4. Test mode evaluates all collection words and persists outcomes.
5. Collection-level statistics are visible.
6. Problematic-word practice works for top 10/20/30 words based on stored mistakes.
7. Application can be started as a Docker container in local network with persistent SQLite storage.
