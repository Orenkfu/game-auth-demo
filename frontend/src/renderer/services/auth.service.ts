import { config } from '../config';

export interface AuthIdentity {
  id: string;
  email: string;
  emailVerified: boolean;
  status: string;
}

export interface AuthProfile {
  id: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
}

export interface DiscordData {
  id: string;
  username: string;
  discriminator: string;
  global_name: string | null;
  avatar: string | null;
  email: string | null;
  verified: boolean;
  avatarUrl: string | null;
}

export interface RiotData {
  puuid: string;
  gameName: string;
  tagLine: string;
  riotId: string;
}

export interface AuthResult {
  message: string;
  isNewUser: boolean;
  sessionToken: string;
  identity: AuthIdentity;
  profile: AuthProfile;
  discord?: DiscordData;
  riot?: RiotData;
  statusCode?: number;
}

export type AuthProvider = 'discord' | 'riot';

export class AuthService {
  private sessionToken: string | null = null;
  private userProfile: AuthProfile | null = null;

  getOAuthUrl(provider: AuthProvider): string {
    return `${config.backendUrl}/oauth/${provider}`;
  }

  setSession(token: string, profile: AuthProfile): void {
    this.sessionToken = token;
    this.userProfile = profile;
  }

  getSessionToken(): string | null {
    return this.sessionToken;
  }

  getProfileId(): string | null {
    return this.userProfile?.id ?? null;
  }

  clearSession(): void {
    this.sessionToken = null;
    this.userProfile = null;
  }

  async validateSession(): Promise<boolean> {
    if (!this.sessionToken) return false;

    try {
      const response = await fetch(`${config.backendUrl}/oauth/session`, {
        headers: { Authorization: `Bearer ${this.sessionToken}` },
      });
      return response.ok;
    } catch {
      return false;
    }
  }

  async logout(): Promise<void> {
    if (this.sessionToken) {
      try {
        await fetch(`${config.backendUrl}/oauth/logout`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${this.sessionToken}` },
        });
      } catch {
        // Ignore errors on logout
      }
    }
    this.clearSession();
  }
}
