import { useState, useCallback } from 'react';
import { authService, eventQueue } from './bootstrap';
import type { AuthResult, AuthProvider } from './services/auth.service';
import { EventMockPipe, PipeState } from './event-generation/event.mock-pipe';
import { GAME_RULES } from './event-generation/game-rules';
import { QueryPanel } from './components/QueryPanel';

const AVAILABLE_GAMES = Object.keys(GAME_RULES);

interface PipeEntry {
  id: number;
  pipe: EventMockPipe;
  state: PipeState;
  rate: number;
}

let nextPipeId = 0;

export default function App() {
  const [user, setUser] = useState<AuthResult | null>(null);
  const [loading, setLoading] = useState<AuthProvider | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pipes, setPipes] = useState<PipeEntry[]>([]);
  const [selectedGame, setSelectedGame] = useState(AVAILABLE_GAMES[0]);

  const handleLogin = async (provider: AuthProvider) => {
    setLoading(provider);
    setError(null);

    try {
      const result = await window.electronAPI.loginWithProvider(provider);
      if (result && result.statusCode) {
        setError(result.message || 'Login failed');
        return;
      }
      authService.setSession(result.sessionToken, result.profile);
      setUser(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setLoading(null);
    }
  };

  const handleLogout = async () => {
    pipes.forEach(p => p.pipe.close());
    setPipes([]);
    await authService.logout();
    setUser(null);
    setError(null);
  };

  const addPipe = useCallback(() => {
    const pipe = new EventMockPipe(eventQueue, selectedGame);
    setPipes(prev => [...prev, {
      id: nextPipeId++,
      pipe,
      state: pipe.state,
      rate: pipe.eventsPerSecond,
    }]);
  }, [selectedGame]);

  const updatePipeState = useCallback((id: number) => {
    setPipes(prev => prev.map(p =>
      p.id === id ? { ...p, state: p.pipe.state, rate: p.pipe.eventsPerSecond } : p
    ));
  }, []);

  const removePipe = useCallback((id: number) => {
    setPipes(prev => prev.filter(p => p.id !== id));
  }, []);
  function TitleBar() {

    return (
      <div className='titlebar'>
        <button onClick={() => window.electronAPI.minimizeWindow()}>—</button>
        <button onClick={() => window.electronAPI.maximizeWindow()}>□</button>
        <button onClick={() => window.electronAPI.closeWindow()}>✕</button>
      </div>
    );
  }
  if (user) {
    return (
      <div className="container">
        <TitleBar />
        <h1>Welcome, {user.profile.displayName}!</h1>
        <p className="subtitle">@{user.profile.username}</p>

        <div className="user-card">
          {user.profile.avatarUrl && (
            <img src={user.profile.avatarUrl} alt="Avatar" className="avatar" />
          )}
          <div className="user-info">
            <p><strong>Session:</strong> {user.sessionToken.substring(0, 8)}...</p>
            <p><strong>Profile ID:</strong> {user.profile.id}</p>
            <p><strong>Email:</strong> {user.identity.email}</p>
            {user.discord && <p><strong>Discord:</strong> {user.discord.username}</p>}
            {user.riot && <p><strong>Riot ID:</strong> {user.riot.riotId}</p>}
          </div>
        </div>

        <div className="pipes-section">
          <h2>Event Mock Pipes</h2>

          <div className="add-pipe">
            <select value={selectedGame} onChange={e => setSelectedGame(e.target.value)}>
              {AVAILABLE_GAMES.map(g => <option key={g} value={g}>{g}</option>)}
            </select>
            <button className="add-btn" onClick={addPipe}>Open Game</button>
          </div>

          <div className="pipes-list">
            {pipes.map(entry => (
              <div key={entry.id} className={`pipe-card pipe-${entry.state}`}>
                <div className="pipe-header">
                  <strong>{entry.pipe.gameId}</strong>
                  <span className={`status-badge status-${entry.state}`}>{entry.state}</span>
                </div>

                <div className="pipe-controls">
                  {entry.state === 'idle' && (
                    <>
                      <button onClick={() => { entry.pipe.startMatch(); updatePipeState(entry.id); }}>
                        Start Match
                      </button>
                      <button className="close-btn" onClick={() => { entry.pipe.close(); removePipe(entry.id); }}>
                        Close Game
                      </button>
                    </>
                  )}

                  {entry.state === 'streaming' && (
                    <>
                      <label>
                        Rate:
                        <input
                          type="number"
                          min="1"
                          max="100"
                          value={entry.rate}
                          onChange={e => {
                            const rate = parseInt(e.target.value) || 1;
                            entry.pipe.setRate(rate);
                            updatePipeState(entry.id);
                          }}
                        />
                        /sec
                      </label>
                      <button onClick={() => { entry.pipe.endMatch(); updatePipeState(entry.id); }}>
                        End Match
                      </button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        <QueryPanel />

        <button onClick={handleLogout} className="logout-btn">Log Out</button>
      </div>
    );
  }

  return (
    <div className="container">
      <TitleBar />
      <h1>Outplayed Auth Demo</h1>
      <p className="subtitle">Sign in with your gaming account</p>

      {error && <div className="error">{error}</div>}

      <div className="auth-buttons">
        <button onClick={() => handleLogin('discord')} disabled={loading !== null} className="discord-btn">
          {loading === 'discord' ? 'Connecting...' : 'Login with Discord'}
        </button>
        <button onClick={() => handleLogin('riot')} disabled={loading !== null} className="riot-btn">
          {loading === 'riot' ? 'Connecting...' : 'Login with Riot'}
        </button>
      </div>

      <p className="note">Note: Riot login requires RSO credentials (not yet configured)</p>
    </div>
  );
}
