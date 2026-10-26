import fs from 'node:fs';
import { openCatalogReadOnly, readCatalogInfo, type CatalogConnection } from '@koster/db';

/**
 * Открывает catalog.db только для чтения (Р21). В собранной программе каталог
 * обязателен; в разработке его может не быть, пока не запущен `npm run catalog:build`.
 */
export function openProgramCatalog(
  file: string,
  isPackaged: boolean,
  log: (message: string) => void,
): CatalogConnection | null {
  if (!fs.existsSync(file) && !isPackaged) {
    log(`Каталога нет: ${file}. Соберите его: npm run catalog:build`);
    return null;
  }
  const catalog = openCatalogReadOnly(file);
  const info = readCatalogInfo(catalog);
  log(`Каталог ${info['catalog_version'] ?? '?'} от ${info['built_at'] ?? '?'}: ${file}`);
  return catalog;
}
