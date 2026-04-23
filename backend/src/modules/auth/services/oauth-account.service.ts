import { Injectable } from '@nestjs/common';
import { OAuthAccountRepository } from '../repositories/oauth-account.repository';
import { OAuthAccount, OAuthProvider } from '../entities/oauth-account.entity';
import { TokenEncryptionService } from '../../../shared/services/token-encryption.service';

export interface CreateOAuthAccountDto {
  identityId: string;
  provider: OAuthProvider;
  providerUserId: string;
  providerUsername: string | null;
  providerEmail: string | null;
  accessToken: string;
  refreshToken: string | null;
  expiresIn: number;
  scopes: string[];
  metadata: Record<string, unknown>;
}

@Injectable()
export class OAuthAccountService {
  constructor(
    private readonly oauthAccountRepository: OAuthAccountRepository,
    private readonly tokenEncryption: TokenEncryptionService,
  ) {}

  async create(dto: CreateOAuthAccountDto): Promise<OAuthAccount> {
    const id = crypto.randomUUID();
    const now = new Date();

    const account: OAuthAccount = {
      id,
      identityId: dto.identityId,
      provider: dto.provider,
      providerUserId: dto.providerUserId,
      providerUsername: dto.providerUsername,
      providerEmail: dto.providerEmail,
      accessTokenEncrypted: this.tokenEncryption.encrypt(dto.accessToken),
      refreshTokenEncrypted: dto.refreshToken ? this.tokenEncryption.encrypt(dto.refreshToken) : null,
      tokenExpiresAt: new Date(Date.now() + dto.expiresIn * 1000),
      scopes: dto.scopes,
      metadata: dto.metadata,
      createdAt: now,
      updatedAt: now,
    };

    return await this.oauthAccountRepository.create(account);
  }

  async findByProviderUserId(
    provider: OAuthProvider,
    providerUserId: string,
  ): Promise<OAuthAccount | null> {
    return await this.oauthAccountRepository.findByProviderUserId(provider, providerUserId);
  }

  async findByIdentityId(identityId: string): Promise<OAuthAccount[]> {
    return await this.oauthAccountRepository.findByIdentityId(identityId);
  }

  async updateTokens(
    id: string,
    accessToken: string,
    refreshToken: string | null,
    expiresIn: number,
  ): Promise<void> {
    const account = await this.oauthAccountRepository.findById(id);
    if (!account) return;

    account.accessTokenEncrypted = this.tokenEncryption.encrypt(accessToken);
    account.refreshTokenEncrypted = refreshToken ? this.tokenEncryption.encrypt(refreshToken) : null;
    account.tokenExpiresAt = new Date(Date.now() + expiresIn * 1000);
    account.updatedAt = new Date();

    await this.oauthAccountRepository.update(id, account);
  }

  async delete(identityId: string, provider: OAuthProvider): Promise<boolean> {
    return await this.oauthAccountRepository.deleteByIdentityAndProvider(identityId, provider);
  }
}
