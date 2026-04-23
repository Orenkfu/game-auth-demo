import { useState, useCallback } from 'react';
import { eventQueue } from './bootstrap';
import { EventMockPipe, PipeState } from '../event-generation/event.mock-pipe';
import { GAME_RULES } from '../event-generation/game-rules';
import { TitleBar } from './components/TitleBar';
import { PipeCard } from './components/PipeCard';
import { QueryPanel } from './components/QueryPanel';
import { VideoUploader } from './components/VideoUploader';
import { VideoList } from './components/VideoList';
import { useAuth } from './hooks/useAuth';

const AVAILABLE_GAMES = Object.keys(GAME_RULES);

interface PipeEntry {
  id: number;
  pipe: EventMockPipe;
  state: PipeState;
  rate: number;
}

let nextPipeId = 0;

export default function App() {
  const { user, loading, error, login, logout } = useAuth();
  const [pipes, setPipes] = useState<PipeEntry[]>([]);
  const [selectedGame, setSelectedGame] = useState(AVAILABLE_GAMES[0]);
  const [videoRefresh, setVideoRefresh] = useState(0);

  const handleLogout = async () => {
    pipes.forEach(p => p.pipe.close());
    setPipes([]);
    await logout();
  };

  const addPipe = useCallback(() => {
    const pipe = new EventMockPipe(eventQueue, selectedGame);
    setPipes(prev => [...prev, { id: nextPipeId++, pipe, state: pipe.state, rate: pipe.eventsPerSecond }]);
  }, [selectedGame]);

  const updatePipeState = useCallback((id: number) => {
    setPipes(prev => prev.map(p =>
      p.id === id ? { ...p, state: p.pipe.state, rate: p.pipe.eventsPerSecond } : p
    ));
  }, []);

  const removePipe = useCallback((id: number) => {
    setPipes(prev => prev.filter(p => p.id !== id));
  }, []);

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
              <PipeCard
                key={entry.id}
                id={entry.id}
                pipe={entry.pipe}
                state={entry.state}
                rate={entry.rate}
                onStateChange={updatePipeState}
                onRemove={removePipe}
              />
            ))}
          </div>
        </div>

        <QueryPanel />

        <div className="video-section">
          <VideoUploader onUploaded={() => setVideoRefresh(n => n + 1)} />
          <VideoList refreshTrigger={videoRefresh} />
        </div>

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
        <button onClick={() => login('discord')} disabled={loading !== null} className="discord-btn">
          {loading === 'discord' ? 'Connecting...' : 'Login with Discord'}
        </button>
        <button onClick={() => login('riot')} disabled={loading !== null} className="riot-btn">
          {loading === 'riot' ? 'Connecting...' : 'Login with Riot'}
        </button>
      </div>

      <p className="note">Note: Riot login requires RSO credentials (not yet configured)</p>
    </div>
  );
}
