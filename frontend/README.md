# Game Auth Frontend

Electron desktop application with React for gaming OAuth authentication.

## Architecture

```
src/
├── index.ts              # Electron main process — OAuth popup + IPC handler
├── preload.ts            # IPC bridge (contextBridge)
├── renderer.tsx          # React entry point
├── App.tsx               # Main React component (login/profile UI)
├── index.css             # Styling
├── index.html            # HTML template
├── services/
│   └── auth.service.ts   # Session token management + logout
└── types/
    └── electron.d.ts     # window.electronAPI type declarations
```

## OAuth Flow

The desktop app handles OAuth via a child `BrowserWindow` that stays within the Electron process:

```
1. User clicks "Login with Discord" in App.tsx
2. Renderer calls window.electronAPI.loginWithProvider('discord') via IPC
3. Main process (index.ts) opens a child BrowserWindow at http://localhost:3001/oauth/discord
4. Backend generates OAuth state, stores it, redirects to Discord's auth page
5. BrowserWindow follows the redirect — user authenticates on Discord
6. Discord redirects to http://localhost:3001/oauth/discord/callback?code=...&state=...
7. Backend validates state, exchanges code for tokens, creates session, returns JSON
8. Main process detects the callback URL via did-finish-load, reads document.body.innerText
9. Parses the JSON response and resolves the IPC promise
10. App.tsx receives AuthResult and updates UI (or shows error if statusCode is set)
```

### IPC Bridge

`preload.ts` exposes a single method via `contextBridge`:

```typescript
window.electronAPI.loginWithProvider(provider: 'discord' | 'riot'): Promise<AuthResult>
```

`AuthResult` on success:
```typescript
{
  message: string;
  isNewUser: boolean;
  sessionToken: string;
  identity: { id, email, emailVerified, status };
  profile: { id, username, displayName, avatarUrl };
  discord?: { id, username, global_name, avatar, email, verified, avatarUrl };
  riot?: { puuid, gameName, tagLine, riotId };
}
```

On backend error the response will include `statusCode` — `App.tsx` checks for this and shows the error message rather than crashing.

## Components

### App.tsx

Three UI states:
- **Logged out** — Discord and Riot login buttons
- **Loading** — Disabled buttons with "Connecting..." while OAuth is in flight
- **Logged in** — Profile card showing displayName, username, avatar, session info

### AuthService (`services/auth.service.ts`)

Client-side helper for:
- Storing the session token in memory
- Validating the session against the backend (`GET /oauth/session`)
- Sending logout (`POST /oauth/logout`)

## Quick Reference

```bash
# Development
npm start                  # Launch with Electron Forge dev server

# Build
npm run package            # Package for current platform
npm run make               # Create distributable installers

# Code quality
npm run lint
```

## Build Targets

| Platform | Format |
|----------|--------|
| Windows | Squirrel installer |
| macOS | ZIP archive |
| Linux | DEB, RPM packages |

## Security

- Context isolation enabled (Electron default)
- Node integration disabled in renderer process
- All IPC via `contextBridge` — renderer has no access to Node APIs
- Session tokens stored in memory only (never written to disk or localStorage)
- Backend URL is hardcoded to `http://localhost:3001` — not user-configurable

## Dependencies

### Runtime
- `react`, `react-dom` — UI framework
- `electron-squirrel-startup` — Windows installer handling

### Development
- `@electron-forge/*` — build toolchain
- `@electron/fuses` — security hardening configuration
- `typescript`, `ts-loader` — TypeScript compilation
- `css-loader`, `style-loader` — CSS bundling
