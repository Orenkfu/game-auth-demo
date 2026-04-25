# Outplayed Backend

Outplayed's dedicated backend. Self-managed authentication, user profiles, video upload, and (scaffolded) event pipeline — decoupled from Overwolf shared platform infrastructure.

- **Architecture** — [docs/architecture.md](docs/architecture.md)
- **Decision register (ADRs)** — [docs/decisions.md](docs/decisions.md)
- **Platform strategy & auth migration** — [docs/platform-strategy.md](docs/platform-strategy.md)
- **Production roadmap** — [docs/production-roadmap.md](docs/production-roadmap.md)
- **Business case & costs** — [docs/business-case.md](docs/business-case.md)
- **Feature specs** — [docs/features.md](docs/features.md)
- **Open questions & deferred decisions** — [docs/open-questions.md](docs/open-questions.md)
- **Operations runbooks** — [docs/operations.md](docs/operations.md)

## Quick start

### Docker Compose (full stack)

```bash
docker compose up --build          # backend, redis, postgres, minio, ingestor, consumer
cd frontend && npm install && npm start
```

| Service | URL |
|---------|-----|
| Backend API | http://localhost:3001 |
| Frontend (Electron) | http://localhost:3000 |
| Redis | localhost:6379 |
| Postgres | localhost:5432 |

### Backend only (no Docker)

```bash
cd backend
# .env: USE_POSTGRES=false, USE_REDIS=false
npm install && npm run start:dev
```

## Environment

Copy `backend/.env.example` → `backend/.env`. OAuth credentials (Discord required; Riot optional, pending RSO) and AWS/MinIO settings for video upload. See [backend/README.md](backend/README.md).

## Testing

```bash
cd backend
npm test                    # unit tests + coverage
npm run test:e2e:docker     # e2e (auto-starts Docker Redis)
```

## Repository layout

| Path | What |
|------|------|
| [backend/](backend/) | NestJS 11 API (port 3001) — OAuth, sessions, profiles, video upload |
| [frontend/](frontend/) | Electron + React desktop client (port 3000) |
| [ingestor/](ingestor/) | Go HTTP → Redis event producer (port 3002) — scaffolding for the future Kafka pipeline |
| [consumer/](consumer/) | Go Redis → DuckDB consumer (port 3003) — scaffolding for the future Snowflake pipeline |
| [infra/](infra/) | Terraform + Terragrunt AWS infra |
| [docs/](docs/) | Architecture, decisions, roadmap |

## License

UNLICENSED — private project.
