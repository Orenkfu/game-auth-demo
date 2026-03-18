import { contextBridge, ipcRenderer } from 'electron';

export type AuthProvider = 'discord' | 'riot';

contextBridge.exposeInMainWorld('electronAPI', {
  loginWithProvider: (provider: AuthProvider) =>
    ipcRenderer.invoke('oauth:login', provider),
});
