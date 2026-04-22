export type UploadType = 'single' | 'multipart';

export interface InitiateUploadResponse {
  videoId: string;
  uploadType: UploadType;
  url?: string;
  uploadId?: string;
  partSize?: number;
}
