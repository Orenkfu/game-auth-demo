# Outplayed Auth Demo

A production-grade gaming authentication system demonstrating OAuth integration with gaming platforms (Discord, Riot Games), session management, and clean architecture patterns.

## Project Structure

```
game-auth/
├── backend/          # NestJS API (TypeScript)
├── frontend/         # Electron + React desktop app
└── ARCHITECTURE.md   # Design decisions & implementation details
```

## Tech Stack

| Layer | Technology |
|-------|------------|
| Backend | NestJS 11, TypeScript, Redis (sessions) |
| Frontend | Electron 41, React 19, TypeScript |
| Auth | OAuth 2.0 (Discord working, Riot pending RSO) |

## Quick Start

### Prerequisites

- Node.js 18+
- npm 9+
- Redis (for session storage, or uses in-memory fallback)
- Discord Developer Application (for OAuth)

### 1. Clone and Install

```bash
# Install backend dependencies
cd backend
npm install

# Install frontend dependencies
cd ../frontend
npm install
```

### 2. Configure Environment

Create `backend/.env`:

```env
# Server
PORT=3001

# Discord OAuth (required)
DISCORD_CLIENT_ID=your_client_id
DISCORD_CLIENT_SECRET=your_client_secret
DISCORD_REDIRECT_URI=http://localhost:3001/oauth/discord/callback

# Riot OAuth (optional - requires RSO approval)
RIOT_CLIENT_ID=
RIOT_CLIENT_SECRET=
RIOT_REDIRECT_URI=http://localhost:3001/oauth/riot/callback

# Session
SESSION_TTL_SECONDS=86400
```

### 3. Run Development Servers

```bash
# Terminal 1: Backend
cd backend
npm run start:dev

# Terminal 2: Frontend
cd frontend
npm start
```

| Service | URL |
|---------|-----|
| Backend API | http://localhost:3001 |
| Frontend (Electron) | Desktop window |

## Features

### Implemented

- **OAuth Authentication**: Discord login with email/identify scopes
- **Identity/Profile Separation**: Auth concerns isolated from user data
- **Session Management**: In-memory cache with TTL (Redis-ready)
- **OAuth Token Storage**: Secure storage with refresh token support
- **Account Linking Rules**: Email collision detection, explicit linking required
- **State Parameter**: CSRF protection for OAuth flows
- **Desktop OAuth Flow**: System browser popup with deep linking

### Pending

- Riot OAuth (awaiting RSO credentials)
- PostgreSQL persistence
- Token encryption at rest
- Auth middleware for protected routes

## Documentation

- [Architecture & Design Decisions](./ARCHITECTURE.md)
- [Backend README](./backend/README.md)
- [Frontend README](./frontend/README.md)

## Testing

```bash
# Backend tests with coverage
cd backend
npm test

# Run specific test file
npm test -- session.service.spec.ts
```

## License

UNLICENSED - Private project