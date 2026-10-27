import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { openCatalogReadOnly, type CatalogConnection } from '@koster/db';
import { buildCatalog, DEFAULT_PATHS } from '@koster/importer';

/**
 * Временный каталог из тестовых страниц data/fixtures (раздел 9: тесты сервера —
 * на временных базах). Возвращает соединение только для чтения, как в программе.
 */
export function openTestCatalog(): { catalog: CatalogConnection; dispose: () => void } {
  const folder = fs.mkdtempSync(path.join(os.tmpdir(), 'koster-api-'));
  const file = path.join(folder, 'catalog.db');
  buildCatalog({
    cacheDir: DEFAULT_PATHS.spellFixtures,
    reviewedDir: DEFAULT_PATHS.reviewedSpells,
    outFile: file,
    previousFile: null,
    ledgerDir: null,
    sourceKind: 'fixtures',
    now: new Date('2026-10-27T10:00:00Z'),
  });
  const catalog = openCatalogReadOnly(file);
  return {
    catalog,
    dispose: () => {
      catalog.close();
      fs.rmSync(folder, { recursive: true, force: true });
    },
  };
}
