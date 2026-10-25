# EWRA Platform — agent guide (shared by Claude, Gemini, Lovable, Codex)

Entity-Wide Risk Assessment for Arab Bank Group Compliance. Live: https://arabbank.siraajschool.com/
This file is the single source of project context. Read it instead of exploring the repo.

## Token rules (follow strictly)
- Do NOT open `docs/*.xlsx` (1.3 MB, methodology source only) or `package-lock.json`. Ask the user if a workbook detail is needed.
- Do NOT scan the whole repo. Use the map below, then `grep -n` to jump to the exact function and read only that range.
- Edit in place with small diffs; never rewrite whole files. Do not reformat untouched code.
- No new dependencies or frameworks without asking. Stack is intentionally tiny (express, multer, bcryptjs, node:sqlite).
- Keep replies short: what changed, files touched, test result. No recaps.

## Stack
Node >= 22.13, ESM, Express API, built-in SQLite. Frontend is vanilla JS with **no build step** (not React, not Vite, not Tailwind).

## Map (where things live)
| File | Contents |
| --- | --- |
| `shared/data.js` | Reference data: `RISKS` (20 L1 risks), `ENTITIES` (30), `CONTROLS` (43), `DEFAULT_CONFIG`, labels |
| `shared/engine.js` | Residual engine: `evaluateTest`, `controlEnvironment`, `appetiteStatus`, `assessEntity` |
| `shared/workflow.js` | Roles + permissions: `ROLES`, `canView/canEdit/canDecide/...`, `submitError`, `decisionError` |
| `shared/seed.js` | `buildSeed()` sample data |
| `server/index.js` | Routes: `/api/login logout me password state config`, `/api/entities/:code/{ratings,tests,evidence,submit,comments,review,decision,remind}`, `/api/evidence/:id` |
| `server/db.js` | SQLite schema and queries |
| `public/js/app.js` | All screens: `overview queue heat entityView risksTab controlsTab commentsTab actionPanel settings auditView account` |
| `public/js/api.js` | `createApi()` → server API or in-browser demo adapter (`window.EWRA_MODE`) |
| `public/config.js` | Branding + mode |
| `test/engine.test.js` | node:test unit tests |

`shared/` is used by server, browser demo and tests: change business rules there, once.

## Commands
- `npm test` — run after any change to `shared/` or `server/`
- `npm start` — http://localhost:8080 (seed password `Ewra@2026`, users `cco`, `auditor`, `co.<entity>`)
- `npm run build:demo` — static demo into `_site/` (GitHub Pages)

## Domain rules to preserve
- Shariah risk `RC-04` applies to Islamic entities only.
- A control counts toward residual only if its test is in date AND Head Office accepted the evidence.
- Country COs see/edit only their own entity, and only in Draft or Returned. Internal Audit is read-only. CCO reviews, decides, configures.
- Every API route must check role and entity scope on the server.
