import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../shared/services/prisma.service';
import { Video, VideoStatus, VideoVisibility } from '../types';
import { VideoRepository } from './video.repository';

@Injectable()
export class PrismaVideoRepository extends VideoRepository {
  constructor(private readonly prisma: PrismaService) {
    super(null as any);
  }

  async create(video: Video): Promise<Video> {
    const row = await this.prisma.video.create({ data: toPrismaInput(video) });
    return fromPrisma(row);
  }

  async findById(id: string): Promise<Video | null> {
    const row = await this.prisma.video.findUnique({ where: { id } });
    return row ? fromPrisma(row) : null;
  }

  async findAll(): Promise<Video[]> {
    const rows = await this.prisma.video.findMany();
    return rows.map(fromPrisma);
  }

  async findByIdentityId(identityId: string, status?: VideoStatus): Promise<Video[]> {
    const rows = await this.prisma.video.findMany({ where: { identityId, ...(status && { status }) } });
    return rows.map(fromPrisma);
  }

  async findByUploadId(uploadId: string): Promise<Video | null> {
    const row = await this.prisma.video.findFirst({ where: { uploadId } });
    return row ? fromPrisma(row) : null;
  }

  async findPendingByIdentityAndId(id: string, identityId: string): Promise<Video | null> {
    const row = await this.prisma.video.findFirst({
      where: { id, identityId, status: VideoStatus.PENDING },
    });
    return row ? fromPrisma(row) : null;
  }

  async update(id: string, video: Video): Promise<Video> {
    const row = await this.prisma.video.update({ where: { id }, data: toPrismaInput(video) });
    return fromPrisma(row);
  }

  async delete(id: string): Promise<boolean> {
    await this.prisma.video.delete({ where: { id } });
    return true;
  }
}

function fromPrisma(row: any): Video {
  return {
    id: row.id,
    identityId: row.identityId,
    title: row.title,
    filename: row.filename,
    storageKey: row.storageKey,
    uploadId: row.uploadId,
    status: row.status as VideoStatus,
    visibility: row.visibility as VideoVisibility,
    sizeBytes: row.sizeBytes !== null ? Number(row.sizeBytes) : null,
    durationSecs: row.durationSecs,
    width: row.width,
    height: row.height,
    mimeType: row.mimeType,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function toPrismaInput(video: Video) {
  return {
    id: video.id,
    identityId: video.identityId,
    title: video.title,
    filename: video.filename,
    storageKey: video.storageKey,
    uploadId: video.uploadId,
    status: video.status,
    visibility: video.visibility,
    sizeBytes: video.sizeBytes,
    durationSecs: video.durationSecs,
    width: video.width,
    height: video.height,
    mimeType: video.mimeType,
    updatedAt: video.updatedAt,
  };
}
