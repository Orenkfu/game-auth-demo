import type { AuthResult, AuthProvider } from '../services/auth.service';

export interface ElectronAPI {
  loginWithProvider: (provider: AuthProvider) => Promise<AuthResult>;
  logout: () => Promise<void>;
  minimizeWindow: () => void;
  maximizeWindow: () => void;
  closeWindow: () => void;
}

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}
