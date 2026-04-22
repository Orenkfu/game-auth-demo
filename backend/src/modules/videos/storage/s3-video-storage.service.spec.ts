import { S3VideoStorageService } from './s3-video-storage.service';
import type { ConfigService } from '@nestjs/config';

// ─── AWS SDK mocks ────────────────────────────────────────────────────────────

const mockSend = jest.fn();
const mockGetSignedUrl = jest.fn();

jest.mock('@aws-sdk/client-s3', () => ({
  S3Client: jest.fn().mockImplementation(() => ({ send: mockSend })),
  PutObjectCommand: jest.fn().mockImplementation((input) => ({ input })),
  CreateMultipartUploadCommand: jest.fn().mockImplementation((input) => ({ input })),
  UploadPartCommand: jest.fn().mockImplementation((input) => ({ input })),
  CompleteMultipartUploadCommand: jest.fn().mockImplementation((input) => ({ input })),
  AbortMultipartUploadCommand: jest.fn().mockImplementation((input) => ({ input })),
  HeadObjectCommand: jest.fn().mockImplementation((input) => ({ input })),
  GetObjectCommand: jest.fn().mockImplementation((input) => ({ input })),
  DeleteObjectCommand: jest.fn().mockImplementation((input) => ({ input })),
}));

jest.mock('@aws-sdk/s3-request-presigner', () => ({
  getSignedUrl: (...args: any[]) => mockGetSignedUrl(...args),
}));

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeConfig(overrides: Record<string, string | undefined> = {}): jest.Mocked<ConfigService> {
  const defaults: Record<string, string | undefined> = {
    STORAGE_BUCKET: 'test-bucket',
    STORAGE_REGION: 'us-east-1',
    STORAGE_URL_EXPIRY_SECS: '3600',
    STORAGE_ENDPOINT: undefined,
    STORAGE_CDN_DOMAIN: undefined,
    AWS_ACCESS_KEY_ID: 'test-key',
    AWS_SECRET_ACCESS_KEY: 'test-secret',
    ...overrides,
  };

  return {
    get: jest.fn((key: string) => defaults[key]),
    getOrThrow: jest.fn((key: string) => {
      const val = defaults[key];
      if (val === undefined) throw new Error(`Missing config: ${key}`);
      return val;
    }),
  } as unknown as jest.Mocked<ConfigService>;
}

function makeService(configOverrides: Record<string, string | undefined> = {}): S3VideoStorageService {
  const svc = new S3VideoStorageService(makeConfig(configOverrides));
  svc.onModuleInit();
  return svc;
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('S3VideoStorageService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('onModuleInit', () => {
    it('initialises S3Client with forcePathStyle when endpoint is set', () => {
      const { S3Client } = require('@aws-sdk/client-s3');
      makeService({ STORAGE_ENDPOINT: 'http://localhost:9000' });
      expect(S3Client).toHaveBeenCalledWith(
        expect.objectContaining({ endpoint: 'http://localhost:9000', forcePathStyle: true }),
      );
    });

    it('initialises S3Client without forcePathStyle when no endpoint', () => {
      const { S3Client } = require('@aws-sdk/client-s3');
      makeService();
      expect(S3Client).toHaveBeenCalledWith(
        expect.not.objectContaining({ forcePathStyle: true }),
      );
    });
  });

  describe('getSingleUploadUrl', () => {
    it('returns a pre-signed PUT URL for the given key and mimeType', async () => {
      mockGetSignedUrl.mockResolvedValue('https://signed-url');
      const svc = makeService();

      const result = await svc.getSingleUploadUrl('videos/id/original.mp4', 'video/mp4');

      expect(result).toEqual({ url: 'https://signed-url' });
      expect(mockGetSignedUrl).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ input: { Bucket: 'test-bucket', Key: 'videos/id/original.mp4', ContentType: 'video/mp4' } }),
        { expiresIn: 3600 },
      );
    });
  });

  describe('initiateMultipartUpload', () => {
    it('returns the uploadId from S3', async () => {
      mockSend.mockResolvedValue({ UploadId: 'upload-abc' });
      const svc = makeService();

      const result = await svc.initiateMultipartUpload('videos/id/original.mp4', 'video/mp4');

      expect(result).toEqual({ uploadId: 'upload-abc' });
      const { CreateMultipartUploadCommand } = require('@aws-sdk/client-s3');
      expect(CreateMultipartUploadCommand).toHaveBeenCalledWith({
        Bucket: 'test-bucket',
        Key: 'videos/id/original.mp4',
        ContentType: 'video/mp4',
      });
    });
  });

  describe('getPartUploadUrls', () => {
    it('returns a signed URL per part number', async () => {
      mockGetSignedUrl
        .mockResolvedValueOnce('https://part-1-url')
        .mockResolvedValueOnce('https://part-2-url');
      const svc = makeService();

      const result = await svc.getPartUploadUrls('videos/id/original.mp4', 'upload-abc', [1, 2]);

      expect(result).toEqual([
        { partNumber: 1, url: 'https://part-1-url' },
        { partNumber: 2, url: 'https://part-2-url' },
      ]);
    });

    it('passes correct PartNumber and UploadId to each command', async () => {
      mockGetSignedUrl.mockResolvedValue('https://url');
      const svc = makeService();
      const { UploadPartCommand } = require('@aws-sdk/client-s3');

      await svc.getPartUploadUrls('videos/id/original.mp4', 'upload-abc', [3]);

      expect(UploadPartCommand).toHaveBeenCalledWith({
        Bucket: 'test-bucket',
        Key: 'videos/id/original.mp4',
        UploadId: 'upload-abc',
        PartNumber: 3,
      });
    });
  });

  describe('completeMultipartUpload', () => {
    it('sends CompleteMultipartUploadCommand with mapped parts', async () => {
      mockSend.mockResolvedValue({});
      const svc = makeService();
      const { CompleteMultipartUploadCommand } = require('@aws-sdk/client-s3');

      await svc.completeMultipartUpload('videos/id/original.mp4', 'upload-abc', [
        { partNumber: 1, etag: 'etag-1' },
        { partNumber: 2, etag: 'etag-2' },
      ]);

      expect(CompleteMultipartUploadCommand).toHaveBeenCalledWith({
        Bucket: 'test-bucket',
        Key: 'videos/id/original.mp4',
        UploadId: 'upload-abc',
        MultipartUpload: {
          Parts: [
            { PartNumber: 1, ETag: 'etag-1' },
            { PartNumber: 2, ETag: 'etag-2' },
          ],
        },
      });
    });
  });

  describe('abortMultipartUpload', () => {
    it('sends AbortMultipartUploadCommand', async () => {
      mockSend.mockResolvedValue({});
      const svc = makeService();
      const { AbortMultipartUploadCommand } = require('@aws-sdk/client-s3');

      await svc.abortMultipartUpload('videos/id/original.mp4', 'upload-abc');

      expect(AbortMultipartUploadCommand).toHaveBeenCalledWith({
        Bucket: 'test-bucket',
        Key: 'videos/id/original.mp4',
        UploadId: 'upload-abc',
      });
    });
  });

  describe('objectExists', () => {
    it('returns true when HeadObject succeeds', async () => {
      mockSend.mockResolvedValue({});
      const svc = makeService();

      expect(await svc.objectExists('videos/id/original.mp4')).toBe(true);
    });

    it('returns false on 404', async () => {
      mockSend.mockRejectedValue({ name: 'NotFound' });
      const svc = makeService();

      expect(await svc.objectExists('videos/id/original.mp4')).toBe(false);
    });

    it('returns false when $metadata httpStatusCode is 404', async () => {
      mockSend.mockRejectedValue({ $metadata: { httpStatusCode: 404 } });
      const svc = makeService();

      expect(await svc.objectExists('videos/id/original.mp4')).toBe(false);
    });

    it('rethrows unexpected errors', async () => {
      mockSend.mockRejectedValue(new Error('network error'));
      const svc = makeService();

      await expect(svc.objectExists('videos/id/original.mp4')).rejects.toThrow('network error');
    });
  });

  describe('getDownloadUrl', () => {
    it('returns a CDN URL directly when STORAGE_CDN_DOMAIN is set', async () => {
      const svc = makeService({ STORAGE_CDN_DOMAIN: 'https://cdn.example.com' });

      const url = await svc.getDownloadUrl('videos/id/original.mp4');

      expect(url).toBe('https://cdn.example.com/videos/id/original.mp4');
      expect(mockGetSignedUrl).not.toHaveBeenCalled();
    });

    it('returns a pre-signed GetObject URL when no CDN domain', async () => {
      mockGetSignedUrl.mockResolvedValue('https://signed-download-url');
      const svc = makeService();

      const url = await svc.getDownloadUrl('videos/id/original.mp4');

      expect(url).toBe('https://signed-download-url');
      const { GetObjectCommand } = require('@aws-sdk/client-s3');
      expect(GetObjectCommand).toHaveBeenCalledWith({
        Bucket: 'test-bucket',
        Key: 'videos/id/original.mp4',
      });
    });

    it('uses custom expiry when provided', async () => {
      mockGetSignedUrl.mockResolvedValue('https://url');
      const svc = makeService();

      await svc.getDownloadUrl('videos/id/original.mp4', 300);

      expect(mockGetSignedUrl).toHaveBeenCalledWith(expect.anything(), expect.anything(), { expiresIn: 300 });
    });
  });

  describe('deleteObject', () => {
    it('sends DeleteObjectCommand with correct key', async () => {
      mockSend.mockResolvedValue({});
      const svc = makeService();
      const { DeleteObjectCommand } = require('@aws-sdk/client-s3');

      await svc.deleteObject('videos/id/original.mp4');

      expect(DeleteObjectCommand).toHaveBeenCalledWith({
        Bucket: 'test-bucket',
        Key: 'videos/id/original.mp4',
      });
    });
  });
});
