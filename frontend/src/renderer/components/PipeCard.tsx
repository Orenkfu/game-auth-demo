import { EventMockPipe, PipeState } from '../../event-generation/event.mock-pipe';

interface PipeCardProps {
  id: number;
  pipe: EventMockPipe;
  state: PipeState;
  rate: number;
  onStateChange: (id: number) => void;
  onRemove: (id: number) => void;
}

export function PipeCard({ id, pipe, state, rate, onStateChange, onRemove }: PipeCardProps) {
  return (
    <div className={`pipe-card pipe-${state}`}>
      <div className="pipe-header">
        <strong>{pipe.gameId}</strong>
        <span className={`status-badge status-${state}`}>{state}</span>
      </div>

      <div className="pipe-controls">
        {state === 'idle' && (
          <>
            <button onClick={() => { pipe.startMatch(); onStateChange(id); }}>
              Start Match
            </button>
            <button className="close-btn" onClick={() => { pipe.close(); onRemove(id); }}>
              Close Game
            </button>
          </>
        )}

        {state === 'streaming' && (
          <>
            <label>
              Rate:
              <input
                type="number"
                min="1"
                max="100"
                value={rate}
                onChange={e => {
                  const newRate = parseInt(e.target.value) || 1;
                  pipe.setRate(newRate);
                  onStateChange(id);
                }}
              />
              /sec
            </label>
            <button onClick={() => { pipe.endMatch(); onStateChange(id); }}>
              End Match
            </button>
          </>
        )}
      </div>
    </div>
  );
}
