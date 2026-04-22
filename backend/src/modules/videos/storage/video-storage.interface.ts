import type { PartUrl } from '../types';

export interface VideoStorageService {
  getSingleUploadUrl(key: string, mimeType: string): Promise<{ url: string }>;

  initiateMultipartUpload(key: string, mimeType: string): Promise<{ uploadId: string }>;
  getPartUploadUrls(key: string, uploadId: string, partNumbers: number[]): Promise<PartUrl[]>;
  completeMultipartUpload(
    key: string,
    uploadId: string,
    parts: { partNumber: number; etag: string }[],
  ): Promise<void>;
  abortMultipartUpload(key: string, uploadId: string): Promise<void>;

  objectExists(key: string): Promise<boolean>;
  getDownloadUrl(key: string, expiresInSecs?: number): Promise<string>;
  deleteObject(key: string): Promise<void>;
}

export const VIDEO_STORAGE_SERVICE = 'VIDEO_STORAGE_SERVICE';
