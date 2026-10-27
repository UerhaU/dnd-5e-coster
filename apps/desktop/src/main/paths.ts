import fs from 'node:fs';
import path from 'node:path';

/** Все папки, куда программе разрешено писать (раздел 4.2). */
export interface PortablePaths {
  /** `data/` рядом с exe; в режиме разработки — `storage/dev-data/`. */
  data: string;
  logs: string;
  /** Служебные файлы Electron и Chromium (кэш, настройки окна). */
  electron: string;
  crashDumps: string;
}

export interface PathsInput {
  isPackaged: boolean;
  /** Путь к exe (`app.getPath('exe')`). */
  exePath: string;
  /** Папка приложения (`app.getAppPath()`); в разработке — `apps/desktop`. */
  appPath: string;
}

/** Считает пути от папки программы. Ничего не создаёт и не пишет. */
export function resolvePortablePaths(input: PathsInput): PortablePaths {
  const data = input.isPackaged
    ? path.join(path.dirname(input.exePath), 'data')
    : path.resolve(input.appPath, '..', '..', 'storage', 'dev-data');
  const electron = path.join(data, 'electron');

  return {
    data,
    logs: path.join(data, 'logs'),
    electron,
    crashDumps: path.join(electron, 'crashes'),
  };
}

/**
 * catalog.db программы (Р21): в собранной программе — `resources/catalog.db` рядом с app.asar,
 * в разработке — `apps/desktop/resources/catalog.db` (его собирает `npm run catalog:build`).
 * Файл только читается, поэтому он не входит в PortablePaths.
 */
export function resolveCatalogFile(input: PathsInput): string {
  const resources = input.isPackaged
    ? path.dirname(input.appPath)
    : path.join(input.appPath, 'resources');
  return path.join(resources, 'catalog.db');
}

export class DataFolderError extends Error {
  readonly folder: string;
  readonly reason: unknown;

  constructor(folder: string, reason: unknown) {
    super(
      `Костёр не может сохранять данные в папке:\n${folder}\n\n` +
        'Переместите папку программы туда, где разрешена запись ' +
        '(например, в «Документы» или на флешку), и запустите её снова.',
    );
    this.name = 'DataFolderError';
    this.folder = folder;
    this.reason = reason;
  }
}

/**
 * Создаёт `data/` и `data/logs/` и проверяет, что туда можно писать.
 * Если нельзя — бросает `DataFolderError`, а не ищет другое место.
 */
export function prepareDataFolders(paths: PortablePaths): void {
  try {
    fs.mkdirSync(paths.logs, { recursive: true });

    const probe = path.join(paths.data, `.write-test-${process.pid}`);
    fs.writeFileSync(probe, '');
    fs.rmSync(probe);
  } catch (error) {
    throw new DataFolderError(paths.data, error);
  }
}
