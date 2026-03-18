export enum OAuthProvider {
  DISCORD = 'discord',
  RIOT = 'riot',
}

/**
 * OAuthAccount links external OAuth providers to an Identity.
 * Many OAuthAccounts can link to one Identity.
 */
export interface OAuthAccount {
  id: string;

  // Link to Identity (not UserProfile)
  identityId: string;

  // Provider info
  provider: OAuthProvider;
  providerUserId: string;
  providerUsername: string | null;
  providerEmail: string | null;

  // Encrypted tokens
  accessTokenEncrypted: string;
  refreshTokenEncrypted: string | null;
  tokenExpiresAt: Date | null;

  // Provider-specific metadata
  scopes: string[];
  metadata: Record<string, unknown>;

  createdAt: Date;
  updatedAt: Date;
}
