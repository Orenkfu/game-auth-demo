// Riot account data from API
export interface RiotAccount {
  puuid: string; // Player Universally Unique ID
  gameName: string; // Riot ID name part
  tagLine: string; // Riot ID tag part (e.g., #NA1)
}

// Riot OAuth token response (OpenID Connect)
export interface RiotTokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  refresh_token?: string;
  scope: string;
  id_token?: string; // JWT containing user info
}
