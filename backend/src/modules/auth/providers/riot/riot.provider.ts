import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { RiotAccount, RiotTokenResponse } from './riot.types';
import * as crypto from 'crypto';
import {
  RIOT_OAUTH_AUTHORIZE_URL,
  RIOT_TOKEN_URL,
  RIOT_API_BASE_URL,
  RIOT_ACCOUNT_ME_ENDPOINT,
  CONFIG_RIOT_CLIENT_ID,
  CONFIG_RIOT_CLIENT_SECRET,
  CONFIG_RIOT_REDIRECT_URI,
  CONFIG_RIOT_SCOPES,
  HASH_ALGORITHM_SHA256,
  ENCODING_BASE64URL,
  OAUTH_RESPONSE_TYPE_PARAM,
  OAUTH_CODE_VALUE,
  OAUTH_CODE_CHALLENGE_PARAM,
  OAUTH_CODE_CHALLENGE_METHOD_PARAM,
  OAUTH_CODE_CHALLENGE_METHOD_S256,
  HTTP_HEADER_CONTENT_TYPE,
  CONTENT_TYPE_FORM_URLENCODED,
  HTTP_HEADER_AUTHORIZATION,
  AUTH_SCHEME_BASIC,
  OAUTH_GRANT_TYPE_PARAM,
  OAUTH_GRANT_TYPE_AUTH_CODE,
  OAUTH_GRANT_TYPE_REFRESH,
  AUTH_SCHEME_BEARER,
  RIOT_SCOPE_OPENID,
  RIOT_SCOPE_OFFLINE_ACCESS,
  ERROR_RIOT_CODE_EXCHANGE,
  ERROR_RIOT_REFRESH_TOKENS,
  ERROR_RIOT_FETCH_ACCOUNT,
} from '../../../../shared/constants';

interface PKCEChallenge {
  codeVerifier: string;
  codeChallenge: string;
}

@Injectable()
export class RiotProvider {
  private readonly logger = new Logger(RiotProvider.name);
  private readonly clientId: string;
  private readonly clientSecret: string;
  private readonly redirectUri: string;
  private readonly scopes: string[];

  private readonly authUrl = RIOT_OAUTH_AUTHORIZE_URL;
  private readonly tokenUrl = RIOT_TOKEN_URL;
  private readonly accountApiBase = RIOT_API_BASE_URL;

  constructor(private readonly configService: ConfigService) {
    this.clientId = this.configService.getOrThrow<string>(CONFIG_RIOT_CLIENT_ID);
    this.clientSecret = this.configService.getOrThrow<string>(
      CONFIG_RIOT_CLIENT_SECRET,
    );
    this.redirectUri =
      this.configService.getOrThrow<string>(CONFIG_RIOT_REDIRECT_URI);
    this.scopes = this.configService.get<string[]>(CONFIG_RIOT_SCOPES) ?? [
      RIOT_SCOPE_OPENID,
      RIOT_SCOPE_OFFLINE_ACCESS,
    ];
  }

  generatePKCE(): PKCEChallenge {
    const codeVerifier = crypto.randomBytes(32).toString(ENCODING_BASE64URL);
    const codeChallenge = crypto
      .createHash(HASH_ALGORITHM_SHA256)
      .update(codeVerifier)
      .digest(ENCODING_BASE64URL);

    return { codeVerifier, codeChallenge };
  }

  getAuthorizationUrl(state: string, codeChallenge: string): string {
    const params = new URLSearchParams({
      client_id: this.clientId,
      redirect_uri: this.redirectUri,
      [OAUTH_RESPONSE_TYPE_PARAM]: OAUTH_CODE_VALUE,
      scope: this.scopes.join(' '),
      state,
      [OAUTH_CODE_CHALLENGE_PARAM]: codeChallenge,
      [OAUTH_CODE_CHALLENGE_METHOD_PARAM]: OAUTH_CODE_CHALLENGE_METHOD_S256,
    });

    return `${this.authUrl}?${params.toString()}`;
  }

  async exchangeCode(
    code: string,
    codeVerifier: string,
  ): Promise<RiotTokenResponse> {
    const credentials = Buffer.from(
      `${this.clientId}:${this.clientSecret}`,
    ).toString('base64');

    const response = await fetch(this.tokenUrl, {
      method: 'POST',
      headers: {
        [HTTP_HEADER_CONTENT_TYPE]: CONTENT_TYPE_FORM_URLENCODED,
        [HTTP_HEADER_AUTHORIZATION]: `${AUTH_SCHEME_BASIC} ${credentials}`,
      },
      body: new URLSearchParams({
        [OAUTH_GRANT_TYPE_PARAM]: OAUTH_GRANT_TYPE_AUTH_CODE,
        code,
        redirect_uri: this.redirectUri,
        code_verifier: codeVerifier,
      }),
    });

    if (!response.ok) {
      this.logger.warn(`${ERROR_RIOT_CODE_EXCHANGE}${await response.text()}`);
      throw new UnauthorizedException(ERROR_RIOT_CODE_EXCHANGE);
    }

    return response.json() as Promise<RiotTokenResponse>;
  }

  async refreshTokens(refreshToken: string): Promise<RiotTokenResponse> {
    const credentials = Buffer.from(
      `${this.clientId}:${this.clientSecret}`,
    ).toString('base64');

    const response = await fetch(this.tokenUrl, {
      method: 'POST',
      headers: {
        [HTTP_HEADER_CONTENT_TYPE]: CONTENT_TYPE_FORM_URLENCODED,
        [HTTP_HEADER_AUTHORIZATION]: `${AUTH_SCHEME_BASIC} ${credentials}`,
      },
      body: new URLSearchParams({
        [OAUTH_GRANT_TYPE_PARAM]: OAUTH_GRANT_TYPE_REFRESH,
        refresh_token: refreshToken,
      }),
    });

    if (!response.ok) {
      this.logger.warn(`${ERROR_RIOT_REFRESH_TOKENS}${await response.text()}`);
      throw new UnauthorizedException(ERROR_RIOT_REFRESH_TOKENS);
    }

    return response.json() as Promise<RiotTokenResponse>;
  }

  async getAccountInfo(accessToken: string): Promise<RiotAccount> {
    const response = await fetch(
      `${this.accountApiBase}${RIOT_ACCOUNT_ME_ENDPOINT}`,
      {
        headers: {
          [HTTP_HEADER_AUTHORIZATION]: `${AUTH_SCHEME_BEARER} ${accessToken}`,
        },
      },
    );

    if (!response.ok) {
      this.logger.warn(`${ERROR_RIOT_FETCH_ACCOUNT}${await response.text()}`);
      throw new UnauthorizedException(ERROR_RIOT_FETCH_ACCOUNT);
    }

    return response.json() as Promise<RiotAccount>;
  }
}
