import { ipcMain, BrowserWindow } from 'electron';
import { IPC_CHANNELS } from './ipc-channels';

export function registerWindowHandlers(mainWindow: BrowserWindow): void {
  ipcMain.on(IPC_CHANNELS.WINDOW_MINIMIZE, () => mainWindow.minimize());
  ipcMain.on(IPC_CHANNELS.WINDOW_MAXIMIZE, () =>
    mainWindow.isMaximized() ? mainWindow.unmaximize() : mainWindow.maximize()
  );
  ipcMain.on(IPC_CHANNELS.WINDOW_CLOSE, () => mainWindow.close());
}
