# Outplayed Auth Demo - Architecture & Design Decisions

## Overview

A production-grade gaming authentication system demonstrating OAuth integration with gaming platforms, clean separation of concerns, and session management.

**Tech Stack:**
- Backend: NestJS + TypeScript + PostgreSQL (planned) + Redis
- Frontend: Electron + React + TypeScript

---

## Core Concepts

### Identity vs UserProfile Separation

We separate authentication concerns from application concerns:

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
- Clean module boundaries with clear FK relationships
- Enables future features like account merging, identity providers

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

**One Identity can have multiple OAuthAccounts** (e.g., same user linked to both Discord and Riot).

---

## OAuth Provider Linking Rules

When a user authenticates via OAuth, we follow these rules:

### Rule 1: Provider Already Linked
If the provider's user ID is already linked to an existing Identity → **Login**

```
Discord user 123456 exists in OAuthAccounts
  → Find linked Identity
  → Update lastLoginAt
  → Create session
  → Return existing user
```

### Rule 2: No Match Found
If no matching provider ID AND no matching email → **Create New User**

```
Discord user 123456 not found
Discord email not in any Identity
  → Create new Identity
  → Create new UserProfile
  → Create OAuthAccount linking them
  → Create session
  → Return new user (isNewUser: true)
```

### Rule 3: Email Collision
If no matching provider ID BUT email matches existing Identity → **Require Explicit Link**

```
Discord user 123456 not found
Discord email "user@example.com" exists in Identity
  → Throw LinkRequiredException
  → User must login to existing account first
  → Then explicitly link Discord from settings
```

**Rationale:** Prevents account hijacking. A malicious actor can't take over an account just by having access to the same email on a different OAuth provider.

**Exception:** If the OAuth provider's email is not verified, we generate a placeholder email (`{providerId}@discord.placeholder`) and follow Rule 2.

---

## Session Management

**Status:** Implemented (in-memory cache with Redis-ready abstraction)

### Decisions

| Aspect | Decision | Rationale |
|--------|----------|-----------|
| Storage | CacheStore interface | Currently in-memory, swappable to Redis |
| Strategy | Sessions over JWT | Instant revocation, simpler mental model, avoids JWT complexity creep |
| Expiration | Sliding window | Active users stay logged in, idle users expire |
| Default TTL | 24 hours (configurable) | Balance between security and UX |
| Absolute max | 30 days (planned) | Force re-auth even for active users |

### Session Data Structure

```typescript
interface Session {
  id: string;              // UUID
  identityId: string;      // Linked identity
  profileId: string;       // Linked user profile
  provider: string;        // OAuth provider used
  createdAt: number;       // Timestamp
  lastActivityAt: number;  // Updated on validate/touch
}
```

### API

| Method | Description |
|--------|-------------|
| `create(data)` | Create new session, returns session object |
| `get(id)` | Retrieve session by ID |
| `validate(id)` | Validate and refresh session TTL |
| `touch(id)` | Update lastActivityAt only |
| `revoke(id)` | Delete single session |
| `revokeAllForIdentity(id)` | Delete all sessions for identity |

### Session vs OAuth Token Lifecycle

These are independent:

```
┌─────────────────────────────────────────────────────────┐
│ App Session (Redis)                                     │
│ - TTL: 24h sliding window                               │
│ - Purpose: "Is user logged into OUR app?"               │
│ - Refreshed: On every authenticated request             │
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│ OAuth Tokens (Database)                                 │
│ - access_token: Provider-specific (~7 days for Discord) │
│ - refresh_token: Long-lived                             │
│ - Purpose: "Can we call provider API on user's behalf?" │
│ - Refreshed: Lazily, when making provider API calls     │
└─────────────────────────────────────────────────────────┘
```

**Interaction scenarios:**

| Session | OAuth Token | Action |
|---------|-------------|--------|
| Valid | Valid | Proceed normally |
| Valid | Expired | Use refresh_token to get new access_token |
| Valid | Refresh failed | Degrade gracefully or prompt re-link |
| Expired | Any | Require full re-authentication |

---

## OAuth Providers

### Discord (Implemented)

**Status:** Fully working with test coverage

**Scopes:**
- `identify` - Basic user info (username, avatar, discriminator)
- `email` - Email address

**Features:**
- Authorization URL generation with state parameter
- Code exchange for access/refresh tokens
- User info retrieval with avatar URL construction
- Token expiry tracking

**Planned scopes (require Discord approval):**
- `relationships.read` - Friends list (requires Social SDK approval)

**Configuration:**
```env
DISCORD_CLIENT_ID=...
DISCORD_CLIENT_SECRET=...
DISCORD_REDIRECT_URI=http://localhost:3001/oauth/discord/callback
```

### Riot Games (Postponed)

**Status:** Code implemented, awaiting RSO credentials

**Issue:** Riot Sign-On (RSO) requires a separate application process beyond the standard Riot Developer Portal. Standard API keys don't provide OAuth capabilities.

**Implementation notes:**
- Uses PKCE (Proof Key for Code Exchange) as required by Riot
- Scopes: `openid`, `offline_access`
- No email provided by Riot - uses placeholder `{puuid}@riot.placeholder`

**To enable:**
1. Apply for RSO access via Riot Developer Portal
2. Obtain client_id and client_secret
3. Update `.env` with credentials

---

## Project Structure

```
game-auth/
├── README.md                   # Project overview & quick start
├── ARCHITECTURE.md             # This file
├── backend/                    # NestJS API
│   ├── README.md               # Backend documentation
│   ├── src/
│   │   ├── config/             # Configuration validation
│   │   ├── modules/
│   │   │   ├── auth/           # Authentication module
│   │   │   │   ├── controllers/
│   │   │   │   │   └── oauth.controller.ts
│   │   │   │   ├── services/
│   │   │   │   │   ├── identity.service.ts
│   │   │   │   │   ├── oauth.service.ts
│   │   │   │   │   ├── oauth-account.service.ts
│   │   │   │   │   ├── session.service.ts      # NEW
│   │   │   │   │   └── state-store.service.ts
│   │   │   │   ├── providers/
│   │   │   │   │   ├── discord/
│   │   │   │   │   │   ├── discord.provider.ts
│   │   │   │   │   │   └── discord.types.ts
│   │   │   │   │   └── riot/
│   │   │   │   │       ├── riot.provider.ts
│   │   │   │   │       └── riot.types.ts
│   │   │   │   ├── entities/
│   │   │   │   ├── repositories/
│   │   │   │   └── exceptions/
│   │   │   ├── users/          # User profile module
│   │   │   │   ├── dto/        # Validation DTOs
│   │   │   │   ├── services/
│   │   │   │   ├── repositories/
│   │   │   │   └── entities/
│   │   │   └── social/         # Planned: friends, social features
│   │   └── shared/
│   │       ├── services/
│   │       │   ├── in-memory-store.service.ts   # Entity storage
│   │       │   └── in-memory-cache.service.ts   # Session cache
│   │       ├── interfaces/     # CacheStore abstraction
│   │       └── constants/      # Injection tokens
│   └── .env
│
└── frontend/                   # Electron + React
    ├── README.md               # Frontend documentation
    ├── forge.config.ts         # Electron Forge config
    ├── src/
    │   ├── index.ts            # Main process (OAuth popup handling)
    │   ├── preload.ts          # IPC bridge (contextBridge)
    │   ├── renderer.tsx        # React entry point
    │   ├── App.tsx             # Main UI component
    │   ├── index.css           # Styling
    │   ├── services/
    │   │   └── auth.service.ts # Auth API client
    │   └── types/
    │       └── electron.d.ts   # Type declarations
    └── package.json
```

---

## Ports

| Service | Port |
|---------|------|
| Backend (NestJS) | 3001 |
| Frontend (Electron Forge dev server) | 3000 |

---

## Implementation Status

### Completed

- [x] **Identity/UserProfile separation** - Auth and app data cleanly separated
- [x] **Discord OAuth** - Full implementation with identify/email scopes
- [x] **OAuth account linking** - Multiple providers per identity supported
- [x] **Session service** - Create, validate, refresh, revoke sessions
- [x] **Session storage** - In-memory cache with TTL (Redis-ready abstraction)
- [x] **State store service** - OAuth state parameter management with CSRF protection
- [x] **Logout endpoint** - Session revocation via POST /oauth/logout
- [x] **Desktop OAuth flow** - System browser popup with IPC result handling
- [x] **Email collision detection** - LinkRequiredException for security

### In Progress

- [ ] **Auth middleware** - Validate session on protected routes
- [ ] **Redis session store** - Currently using in-memory (production-ready interface exists)

### Planned

- [ ] **PostgreSQL integration** - Replace InMemoryStore with real DB
- [ ] **Token encryption** - Encrypt OAuth tokens at rest
- [ ] **Riot OAuth** - Enable once RSO credentials obtained
- [ ] **Account linking UI** - Allow users to link additional providers

### Future

- [ ] **Email/password auth** - Traditional login option
- [ ] **Password reset flow** - Email-based reset
- [ ] **Email verification** - Verify email ownership
- [ ] **Friends import** - Fetch friends from Discord (requires approval)
- [ ] **Rate limiting** - Protect against abuse
- [ ] **Refresh token rotation** - Enhanced security for OAuth tokens
- [ ] **"Remember me"** - Extended session TTL option
- [ ] **Multi-device session management** - View/revoke sessions

---

## Security Considerations

### Implemented

- PKCE for Riot OAuth (prevents authorization code interception)
- State parameter for CSRF protection in OAuth flows
- Email masking in LinkRequiredException responses
- Placeholder emails for unverified OAuth emails
- Context isolation in Electron (Node disabled in renderer)
- IPC communication via secure contextBridge
- Session tokens stored in memory only (not localStorage)
- Sliding window session expiry (24h default)
- Session revocation support (instant logout)

### Planned

- Token encryption at rest (AES-256)
- Session binding (IP, user agent)
- Absolute session expiry (max lifetime)
- Audit logging for auth events
- Rate limiting for auth endpoints

---

## Configuration

### Environment Variables

```env
# Server
PORT=3001

# Discord OAuth
DISCORD_CLIENT_ID=...
DISCORD_CLIENT_SECRET=...
DISCORD_REDIRECT_URI=http://localhost:3001/oauth/discord/callback

# Riot OAuth (pending RSO approval)
RIOT_CLIENT_ID=...
RIOT_CLIENT_SECRET=...
RIOT_REDIRECT_URI=http://localhost:3001/oauth/riot/callback

# Redis (planned)
REDIS_URL=redis://localhost:6379

# Session (planned)
SESSION_TTL_SECONDS=86400
SESSION_MAX_AGE_SECONDS=2592000
```
