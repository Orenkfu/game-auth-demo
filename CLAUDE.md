# game-auth

Outplayed's backend platform. Self-managed authentication, user profiles, video upload, and event analytics pipeline — decoupled from Overwolf shared infrastructure.

## Services

| Service | Language | Port | Purpose |
|---------|----------|------|---------|
| `backend/` | NestJS 11 / TypeScript | 3001 | OAuth, sessions, profiles, video upload |
| `frontend/` | Electron 41 + React 19 | 3000 | Desktop OAuth flow, profile UI |
| `ingestor/` | Go 1.24 | 3002 | HTTP → Redis event queue producer (scaffolding) |
| `consumer/` | Go 1.26 | 3003 | Redis → DuckDB consumer + query API (scaffolding) |

Shared infra: **Redis** (sessions + event queue), **PostgreSQL** (auth/profile via Prisma).

## Key docs

- **Architecture** — [docs/architecture.md](docs/architecture.md) — read before touching auth, sessions, or storage layer
- **Decision register** — [docs/decisions.md](docs/decisions.md) — all locked architectural decisions with rationale
- **Open questions** — [docs/open-questions.md](docs/open-questions.md) — pending decisions and deferred re-evaluations
- **Operations** — [docs/operations.md](docs/operations.md) — incident runbooks

## Running

```bash
# Full stack
docker compose up --build
cd frontend && npm install && npm start

# Backend only (no Docker)
cd backend
# .env: USE_POSTGRES=false, USE_REDIS=false
npm install && npm run start:dev
```

## Testing

```bash
cd backend && npm test                  # unit tests + coverage
cd backend && npm run test:e2e:docker   # E2E (auto-starts Docker Redis)
```

## Key commands

```bash
# Backend
npm run db:migrate     # Apply Prisma migrations
npm run lint           # ESLint fix
npm run format         # Prettier

# Go services (built via Docker; local builds)
go build -o ingestor .                   # ingestor/
CGO_ENABLED=1 go build -o consumer .    # consumer/ (DuckDB needs CGO)
```

---

## DOs

- **Read [docs/decisions.md](docs/decisions.md) before suggesting architectural changes.** Most platform-level choices (auth strategy, sessions, warehouse, streaming, observability) are locked with rationale. Check there first.
- **Keep Identity and UserProfile strictly separate.** Identity = auth concerns. UserProfile = app concerns. Never add app fields to Identity or auth fields to UserProfile. See [docs/architecture.md §2.1](docs/architecture.md#21-identity-vs-userprofile).
- **Add new env vars to `backend/src/shared/config/env.schema.ts`** with Zod validation. App startup fails fast on missing/malformed config by design.
- **Use `TokenEncryptionService` for any provider token storage.** Never write OAuth access/refresh tokens to the DB in plaintext. See D-019.
- **Apply `SessionGuard` to all authenticated routes.** Use `@UseGuards(SessionGuard)` and `@CurrentSession()` — never read the session manually from the request.
- **Run `npm test` after backend changes.** Tests cover the 3-rule OAuth linking logic; a regression there is a security bug.
- **Follow the existing repository pattern when adding new repos** — interface + two implementations (in-memory + Prisma), injected via DI token in the module. Toggled by `USE_POSTGRES`.

## DON'Ts

- **Don't modify the 3-rule OAuth linking logic** without reading [docs/architecture.md §2.2](docs/architecture.md#22-oauth-provider-linking--3-rule-model) and understanding the security implications of each rule. Rule 3 prevents account hijacking.
- **Don't propose JWT sessions.** Server-side Redis sessions are decided (D-006). The rationale is in decisions.md — instant revocation is the requirement.
- **Don't suggest GraphQL, switching the warehouse away from Snowflake, or ClickHouse.** These are closed decisions (D-002, D-011, D-016).
- **Don't remove the in-memory storage fallback** (`USE_POSTGRES=false`, `USE_REDIS=false`). It's required for local dev without Docker and for unit tests.
- **Don't add code comments that explain what the code does.** Only comment when the *why* is non-obvious — a hidden constraint, a security invariant, or a workaround for a specific bug.
- **Don't create new top-level docs.** Add to existing docs in `docs/` or extend this file. The doc set is intentionally small.
- **Don't hardcode environment-specific values in source.** All config flows through `ConfigService` / the Zod env schema.
