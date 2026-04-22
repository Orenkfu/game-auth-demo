import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { VideosController } from './videos.controller';
import { VideosService } from './videos.service';
import { VideoRepository } from './repositories/video.repository';
import { PrismaVideoRepository } from './repositories/prisma-video.repository';
import { S3VideoStorageService } from './storage/s3-video-storage.service';
import { VIDEO_STORAGE_SERVICE } from './storage/video-storage.interface';
import { InMemoryStore } from '../../shared/services/in-memory-store.service';
import { PrismaService } from '../../shared/services/prisma.service';

@Module({
  imports: [ConfigModule],
  controllers: [VideosController],
  providers: [
    {
      provide: VideoRepository,
      useFactory: (config: ConfigService, store: InMemoryStore, prisma: PrismaService) =>
        config.get('USE_POSTGRES') === 'true'
          ? new PrismaVideoRepository(prisma)
          : new VideoRepository(store),
      inject: [ConfigService, InMemoryStore, PrismaService],
    },
    {
      provide: VIDEO_STORAGE_SERVICE,
      useClass: S3VideoStorageService,
    },
    VideosService,
  ],
  exports: [VideosService],
})
export class VideosModule {}
