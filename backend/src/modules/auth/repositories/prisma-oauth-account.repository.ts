import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../shared/services/prisma.service';
import { OAuthAccount, OAuthProvider } from '../entities/oauth-account.entity';

@Injectable()
export class PrismaOAuthAccountRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(entity: OAuthAccount): Promise<OAuthAccount> {
    const result = await this.prisma.oAuthAccount.create({
      data: {
        ...entity,
        metadata: entity.metadata as object,
      },
    });
    return result as unknown as OAuthAccount;
  }

  async findById(id: string): Promise<OAuthAccount | null> {
    const result = await this.prisma.oAuthAccount.findUnique({ where: { id } });
    return result as unknown as OAuthAccount | null;
  }

  async findByProviderUserId(
    provider: OAuthProvider,
    providerUserId: string,
  ): Promise<OAuthAccount | null> {
    const result = await this.prisma.oAuthAccount.findUnique({
      where: { provider_providerUserId: { provider, providerUserId } },
    });
    return result as unknown as OAuthAccount | null;
  }

  async findByIdentityId(identityId: string): Promise<OAuthAccount[]> {
    const results = await this.prisma.oAuthAccount.findMany({
      where: { identityId },
    });
    return results as unknown as OAuthAccount[];
  }

  async findByIdentityAndProvider(
    identityId: string,
    provider: OAuthProvider,
  ): Promise<OAuthAccount | null> {
    const result = await this.prisma.oAuthAccount.findFirst({
      where: { identityId, provider },
    });
    return result as unknown as OAuthAccount | null;
  }

  async update(id: string, entity: OAuthAccount): Promise<OAuthAccount> {
    const result = await this.prisma.oAuthAccount.update({
      where: { id },
      data: {
        providerUsername: entity.providerUsername,
        providerEmail: entity.providerEmail,
        accessTokenEncrypted: entity.accessTokenEncrypted,
        refreshTokenEncrypted: entity.refreshTokenEncrypted,
        tokenExpiresAt: entity.tokenExpiresAt,
        scopes: entity.scopes,
        metadata: entity.metadata as object,
        updatedAt: entity.updatedAt,
      },
    });
    return result as unknown as OAuthAccount;
  }

  async deleteByIdentityAndProvider(
    identityId: string,
    provider: OAuthProvider,
  ): Promise<boolean> {
    const result = await this.prisma.oAuthAccount.deleteMany({
      where: { identityId, provider },
    });
    return result.count > 0;
  }

  async delete(id: string): Promise<boolean> {
    try {
      await this.prisma.oAuthAccount.delete({ where: { id } });
      return true;
    } catch {
      return false;
    }
  }
}
