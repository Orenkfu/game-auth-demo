import { ForbiddenException, NotFoundException, BadRequestException } from '@nestjs/common';
import { VideosService } from './videos.service';
import { VideoRepository } from './repositories/video.repository';
import { InMemoryStore } from '../../shared/services/in-memory-store.service';
import { VideoStatus, VideoVisibility } from './types';
import type { Video } from './types';
import type { VideoStorageService } from './storage/video-storage.interface';
import type { ConfigService } from '@nestjs/config';

// ─── Mocks ────────────────────────────────────────────────────────────────────

const mockStorage: jest.Mocked<VideoStorageService> = {
  getSingleUploadUrl: jest.fn(),
  initiateMultipartUpload: jest.fn(),
  getPartUploadUrls: jest.fn(),
  completeMultipartUpload: jest.fn(),
  abortMultipartUpload: jest.fn(),
  objectExists: jest.fn(),
  getDownloadUrl: jest.fn(),
  deleteObject: jest.fn(),
};

function makeConfig(overrides: Record<string, string> = {}): jest.Mocked<ConfigService> {
  return {
    get: jest.fn((key: string) => overrides[key]),
  } as unknown as jest.Mocked<ConfigService>;
}

// ─── Factories ────────────────────────────────────────────────────────────────

function makeVideo(overrides: Partial<Video> = {}): Video {
  const now = new Date();
  return {
    id: 'video-1',
    identityId: 'identity-1',
    title: null,
    filename: 'clip.mp4',
    storageKey: 'videos/identity-1/video-1/original.mp4',
    uploadId: null,
    status: VideoStatus.READY,
    visibility: VideoVisibility.PRIVATE,
    sizeBytes: null,
    durationSecs: null,
    width: null,
    height: null,
    mimeType: 'video/mp4',
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

function makeService() {
  const store = new InMemoryStore();
  const repo = new VideoRepository(store);
  const svc = new VideosService(repo, mockStorage, makeConfig());
  return { svc, repo };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('VideosService', () => {
  beforeEach(() => jest.clearAllMocks());

  // ── initiateUpload ──────────────────────────────────────────────────────────

  describe('initiateUpload', () => {
    it('returns single upload URL for small files', async () => {
      mockStorage.getSingleUploadUrl.mockResolvedValue({ url: 'https://put-url' });
      const { svc } = makeService();

      const result = await svc.initiateUpload('identity-1', {
        filename: 'clip.mp4',
        mimeType: 'video/mp4',
        fileSize: 10 * 1024 * 1024,
      });

      expect(result.uploadType).toBe('single');
      expect(result.url).toBe('https://put-url');
      expect(result.videoId).toBeDefined();
      expect(result).not.toHaveProperty('storageKey');
      expect(mockStorage.initiateMultipartUpload).not.toHaveBeenCalled();
    });

    it('returns multipart details for large files', async () => {
      mockStorage.initiateMultipartUpload.mockResolvedValue({ uploadId: 'upload-abc' });
      const { svc } = makeService();

      const result = await svc.initiateUpload('identity-1', {
        filename: 'session.mp4',
        mimeType: 'video/mp4',
        fileSize: 200 * 1024 * 1024,
      });

      expect(result.uploadType).toBe('multipart');
      expect(result.uploadId).toBe('upload-abc');
      expect(result.partSize).toBeDefined();
      expect(result).not.toHaveProperty('storageKey');
      expect(mockStorage.getSingleUploadUrl).not.toHaveBeenCalled();
    });

    it('persists a pending video record before calling storage', async () => {
      const { svc, repo } = makeService();
      let recordCountBeforeStorage = 0;
      mockStorage.initiateMultipartUpload.mockImplementation(async () => {
        recordCountBeforeStorage = (await repo.findAll()).length;
        return { uploadId: 'upload-abc' };
      });

      const result = await svc.initiateUpload('identity-1', {
        filename: 'session.mp4',
        mimeType: 'video/mp4',
        fileSize: 200 * 1024 * 1024,
      });

      expect(recordCountBeforeStorage).toBe(1);
      expect((await repo.findById(result.videoId))!.status).toBe(VideoStatus.PENDING);
    });

    it('builds storage key with namespaced structure', async () => {
      mockStorage.getSingleUploadUrl.mockResolvedValue({ url: 'https://url' });
      const { svc, repo } = makeService();

      const result = await svc.initiateUpload('identity-1', {
        filename: 'clip.mp4',
        mimeType: 'video/mp4',
        fileSize: 1024,
      });

      const video = await repo.findById(result.videoId);
      expect(video!.storageKey).toMatch(/^videos\/identity-1\/.+\/original\.mp4$/);
    });
  });

  // ── getPartUrls ─────────────────────────────────────────────────────────────

  describe('getPartUrls', () => {
    it('returns part URLs for a valid pending multipart upload', async () => {
      const partUrls = [{ partNumber: 1, url: 'https://part-1' }];
      mockStorage.getPartUploadUrls.mockResolvedValue(partUrls);
      const { svc, repo } = makeService();
      await repo.create(makeVideo({ status: VideoStatus.PENDING, uploadId: 'upload-abc' }));

      const result = await svc.getPartUrls('identity-1', 'upload-abc', { partNumbers: [1] });

      expect(result).toEqual(partUrls);
    });

    it('throws NotFoundException when uploadId is unknown', async () => {
      const { svc } = makeService();
      await expect(svc.getPartUrls('identity-1', 'bad-id', { partNumbers: [1] })).rejects.toThrow(NotFoundException);
    });

    it('throws ForbiddenException when caller does not own the upload', async () => {
      const { svc, repo } = makeService();
      await repo.create(makeVideo({ status: VideoStatus.PENDING, uploadId: 'upload-abc' }));

      await expect(svc.getPartUrls('other-identity', 'upload-abc', { partNumbers: [1] })).rejects.toThrow(ForbiddenException);
    });

    it('throws BadRequestException when upload is no longer pending', async () => {
      const { svc, repo } = makeService();
      await repo.create(makeVideo({ status: VideoStatus.READY, uploadId: 'upload-abc' }));

      await expect(svc.getPartUrls('identity-1', 'upload-abc', { partNumbers: [1] })).rejects.toThrow(BadRequestException);
    });
  });

  // ── completeUpload ──────────────────────────────────────────────────────────

  describe('completeUpload', () => {
    it('completes a single-path upload when object exists', async () => {
      mockStorage.objectExists.mockResolvedValue(true);
      const { svc, repo } = makeService();
      await repo.create(makeVideo({ status: VideoStatus.PENDING, uploadId: null }));

      const result = await svc.completeUpload('identity-1', 'video-1', {
        sizeBytes: 5_000_000,
        durationSecs: 30,
        width: 1920,
        height: 1080,
      });

      expect(result.status).toBe(VideoStatus.READY);
      expect(result.sizeBytes).toBe(5_000_000);
      expect(result.durationSecs).toBe(30);
      expect(result.width).toBe(1920);
      expect(result.height).toBe(1080);
    });

    it('completes a multipart upload and clears uploadId', async () => {
      mockStorage.completeMultipartUpload.mockResolvedValue(undefined);
      const { svc, repo } = makeService();
      await repo.create(makeVideo({ status: VideoStatus.PENDING, uploadId: 'upload-abc' }));

      const result = await svc.completeUpload('identity-1', 'video-1', {
        sizeBytes: 200_000_000,
        parts: [{ partNumber: 1, etag: 'etag-1' }],
      });

      expect(result.status).toBe(VideoStatus.READY);
      expect(result.uploadId).toBeNull();
      expect(mockStorage.completeMultipartUpload).toHaveBeenCalledWith(
        expect.any(String),
        'upload-abc',
        [{ partNumber: 1, etag: 'etag-1' }],
      );
    });

    it('throws BadRequestException for single-path when object missing', async () => {
      mockStorage.objectExists.mockResolvedValue(false);
      const { svc, repo } = makeService();
      await repo.create(makeVideo({ status: VideoStatus.PENDING, uploadId: null }));

      await expect(svc.completeUpload('identity-1', 'video-1', { sizeBytes: 1 })).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException for multipart when parts are missing', async () => {
      const { svc, repo } = makeService();
      await repo.create(makeVideo({ status: VideoStatus.PENDING, uploadId: 'upload-abc' }));

      await expect(svc.completeUpload('identity-1', 'video-1', { sizeBytes: 1 })).rejects.toThrow(BadRequestException);
    });

    it('throws NotFoundException when video is not pending', async () => {
      const { svc, repo } = makeService();
      await repo.create(makeVideo({ status: VideoStatus.READY }));

      await expect(svc.completeUpload('identity-1', 'video-1', { sizeBytes: 1 })).rejects.toThrow(NotFoundException);
    });
  });

  // ── abortUpload ─────────────────────────────────────────────────────────────

  describe('abortUpload', () => {
    it('aborts a multipart upload and deletes the record', async () => {
      mockStorage.abortMultipartUpload.mockResolvedValue(undefined);
      const { svc, repo } = makeService();
      await repo.create(makeVideo({ status: VideoStatus.PENDING, uploadId: 'upload-abc' }));

      await svc.abortUpload('identity-1', 'video-1');

      expect(mockStorage.abortMultipartUpload).toHaveBeenCalledWith(
        expect.any(String), 'upload-abc',
      );
      expect(await repo.findById('video-1')).toBeNull();
    });

    it('deletes the object for a single-path abort when object exists', async () => {
      mockStorage.objectExists.mockResolvedValue(true);
      mockStorage.deleteObject.mockResolvedValue(undefined);
      const { svc, repo } = makeService();
      await repo.create(makeVideo({ status: VideoStatus.PENDING, uploadId: null }));

      await svc.abortUpload('identity-1', 'video-1');

      expect(mockStorage.deleteObject).toHaveBeenCalled();
      expect(await repo.findById('video-1')).toBeNull();
    });

    it('skips deleteObject for single-path when object does not yet exist', async () => {
      mockStorage.objectExists.mockResolvedValue(false);
      const { svc, repo } = makeService();
      await repo.create(makeVideo({ status: VideoStatus.PENDING, uploadId: null }));

      await svc.abortUpload('identity-1', 'video-1');

      expect(mockStorage.deleteObject).not.toHaveBeenCalled();
    });

    it('throws NotFoundException when video not found', async () => {
      const { svc } = makeService();
      await expect(svc.abortUpload('identity-1', 'missing')).rejects.toThrow(NotFoundException);
    });
  });

  // ── listVideos ──────────────────────────────────────────────────────────────

  describe('listVideos', () => {
    it('returns only ready videos belonging to the identity', async () => {
      const { svc, repo } = makeService();
      await repo.create(makeVideo({ id: 'v1', status: VideoStatus.READY }));
      await repo.create(makeVideo({ id: 'v2', status: VideoStatus.PENDING }));
      await repo.create(makeVideo({ id: 'v3', status: VideoStatus.READY, identityId: 'other' }));

      const result = await svc.listVideos('identity-1');

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('v1');
    });
  });

  // ── getVideo ────────────────────────────────────────────────────────────────

  describe('getVideo', () => {
    it('returns video with download URL for owner', async () => {
      mockStorage.getDownloadUrl.mockResolvedValue('https://download-url');
      const { svc, repo } = makeService();
      await repo.create(makeVideo());

      const result = await svc.getVideo('video-1', 'identity-1');

      expect(result.downloadUrl).toBe('https://download-url');
    });

    it('throws ForbiddenException for private video accessed by non-owner', async () => {
      const { svc, repo } = makeService();
      await repo.create(makeVideo({ visibility: VideoVisibility.PRIVATE }));

      await expect(svc.getVideo('video-1', 'other-identity')).rejects.toThrow(ForbiddenException);
    });

    it('throws ForbiddenException for private video accessed with no session', async () => {
      const { svc, repo } = makeService();
      await repo.create(makeVideo({ visibility: VideoVisibility.PRIVATE }));

      await expect(svc.getVideo('video-1', undefined)).rejects.toThrow(ForbiddenException);
    });

    it('returns unlisted video without authentication', async () => {
      mockStorage.getDownloadUrl.mockResolvedValue('https://url');
      const { svc, repo } = makeService();
      await repo.create(makeVideo({ visibility: VideoVisibility.UNLISTED }));

      const result = await svc.getVideo('video-1', undefined);

      expect(result.id).toBe('video-1');
    });

    it('throws NotFoundException for non-existent video', async () => {
      const { svc } = makeService();
      await expect(svc.getVideo('missing', 'identity-1')).rejects.toThrow(NotFoundException);
    });

    it('throws NotFoundException for pending video', async () => {
      const { svc, repo } = makeService();
      await repo.create(makeVideo({ status: VideoStatus.PENDING }));

      await expect(svc.getVideo('video-1', 'identity-1')).rejects.toThrow(NotFoundException);
    });
  });

  // ── updateVideo ─────────────────────────────────────────────────────────────

  describe('updateVideo', () => {
    it('updates title and visibility', async () => {
      const { svc, repo } = makeService();
      await repo.create(makeVideo());

      const result = await svc.updateVideo('identity-1', 'video-1', {
        title: 'Best clip',
        visibility: VideoVisibility.PUBLIC,
      });

      expect(result.title).toBe('Best clip');
      expect(result.visibility).toBe(VideoVisibility.PUBLIC);
    });

    it('throws ForbiddenException when caller does not own the video', async () => {
      const { svc, repo } = makeService();
      await repo.create(makeVideo());

      await expect(svc.updateVideo('other', 'video-1', { title: 'x' })).rejects.toThrow(ForbiddenException);
    });

    it('throws NotFoundException for non-existent video', async () => {
      const { svc } = makeService();
      await expect(svc.updateVideo('identity-1', 'missing', {})).rejects.toThrow(NotFoundException);
    });
  });

  // ── deleteVideo ─────────────────────────────────────────────────────────────

  describe('deleteVideo', () => {
    it('deletes from storage and removes the record', async () => {
      mockStorage.deleteObject.mockResolvedValue(undefined);
      const { svc, repo } = makeService();
      await repo.create(makeVideo());

      await svc.deleteVideo('identity-1', 'video-1');

      expect(mockStorage.deleteObject).toHaveBeenCalledWith('videos/identity-1/video-1/original.mp4');
      expect(await repo.findById('video-1')).toBeNull();
    });

    it('throws ForbiddenException when caller does not own the video', async () => {
      const { svc, repo } = makeService();
      await repo.create(makeVideo());

      await expect(svc.deleteVideo('other', 'video-1')).rejects.toThrow(ForbiddenException);
    });

    it('throws NotFoundException for non-existent video', async () => {
      const { svc } = makeService();
      await expect(svc.deleteVideo('identity-1', 'missing')).rejects.toThrow(NotFoundException);
    });

    it('throws BadRequestException for pending video — use abort endpoint', async () => {
      const { svc, repo } = makeService();
      await repo.create(makeVideo({ status: VideoStatus.PENDING }));

      await expect(svc.deleteVideo('identity-1', 'video-1')).rejects.toThrow(BadRequestException);
    });
  });
});
