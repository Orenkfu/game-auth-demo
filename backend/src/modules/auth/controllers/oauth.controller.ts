import {
  Controller,
  Get,
  Post,
  Query,
  Headers,
  Res,
  HttpCode,
  HttpStatus,
  BadRequestException,
  UnauthorizedException,
  UseGuards,
  Logger,
} from '@nestjs/common';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import { IsOptional, IsString } from 'class-validator';
import express from 'express';
import { OAuthService } from '../services/oauth.service';
import { SessionService } from '../services/session.service';
import type { Session } from '../services/session.service';
import { DiscordUser } from '../providers/discord/discord.types';
import { RiotAccount } from '../providers/riot/riot.types';
import { SessionGuard } from '../../../shared/guards/session.guard';
import { CurrentSession } from '../../../shared/decorators/current-session.decorator';
import {
  OAUTH_CONTROLLER_ROUTE,
  OAUTH_DISCORD_ROUTE,
  OAUTH_DISCORD_CALLBACK_ROUTE,
  OAUTH_DISCORD_LINK_ROUTE,
  OAUTH_RIOT_ROUTE,
  OAUTH_RIOT_CALLBACK_ROUTE,
  OAUTH_RIOT_LINK_ROUTE,
  OAUTH_SESSION_ROUTE,
  OAUTH_LOGOUT_ROUTE,
  ERROR_DISCORD_AUTH_FAILED,
  ERROR_RIOT_AUTH_FAILED,
  ERROR_MISSING_SESSION_TOKEN,
  ERROR_INVALID_SESSION,
  SUCCESS_ACCOUNT_CREATED,
  SUCCESS_LOGIN,
  SUCCESS_LOGGED_OUT,
  DISCORD_AVATAR_CDN_URL,
  PROVIDER_DISCORD,
  PROVIDER_RIOT,
} from '../../../shared/constants';

export class OAuthCallbackQuery {
  @IsString()
  code!: string;

  @IsString()
  state!: string;

  @IsOptional()
  @IsString()
  error?: string;

  @IsOptional()
  @IsString()
  error_description?: string;
}

@Controller(OAUTH_CONTROLLER_ROUTE)
export class OAuthController {
  private readonly logger = new Logger(OAuthController.name);

  constructor(
    private readonly oauthService: OAuthService,
    private readonly sessionService: SessionService,
  ) { }

  // === Discord ===

  @Get(OAUTH_DISCORD_ROUTE)
  async discordAuth(@Res() res: express.Response): Promise<void> {
    const authUrl = await this.oauthService.getDiscordAuthUrl();
    res.redirect(HttpStatus.FOUND, authUrl);
  }

  @Throttle({ default: { ttl: 60_000, limit: 10 } })
  @UseGuards(ThrottlerGuard)
  @Get(OAUTH_DISCORD_CALLBACK_ROUTE)
  async discordCallback(
    @Query() query: OAuthCallbackQuery,
    @Res() res: express.Response,
  ): Promise<void> {
    if (query.error) {
      this.logger.warn(`Discord OAuth error: ${query.error_description ?? query.error}`);
      throw new BadRequestException(ERROR_DISCORD_AUTH_FAILED);
    }

    const { identity, profile, providerData, isNewUser } =
      await this.oauthService.handleDiscordCallback(query.code, query.state);

    const discordUser = providerData as DiscordUser;

    const session = await this.sessionService.create({
      identityId: identity.id,
      profileId: profile.id,
      provider: PROVIDER_DISCORD,
    });

    res.status(HttpStatus.OK).json({
      message: isNewUser ? SUCCESS_ACCOUNT_CREATED : SUCCESS_LOGIN,
      isNewUser,
      sessionToken: session.id,
      identity: {
        id: identity.id,
        email: identity.email,
        emailVerified: identity.emailVerified,
        status: identity.status,
      },
      profile: {
        id: profile.id,
        username: profile.username,
        displayName: profile.displayName,
        avatarUrl: profile.avatarUrl,
      },
      discord: {
        id: discordUser.id,
        username: discordUser.username,
        discriminator: discordUser.discriminator,
        global_name: discordUser.global_name,
        avatar: discordUser.avatar,
        email: discordUser.email,
        verified: discordUser.verified,
        avatarUrl: discordUser.avatar
          ? `${DISCORD_AVATAR_CDN_URL}${discordUser.id}/${discordUser.avatar}.png`
          : null,
      },
    });
  }

  @Throttle({ default: { ttl: 60_000, limit: 5 } })
  @UseGuards(ThrottlerGuard, SessionGuard)
  @Get(OAUTH_DISCORD_LINK_ROUTE)
  async discordLink(
    @CurrentSession() session: Session,
    @Res() res: express.Response,
  ): Promise<void> {
    const authUrl = await this.oauthService.getDiscordAuthUrl({
      linkToIdentityId: session.identityId,
    });
    res.redirect(HttpStatus.FOUND, authUrl);
  }

  // === Riot ===

  @Get(OAUTH_RIOT_ROUTE)
  async riotAuth(@Res() res: express.Response): Promise<void> {
    const authUrl = await this.oauthService.getRiotAuthUrl();
    res.redirect(HttpStatus.FOUND, authUrl);
  }

  @Throttle({ default: { ttl: 60_000, limit: 10 } })
  @UseGuards(ThrottlerGuard)
  @Get(OAUTH_RIOT_CALLBACK_ROUTE)
  async riotCallback(
    @Query() query: OAuthCallbackQuery,
    @Res() res: express.Response,
  ): Promise<void> {
    if (query.error) {
      this.logger.warn(`Riot OAuth error: ${query.error_description ?? query.error}`);
      throw new BadRequestException(ERROR_RIOT_AUTH_FAILED);
    }

    const { identity, profile, providerData, isNewUser } =
      await this.oauthService.handleRiotCallback(query.code, query.state);

    const riotAccount = providerData as RiotAccount;

    const session = await this.sessionService.create({
      identityId: identity.id,
      profileId: profile.id,
      provider: PROVIDER_RIOT,
    });

    res.status(HttpStatus.OK).json({
      message: isNewUser ? SUCCESS_ACCOUNT_CREATED : SUCCESS_LOGIN,
      isNewUser,
      sessionToken: session.id,
      identity: {
        id: identity.id,
        email: identity.email,
        emailVerified: identity.emailVerified,
        status: identity.status,
      },
      profile: {
        id: profile.id,
        username: profile.username,
        displayName: profile.displayName,
        avatarUrl: profile.avatarUrl,
      },
      riot: {
        puuid: riotAccount.puuid,
        gameName: riotAccount.gameName,
        tagLine: riotAccount.tagLine,
        riotId: `${riotAccount.gameName}#${riotAccount.tagLine}`,
      },
    });
  }

  @Throttle({ default: { ttl: 60_000, limit: 5 } })
  @UseGuards(ThrottlerGuard, SessionGuard)
  @Get(OAUTH_RIOT_LINK_ROUTE)
  async riotLink(
    @CurrentSession() session: Session,
    @Res() res: express.Response,
  ): Promise<void> {
    const authUrl = await this.oauthService.getRiotAuthUrl({
      linkToIdentityId: session.identityId,
    });
    res.redirect(HttpStatus.FOUND, authUrl);
  }

  // === Session Management ===

  @Throttle({ default: { ttl: 60_000, limit: 30 } })
  @UseGuards(ThrottlerGuard)
  @Get(OAUTH_SESSION_ROUTE)
  async validateSession(
    @Headers('authorization') authHeader: string,
  ): Promise<{ valid: boolean; session?: object }> {
    const token = this.extractToken(authHeader);
    if (!token) {
      throw new UnauthorizedException(ERROR_MISSING_SESSION_TOKEN);
    }

    const session = await this.sessionService.validate(token);
    if (!session) {
      throw new UnauthorizedException(ERROR_INVALID_SESSION);
    }

    return { valid: true, session };
  }

  @Throttle({ default: { ttl: 60_000, limit: 10 } })
  @UseGuards(ThrottlerGuard)
  @HttpCode(HttpStatus.OK)
  @Post(OAUTH_LOGOUT_ROUTE)
  async logout(
    @Headers('authorization') authHeader: string,
  ): Promise<{ message: string }> {
    const token = this.extractToken(authHeader);
    if (token) {
      await this.sessionService.revoke(token);
    }
    return { message: SUCCESS_LOGGED_OUT };
  }

  private extractToken(authHeader: string | undefined): string | null {
    if (!authHeader) return null;
    const [type, token] = authHeader.split(' ');
    return type === 'Bearer' ? token : null;
  }
}
