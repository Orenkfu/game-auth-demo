import { Injectable, Inject, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { VideoRepository } from './repositories/video.repository';
import type { VideoStorageService } from './storage/video-storage.interface';
import { VIDEO_STORAGE_SERVICE } from './storage/video-storage.interface';
import { Video, VideoStatus, VideoVisibility, InitiateUploadResponse } from './types';
import { InitiateUploadDto } from './dto/initiate-upload.dto';
import { CompleteUploadDto } from './dto/complete-upload.dto';
import { UpdateVideoDto } from './dto/update-video.dto';
import { GetPartUrlsDto } from './dto/get-part-urls.dto';
import { MB, DEFAULT_MULTIPART_THRESHOLD_MB, DEFAULT_PART_SIZE_MB, DEFAULT_URL_EXPIRY_SECS } from './videos.constants';

@Injectable()
export class VideosService {
  private readonly multipartThreshold: number;
  private readonly partSize: number;
  private readonly urlExpiry: number;

  constructor(
    private readonly videoRepository: VideoRepository,
    @Inject(VIDEO_STORAGE_SERVICE) private readonly storage: VideoStorageService,
    private readonly config: ConfigService,
  ) {
    this.multipartThreshold =
      (Number(this.config.get('STORAGE_MULTIPART_THRESHOLD_MB')) || DEFAULT_MULTIPART_THRESHOLD_MB) * MB;
    this.partSize =
      (Number(this.config.get('STORAGE_PART_SIZE_MB')) || DEFAULT_PART_SIZE_MB) * MB;
    this.urlExpiry =
      Number(this.config.get('STORAGE_URL_EXPIRY_SECS')) || DEFAULT_URL_EXPIRY_SECS;
  }

  async initiateUpload(identityId: string, dto: InitiateUploadDto): Promise<InitiateUploadResponse> {
    const videoId = crypto.randomUUID();
    const storageKey = this.buildStorageKey(identityId, videoId, dto.filename);
    const now = new Date();
    const isMultipart = dto.fileSize >= this.multipartThreshold;

    const video: Video = {
      id: videoId,
      identityId,
      title: dto.title ?? null,
      filename: dto.filename,
      storageKey,
      uploadId: null,
      status: VideoStatus.PENDING,
      visibility: VideoVisibility.PRIVATE,
      sizeBytes: null,
      durationSecs: null,
      width: null,
      height: null,
      mimeType: dto.mimeType,
      createdAt: now,
      updatedAt: now,
    };

    await this.videoRepository.create(video);

    if (isMultipart) {
      const { uploadId } = await this.storage.initiateMultipartUpload(storageKey, dto.mimeType);
      await this.videoRepository.update(videoId, { ...video, uploadId, updatedAt: new Date() });
      return { videoId, uploadType: 'multipart', uploadId, partSize: this.partSize };
    }

    const { url } = await this.storage.getSingleUploadUrl(storageKey, dto.mimeType);
    return { videoId, uploadType: 'single', url };
  }

  async getPartUrls(identityId: string, uploadId: string, dto: GetPartUrlsDto) {
    const video = await this.videoRepository.findByUploadId(uploadId);
    if (!video) throw new NotFoundException('Upload not found');
    if (video.identityId !== identityId) throw new ForbiddenException();
    if (video.status !== VideoStatus.PENDING) throw new BadRequestException('Upload is no longer pending');

    return this.storage.getPartUploadUrls(video.storageKey, uploadId, dto.partNumbers);
  }

  async completeUpload(identityId: string, videoId: string, dto: CompleteUploadDto): Promise<Video> {
    const video = await this.videoRepository.findPendingByIdentityAndId(videoId, identityId);
    if (!video) throw new NotFoundException('Pending upload not found');

    if (video.uploadId) {
      if (!dto.parts?.length) throw new BadRequestException('parts are required for multipart upload');
      await this.storage.completeMultipartUpload(video.storageKey, video.uploadId, dto.parts);
    } else {
      const exists = await this.storage.objectExists(video.storageKey);
      if (!exists) throw new BadRequestException('Object not found in storage — upload may have failed');
    }

    const now = new Date();
    const updated: Video = {
      ...video,
      uploadId: null,
      status: VideoStatus.READY,
      sizeBytes: dto.sizeBytes,
      durationSecs: dto.durationSecs ?? null,
      width: dto.width ?? null,
      height: dto.height ?? null,
      updatedAt: now,
    };

    return this.videoRepository.update(videoId, updated);
  }

  async abortUpload(identityId: string, videoId: string): Promise<void> {
    const video = await this.videoRepository.findPendingByIdentityAndId(videoId, identityId);
    if (!video) throw new NotFoundException('Pending upload not found');

    if (video.uploadId) {
      await this.storage.abortMultipartUpload(video.storageKey, video.uploadId);
    } else {
      // Single-path: object may already be in storage, clean it up
      const exists = await this.storage.objectExists(video.storageKey);
      if (exists) await this.storage.deleteObject(video.storageKey);
    }

    await this.videoRepository.delete(videoId);
  }

  // TODO(tech-debt): add pagination — to be handled at project level with a shared helper
  async listVideos(identityId: string): Promise<Video[]> {
    return this.videoRepository.findByIdentityId(identityId, VideoStatus.READY);
  }

  async getVideo(id: string, identityId?: string): Promise<Video & { downloadUrl: string }> {
    const video = await this.videoRepository.findById(id);
    if (!video || video.status !== VideoStatus.READY) throw new NotFoundException('Video not found');

    if (video.visibility === VideoVisibility.PRIVATE) {
      if (!identityId || video.identityId !== identityId) throw new ForbiddenException();
    }

    const downloadUrl = await this.storage.getDownloadUrl(video.storageKey, this.urlExpiry);
    return { ...video, downloadUrl };
  }

  async updateVideo(identityId: string, id: string, dto: UpdateVideoDto): Promise<Video> {
    const video = await this.videoRepository.findById(id);
    if (!video || video.status !== VideoStatus.READY) throw new NotFoundException('Video not found');
    if (video.identityId !== identityId) throw new ForbiddenException();

    const updated: Video = { ...video, ...dto, updatedAt: new Date() };
    return this.videoRepository.update(id, updated);
  }

  async deleteVideo(identityId: string, id: string): Promise<void> {
    const video = await this.videoRepository.findById(id);
    if (!video) throw new NotFoundException('Video not found');
    if (video.identityId !== identityId) throw new ForbiddenException();
    if (video.status === VideoStatus.PENDING) throw new BadRequestException('Cannot delete a pending upload — use the abort endpoint instead');

    await this.storage.deleteObject(video.storageKey);
    await this.videoRepository.delete(id);
  }

  private buildStorageKey(identityId: string, videoId: string, filename: string): string {
    const ext = filename.split('.').pop() ?? 'mp4';
    return `videos/${identityId}/${videoId}/original.${ext}`;
  }
}
