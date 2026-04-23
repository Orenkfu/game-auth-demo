import {
  Controller,
  Post,
  Get,
  Patch,
  Delete,
  Body,
  Param,
  HttpCode,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import { VideosService } from './videos.service';
import { InitiateUploadDto } from './dto/initiate-upload.dto';
import { CompleteUploadDto } from './dto/complete-upload.dto';
import { GetPartUrlsDto } from './dto/get-part-urls.dto';
import { UpdateVideoDto } from './dto/update-video.dto';
import { SessionGuard } from '../../shared/guards/session.guard';
import { CurrentSession } from '../../shared/decorators/current-session.decorator';
import type { Session } from '../auth/services/session.service';

@Controller('videos')
export class VideosController {
  constructor(private readonly videosService: VideosService) {}

  @Throttle({ default: { ttl: 60_000, limit: 20 } })
  @UseGuards(ThrottlerGuard, SessionGuard)
  @Post('upload/initiate')
  initiateUpload(@CurrentSession() session: Session, @Body() dto: InitiateUploadDto) {
    return this.videosService.initiateUpload(session.identityId, dto);
  }

  @Post('upload/:uploadId/parts')
  @UseGuards(SessionGuard)
  getPartUrls(
    @CurrentSession() session: Session,
    @Param('uploadId') uploadId: string,
    @Body() dto: GetPartUrlsDto,
  ) {
    return this.videosService.getPartUrls(session.identityId, uploadId, dto);
  }

  @Post('upload/:videoId/complete')
  @UseGuards(SessionGuard)
  completeUpload(
    @CurrentSession() session: Session,
    @Param('videoId') videoId: string,
    @Body() dto: CompleteUploadDto,
  ) {
    return this.videosService.completeUpload(session.identityId, videoId, dto);
  }

  @Delete('upload/:videoId')
  @UseGuards(SessionGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  abortUpload(@CurrentSession() session: Session, @Param('videoId') videoId: string) {
    return this.videosService.abortUpload(session.identityId, videoId);
  }

  @Get()
  @UseGuards(SessionGuard)
  listVideos(@CurrentSession() session: Session) {
    return this.videosService.listVideos(session.identityId);
  }

  @Get(':id')
  getVideo(@CurrentSession() session: Session | undefined, @Param('id') id: string) {
    return this.videosService.getVideo(id, session?.identityId);
  }

  @Patch(':id')
  @UseGuards(SessionGuard)
  updateVideo(
    @CurrentSession() session: Session,
    @Param('id') id: string,
    @Body() dto: UpdateVideoDto,
  ) {
    return this.videosService.updateVideo(session.identityId, id, dto);
  }

  @Delete(':id')
  @UseGuards(SessionGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  deleteVideo(@CurrentSession() session: Session, @Param('id') id: string) {
    return this.videosService.deleteVideo(session.identityId, id);
  }
}
