# Game Auth Frontend

Electron desktop application with React for gaming OAuth authentication.

## Architecture

```
src/
├── index.ts              # Electron main process
├── preload.ts            # IPC bridge (contextBridge)
├── renderer.tsx          # React entry point
├── App.tsx               # Main React component
├── index.css             # Styling
├── index.html            # HTML template
├── services/
│   └── auth.service.ts   # Auth API client
└── types/
    └── electron.d.ts     # Type declarations
```

## OAuth Flow

The desktop app handles OAuth using a system browser popup:

```
1. User clicks "Login with Discord"
2. Main process opens system browser with OAuth URL
3. User authenticates on Discord's website
4. Discord redirects to localhost callback
5. Backend exchanges code for tokens
6. Backend returns session token + user data
7. Main process sends result to renderer via IPC
```

### IPC Bridge

The preload script exposes a secure API to the renderer:

```typescript
window.electronAPI.loginWithProvider(provider: 'discord' | 'riot')
  // Returns: AuthResult with session token, identity, profile
```

## Components

### App.tsx

Main React component with states:
- **Logged out**: Shows Discord/Riot login buttons
- **Loading**: Shows spinner during OAuth
- **Logged in**: Shows user profile with session info

### AuthService

Client-side service for:
- Generating OAuth URLs
- Storing session tokens
- Validating sessions
- Handling logout

## Quick Reference

```bash
# Development
npm start                  # Launch with Electron Forge dev server

# Build
npm run package            # Package for current platform
npm run make               # Create distributables

# Code Quality
npm run lint               # ESLint for TypeScript
```

## Build Targets

Configured via Electron Forge:

| Platform | Format |
|----------|--------|
| Windows | Squirrel installer |
| macOS | ZIP archive |
| Linux | DEB, RPM packages |

## Configuration

Configured via `forge.config.ts`:
- Webpack for TypeScript compilation
- Fuses for security hardening
- Auto-unpack natives for node modules

## Dependencies

### Runtime
- `electron-squirrel-startup` - Windows installer handling
- `react`, `react-dom` - UI framework

### Development
- `@electron-forge/*` - Build toolchain
- `@electron/fuses` - Security configuration
- `typescript`, `ts-loader` - TypeScript compilation
- `css-loader`, `style-loader` - CSS bundling

## Security

- Context isolation enabled (default in Electron 41)
- Node integration disabled in renderer
- IPC communication via contextBridge
- Session tokens stored in memory only
