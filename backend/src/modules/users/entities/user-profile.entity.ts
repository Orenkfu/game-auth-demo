/**
 * UserProfile represents the application-level user data.
 * This is the profile concern - display name, avatar, preferences, etc.
 *
 * Linked 1:1 to Identity (auth concern) via identityId.
 */
export interface UserProfile {
  id: string;

  // Link to Identity (auth)
  identityId: string;

  // Profile data
  username: string;
  displayName: string | null;
  avatarUrl: string | null;
  bio: string | null;

  // Gaming profile
  gamerTag: string | null;
  preferredGames: string[];

  // Timestamps
  createdAt: Date;
  updatedAt: Date;
}
