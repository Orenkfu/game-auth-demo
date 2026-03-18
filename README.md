# Outplayed Auth Demo

A gaming authentication system demonstrating OAuth integration with Discord and Riot Games, session management, Postgres persistence, and clean architecture patterns — runnable in full via Docker Compose.

## Project Structure

```
game-auth/
├── backend/          # NestJS API (TypeScript)
├── frontend/         # Electron + React desktop app
├── docker-compose.yml
└── ARCHITECTURE.md   # Design decisions & implementation details
```

## Tech Stack

| Layer | Technology |
|-------|------------|
| Backend | NestJS 11, TypeScript |
| Database | PostgreSQL 16 + Prisma 6 ORM |
| Cache / Sessions | Redis (ioredis) |
| Frontend | Electron 41, React 19, TypeScript |
| Auth | OAuth 2.0 — Discord (working), Riot Games (code ready, needs RSO credentials) |
| Infrastructure | Docker Compose |

## Quick Start

### Option A — Docker Compose (recommended)

Runs backend + Redis + Postgres together:

```bash
docker compose up --build
```

| Service | URL |
|---------|-----|
| Backend API | http://localhost:3001 |
| Redis | localhost:6379 |
| Postgres | localhost:5432 |

Then start the Electron frontend separately:

```bash
cd frontend
npm install
npm start
```

### Option B — Local backend (no Postgres)

Runs with in-memory storage (no Docker required):

```bash
cd backend
npm install
# Leave USE_POSTGRES=false and USE_REDIS=false in .env
npm run start:dev
```

```bash
cd frontend
npm install
npm start
```

### Environment Variables

`backend/.env`:

```env
# Discord OAuth (required)
DISCORD_CLIENT_ID=your_client_id
DISCORD_CLIENT_SECRET=your_client_secret
DISCORD_REDIRECT_URI=http://localhost:3001/oauth/discord/callback

# Riot OAuth (optional — requires RSO approval)
RIOT_CLIENT_ID=your_riot_client_id
RIOT_CLIENT_SECRET=your_riot_client_secret
RIOT_REDIRECT_URI=http://localhost:3001/oauth/riot/callback

# Redis (USE_REDIS=false falls back to in-memory)
USE_REDIS=true
REDIS_URL=redis://localhost:6379

# Postgres (USE_POSTGRES=false falls back to in-memory)
USE_POSTGRES=false
DATABASE_URL=postgresql://gameauth:gameauth@localhost:5432/gameauth

# Session
SESSION_TTL_SECONDS=86400
```

## Features

- **OAuth Authentication** — Discord login with email/identify scopes
- **Identity/Profile Separation** — Auth concerns isolated from user data
- **3 Auth Rules** — Returning user, new user, and email collision (requires explicit link)
- **Session Management** — Redis-backed sliding window sessions with `SessionGuard`
- **Postgres Persistence** — Prisma ORM, switchable per environment
- **In-memory Fallback** — Full local dev without Docker
- **Global Validation** — `ValidationPipe` with whitelist on all endpoints
- **HTTP Logging** — Request/response logging middleware
- **Desktop OAuth Flow** — Electron popup window with IPC result handling
- **E2E Test Suite** — 7 tests covering all auth rules + Redis session storage

## Database

```bash
cd backend

# Run migrations (creates tables)
npm run db:migrate

# Open Prisma Studio (UI to browse data)
npm run db:studio
```

## Testing

```bash
cd backend

# Unit tests with coverage
npm test

# E2E tests (requires Redis)
npm run test:e2e

# E2E with Docker Redis auto-started
npm run test:e2e:docker
```

## Documentation

- [Architecture & Design Decisions](./ARCHITECTURE.md)
- [Backend README](./backend/README.md)
- [Frontend README](./frontend/README.md)

## License

UNLICENSED - Private project
