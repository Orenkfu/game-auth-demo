export enum UserStatus {
  ACTIVE = 'active',
  SUSPENDED = 'suspended',
  DELETED = 'deleted',
}

export interface User {
  id: string;
  email: string;
  emailVerified: boolean;
  passwordHash: string | null; // null for OAuth-only accounts
  username: string;
  displayName: string | null;
  avatarUrl: string | null;
  bio: string | null;

  // Gaming profile
  gamerTag: string | null;
  preferredGames: string[];

  // Account status
  status: UserStatus;
  lastLoginAt: Date | null;

  // Timestamps
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}
