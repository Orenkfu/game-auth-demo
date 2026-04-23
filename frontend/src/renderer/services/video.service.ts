import { config } from '../config';

export interface VideoMeta {
  id: string;
  title: string | null;
  filename: string;
  status: string;
  visibility: string;
  sizeBytes: number | null;
  durationSecs: number | null;
  width: number | null;
  height: number | null;
  mimeType: string;
  createdAt: string;
  downloadUrl: string;
}

interface InitiateResponse {
  videoId: string;
  uploadType: 'single' | 'multipart';
  url?: string;
  uploadId?: string;
  partSize?: number;
}

interface PartUrl {
  partNumber: number;
  url: string;
}

export class VideoService {
  async upload(file: File, token: string): Promise<{ videoId: string }> {
    const initiated = await this.initiate(file, token);
    const { videoId, uploadType, url, uploadId, partSize } = initiated;

    try {
      if (uploadType === 'single') {
        await this.putSingle(url!, file);
        await this.complete(videoId, token, { sizeBytes: file.size });
      } else {
        const parts = await this.putMultipart(file, uploadId!, partSize!, videoId, token);
        await this.complete(videoId, token, { sizeBytes: file.size, parts });
      }
      return { videoId };
    } catch (err) {
      await this.abort(videoId, token).catch(() => {});
      throw err;
    }
  }

  async listVideos(token: string): Promise<VideoMeta[]> {
    const res = await fetch(`${config.backendUrl}/videos`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) throw new Error(`Failed to list videos: ${res.status}`);
    return res.json();
  }

  async deleteVideo(videoId: string, token: string): Promise<void> {
    const res = await fetch(`${config.backendUrl}/videos/${videoId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) throw new Error(`Failed to delete video: ${res.status}`);
  }

  private async initiate(file: File, token: string): Promise<InitiateResponse> {
    const res = await fetch(`${config.backendUrl}/videos/upload/initiate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        filename: file.name,
        mimeType: file.type || 'video/mp4',
        fileSize: file.size,
        title: file.name.replace(/\.[^.]+$/, ''),
      }),
    });
    if (!res.ok) throw new Error(`Initiate failed: ${res.status}`);
    return res.json();
  }

  private async putSingle(url: string, file: File): Promise<void> {
    const res = await fetch(url, {
      method: 'PUT',
      headers: { 'Content-Type': file.type || 'video/mp4' },
      body: file,
    });
    if (!res.ok) throw new Error(`Single upload failed: ${res.status}`);
  }

  private async putMultipart(
    file: File,
    uploadId: string,
    partSize: number,
    videoId: string,
    token: string,
  ): Promise<{ partNumber: number; etag: string }[]> {
    const totalParts = Math.ceil(file.size / partSize);
    const partNumbers = Array.from({ length: totalParts }, (_, i) => i + 1);

    const urlRes = await fetch(`${config.backendUrl}/videos/upload/${uploadId}/parts`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ partNumbers }),
    });
    if (!urlRes.ok) throw new Error(`Failed to get part URLs: ${urlRes.status}`);
    const partUrls: PartUrl[] = await urlRes.json();

    const parts: { partNumber: number; etag: string }[] = [];

    for (const { partNumber, url } of partUrls) {
      const start = (partNumber - 1) * partSize;
      const end = Math.min(start + partSize, file.size);
      const chunk = file.slice(start, end);

      const res = await fetch(url, {
        method: 'PUT',
        headers: { 'Content-Type': file.type || 'video/mp4' },
        body: chunk,
      });
      if (!res.ok) throw new Error(`Part ${partNumber} upload failed: ${res.status}`);

      const etag = res.headers.get('ETag');
      if (!etag) throw new Error(`No ETag returned for part ${partNumber}`);
      parts.push({ partNumber, etag });
    }

    return parts;
  }

  private async complete(
    videoId: string,
    token: string,
    payload: { sizeBytes: number; parts?: { partNumber: number; etag: string }[] },
  ): Promise<void> {
    const res = await fetch(`${config.backendUrl}/videos/upload/${videoId}/complete`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error(`Complete failed: ${res.status}`);
  }

  private async abort(videoId: string, token: string): Promise<void> {
    await fetch(`${config.backendUrl}/videos/upload/${videoId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    });
  }
}
