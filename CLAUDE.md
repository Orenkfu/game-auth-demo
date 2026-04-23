# game-auth

Semi-monorepo: game authentication platform with an event analytics pipeline.

## What's here

| Service | Language | Port | Purpose |
|---------|----------|------|---------|
| `backend/` | NestJS 11 / TypeScript | 3001 | OAuth, sessions, user profiles |
| `frontend/` | Electron 41 + React 19 | 3000 | Desktop OAuth flow, profile UI |
| `ingestor/` | Go 1.24 | 3002 | HTTP → Redis event queue producer |
| `consumer/` | Go 1.26 | 3003 | Redis → DuckDB consumer + query API |

Shared infrastructure: **Redis** (session store + event queue `events:queue`), **PostgreSQL** (auth/profile data via Prisma).

## Architecture

Read [ARCHITECTURE.md](ARCHITECTURE.md) before touching auth logic. Key concepts:
- Identity (auth) vs UserProfile (app data) are intentionally separate models
- 3-rule OAuth provider linking — Rule 3 throws `LinkRequiredException`
- Storage layer is env-swappable: `USE_REDIS` / `USE_POSTGRES` toggle implementations with no code changes

## Running the project

**Full stack (recommended):**
```bash
docker compose up --build   # backend, redis, postgres, ingestor, consumer
cd frontend && npm install && npm start
```

**Backend only (no Docker):**
```bash
cd backend
# .env: USE_POSTGRES=false, USE_REDIS=false
npm install && npm run start:dev
```

## Testing

```bash
# Backend unit tests + coverage
cd backend && npm test

# Backend E2E (auto-starts Docker Redis)
cd backend && npm run test:e2e:docker
```

E2E tests cover the 3 OAuth linking rules and Redis session lifecycle. See [backend/README.md](backend/README.md) for full test strategy.

## Key commands

```bash
# Backend
npm run db:migrate     # Apply Prisma migrations
npm run db:studio      # Open Prisma Studio
npm run lint           # ESLint fix
npm run format         # Prettier

# Frontend
npm start              # Electron Forge dev server
npm run make           # Build distributable

# Go services — built via Docker; local:
go build -o ingestor .                    # ingestor/
CGO_ENABLED=1 go build -o consumer .     # consumer/ (DuckDB needs CGO)
```

## Service communication

```
Frontend ──HTTP──► Backend (3001)
Frontend ──HTTP──► Ingestor (3002) POST /ingest {events[]}
Ingestor ──RPUSH──► Redis events:queue
Consumer ──BRPOP──► Redis events:queue ──► DuckDB
Consumer (3003) GET /query?sql=...   (arbitrary DuckDB SQL)
```

## Environment

Backend config lives in `backend/.env` (copy from `backend/.env.example`). Docker Compose injects env vars for Go services — see `docker-compose.yml` for `REDIS_ADDR` and `DUCKDB_PATH`.

OAuth credentials (Discord, Riot) are required for auth flows; see `backend/.env.example` for required keys.
