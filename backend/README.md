# Game Auth Backend

NestJS-based authentication API for gaming OAuth providers.

## Architecture

```
src/
├── app.module.ts           # Root module
├── main.ts                 # Bootstrap
├── config/                 # Configuration schema
├── modules/
│   ├── auth/               # Authentication module
│   │   ├── controllers/    # OAuth endpoints
│   │   ├── services/       # Business logic
│   │   ├── providers/      # OAuth provider integrations
│   │   │   ├── discord/    # Discord OAuth implementation
│   │   │   └── riot/       # Riot OAuth implementation (pending)
│   │   ├── entities/       # Identity, OAuthAccount
│   │   ├── repositories/   # Data access layer
│   │   └── exceptions/     # Custom exceptions
│   ├── users/              # User profile module
│   │   ├── dto/            # Validation DTOs
│   │   ├── services/       # Profile management
│   │   ├── repositories/   # Profile data access
│   │   └── entities/       # UserProfile entity
│   └── social/             # Social features (planned)
└── shared/
    ├── services/           # In-memory cache, Redis wrapper
    ├── interfaces/         # Shared contracts
    └── constants/          # Injection tokens
```

## Modules

### Auth Module

Handles OAuth authentication and session management.

**Services:**
- `IdentityService` - Creates/finds auth identities
- `OAuthAccountService` - Manages linked OAuth accounts
- `OAuthService` - Orchestrates OAuth flow (exchange code, link accounts)
- `SessionService` - Creates/validates/revokes sessions
- `StateStoreService` - Manages OAuth state parameters

**Providers:**
- `DiscordProvider` - Discord OAuth 2.0 implementation
- `RiotProvider` - Riot Sign-On with PKCE (pending credentials)

**Endpoints:**
```
GET  /oauth/discord           # Start Discord OAuth
GET  /oauth/discord/callback  # Handle Discord callback
GET  /oauth/riot              # Start Riot OAuth
GET  /oauth/riot/callback     # Handle Riot callback
GET  /oauth/session           # Validate current session
POST /oauth/logout            # Revoke session
```

### Users Module

Manages user profiles (application data separate from auth).

**Services:**
- `UserProfileService` - CRUD operations, username generation
- `UsersService` - Aggregated user operations

**Entities:**
- `UserProfile` - Display name, avatar, bio, gamer preferences

## Quick Reference

```bash
# Development
npm run start:dev          # Watch mode with hot reload
npm run start:debug        # Debug mode with inspector

# Testing
npm test                   # Run all tests with coverage
npm run test:watch         # Watch mode
npm run test:e2e           # End-to-end tests

# Code Quality
npm run lint               # ESLint with autofix
npm run format             # Prettier formatting
```

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `PORT` | Server port | 3001 |
| `DISCORD_CLIENT_ID` | Discord app client ID | - |
| `DISCORD_CLIENT_SECRET` | Discord app secret | - |
| `DISCORD_REDIRECT_URI` | OAuth callback URL | - |
| `RIOT_CLIENT_ID` | Riot RSO client ID | - |
| `RIOT_CLIENT_SECRET` | Riot RSO secret | - |
| `RIOT_REDIRECT_URI` | RSO callback URL | - |
| `SESSION_TTL_SECONDS` | Session TTL | 86400 |

## Testing

Test coverage is enforced at 10% minimum (ramping up).

```bash
# Run with coverage report
npm test

# Output formats: text, lcov, html
# Reports at: coverage/
```

### Test Files

```
*.spec.ts                    # Unit tests alongside source
test/*.e2e-spec.ts          # E2E tests in test directory
```

## Dependencies

### Runtime
- `@nestjs/common`, `@nestjs/core`, `@nestjs/config`
- `class-validator`, `class-transformer` - DTO validation
- `ioredis` - Redis client (session store)
- `zod` - Runtime validation

### Development
- `jest`, `@nestjs/testing` - Testing framework
- `supertest` - HTTP assertions
- `typescript-eslint`, `prettier` - Code quality
