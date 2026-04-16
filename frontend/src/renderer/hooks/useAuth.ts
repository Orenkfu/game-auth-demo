import { useState } from 'react';
import { authService } from '../bootstrap';
import type { AuthResult, AuthProvider } from '../services/auth.service';

export function useAuth() {
  const [user, setUser] = useState<AuthResult | null>(null);
  const [loading, setLoading] = useState<AuthProvider | null>(null);
  const [error, setError] = useState<string | null>(null);

  const login = async (provider: AuthProvider) => {
    setLoading(provider);
    setError(null);

    try {
      const result = await window.electronAPI.loginWithProvider(provider);
      if (result && result.statusCode) {
        setError(result.message || 'Login failed');
        return;
      }
      authService.setSession(result.sessionToken, result.profile);
      setUser(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setLoading(null);
    }
  };

  const logout = async () => {
    await authService.logout();
    setUser(null);
    setError(null);
  };

  return { user, loading, error, login, logout };
}
