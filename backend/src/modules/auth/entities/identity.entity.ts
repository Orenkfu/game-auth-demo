export enum IdentityStatus {
  ACTIVE = 'active',
  SUSPENDED = 'suspended',
  DELETED = 'deleted',
}

/**
 * Identity represents an authenticated user in the system.
 * This is the auth concern - who are you and how do you prove it.
 *
 * Separate from UserProfile which holds application-level data.
 */
export interface Identity {
  id: string;

  // Primary identifier - unique email
  email: string;
  emailVerified: boolean;

  // Password auth (null if OAuth-only)
  passwordHash: string | null;

  // Account status
  status: IdentityStatus;
  lastLoginAt: Date | null;

  // Timestamps
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}
