import type { BrowserWindowConstructorOptions, WebContents } from 'electron';
import { originOf } from './origin';

/**
 * Настройки окна. Окно изолировано от Node.js (раздел 4.5):
 * интерфейс общается с главным процессом только через preload.
 */
export function createWindowOptions(preloadPath: string): BrowserWindowConstructorOptions {
  return {
    width: 1280,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    title: 'Костёр',
    show: false,
    autoHideMenuBar: true,
    webPreferences: {
      preload: preloadPath,
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
      nodeIntegrationInWorker: false,
      nodeIntegrationInSubFrames: false,
      webSecurity: true,
      allowRunningInsecureContent: false,
      webviewTag: false,
      spellcheck: false,
    },
  };
}

/** Окно не открывает новых окон, не уходит на чужие адреса и не выдаёт разрешений. */
export function lockDownWebContents(contents: WebContents, allowedOrigin: string): void {
  contents.setWindowOpenHandler(() => ({ action: 'deny' }));

  contents.on('will-navigate', (event, url) => {
    if (originOf(url) !== allowedOrigin) {
      event.preventDefault();
    }
  });

  contents.session.setPermissionRequestHandler((_contents, _permission, callback) => {
    callback(false);
  });
}
