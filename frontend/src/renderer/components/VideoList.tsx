import { useEffect, useState, useCallback } from 'react';
import { videoService, authService } from '../bootstrap';
import type { VideoMeta } from '../services/video.service';

interface Props {
  refreshTrigger: number;
}

export function VideoList({ refreshTrigger }: Props) {
  const [videos, setVideos] = useState<VideoMeta[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const token = authService.getSessionToken();
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const list = await videoService.listVideos(token);
      setVideos(list);
    } catch (err: any) {
      setError(err.message ?? 'Failed to load videos');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load, refreshTrigger]);

  const handleDelete = async (videoId: string) => {
    const token = authService.getSessionToken();
    if (!token) return;
    try {
      await videoService.deleteVideo(videoId, token);
      setVideos(prev => prev.filter(v => v.id !== videoId));
    } catch (err: any) {
      setError(err.message ?? 'Delete failed');
    }
  };

  return (
    <div className="video-list-card">
      <div className="video-list-header">
        <h3>Uploaded Videos</h3>
        <button className="refresh-btn" onClick={load} disabled={loading}>
          {loading ? 'Loading...' : 'Refresh'}
        </button>
      </div>

      {error && <p className="error">{error}</p>}

      {videos.length === 0 && !loading && (
        <p className="empty-state">No videos yet.</p>
      )}

      {videos.map(v => (
        <div key={v.id} className="video-row">
          <div className="video-info">
            <span className="video-title">{v.title ?? v.filename}</span>
            <span className="video-meta">
              {v.sizeBytes ? formatBytes(v.sizeBytes) : '—'}
              {v.durationSecs ? ` · ${v.durationSecs}s` : ''}
              {v.width && v.height ? ` · ${v.width}×${v.height}` : ''}
            </span>
            <span className="video-id">{v.id}</span>
          </div>
          <div className="video-actions">
            <a href={v.downloadUrl} target="_blank" rel="noreferrer" className="view-btn">View</a>
            <button className="delete-btn" onClick={() => handleDelete(v.id)}>Delete</button>
          </div>
        </div>
      ))}
    </div>
  );
}

function formatBytes(bytes: number): string {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}
