import { fileURLToPath } from 'node:url';
import {
  ABILITIES,
  CONDITIONS,
  DAMAGE_TYPES,
  ITEM_CATEGORIES,
  ITEM_KINDS,
  MAGIC_SCHOOLS,
  WEAPON_PROPERTIES,
} from '@koster/shared';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import { openCatalogWritable, type CatalogConnection } from './open.ts';
import {
  abilities,
  conditions,
  damageTypes,
  itemCategories,
  itemKinds,
  magicSchools,
  weaponProperties,
} from './schema.ts';

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
    tx.insert(itemKinds)
      .values([...ITEM_KINDS])
      .run();
    tx.insert(itemCategories)
      .values([...ITEM_CATEGORIES])
      .run();
    tx.insert(weaponProperties)
      .values([...WEAPON_PROPERTIES])
      .run();
  });

  return connection;
}
