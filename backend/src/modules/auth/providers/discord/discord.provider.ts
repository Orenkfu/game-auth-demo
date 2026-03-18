import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  DiscordUser,
  DiscordTokenResponse,
  DiscordRelationship,
} from './discord.types';
import {
  DISCORD_OAUTH_AUTHORIZE_URL,
  DISCORD_TOKEN_URL,
  DISCORD_API_BASE_URL,
  DISCORD_USER_ME_ENDPOINT,
  CONFIG_DISCORD_CLIENT_ID,
  CONFIG_DISCORD_CLIENT_SECRET,
  CONFIG_DISCORD_REDIRECT_URI,
  CONFIG_DISCORD_SCOPES,
  OAUTH_RESPONSE_TYPE_PARAM,
  OAUTH_CODE_VALUE,
  HTTP_HEADER_CONTENT_TYPE,
  CONTENT_TYPE_FORM_URLENCODED,
  OAUTH_GRANT_TYPE_PARAM,
  OAUTH_GRANT_TYPE_AUTH_CODE,
  OAUTH_GRANT_TYPE_REFRESH,
  HTTP_HEADER_AUTHORIZATION,
  AUTH_SCHEME_BEARER,
  DISCORD_SCOPE_IDENTIFY,
  DISCORD_SCOPE_EMAIL,
  ERROR_DISCORD_CODE_EXCHANGE,
  ERROR_DISCORD_REFRESH_TOKENS,
  ERROR_DISCORD_FETCH_USER,
  ERROR_DISCORD_FETCH_RELATIONSHIPS,
} from '../../../../shared/constants';

@Injectable()
export class DiscordProvider {
  private readonly clientId: string;
  private readonly clientSecret: string;
  private readonly redirectUri: string;
  private readonly scopes: string[];

  private readonly authUrl = DISCORD_OAUTH_AUTHORIZE_URL;
  private readonly tokenUrl = DISCORD_TOKEN_URL;
  private readonly apiBase = DISCORD_API_BASE_URL;

  constructor(private readonly configService: ConfigService) {
    this.clientId = this.configService.getOrThrow<string>(CONFIG_DISCORD_CLIENT_ID);
    this.clientSecret = this.configService.getOrThrow<string>(
      CONFIG_DISCORD_CLIENT_SECRET,
    );
    this.redirectUri =
      this.configService.getOrThrow<string>(CONFIG_DISCORD_REDIRECT_URI);
    this.scopes = this.configService.get<string[]>(CONFIG_DISCORD_SCOPES) ?? [
      DISCORD_SCOPE_IDENTIFY,
      DISCORD_SCOPE_EMAIL,
    ];
  }

  getAuthorizationUrl(state: string): string {
    const params = new URLSearchParams({
      client_id: this.clientId,
      redirect_uri: this.redirectUri,
      [OAUTH_RESPONSE_TYPE_PARAM]: OAUTH_CODE_VALUE,
      scope: this.scopes.join(' '),
      state,
    });

    return `${this.authUrl}?${params.toString()}`;
  }

  async exchangeCode(code: string): Promise<DiscordTokenResponse> {
    const response = await fetch(this.tokenUrl, {
      method: 'POST',
      headers: {
        [HTTP_HEADER_CONTENT_TYPE]: CONTENT_TYPE_FORM_URLENCODED,
      },
      body: new URLSearchParams({
        client_id: this.clientId,
        client_secret: this.clientSecret,
        [OAUTH_GRANT_TYPE_PARAM]: OAUTH_GRANT_TYPE_AUTH_CODE,
        code,
        redirect_uri: this.redirectUri,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new UnauthorizedException(
        `${ERROR_DISCORD_CODE_EXCHANGE}${error}`,
      );
    }

    return response.json() as Promise<DiscordTokenResponse>;
  }

  async refreshTokens(refreshToken: string): Promise<DiscordTokenResponse> {
    const response = await fetch(this.tokenUrl, {
      method: 'POST',
      headers: {
        [HTTP_HEADER_CONTENT_TYPE]: CONTENT_TYPE_FORM_URLENCODED,
      },
      body: new URLSearchParams({
        client_id: this.clientId,
        client_secret: this.clientSecret,
        [OAUTH_GRANT_TYPE_PARAM]: OAUTH_GRANT_TYPE_REFRESH,
        refresh_token: refreshToken,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new UnauthorizedException(
        `${ERROR_DISCORD_REFRESH_TOKENS}${error}`,
      );
    }

    return response.json() as Promise<DiscordTokenResponse>;
  }

  async getUserInfo(accessToken: string): Promise<DiscordUser> {
    const response = await fetch(`${this.apiBase}${DISCORD_USER_ME_ENDPOINT}`, {
      headers: {
        [HTTP_HEADER_AUTHORIZATION]: `${AUTH_SCHEME_BEARER} ${accessToken}`,
      },
    });

    if (!response.ok) {
      const error = await response.text();
      throw new UnauthorizedException(
        `${ERROR_DISCORD_FETCH_USER}${error}`,
      );
    }

    return response.json() as Promise<DiscordUser>;
  }

  async revokeToken(accessToken: string): Promise<void> {
    await fetch(`${this.tokenUrl}/revoke`, {
      method: 'POST',
      headers: {
        [HTTP_HEADER_CONTENT_TYPE]: CONTENT_TYPE_FORM_URLENCODED,
      },
      body: new URLSearchParams({
        client_id: this.clientId,
        client_secret: this.clientSecret,
        token: accessToken,
      }),
    });
  }

  async getRelationships(accessToken: string): Promise<DiscordRelationship[]> {
    const response = await fetch(`${this.apiBase}/users/@me/relationships`, {
      headers: {
        [HTTP_HEADER_AUTHORIZATION]: `${AUTH_SCHEME_BEARER} ${accessToken}`,
      },
    });

    if (!response.ok) {
      const error = await response.text();
      throw new UnauthorizedException(
        `${ERROR_DISCORD_FETCH_RELATIONSHIPS}${error}`,
      );
    }

    return response.json() as Promise<DiscordRelationship[]>;
  }
}
