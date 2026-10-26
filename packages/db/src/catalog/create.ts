import { fileURLToPath } from 'node:url';
import { ABILITIES, CONDITIONS, DAMAGE_TYPES, MAGIC_SCHOOLS } from '@koster/shared';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import { openCatalogWritable, type CatalogConnection } from './open.ts';
import { abilities, conditions, damageTypes, magicSchools } from './schema.ts';

/** Папка миграций catalog.db (drizzle/catalog в пакете). */
export function catalogMigrationsFolder(): string {
  return fileURLToPath(new URL('../../drizzle/catalog', import.meta.url));
}

/**
 * Создаёт пустой каталог: применяет миграции и заполняет справочники.
 * Файл не должен существовать — сборка всегда пишет каталог заново.
 */
export function createCatalog(file: string): CatalogConnection {
  const connection = openCatalogWritable(file);
  migrate(connection.db, { migrationsFolder: catalogMigrationsFolder() });

  connection.db.transaction((tx) => {
    tx.insert(magicSchools)
      .values([...MAGIC_SCHOOLS])
      .run();
    tx.insert(damageTypes)
      .values([...DAMAGE_TYPES])
      .run();
    tx.insert(abilities)
      .values([...ABILITIES])
      .run();
    tx.insert(conditions)
      .values([...CONDITIONS])
      .run();
  });

  return connection;
}
