import { Injectable } from '@nestjs/common';
import { InMemoryStore } from '../../../shared/services/in-memory-store.service';
import { BaseRepository } from '../../../shared/repositories/base.repository';
import { Video, VideoStatus } from '../types';
import { STORAGE_VIDEOS } from '../../../shared/constants';

@Injectable()
export class VideoRepository extends BaseRepository<Video> {
  protected readonly namespace = STORAGE_VIDEOS;

  constructor(store: InMemoryStore) {
    super(store);
  }

  async findByIdentityId(identityId: string, status?: VideoStatus): Promise<Video[]> {
    return this.filter((v) => v.identityId === identityId && (status === undefined || v.status === status));
  }

  async findByUploadId(uploadId: string): Promise<Video | null> {
    return this.find((v) => v.uploadId === uploadId);
  }

  async findPendingByIdentityAndId(id: string, identityId: string): Promise<Video | null> {
    return this.find((v) => v.id === id && v.identityId === identityId && v.status === VideoStatus.PENDING);
  }
}
