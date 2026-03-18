import { useState } from 'react';
import { authService } from './services/auth.service';
import type { AuthResult, AuthProvider } from './services/auth.service';

export default function App() {
  const [user, setUser] = useState<AuthResult | null>(null);
  const [loading, setLoading] = useState<AuthProvider | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleLogin = async (provider: AuthProvider) => {
    setLoading(provider);
    setError(null);

    try {
      const result = await window.electronAPI.loginWithProvider(provider);
      authService.setSessionToken(result.sessionToken);
      setUser(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setLoading(null);
    }
  };

  const handleLogout = async () => {
    await authService.logout();
    setUser(null);
    setError(null);
  };

  if (user) {
    return (
      <div className="container">
        <h1>Welcome, {user.profile.displayName}!</h1>
        <p className="subtitle">@{user.profile.username}</p>

        <div className="user-card">
          {user.profile.avatarUrl && (
            <img
              src={user.profile.avatarUrl}
              alt="Avatar"
              className="avatar"
            />
          )}
          <div className="user-info">
            <p><strong>Session:</strong> {user.sessionToken.substring(0, 8)}...</p>
            <p><strong>Identity ID:</strong> {user.identity.id}</p>
            <p><strong>Email:</strong> {user.identity.email}</p>
            <p><strong>Verified:</strong> {user.identity.emailVerified ? 'Yes' : 'No'}</p>
            {user.discord && (
              <p><strong>Discord:</strong> {user.discord.username}</p>
            )}
            {user.riot && (
              <p><strong>Riot ID:</strong> {user.riot.riotId}</p>
            )}
          </div>
        </div>

        <button onClick={handleLogout} className="logout-btn">
          Log Out
        </button>
      </div>
    );
  }

  return (
    <div className="container">
      <h1>Outplayed Auth Demo</h1>
      <p className="subtitle">Sign in with your gaming account</p>

      {error && <div className="error">{error}</div>}

      <div className="auth-buttons">
        <button
          onClick={() => handleLogin('discord')}
          disabled={loading !== null}
          className="discord-btn"
        >
          {loading === 'discord' ? 'Connecting...' : 'Login with Discord'}
        </button>

        <button
          onClick={() => handleLogin('riot')}
          disabled={loading !== null}
          className="riot-btn"
        >
          {loading === 'riot' ? 'Connecting...' : 'Login with Riot'}
        </button>
      </div>

      <p className="note">
        Note: Riot login requires RSO credentials (not yet configured)
      </p>
    </div>
  );
}
