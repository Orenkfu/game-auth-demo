import { Injectable, Inject, forwardRef } from '@nestjs/common';
import { IdentityService } from './identity.service';
import { OAuthAccountService } from './oauth-account.service';
import { StateStoreService, OAuthStateData } from './state-store.service';
import { DiscordProvider } from '../providers/discord/discord.provider';
import { RiotProvider } from '../providers/riot/riot.provider';
import { DiscordUser } from '../providers/discord/discord.types';
import { RiotAccount } from '../providers/riot/riot.types';
import { OAuthProvider } from '../entities/oauth-account.entity';
import { Identity } from '../entities/identity.entity';
import { UserProfileService } from '../../users/services/user-profile.service';
import { UserProfile } from '../../users/entities/user-profile.entity';
import { LinkRequiredException } from '../exceptions/link-required.exception';
import {
  PROVIDER_DISCORD,
  PROVIDER_RIOT,
  DISCORD_PLACEHOLDER_EMAIL_DOMAIN,
  RIOT_PLACEHOLDER_EMAIL_DOMAIN,
  DISCORD_AVATAR_CDN_URL,
  DISCORD_SCOPE_IDENTIFY,
  DISCORD_SCOPE_EMAIL,
  RIOT_SCOPE_OPENID,
  RIOT_SCOPE_OFFLINE_ACCESS,
  ERROR_MISSING_PKCE_VERIFIER,
} from '../../../shared/constants';

export interface OAuthCallbackResult {
  identity: Identity;
  profile: UserProfile;
  providerData: DiscordUser | RiotAccount;
  isNewUser: boolean;
}

@Injectable()
export class OAuthService {
  constructor(
    private readonly identityService: IdentityService,
    private readonly oauthAccountService: OAuthAccountService,
    private readonly stateStore: StateStoreService,
    private readonly discordProvider: DiscordProvider,
    private readonly riotProvider: RiotProvider,
    @Inject(forwardRef(() => UserProfileService))
    private readonly userProfileService: UserProfileService,
  ) {}

  // === Discord OAuth ===

  async getDiscordAuthUrl(stateData?: Omit<OAuthStateData, 'codeVerifier'>): Promise<string> {
    const state = await this.stateStore.generate(stateData);
    return this.discordProvider.getAuthorizationUrl(state);
  }

  async handleDiscordCallback(
    code: string,
    state: string,
  ): Promise<OAuthCallbackResult> {
    const stateData = await this.stateStore.validateAndConsume(state);
    const tokens = await this.discordProvider.exchangeCode(code);
    const discordUser = await this.discordProvider.getUserInfo(
      tokens.access_token,
    );

    // Rule 1: Provider identity exists → login
    const existingAccount = await this.oauthAccountService.findByProviderUserId(
      OAuthProvider.DISCORD,
      discordUser.id,
    );

    if (existingAccount) {
      await this.oauthAccountService.updateTokens(
        existingAccount.id,
        tokens.access_token,
        tokens.refresh_token,
        tokens.expires_in,
      );

      const identity = await this.identityService.findByIdOrThrow(
        existingAccount.identityId,
      );
      await this.identityService.updateLastLogin(identity.id);

      const profile = await this.userProfileService.findByIdentityIdOrThrow(
        identity.id,
      );

      return { identity, profile, providerData: discordUser, isNewUser: false };
    }

    // Explicit linking flow
    if (stateData.linkToIdentityId) {
      const identity = await this.identityService.findByIdOrThrow(
        stateData.linkToIdentityId,
      );
      await this.createDiscordOAuthAccount(
        identity.id,
        discordUser,
        tokens.access_token,
        tokens.refresh_token,
        tokens.expires_in,
      );
      const profile = await this.userProfileService.findByIdentityIdOrThrow(
        identity.id,
      );
      return { identity, profile, providerData: discordUser, isNewUser: false };
    }

    // Rule 3: Verified email matches existing identity → require link
    if (discordUser.email && discordUser.verified) {
      const email = discordUser.email.toLowerCase();
      const existingIdentity = await this.identityService.findByEmail(email);
      if (existingIdentity) {
        throw new LinkRequiredException(PROVIDER_DISCORD, email);
      }
    }

    // Rule 2: No match → create new identity + profile
    const { identity, profile } =
      await this.createIdentityAndProfileFromDiscord(discordUser);

    await this.createDiscordOAuthAccount(
      identity.id,
      discordUser,
      tokens.access_token,
      tokens.refresh_token,
      tokens.expires_in,
    );

    return { identity, profile, providerData: discordUser, isNewUser: true };
  }

  private async createIdentityAndProfileFromDiscord(
    discordUser: DiscordUser,
  ): Promise<{ identity: Identity; profile: UserProfile }> {
    const hasVerifiedEmail = Boolean(discordUser.email && discordUser.verified);
    const email = hasVerifiedEmail
      ? discordUser.email
      : `${discordUser.id}${DISCORD_PLACEHOLDER_EMAIL_DOMAIN}`;

    const identity = await this.identityService.create({
      email: email as string,
      emailVerified: hasVerifiedEmail ?? false,
    });

    const username = await this.userProfileService.generateUniqueUsername(
      discordUser.username,
    );

    const profile = await this.userProfileService.create({
      identityId: identity.id,
      username,
      displayName: discordUser.global_name ?? discordUser.username,
      avatarUrl: discordUser.avatar
        ? `${DISCORD_AVATAR_CDN_URL}${discordUser.id}/${discordUser.avatar}.png`
        : undefined,
    });

    return { identity, profile };
  }

  private async createDiscordOAuthAccount(
    identityId: string,
    discordUser: DiscordUser,
    accessToken: string,
    refreshToken: string,
    expiresIn: number,
  ): Promise<void> {
    await this.oauthAccountService.create({
      identityId,
      provider: OAuthProvider.DISCORD,
      providerUserId: discordUser.id,
      providerUsername: discordUser.username,
      providerEmail: discordUser.email ?? null,
      accessToken,
      refreshToken,
      expiresIn,
      scopes: [DISCORD_SCOPE_IDENTIFY, DISCORD_SCOPE_EMAIL],
      metadata: {
        avatar: discordUser.avatar,
        discriminator: discordUser.discriminator,
        globalName: discordUser.global_name,
      },
    });
  }

  // === Riot OAuth ===

  async getRiotAuthUrl(stateData?: Omit<OAuthStateData, 'codeVerifier'>): Promise<string> {
    const pkce = this.riotProvider.generatePKCE();
    const state = await this.stateStore.generate({
      ...stateData,
      codeVerifier: pkce.codeVerifier,
    });
    return this.riotProvider.getAuthorizationUrl(state, pkce.codeChallenge);
  }

  async handleRiotCallback(
    code: string,
    state: string,
  ): Promise<OAuthCallbackResult> {
    const stateData = await this.stateStore.validateAndConsume(state);

    if (!stateData.codeVerifier) {
      throw new Error(ERROR_MISSING_PKCE_VERIFIER);
    }

    const tokens = await this.riotProvider.exchangeCode(
      code,
      stateData.codeVerifier,
    );
    const riotAccount = await this.riotProvider.getAccountInfo(
      tokens.access_token,
    );

    // Rule 1: Provider identity exists → login
    const existingAccount = await this.oauthAccountService.findByProviderUserId(
      OAuthProvider.RIOT,
      riotAccount.puuid,
    );

    if (existingAccount) {
      await this.oauthAccountService.updateTokens(
        existingAccount.id,
        tokens.access_token,
        tokens.refresh_token ?? null,
        tokens.expires_in,
      );

      const identity = await this.identityService.findByIdOrThrow(
        existingAccount.identityId,
      );
      await this.identityService.updateLastLogin(identity.id);

      const profile = await this.userProfileService.findByIdentityIdOrThrow(
        identity.id,
      );

      return { identity, profile, providerData: riotAccount, isNewUser: false };
    }

    // Explicit linking flow
    if (stateData.linkToIdentityId) {
      const identity = await this.identityService.findByIdOrThrow(
        stateData.linkToIdentityId,
      );
      await this.createRiotOAuthAccount(
        identity.id,
        riotAccount,
        tokens.access_token,
        tokens.refresh_token,
        tokens.expires_in,
      );
      const profile = await this.userProfileService.findByIdentityIdOrThrow(
        identity.id,
      );
      return { identity, profile, providerData: riotAccount, isNewUser: false };
    }

    // Rule 2: No email from Riot → always create new
    // (Riot doesn't provide email, so no Rule 3 check)
    const { identity, profile } =
      await this.createIdentityAndProfileFromRiot(riotAccount);

    await this.createRiotOAuthAccount(
      identity.id,
      riotAccount,
      tokens.access_token,
      tokens.refresh_token,
      tokens.expires_in,
    );

    return { identity, profile, providerData: riotAccount, isNewUser: true };
  }

  private async createIdentityAndProfileFromRiot(
    riotAccount: RiotAccount,
  ): Promise<{ identity: Identity; profile: UserProfile }> {
    const identity = await this.identityService.create({
      email: `${riotAccount.puuid}${RIOT_PLACEHOLDER_EMAIL_DOMAIN}`,
      emailVerified: false,
    });

    const username = await this.userProfileService.generateUniqueUsername(
      riotAccount.gameName,
    );

    const profile = await this.userProfileService.create({
      identityId: identity.id,
      username,
      displayName: `${riotAccount.gameName}#${riotAccount.tagLine}`,
    });

    return { identity, profile };
  }

  private async createRiotOAuthAccount(
    identityId: string,
    riotAccount: RiotAccount,
    accessToken: string,
    refreshToken: string | undefined,
    expiresIn: number,
  ): Promise<void> {
    await this.oauthAccountService.create({
      identityId,
      provider: OAuthProvider.RIOT,
      providerUserId: riotAccount.puuid,
      providerUsername: `${riotAccount.gameName}#${riotAccount.tagLine}`,
      providerEmail: null,
      accessToken,
      refreshToken: refreshToken ?? null,
      expiresIn,
      scopes: [RIOT_SCOPE_OPENID, RIOT_SCOPE_OFFLINE_ACCESS],
      metadata: {
        gameName: riotAccount.gameName,
        tagLine: riotAccount.tagLine,
      },
    });
  }

  // === Account Management ===

  async getLinkedAccounts(identityId: string) {
    return this.oauthAccountService.findByIdentityId(identityId);
  }

  async unlinkAccount(identityId: string, provider: OAuthProvider) {
    return this.oauthAccountService.delete(identityId, provider);
  }
}
