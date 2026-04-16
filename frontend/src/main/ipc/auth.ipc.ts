import { ipcMain, BrowserWindow } from 'electron';
import { IPC_CHANNELS } from './ipc-channels';

const BACKEND_URL = process.env.BACKEND_URL ?? 'http://localhost:3001';

export function registerAuthHandlers(mainWindow: BrowserWindow): void {
  ipcMain.handle(IPC_CHANNELS.AUTH_LOGIN, (_event, provider: string) => {
    return new Promise((resolve, reject) => {
      const authWindow = new BrowserWindow({
        width: 500,
        height: 700,
        parent: mainWindow,
        modal: true,
        webPreferences: {
          nodeIntegration: false,
          contextIsolation: true,
        },
      });

      const authUrl = `${BACKEND_URL}/oauth/${provider}`;
      authWindow.loadURL(authUrl);

      let handled = false;

      authWindow.webContents.on('did-navigate', (_e, url) => {
        console.log('[OAuth] did-navigate:', url);
      });

      authWindow.webContents.on('did-redirect-navigation', (_e, url) => {
        console.log('[OAuth] did-redirect-navigation:', url);
      });

      authWindow.webContents.on('did-finish-load', async () => {
        const url = authWindow.webContents.getURL();
        console.log('[OAuth] did-finish-load:', url);

        if (handled) return;

        if (url.includes('/oauth/') && url.includes('/callback')) {
          handled = true;

          try {
            const html = await authWindow.webContents.executeJavaScript(
              `document.documentElement.outerHTML`
            );
            console.log('[OAuth] Page HTML:', html.substring(0, 500));

            const result = await authWindow.webContents.executeJavaScript(
              `document.body.innerText || document.body.textContent`
            );
            console.log('[OAuth] Body text:', result.substring(0, 500));

            const data = JSON.parse(result);
            authWindow.close();
            resolve(data);
          } catch (err) {
            console.error('[OAuth] Parse error:', err);
            authWindow.close();
            reject(new Error('Failed to parse auth response'));
          }
        }
      });

      authWindow.on('closed', () => {
        if (!handled) {
          reject(new Error('Auth window closed'));
        }
      });
    });
  });

  ipcMain.handle(IPC_CHANNELS.AUTH_LOGOUT, async () => {
    // Main process logout logic if needed
  });
}
