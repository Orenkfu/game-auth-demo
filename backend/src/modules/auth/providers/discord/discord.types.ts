// Discord-specific user data from API
export interface DiscordUser {
  id: string;
  username: string;
  discriminator: string;
  global_name: string | null;
  avatar: string | null;
  email?: string;
  verified?: boolean;
}

// Discord OAuth token response
export interface DiscordTokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  refresh_token: string;
  scope: string;
}

// Discord relationship types
export enum DiscordRelationshipType {
  FRIEND = 1,
  BLOCKED = 2,
  PENDING_INCOMING = 3,
  PENDING_OUTGOING = 4,
  IMPLICIT = 5, // Users who share a server but aren't friends
}

// Discord relationship (friend)
export interface DiscordRelationship {
  id: string;
  type: DiscordRelationshipType;
  nickname: string | null;
  user: DiscordUser;
}
