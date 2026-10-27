import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { _electron as electron, type ElectronApplication, type Page } from '@playwright/test';

// Запуск собранной программы для сценариев. Папка программы копируется во временную:
// программа пишет в data/ рядом с Koster.exe (Р18), и эти файлы не должны попасть
// в zip, который упаковывается из той же папки win-unpacked.
//
// Где взять программу: KOSTER_APP_DIR=<папка с Koster.exe>, иначе release/win-unpacked.

const DEFAULT_APP_DIR = path.resolve(__dirname, '..', 'release', 'win-unpacked');

export interface RunningApp {
  app: ElectronApplication;
  window: Page;
  /** Временная папка с копией программы. */
  folder: string;
  close(): Promise<void>;
}

export async function launchBuiltApp(): Promise<RunningApp> {
  const sourceDir = path.resolve(process.env['KOSTER_APP_DIR'] ?? DEFAULT_APP_DIR);
  if (!fs.existsSync(path.join(sourceDir, 'Koster.exe'))) {
    throw new Error(
      `Нет собранной программы: ${sourceDir}\\Koster.exe. ` +
        'Соберите её: npm run build, затем electron-builder (раздел 10).',
    );
  }
  const folder = fs.mkdtempSync(path.join(os.tmpdir(), 'koster-e2e-'));
  fs.cpSync(sourceDir, folder, { recursive: true });

  const app = await electron.launch({ executablePath: path.join(folder, 'Koster.exe') });
  const window = await app.firstWindow();
  return {
    app,
    window,
    folder,
    close: async () => {
      await app.close();
      fs.rmSync(folder, { recursive: true, force: true });
    },
  };
}
