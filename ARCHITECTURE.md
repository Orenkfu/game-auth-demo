# Outplayed Auth Demo — Architecture & Design Decisions

## Overview

A gaming authentication system with OAuth integration (Discord, Riot Games), session management, Postgres persistence, and clean separation between auth and app-level user data.

**Tech Stack:**
- Backend: NestJS + TypeScript
- Database: PostgreSQL 16 + Prisma 6
- Cache / Sessions: Redis (ioredis)
- Frontend: Electron 41 + React 19 + TypeScript
- Infrastructure: Docker Compose

---

## Core Concepts

### Identity vs UserProfile Separation

Auth concerns are isolated from application data:

```
┌─────────────────────────────────────┐
│ Identity (Auth Module)              │
│ - id                                │
│ - email                             │
│ - emailVerified                     │
│ - passwordHash (future)             │
│ - status (active/suspended/deleted) │
│ - lastLoginAt                       │
└─────────────────────────────────────┘
           │
           │ 1:1
           ▼
┌─────────────────────────────────────┐
│ UserProfile (Users Module)          │
│ - id                                │
│ - identityId (FK)                   │
│ - username                          │
│ - displayName                       │
│ - avatarUrl                         │
│ - bio                               │
│ - gamerTag                          │
│ - preferredGames[]                  │
└─────────────────────────────────────┘
```

**Rationale:**
- Identity handles authentication (login, logout, password reset)
- UserProfile handles application data (profile, preferences)
- Clean module boundaries prevent auth logic from leaking into app features
- Enables future: account merging, multiple identity providers

### OAuth Accounts

OAuth providers link to Identity, not UserProfile:

```
┌─────────────────────────────────────┐
│ OAuthAccount                        │
│ - id                                │
│ - identityId (FK to Identity)       │
│ - provider (discord/riot)           │
│ - providerUserId                    │
│ - providerUsername                  │
│ - providerEmail                     │
│ - accessTokenEncrypted              │
│ - refreshTokenEncrypted             │
│ - tokenExpiresAt                    │
│ - scopes[]                          │
│ - metadata{}                        │
└─────────────────────────────────────┘
```

One Identity can have multiple OAuthAccounts (e.g., the same user linked to both Discord and Riot).

---

## OAuth Provider Linking Rules

When a user authenticates via OAuth, three rules apply in order:

### Rule 1: Provider Already Linked → Login

```
Discord user 123456 exists in OAuthAccounts
  → Find linked Identity
  → Update lastLoginAt
  → Create session
  → Return existing user
```

### Rule 2: No Match Found → Create New User

```
Discord user 123456 not found
Discord email not in any Identity
  → Create new Identity
  → Create new UserProfile
  → Create OAuthAccount linking them
  → Create session
  → Return new user (isNewUser: true)
```

### Rule 3: Email Collision → Require Explicit Link

```
Discord user 123456 not found
Discord email "user@example.com" EXISTS in Identity
  → Throw LinkRequiredException
  → User must login to existing account first
  → Then explicitly link Discord via GET /oauth/discord/link
```

**Rationale:** Prevents account hijacking — a bad actor can't take over an account just by having access to the same email on a different OAuth provider.

**Exception:** If the provider's email is unverified, a placeholder email (`{providerId}@discord.placeholder`) is used and Rule 2 applies.

---

## Session Management

### Decisions

| Aspect | Decision | Rationale |
|--------|----------|-----------|
| Storage | Redis (with InMemory fallback) | Shared state across restarts; in-memory for local dev |
| Strategy | Sessions over JWT | Instant revocation, simpler mental model |
| Expiration | Sliding window | Active users stay logged in; idle users expire |
| Default TTL | 24h (configurable via `SESSION_TTL_SECONDS`) | Balance security and UX |

### Session Data Structure

```typescript
interface Session {
  id: string;              // UUID, used as Bearer token
  identityId: string;      // Linked identity
  profileId: string;       // Linked user profile
  provider: string;        // OAuth provider used to log in
  createdAt: number;       // Unix timestamp (ms)
  lastActivityAt: number;  // Updated on every authenticated request
}
```

### Session vs OAuth Token Lifecycle

```
┌─────────────────────────────────────────────────────────┐
│ App Session (Redis)                                     │
│ - TTL: 24h sliding window                               │
│ - Purpose: "Is user logged into OUR app?"               │
│ - Refreshed: On every authenticated request             │
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│ OAuth Tokens (Postgres / OAuthAccount)                  │
│ - access_token: Provider-specific (~7 days for Discord) │
│ - refresh_token: Long-lived                             │
│ - Purpose: "Can we call the provider API on their behalf?" │
│ - Refreshed: Lazily, when making provider API calls     │
└─────────────────────────────────────────────────────────┘
```

### SessionGuard

`SessionGuard` is a NestJS `CanActivate` guard applied to routes that require authentication:

- Reads `Authorization: Bearer <token>` header
- Looks up session in Redis (or InMemory fallback)
- Refreshes the sliding window TTL on every request
- Attaches the `Session` object to `req.session`

The `@CurrentSession()` param decorator reads `req.session` set by the guard.

---

## Storage Layer Design

The storage layer is fully swappable at startup via environment variables, with no code changes required.

### Session / Cache Store

```
CacheStore (interface)
  ├── InMemoryCacheService  (USE_REDIS=false — local dev)
  └── RedisCache            (USE_REDIS=true  — staging/prod)
```

Injected via `SESSION_STORE` token in `SharedModule`.

### Repositories

```
IdentityRepository (interface)
  ├── IdentityRepository      (USE_POSTGRES=false — uses InMemoryStore)
  └── PrismaIdentityRepository (USE_POSTGRES=true  — uses Prisma/Postgres)

OAuthAccountRepository (interface)
  ├── OAuthAccountRepository      (USE_POSTGRES=false)
  └── PrismaOAuthAccountRepository (USE_POSTGRES=true)

UserProfileRepository (interface)
  ├── UserProfileRepository      (USE_POSTGRES=false)
  └── PrismaUserProfileRepository (USE_POSTGRES=true)
```

Injected via `useFactory` in each module — same repository token, swapped implementation.

### Prisma Schema

Three models: `Identity`, `OAuthAccount`, `UserProfile` with snake_case table names. `OAuthAccount` has a compound unique index on `(provider, providerUserId)`.

```bash
# Apply migrations
cd backend && npm run db:migrate

# Browse data (Prisma Studio)
npm run db:studio
```

---

## OAuth Providers

### Discord (Implemented)

**Scopes:** `identify`, `email`

**Features:**
- Authorization URL generation with state parameter (CSRF protection)
- Code exchange for access/refresh tokens
- User info retrieval with avatar URL construction
- Token expiry tracking

**Configuration:**
```env
DISCORD_CLIENT_ID=...
DISCORD_CLIENT_SECRET=...
DISCORD_REDIRECT_URI=http://localhost:3001/oauth/discord/callback
```

### Riot Games (Code complete — awaiting RSO credentials)

Riot Sign-On (RSO) requires a separate application process beyond the standard Riot Developer Portal.

**Implementation notes:**
- PKCE (Proof Key for Code Exchange) required by Riot
- Scopes: `openid`, `offline_access`
- No email from Riot — uses placeholder `{puuid}@riot.placeholder`

**To enable:**
1. Apply for RSO access via Riot Developer Portal
2. Set `RIOT_CLIENT_ID`, `RIOT_CLIENT_SECRET`, `RIOT_REDIRECT_URI` in `.env`

---

## Request Pipeline

Every incoming request flows through:

```
HTTP Request
  → LoggingMiddleware (logs method, URL, status, duration)
  → ValidationPipe (strips unlisted properties, transforms types)
  → [SessionGuard] (on protected routes — validates Bearer token, refreshes TTL)
  → Controller
```

---

## Project Structure

```
game-auth/
├── README.md
├── ARCHITECTURE.md
├── docker-compose.yml
├── backend/
│   ├── prisma/
│   │   ├── schema.prisma          # Identity, OAuthAccount, UserProfile models
│   │   └── migrations/
│   ├── src/
│   │   ├── main.ts                # Bootstrap, global ValidationPipe
│   │   ├── app.module.ts          # Root module, LoggingMiddleware
│   │   ├── config/                # discord.config.ts, riot.config.ts
│   │   ├── modules/
│   │   │   ├── auth/
│   │   │   │   ├── controllers/
│   │   │   │   │   └── oauth.controller.ts
│   │   │   │   ├── services/
│   │   │   │   │   ├── identity.service.ts
│   │   │   │   │   ├── oauth.service.ts        # 3-rule orchestration
│   │   │   │   │   ├── oauth-account.service.ts
│   │   │   │   │   ├── session.service.ts
│   │   │   │   │   └── state-store.service.ts
│   │   │   │   ├── providers/
│   │   │   │   │   ├── discord/discord.provider.ts
│   │   │   │   │   └── riot/riot.provider.ts   # PKCE
│   │   │   │   ├── repositories/
│   │   │   │   │   ├── identity.repository.ts
│   │   │   │   │   ├── prisma-identity.repository.ts
│   │   │   │   │   ├── oauth-account.repository.ts
│   │   │   │   │   └── prisma-oauth-account.repository.ts
│   │   │   │   ├── entities/
│   │   │   │   └── exceptions/
│   │   │   │       └── link-required.exception.ts
│   │   │   └── users/
│   │   │       ├── services/user-profile.service.ts
│   │   │       ├── repositories/
│   │   │       │   ├── user-profile.repository.ts
│   │   │       │   └── prisma-user-profile.repository.ts
│   │   │       ├── dto/
│   │   │       └── entities/user-profile.entity.ts
│   │   └── shared/
│   │       ├── constants/          # All magic strings/numbers
│   │       ├── decorators/
│   │       │   └── current-session.decorator.ts
│   │       ├── guards/
│   │       │   └── session.guard.ts
│   │       ├── middleware/
│   │       │   └── logging.middleware.ts
│   │       ├── interfaces/cache-store.interface.ts
│   │       └── services/
│   │           ├── in-memory-cache.service.ts
│   │           ├── in-memory-store.service.ts
│   │           ├── redis-cache.service.ts
│   │           └── prisma.service.ts
│   └── test/
│       └── auth-flow.e2e-spec.ts  # 7 E2E tests
└── frontend/
    └── src/
        ├── index.ts               # Main process — OAuth popup, IPC handler
        ├── preload.ts             # contextBridge IPC bridge
        ├── App.tsx                # Login/logout UI
        └── services/auth.service.ts
```

---

## Ports

| Service | Port |
|---------|------|
| Backend (NestJS) | 3001 |
| Frontend (Electron Forge dev) | 3000 |
| Redis | 6379 |
| Postgres | 5432 |

---

## Implementation Status

### Completed

- [x] Identity/UserProfile separation
- [x] Discord OAuth (identify + email scopes)
- [x] Riot OAuth provider (code complete, awaiting RSO credentials)
- [x] OAuth provider linking rules (3 rules with LinkRequiredException)
- [x] Session service (create, validate, touch, revoke, revokeAllForIdentity)
- [x] Redis session store + InMemory fallback (swappable via `USE_REDIS`)
- [x] SessionGuard (CanActivate — validates Bearer token, sliding window TTL)
- [x] `@CurrentSession()` param decorator
- [x] Global `ValidationPipe` (whitelist + transform)
- [x] HTTP logging middleware
- [x] Postgres persistence via Prisma + InMemory fallback (swappable via `USE_POSTGRES`)
- [x] Docker Compose (backend + Redis + Postgres)
- [x] Multi-stage Docker image (deps → build → production)
- [x] E2E test suite (7 tests — all auth rules + Redis session storage)
- [x] Unit tests across all services, repositories, providers, guards, decorators
- [x] Desktop OAuth flow (Electron popup window + IPC)

### Planned / Future

- [ ] Token encryption at rest (AES-256)
- [ ] Riot OAuth activation (pending RSO credentials)
- [ ] Account linking UI
- [ ] Email/password auth
- [ ] Email verification
- [ ] Absolute session max age (e.g., 30 days)
- [ ] Multi-device session management
- [ ] Rate limiting
- [ ] Audit logging for auth events

---

## Security Considerations

### Implemented

- State parameter for CSRF protection on all OAuth flows
- PKCE for Riot OAuth (prevents authorization code interception)
- `ValidationPipe` with `whitelist: true` — strips undecorated query/body params
- Email masking in `LinkRequiredException` responses
- Placeholder emails for unverified OAuth provider emails
- Context isolation in Electron (Node disabled in renderer process)
- IPC via `contextBridge` (no direct Node API exposure)
- Session tokens stored in memory only (never localStorage)
- Sliding window session expiry

### Planned

- Token encryption at rest
- Session binding (IP / user agent fingerprint)
- Absolute session expiry
- Rate limiting on auth endpoints

---

## Configuration Reference

```env
# Server
PORT=3001

# Discord OAuth
DISCORD_CLIENT_ID=...
DISCORD_CLIENT_SECRET=...
DISCORD_REDIRECT_URI=http://localhost:3001/oauth/discord/callback

# Riot OAuth
RIOT_CLIENT_ID=...
RIOT_CLIENT_SECRET=...
RIOT_REDIRECT_URI=http://localhost:3001/oauth/riot/callback

# Redis (false = in-memory fallback)
USE_REDIS=true
REDIS_URL=redis://localhost:6379

# Postgres (false = in-memory fallback)
USE_POSTGRES=true
DATABASE_URL=postgresql://gameauth:gameauth@localhost:5432/gameauth

# Session
SESSION_TTL_SECONDS=86400
```
