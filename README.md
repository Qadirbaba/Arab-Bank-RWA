# EWRA Platform – Entity-Wide Risk Assessment

A working platform for group-wide financial-crime and enterprise risk assessment, built from the **EWRA Platform Scope Document v1.0**. Country Compliance Officers in every group entity rate inherent risk, record control tests and upload evidence. The **Group Chief Compliance Officer** at Head Office reviews every submission, accepts or rejects evidence, and approves, approves with conditions, or returns it.

> **Sample data.** The platform starts with illustrative data for 30 entities so it can be demonstrated end to end. Entity names, tiers, controls, thresholds and appetite levels are proposed defaults to be confirmed with Group Compliance and Group Risk.

## What it does

| Area | Capability |
| --- | --- |
| Taxonomy | 20 Level-1 risks in three domains: financial crime, regulatory and conduct, enterprise (§7) |
| Inherent risk | Rating 1–5 per risk per entity with rationale, entered by the Country CO; Shariah risk applies to Islamic entities only (§8) |
| Controls | 43-control group library mapped to risks with contribution weights; banks-only and Islamic-only applicability (§10.1) |
| Control testing | Design rating, test date, result, sample, exceptions, independent tester; next-due date from the tier and key-control frequency table (§11.1) |
| Evidence | Upload (PDF, Office, images, e-mail, ZIP; max 25 MB), SHA-256 fingerprint, Head Office accept or reject, logged downloads (§11.6) |
| Residual risk | A control counts only when its test is in date and HO accepted the evidence; weighted control environment, key-control cap, residual matrix (§10.2–10.4) |
| Risk appetite | Within / Amber / Red against the maximum acceptable residual rating per risk (§12) |
| Workflow | Draft → Submitted (with attestation) → Approved / Approved with conditions / Returned; comment thread; reminders (§14) |
| Access control | Role-based, row-level by entity: Country COs see only their entity; HO sees all 30; Internal Audit read-only (§13) |
| Oversight | Group overview, submission queue, residual heat map, configurable appetite and residual matrix, full audit trail |

## Run it

### Docker (recommended – on-premises)

```bash
docker compose up -d --build
# open http://localhost:8080
```

Data (SQLite database and evidence files) is kept in the `ewra-data` volume. Set `EWRA_SEED_PASSWORD` in `docker-compose.yml` **before the first start**.

### Node.js 22.13 or later

```bash
npm install
npm start          # http://localhost:8080
npm test           # engine and workflow unit tests
```

### Sign-in accounts (seeded on first start)

| Username | Role |
| --- | --- |
| `cco` | Group Chief Compliance Officer – HO Administrator: reviews, decides, configures |
| `auditor` | Internal Audit – read-only access to everything |
| `co.<entity>` e.g. `co.ae`, `co.fr`, `co.jo-ho` | Country Compliance Officer for that entity only |

All accounts start with the password in `EWRA_SEED_PASSWORD` (default `Ewra@2026`). Users are prompted to change it under **My account**.

### Browser-only demo

`npm run build:demo` writes a static copy to `_site/` that runs entirely in the browser: same screens and calculations, sample data, a role picker instead of passwords, and changes saved only in that browser. The GitHub Pages workflow publishes this build. It is for demonstrations only.

## Configuration

| Variable | Default | Purpose |
| --- | --- | --- |
| `PORT` | `8080` | HTTP port |
| `EWRA_DATA_DIR` | `./data` | Database, evidence files and session secret |
| `EWRA_SEED_PASSWORD` | `Ewra@2026` | Initial password for seeded accounts |
| `EWRA_SESSION_SECRET` | random, stored in data dir | Key that signs session cookies |
| `EWRA_COOKIE_SECURE` | `false` | Set `true` when served over HTTPS |

Branding (product name, subtitle, logo file) is set in `public/config.js`. Place the official logo in `public/assets/` and set `logo`.

## Architecture

```
public/      Web UI (vanilla JS, no build step)     js/app.js screens · js/api.js server or demo adapter
shared/      Used by server, browser and tests      data.js reference data · engine.js residual engine
                                                    workflow.js roles and rules · seed.js sample data
server/      Node.js + Express API                  index.js routes, sessions, uploads · db.js SQLite schema
test/        node:test unit tests
```

The calculation engine and the access rules live in `shared/`, so the server, the demo and the tests apply the same logic.

## Security in this version

- Passwords hashed with bcrypt; signed, HTTP-only, SameSite=Strict session cookies with an 8-hour expiry
- Lock-out for 15 minutes after 5 failed sign-ins; failed sign-ins are logged
- Every API route checks the role and the entity scope on the server
- Content-Security-Policy, X-Frame-Options and no-sniff headers; no third-party scripts; no internet access needed
- Evidence stored outside the web root under random names, with a SHA-256 hash; type and size limits

## Production roadmap (from the Scope Document)

- Single sign-on with Active Directory / ADFS and MFA; AD group to role mapping (§13.5)
- HTTPS through the bank's reverse proxy; PostgreSQL / SQL Server / Oracle in place of SQLite; replicated DR (§17–18)
- Anti-malware (ICAP) scanning of uploads, SIEM forwarding, country-local evidence vaults (§11.6, §17.3)
- Factor-based inherent scoring module with source-system feeds, KRIs and breach escalation (§8, §12, §19)
- Arabic interface (right-to-left), Board reporting packs and exports (§16, §17.5)

## Methodology workbooks

`docs/` holds the Excel calculators the platform's rules come from: the inherent risk calculator (factor model and likelihood × impact) and the inherent + residual calculator (controls, testing, residual matrix, appetite). Both use illustrative sample data.
