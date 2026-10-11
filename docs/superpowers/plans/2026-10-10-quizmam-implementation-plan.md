# Quizmam Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: use `subagent-driven-development` for task-by-task execution and review gates.

**Date:** 2026-10-11  
**Goal:** Implement Quizmam as a single ASP.NET Core 10 project with SQLite backend and React + MUI frontend, while preserving the approved business logic.

## 1. Target Architecture

Single project layout:
- **ASP.NET Core 10 host + FastEndpoints**
- **SQLite** via EF Core
- **Vertical Slice Architecture** (feature-first organization)
- **React + TypeScript + MUI frontend** served by the same host from `wwwroot`

Recommended structure:
- `quizmam/src/Quizmam.Api/` (host + API + data + services)
- `quizmam/src/Quizmam.Api/ClientApp/` (React app source)
- `quizmam/src/Quizmam.Api/wwwroot/` (built frontend assets)
- `quizmam/tests/` (backend and frontend tests)

Backend structure convention (mandatory):
- `Features/<FeatureName>/<UseCase>/` per vertical slice
- each slice contains request/response contracts, endpoint, validator, and business logic
- shared infrastructure only for cross-cutting concerns (db context, common policies, utilities)

## 2. Global Constraints

- Name-based onboarding only; no password authentication.
- User name uniqueness is global.
- Collection name uniqueness is per owner.
- Each collection has fixed source/target language.
- Minimum two complete word pairs to create collection.
- Seed languages: `Polski`, `Angielski`.
- Matching rules: case-insensitive, trim spaces, diacritics-sensitive.
- Typo classification: Levenshtein distance `1`; otherwise wrong.
- Collection delete cascades dependent test/stat records.
- Problematic words are user-scoped with 10/20/30 batch sizes.
- MVP excludes social/gamification/import/export/auth hardening.
- App must run as a Docker container on a local server/LAN.
- SQLite file must be persisted via Docker volume mount.
- Container image must expose the app port and bind for LAN access.

---

## 3. Execution Tasks

### Task 1 — Scaffold host and frontend shell

**Outcome:** runnable single host project with API and React/MUI app wiring.

- [ ] Create ASP.NET Core 10 project (`Quizmam.Api`) and wire FastEndpoints as the API layer.
- [ ] Add FastEndpoints and configure endpoint discovery/pipeline.
- [ ] Add SPA static-files hosting and fallback to `index.html`.
- [ ] Initialize `ClientApp` React + TypeScript app and install MUI (`@mui/material`, `@emotion/react`, `@emotion/styled`).
- [ ] Add build pipeline to publish frontend into `wwwroot` (script or MSBuild target).
- [ ] Add base health endpoint (`GET /api/health`).
- [ ] Validate: app boots and serves frontend from host.
- [ ] Add `Dockerfile` for production-style container build/run.

### Task 2 — Data model, migrations, and seed

**Outcome:** SQLite schema reflects all business entities with constraints.

- [ ] Add EF Core + SQLite packages.
- [ ] Implement entities: User, Language, Collection, WordPair, TestSession, TestAnswer, WordMistakeStat.
- [ ] Configure keys, unique indexes, relations, cascade rules.
- [ ] Add initial migration and database update flow.
- [ ] Implement seed for `Polski` and `Angielski`.
- [ ] Validate with integration test for schema + seed.

### Task 3 — User onboarding and identity persistence

**Outcome:** user can enter/select name, be recognized on reload, and switch identity.

- [ ] API endpoints:
  - `POST /api/users/select-or-create`
  - `GET /api/users`
  - `POST /api/users/switch`
  - `POST /api/users/logout` (clears current identity only)
- [ ] Persist current user in cookie/local session token (no password auth).
- [ ] Handle duplicate/create race safely (idempotent select-or-create behavior).
- [ ] Build MUI onboarding screen with editable dropdown (Autocomplete freeSolo).
- [ ] Gate app entry until a current user is resolved.

### Task 4 — Collection CRUD + wizard (MUI)

**Outcome:** owners can fully manage collections with validated 2-step creation.

- [ ] API endpoints:
  - `GET /api/collections?scope=my|all`
  - `POST /api/collections`
  - `PUT /api/collections/{id}`
  - `DELETE /api/collections/{id}`
  - `GET /api/languages`
- [ ] Enforce owner-only edit/delete.
- [ ] Build 2-step MUI wizard:
  - Step 1 metadata (name + source/target language)
  - Step 2 editable row table with auto-growing rows
- [ ] Validate minimum 2 complete pairs.
- [ ] Add my/all collection toggle in main view.

### Task 5 — Learning modes

**Outcome:** manual and flashcard learning function per selected collection.

- [ ] API endpoint for loading practice words by collection and direction.
- [ ] Manual mode UI with answer validation feedback.
- [ ] Flashcard mode UI with card flip and direction switch.
- [ ] Reuse shared normalization/matching logic across manual/test modes.

### Task 6 — Test mode + session persistence

**Outcome:** full-collection tests are executable and persisted.

- [ ] API endpoints:
  - `POST /api/tests/start`
  - `POST /api/tests/{sessionId}/submit`
  - `GET /api/tests/collections/{collectionId}/stats`
- [ ] Classify answers into correct/typo/wrong with deterministic service.
- [ ] Persist session summary + per-answer records atomically.
- [ ] Show immediate summary in UI.

### Task 7 — Mistake statistics and problematic practice

**Outcome:** user can practice their top problematic words (10/20/30).

- [ ] Update mistake counters during manual/test wrong answers.
- [ ] Implement ranking query with formula:
  - `score = wrong_count * 2 + typo_count`
  - tie-break by most recent mistake
- [ ] API endpoint: `GET /api/practice/problematic?limit=10|20|30`
- [ ] Build dedicated problematic practice screen supporting manual/cards.

### Task 8 — Quality, docs, and release readiness

**Outcome:** stable MVP with clear run instructions and test coverage.

- [ ] Backend tests: unit tests for classification/ranking/validation services.
- [ ] API integration tests: onboarding, collection CRUD, test submission, stats.
- [ ] Frontend tests: onboarding gate, wizard behavior, learning/test flows.
- [ ] Update root README with:
  - prerequisites
  - local run commands
  - Docker build/run commands for LAN hosting
  - migration/seed commands
  - frontend build/publish flow
- [ ] Provide `docker-compose.yml` example for local server with:
  - published LAN port mapping
  - persistent SQLite volume mapping
  - restart policy for local service resilience
- [ ] Add sample `.env` / `appsettings.Development.json` guidance.

---

## 4. Vertical Slice Boundaries

Backend slices (examples):
- `Features/Users/SelectOrCreateUser`
- `Features/Users/SwitchCurrentUser`
- `Features/Collections/CreateCollection`
- `Features/Collections/UpdateCollection`
- `Features/Learning/EvaluateAnswer`
- `Features/Tests/SubmitTestSession`
- `Features/Practice/GetProblematicWords`

Each slice owns:
- endpoint (FastEndpoints `Endpoint<TRequest, TResponse>`)
- request/response DTOs
- validator
- use-case logic and data access for that action

Shared cross-cutting only:
- `Infrastructure/` (DbContext, migrations, seed)
- `Common/` (normalization helpers, shared errors, constants)

Frontend modules:
- `auth/` (onboarding gate + current user context)
- `collections/` (list, filters, wizard, details)
- `practice/` (manual/cards/problematic)
- `tests/` (test-runner and results)
- `shared/` (API client, error components, MUI theme/layout)

## 5. API Error Contract (Consistent)

All error responses use:

```json
{
  "code": "VALIDATION_ERROR",
  "message": "Collection name is required",
  "details": {
    "field": "name"
  }
}
```

Standard codes:
- `VALIDATION_ERROR`
- `NOT_FOUND`
- `FORBIDDEN`
- `CONFLICT`
- `UNAUTHORIZED_CONTEXT`
- `INTERNAL_ERROR`

## 6. Verification Strategy

Minimal required checkpoints:
1. Host serves frontend and API in one process.
2. New user can be created/selected and persisted across reload.
3. Collection wizard enforces business validation.
4. Manual/card/test flows operate with configured direction.
5. Test submission updates session and per-word mistake stats.
6. Problematic 10/20/30 lists match ranking rules.

## 7. Definition of Done

The implementation is done when:
- all tasks above are completed,
- required tests pass,
- app is runnable locally with documented commands,
- business behavior matches the approved product spec without scope creep.
