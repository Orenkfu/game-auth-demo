import { useState } from 'react';
import { config } from '../config';

const PRESET_QUERIES = [
  { label: 'Event counts by action', sql: "SELECT COALESCE(metadata->>'actionName', type) as action_name, COUNT(*) as count FROM events GROUP BY action_name ORDER BY count DESC" },
  { label: 'Events by game', sql: 'SELECT game_id, COUNT(*) as count FROM events WHERE game_id IS NOT NULL GROUP BY game_id ORDER BY count DESC' },
  { label: 'User traits', sql: 'SELECT * FROM user_traits' },
  { label: 'Recent events', sql: 'SELECT id, type, game_id, user_id, timestamp FROM events ORDER BY timestamp DESC LIMIT 20' },
  { label: 'Action breakdown', sql: "SELECT metadata->>'actionName' as action, COUNT(*) as count FROM events WHERE type = 'action' GROUP BY action ORDER BY count DESC" },
  { label: 'Events per minute', sql: "SELECT DATE_TRUNC('minute', to_timestamp(timestamp / 1000)) as minute, COUNT(*) as count FROM events GROUP BY minute ORDER BY minute DESC LIMIT 20" },
];

export function QueryPanel() {
  const [sql, setSql] = useState(PRESET_QUERIES[0].sql);
  const [results, setResults] = useState<Record<string, unknown>[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const runQuery = async () => {
    setLoading(true);
    setError(null);
    setResults(null);
    try {
      const res = await fetch(`${config.consumerUrl}/query?sql=${encodeURIComponent(sql)}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data);
      setResults(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  };

  const columns = results && results.length > 0 ? Object.keys(results[0]) : [];

  return (
    <div className="query-panel">
      <h2>Data Explorer</h2>

      <div className="preset-queries">
        {PRESET_QUERIES.map(q => (
          <button key={q.label} className="preset-btn" onClick={() => setSql(q.sql)}>
            {q.label}
          </button>
        ))}
      </div>

      <textarea
        className="sql-input"
        value={sql}
        onChange={e => setSql(e.target.value)}
        rows={4}
        spellCheck={false}
      />

      <button className="run-btn" onClick={runQuery} disabled={loading}>
        {loading ? 'Running...' : 'Run Query'}
      </button>

      {error && <div className="query-error">{error}</div>}

      {results && (
        <div className="results-wrapper">
          <p className="results-count">{results.length} row{results.length !== 1 ? 's' : ''}</p>
          {results.length > 0 ? (
            <div className="table-scroll">
              <table className="results-table">
                <thead>
                  <tr>{columns.map(col => <th key={col}>{col}</th>)}</tr>
                </thead>
                <tbody>
                  {results.map((row, i) => (
                    <tr key={i}>
                      {columns.map(col => (
                        <td key={col}>
                          {row[col] === null
                            ? <span className="null-val">null</span>
                            : typeof row[col] === 'object'
                              ? JSON.stringify(row[col])
                              : String(row[col])}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="no-results">No results</p>
          )}
        </div>
      )}
    </div>
  );
}
