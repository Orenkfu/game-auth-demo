import { app, BrowserWindow, ipcMain } from 'electron';

declare const MAIN_WINDOW_WEBPACK_ENTRY: string;
declare const MAIN_WINDOW_PRELOAD_WEBPACK_ENTRY: string;

const BACKEND_URL = 'http://localhost:3001';

if (require('electron-squirrel-startup')) {
  app.quit();
}

let mainWindow: BrowserWindow | null = null;

const createWindow = (): void => {
  mainWindow = new BrowserWindow({
    height: 700,
    width: 900,
    webPreferences: {
      preload: MAIN_WINDOW_PRELOAD_WEBPACK_ENTRY,
    },
  });

  mainWindow.loadURL(MAIN_WINDOW_WEBPACK_ENTRY);
  mainWindow.webContents.openDevTools();
};

// Handle OAuth login requests from renderer
ipcMain.handle('oauth:login', async (_event, provider: string) => {
  return new Promise((resolve, reject) => {
    const authWindow = new BrowserWindow({
      width: 500,
      height: 700,
      parent: mainWindow ?? undefined,
      modal: true,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
      },
    });

    const authUrl = `${BACKEND_URL}/oauth/${provider}`;
    authWindow.loadURL(authUrl);

    let handled = false;

    // Log all navigation events
    authWindow.webContents.on('did-navigate', (_e, url) => {
      console.log('[OAuth] did-navigate:', url);
    });

    authWindow.webContents.on('did-redirect-navigation', (_e, url) => {
      console.log('[OAuth] did-redirect-navigation:', url);
    });

    // Listen for page finish loading
    authWindow.webContents.on('did-finish-load', async () => {
      const url = authWindow.webContents.getURL();
      console.log('[OAuth] did-finish-load:', url);

      if (handled) {
        console.log('[OAuth] Already handled, skipping');
        return;
      }

      // Check if we're at the callback URL
      if (url.includes('/oauth/') && url.includes('/callback')) {
        console.log('[OAuth] Detected callback URL, extracting response...');
        handled = true;

        try {
          // Get the raw HTML to see what we're dealing with
          const html = await authWindow.webContents.executeJavaScript(
            `document.documentElement.outerHTML`
          );
          console.log('[OAuth] Page HTML:', html.substring(0, 500));

          // Get the page content
          const result = await authWindow.webContents.executeJavaScript(
            `document.body.innerText || document.body.textContent`
          );
          console.log('[OAuth] Body text:', result.substring(0, 500));

          const data = JSON.parse(result);
          console.log('[OAuth] Parsed successfully:', data);
          authWindow.close();
          resolve(data);
        } catch (err) {
          console.error('[OAuth] Parse error:', err);
          console.error('[OAuth] Error message:', err instanceof Error ? err.message : err);
          authWindow.close();
          reject(new Error('Failed to parse auth response'));
        }
      } else {
        console.log('[OAuth] Not a callback URL, waiting...');
      }
    });

    authWindow.on('closed', () => {
      // Only reject if we haven't already handled the response
      if (!handled) {
        reject(new Error('Auth window closed'));
      }
    });
  });
});

app.on('ready', createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});
