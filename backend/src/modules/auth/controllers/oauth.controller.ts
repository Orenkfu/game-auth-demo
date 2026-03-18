import {
  Controller,
  Get,
  Post,
  Query,
  Headers,
  Res,
  HttpStatus,
  BadRequestException,
  UnauthorizedException,
} from '@nestjs/common';
import express from 'express';
import { OAuthService } from '../services/oauth.service';
import { SessionService } from '../services/session.service';
import { DiscordUser } from '../providers/discord/discord.types';
import { RiotAccount } from '../providers/riot/riot.types';
import {
  OAUTH_CONTROLLER_ROUTE,
  OAUTH_DISCORD_ROUTE,
  OAUTH_DISCORD_CALLBACK_ROUTE,
  OAUTH_DISCORD_LINK_ROUTE,
  OAUTH_RIOT_ROUTE,
  OAUTH_RIOT_CALLBACK_ROUTE,
  OAUTH_RIOT_LINK_ROUTE,
  CURRENT_IDENTITY_ID_PARAM,
  ERROR_DISCORD_AUTH_FAILED,
  ERROR_RIOT_AUTH_FAILED,
  SUCCESS_ACCOUNT_CREATED,
  SUCCESS_LOGIN,
  DISCORD_AVATAR_CDN_URL,
  PROVIDER_DISCORD,
  PROVIDER_RIOT,
} from '../../../shared/constants';

class OAuthCallbackQuery {
  code: string;
  state: string;
  error?: string;
  error_description?: string;
}

@Controller(OAUTH_CONTROLLER_ROUTE)
export class OAuthController {
  constructor(
    private readonly oauthService: OAuthService,
    private readonly sessionService: SessionService,
  ) {}

  // === Discord ===

  @Get(OAUTH_DISCORD_ROUTE)
  async discordAuth(@Res() res: express.Response): Promise<void> {
    const authUrl = await this.oauthService.getDiscordAuthUrl();
    res.redirect(HttpStatus.FOUND, authUrl);
  }

  @Get(OAUTH_DISCORD_CALLBACK_ROUTE)
  async discordCallback(
    @Query() query: OAuthCallbackQuery,
    @Res() res: express.Response,
  ): Promise<void> {
    if (query.error) {
      throw new BadRequestException(
        query.error_description ?? ERROR_DISCORD_AUTH_FAILED,
      );
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

  @Get(OAUTH_DISCORD_LINK_ROUTE)
  async discordLink(@Res() res: express.Response): Promise<void> {
    // TODO: Get identityId from session
    const identityId = CURRENT_IDENTITY_ID_PARAM;
    const authUrl = await this.oauthService.getDiscordAuthUrl({
      linkToIdentityId: identityId,
    });
    res.redirect(HttpStatus.FOUND, authUrl);
  }

  // === Riot ===

  @Get(OAUTH_RIOT_ROUTE)
  async riotAuth(@Res() res: express.Response): Promise<void> {
    const authUrl = await this.oauthService.getRiotAuthUrl();
    res.redirect(HttpStatus.FOUND, authUrl);
  }

  @Get(OAUTH_RIOT_CALLBACK_ROUTE)
  async riotCallback(
    @Query() query: OAuthCallbackQuery,
    @Res() res: express.Response,
  ): Promise<void> {
    if (query.error) {
      throw new BadRequestException(
        query.error_description ?? ERROR_RIOT_AUTH_FAILED,
      );
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

  @Get(OAUTH_RIOT_LINK_ROUTE)
  async riotLink(@Res() res: express.Response): Promise<void> {
    // TODO: Get identityId from session
    const identityId = CURRENT_IDENTITY_ID_PARAM;
    const authUrl = await this.oauthService.getRiotAuthUrl({
      linkToIdentityId: identityId,
    });
    res.redirect(HttpStatus.FOUND, authUrl);
  }

  // === Session Management ===

  @Get('session')
  async validateSession(
    @Headers('authorization') authHeader: string,
  ): Promise<{ valid: boolean; session?: object }> {
    const token = this.extractToken(authHeader);
    if (!token) {
      throw new UnauthorizedException('Missing session token');
    }

    const session = await this.sessionService.validate(token);
    if (!session) {
      throw new UnauthorizedException('Invalid or expired session');
    }

    return { valid: true, session };
  }

  @Post('logout')
  async logout(
    @Headers('authorization') authHeader: string,
  ): Promise<{ message: string }> {
    const token = this.extractToken(authHeader);
    if (token) {
      await this.sessionService.revoke(token);
    }
    return { message: 'Logged out successfully' };
  }

  private extractToken(authHeader: string | undefined): string | null {
    if (!authHeader) return null;
    const [type, token] = authHeader.split(' ');
    return type === 'Bearer' ? token : null;
  }
}
