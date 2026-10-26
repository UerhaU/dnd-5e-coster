import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { DataFolderError, prepareDataFolders, resolvePortablePaths } from './paths';

describe('resolvePortablePaths', () => {
  it('в собранной программе кладёт data/ рядом с exe', () => {
    const paths = resolvePortablePaths({
      isPackaged: true,
      exePath: 'D:\\тест Костёр\\Koster\\Koster.exe',
      appPath: 'D:\\тест Костёр\\Koster\\resources\\app.asar',
    });

    expect(paths.data).toBe(path.join('D:\\тест Костёр\\Koster', 'data'));
    expect(paths.logs).toBe(path.join('D:\\тест Костёр\\Koster', 'data', 'logs'));
  });

  it('в разработке кладёт data/ в storage/dev-data/', () => {
    const paths = resolvePortablePaths({
      isPackaged: false,
      exePath: 'D:\\repo\\node_modules\\electron\\dist\\electron.exe',
      appPath: 'D:\\repo\\apps\\desktop',
    });

    expect(paths.data).toBe(path.resolve('D:\\repo', 'storage', 'dev-data'));
  });

  it('все служебные папки Electron лежат внутри data/', () => {
    const paths = resolvePortablePaths({
      isPackaged: true,
      exePath: 'C:\\Koster\\Koster.exe',
      appPath: 'C:\\Koster\\resources\\app.asar',
    });

    for (const folder of [paths.logs, paths.electron, paths.crashDumps]) {
      expect(path.relative(paths.data, folder).startsWith('..')).toBe(false);
    }
  });
});

describe('prepareDataFolders', () => {
  let root: string;
  beforeEach(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'koster папка '));
  });
  afterEach(() => {
    fs.rmSync(root, { recursive: true, force: true });
  });

  it('создаёт data/ и data/logs/ и ничего больше', () => {
    const paths = resolvePortablePaths({
      isPackaged: true,
      exePath: path.join(root, 'Koster.exe'),
      appPath: path.join(root, 'resources', 'app.asar'),
    });

    prepareDataFolders(paths);

    expect(fs.readdirSync(root)).toEqual(['data']);
    expect(fs.readdirSync(paths.data)).toEqual(['logs']);
  });

  it('сообщает понятную ошибку, если папку создать нельзя', () => {
    // Файл на месте data/ — так же, как папка без прав на запись, не даёт создать data/.
    fs.writeFileSync(path.join(root, 'data'), '');
    const paths = resolvePortablePaths({
      isPackaged: true,
      exePath: path.join(root, 'Koster.exe'),
      appPath: path.join(root, 'resources', 'app.asar'),
    });

    expect(() => prepareDataFolders(paths)).toThrow(DataFolderError);
    expect(() => prepareDataFolders(paths)).toThrow(/не может сохранять данные/);
  });
});
