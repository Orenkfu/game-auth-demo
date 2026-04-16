import { contextBridge, ipcRenderer } from 'electron';

export type AuthProvider = 'discord' | 'riot';

contextBridge.exposeInMainWorld('electronAPI', {
  loginWithProvider: (provider: AuthProvider) =>
    ipcRenderer.invoke('oauth:login', provider),
  logout: () => ipcRenderer.invoke('oauth:logout'),
  minimizeWindow: () => ipcRenderer.send('window:minimize'),
  maximizeWindow: () => ipcRenderer.send('window:maximize'),
  closeWindow: () => ipcRenderer.send('window:close'),
});
