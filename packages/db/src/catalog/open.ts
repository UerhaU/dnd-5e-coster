import Database from 'better-sqlite3';
import { drizzle, type BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import * as schema from './schema.ts';

export type CatalogDb = BetterSQLite3Database<typeof schema>;

export interface CatalogConnection {
  db: CatalogDb;
  sqlite: Database.Database;
  close(): void;
}

function connect(sqlite: Database.Database): CatalogConnection {
  return {
    db: drizzle(sqlite, { schema }),
    sqlite,
    close: () => sqlite.close(),
  };
}

/**
 * Открывает catalog.db программы: только чтение, файл обязан существовать (Р21).
 * Каталог не мигрирует — при обновлении программы файл заменяется целиком (раздел 5.6).
 */
export function openCatalogReadOnly(file: string): CatalogConnection {
  return connect(new Database(file, { readonly: true, fileMustExist: true }));
}

/** Открывает каталог на запись — только для сборки (импортёр) и тестов. */
export function openCatalogWritable(file: string): CatalogConnection {
  const sqlite = new Database(file);
  sqlite.pragma('foreign_keys = ON');
  return connect(sqlite);
}

/** Всё содержимое `catalog_info` как объект. */
export function readCatalogInfo(connection: CatalogConnection): Record<string, string> {
  const rows = connection.db.select().from(schema.catalogInfo).all();
  return Object.fromEntries(rows.map((row) => [row.key, row.value]));
}
