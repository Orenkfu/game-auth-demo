import type { AuthResult } from '../services/auth.service';

export type AuthProvider = 'discord' | 'riot';

export interface ElectronAPI {
  loginWithProvider: (provider: AuthProvider) => Promise<AuthResult>;
}

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}
