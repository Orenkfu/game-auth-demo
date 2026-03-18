const BACKEND_URL = 'http://localhost:3001';

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
}

export type AuthProvider = 'discord' | 'riot';

class AuthService {
  private sessionToken: string | null = null;

  getOAuthUrl(provider: AuthProvider): string {
    return `${BACKEND_URL}/oauth/${provider}`;
  }

  setSessionToken(token: string): void {
    this.sessionToken = token;
  }

  getSessionToken(): string | null {
    return this.sessionToken;
  }

  clearSessionToken(): void {
    this.sessionToken = null;
  }

  async validateSession(): Promise<boolean> {
    if (!this.sessionToken) return false;

    try {
      const response = await fetch(`${BACKEND_URL}/oauth/session`, {
        headers: {
          Authorization: `Bearer ${this.sessionToken}`,
        },
      });
      return response.ok;
    } catch {
      return false;
    }
  }

  async logout(): Promise<void> {
    if (this.sessionToken) {
      try {
        await fetch(`${BACKEND_URL}/oauth/logout`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${this.sessionToken}`,
          },
        });
      } catch {
        // Ignore errors on logout
      }
    }
    this.clearSessionToken();
  }
}

export const authService = new AuthService();
