import { useRef, useState } from 'react';
import { videoService } from '../bootstrap';
import { authService } from '../bootstrap';

type UploadState = 'idle' | 'uploading' | 'done' | 'error';

interface Props {
  onUploaded: () => void;
}

export function VideoUploader({ onUploaded }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [state, setState] = useState<UploadState>('idle');
  const [error, setError] = useState<string | null>(null);
  const [lastVideoId, setLastVideoId] = useState<string | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const picked = e.target.files?.[0] ?? null;
    setFile(picked);
    setState('idle');
    setError(null);
    setLastVideoId(null);
  };

  const handleUpload = async () => {
    if (!file) return;
    const token = authService.getSessionToken();
    if (!token) { setError('No session token'); return; }

    setState('uploading');
    setError(null);

    try {
      const { videoId } = await videoService.upload(file, token);
      setLastVideoId(videoId);
      setState('done');
      setFile(null);
      if (inputRef.current) inputRef.current.value = '';
      onUploaded();
    } catch (err: any) {
      setError(err.message ?? 'Upload failed');
      setState('error');
    }
  };

  return (
    <div className="uploader-card">
      <h3>Upload Video</h3>

      <input
        ref={inputRef}
        type="file"
        accept="video/*"
        onChange={handleFileChange}
        style={{ display: 'none' }}
      />

      <div className="uploader-row">
        <button className="pick-btn" onClick={() => inputRef.current?.click()} disabled={state === 'uploading'}>
          Pick file
        </button>
        <span className="file-name">
          {file ? `${file.name} (${formatBytes(file.size)})` : 'No file selected'}
        </span>
      </div>

      {file && state !== 'uploading' && (
        <button className="upload-btn" onClick={handleUpload}>Upload</button>
      )}

      {state === 'uploading' && <p className="upload-status">Uploading...</p>}
      {state === 'done' && <p className="upload-status success">Done — video ID: {lastVideoId}</p>}
      {state === 'error' && <p className="upload-status error">{error}</p>}
    </div>
  );
}

function formatBytes(bytes: number): string {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}
