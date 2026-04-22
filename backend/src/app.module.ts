import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import { SharedModule } from './shared/shared.module';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { VideosModule } from './modules/videos/videos.module';
import { LoggingMiddleware } from './shared/middleware/logging.middleware';
import { ENV_FILE_LOCAL, ENV_FILE_DEFAULT } from './shared/constants';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: [ENV_FILE_LOCAL, ENV_FILE_DEFAULT],
    }),
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 60 }]),
    SharedModule,
    AuthModule,
    UsersModule,
    VideosModule,
  ],
  controllers: [],
  providers: [],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(LoggingMiddleware).forRoutes('*');
  }
}
