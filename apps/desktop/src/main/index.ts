import path from 'node:path';
import { createServer, listenLocal } from '@koster/server';
import { app, BrowserWindow, dialog, ipcMain } from 'electron';
import { IPC_GET_SERVER_URL } from '../shared/ipc';
import { openProgramCatalog } from './catalog';
import { createLogger } from './log';
import { originOf } from './origin';
import {
  DataFolderError,
  prepareDataFolders,
  resolveCatalogFile,
  resolvePortablePaths,
  type PathsInput,
  type PortablePaths,
} from './paths';
import { APP_ORIGIN, registerAppScheme, serveRenderer } from './renderer-protocol';
import { readSqliteVersion } from './sqlite';
import { createWindowOptions, lockDownWebContents } from './window';

function fail(message: string): void {
  dialog.showErrorBox('Костёр не может запуститься', message);
  app.exit(1);
}

/**
 * Пути — самым первым делом, до готовности приложения:
 * иначе Electron создаст свои папки в AppData (раздел 4.2).
 */
function pathsInput(): PathsInput {
  return {
    isPackaged: app.isPackaged,
    exePath: app.getPath('exe'),
    appPath: app.getAppPath(),
  };
}

function setUpPortablePaths(): PortablePaths | null {
  const paths = resolvePortablePaths(pathsInput());

  try {
    prepareDataFolders(paths);
  } catch (error) {
    fail(error instanceof DataFolderError ? error.message : String(error));
    return null;
  }

  app.setPath('userData', paths.electron);
  app.setPath('sessionData', paths.electron);
  app.setPath('crashDumps', paths.crashDumps);
  app.setAppLogsPath(paths.logs);
  return paths;
}

async function start(paths: PortablePaths, log: (message: string) => void): Promise<void> {
  const devRendererUrl = app.isPackaged ? undefined : process.env['ELECTRON_RENDERER_URL'];
  const rendererOrigin = devRendererUrl ? originOf(devRendererUrl) : APP_ORIGIN;

  log(`Запуск ${app.getVersion()}, данные: ${paths.data}`);

  const catalog = openProgramCatalog(resolveCatalogFile(pathsInput()), app.isPackaged, log);

  const server = createServer({
    appVersion: app.getVersion(),
    sqliteVersion: readSqliteVersion(),
    allowedOrigins: [rendererOrigin],
    catalog,
  });
  const serverUrl = await listenLocal(server);
  log(`Сервер слушает ${serverUrl}`);

  app.on('before-quit', () => {
    void server.close();
    catalog?.close();
  });

  ipcMain.handle(IPC_GET_SERVER_URL, (event) => {
    const senderOrigin = originOf(event.senderFrame?.url ?? 'about:blank');
    if (senderOrigin !== rendererOrigin) {
      throw new Error('Запрос не из окна программы');
    }
    return serverUrl;
  });

  const window = new BrowserWindow(
    createWindowOptions(path.join(__dirname, '../preload/index.js')),
  );
  lockDownWebContents(window.webContents, rendererOrigin);
  window.once('ready-to-show', () => window.show());

  if (devRendererUrl) {
    await window.loadURL(devRendererUrl);
  } else {
    serveRenderer(path.join(__dirname, '../renderer'));
    await window.loadURL(`${APP_ORIGIN}/index.html`);
  }
}

const paths = setUpPortablePaths();

if (paths) {
  const log = createLogger(paths.logs);
  registerAppScheme();

  app.on('window-all-closed', () => {
    app.quit();
  });

  app
    .whenReady()
    .then(() => start(paths, log))
    .catch((error: unknown) => {
      const message = error instanceof Error ? (error.stack ?? error.message) : String(error);
      log(`Ошибка запуска: ${message}`);
      fail(message);
    });
}
