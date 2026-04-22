import { VideoStatus } from './video-status.types';
import { VideoVisibility } from './video-visibility.types';

export interface Video {
  id: string;
  identityId: string;
  title: string | null;
  filename: string;
  storageKey: string;
  uploadId: string | null;
  status: VideoStatus;
  visibility: VideoVisibility;
  sizeBytes: number | null;
  durationSecs: number | null;
  width: number | null;
  height: number | null;
  mimeType: string;
  createdAt: Date;
  updatedAt: Date;
}
