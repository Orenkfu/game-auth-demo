# Game Auth Backend

NestJS authentication API with Discord/Riot OAuth, Redis sessions, and Postgres persistence.

## Architecture

```
src/
├── main.ts                # Bootstrap — global ValidationPipe, port
├── app.module.ts          # Root module — LoggingMiddleware
├── config/                # discord.config.ts, riot.config.ts
├── modules/
│   ├── auth/              # Authentication module
│   │   ├── controllers/   # oauth.controller.ts
│   │   ├── services/      # identity, oauth, oauth-account, session, state-store
│   │   ├── providers/     # discord/, riot/ (PKCE)
│   │   ├── repositories/  # in-memory + Prisma implementations
│   │   ├── entities/      # Identity, OAuthAccount
│   │   └── exceptions/    # LinkRequiredException
│   └── users/             # User profile module
│       ├── dto/           # class-validator DTOs
│       ├── services/      # user-profile.service.ts
│       ├── repositories/  # in-memory + Prisma implementations
│       └── entities/      # UserProfile
└── shared/
    ├── constants/         # All magic strings and numbers
    ├── decorators/        # @CurrentSession()
    ├── guards/            # SessionGuard
    ├── middleware/        # LoggingMiddleware
    ├── interfaces/        # CacheStore
    └── services/          # InMemoryCache, InMemoryStore, RedisCache, PrismaService
```

## Modules

### Auth Module

**Services:**
- `IdentityService` — creates/finds auth identities
- `OAuthService` — orchestrates the 3-rule OAuth flow
- `OAuthAccountService` — manages linked OAuth accounts
- `SessionService` — creates/validates/revokes sessions with sliding TTL
- `StateStoreService` — OAuth state parameter with TTL (CSRF protection)

**Providers:**
- `DiscordProvider` — Discord OAuth 2.0 (authorize URL, code exchange, user info)
- `RiotProvider` — Riot Sign-On with PKCE (code complete, awaiting RSO credentials)

**Endpoints:**
```
GET  /oauth/discord           # Initiate Discord OAuth
GET  /oauth/discord/callback  # Handle Discord callback
GET  /oauth/discord/link      # Link Discord to existing session [SessionGuard]
GET  /oauth/riot              # Initiate Riot OAuth
GET  /oauth/riot/callback     # Handle Riot callback
GET  /oauth/riot/link         # Link Riot to existing session [SessionGuard]
GET  /oauth/session           # Validate current session token
POST /oauth/logout            # Revoke session
```

### Users Module

**Services:**
- `UserProfileService` — CRUD, unique username generation

**Entities:**
- `UserProfile` — username, displayName, avatarUrl, bio, gamerTag, preferredGames

### Shared Module

**Guards:**
- `SessionGuard` — validates `Authorization: Bearer <token>`, refreshes sliding TTL

**Decorators:**
- `@CurrentSession()` — injects the `Session` object from `req.session` (set by `SessionGuard`)

**Middleware:**
- `LoggingMiddleware` — logs `METHOD /path STATUS Xms` for every request

**Storage:**

| Env | SESSION_STORE | Repositories |
|-----|---------------|--------------|
| `USE_REDIS=false` | InMemoryCacheService | InMemory*Repository |
| `USE_REDIS=true` | RedisCache | — |
| `USE_POSTGRES=false` | — | InMemory*Repository |
| `USE_POSTGRES=true` | — | Prisma*Repository |

## Quick Reference

```bash
# Development (in-memory — no Docker required)
npm run start:dev

# Build
npm run build              # prisma generate + nest build

# Database (requires Postgres running)
npm run db:migrate         # Apply Prisma migrations
npm run db:studio          # Open Prisma Studio UI

# Testing
npm test                   # Unit tests with coverage
npm run test:watch         # Watch mode
npm run test:e2e           # E2E tests (requires Redis on localhost:6379)
npm run test:e2e:docker    # Auto-starts Redis via Docker, then runs E2E

# Code quality
npm run lint
npm run format
```

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `PORT` | Server port | `3001` |
| `USE_REDIS` | Use Redis for sessions | `false` |
| `REDIS_URL` | Redis connection URL | `redis://localhost:6379` |
| `USE_POSTGRES` | Use Postgres for persistence | `false` |
| `DATABASE_URL` | Postgres connection URL | — |
| `DISCORD_CLIENT_ID` | Discord app client ID | required |
| `DISCORD_CLIENT_SECRET` | Discord app secret | required |
| `DISCORD_REDIRECT_URI` | Discord OAuth callback URL | required |
| `RIOT_CLIENT_ID` | Riot RSO client ID | required if Riot enabled |
| `RIOT_CLIENT_SECRET` | Riot RSO secret | required if Riot enabled |
| `RIOT_REDIRECT_URI` | Riot OAuth callback URL | required if Riot enabled |
| `SESSION_TTL_SECONDS` | Session sliding window TTL | `86400` (24h) |

## Testing

Tests are co-located with source files (`*.spec.ts`) and E2E tests live in `test/`.

```bash
npm test   # runs Jest with coverage
```

**Unit test coverage** includes all services, repositories (in-memory + Prisma), providers (Discord + Riot), guards, decorators, middleware, DTOs, and the OAuth controller.

**E2E tests** (`test/auth-flow.e2e-spec.ts`) cover:
- Rule 1: Returning user login
- Rule 2: New user signup
- Rule 3: Email collision + explicit link
- Redis session storage (login → verify in Redis, logout → verify removed)

## Dependencies

### Runtime
- `@nestjs/common`, `@nestjs/core`, `@nestjs/config`
- `class-validator`, `class-transformer` — DTO validation
- `ioredis` — Redis client
- `prisma`, `@prisma/client` — ORM

### Development
- `jest`, `@nestjs/testing`, `supertest` — testing
- `typescript-eslint`, `prettier` — code quality
