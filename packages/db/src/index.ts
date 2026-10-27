/** Два файла базы (Р21): каталог из релиза и данные пользователя в `data/`. */
export const DATABASE_FILES = {
  catalog: 'catalog.db',
  user: 'user.db',
} as const;

export * as catalogSchema from './catalog/schema.ts';
export { createCatalog, catalogMigrationsFolder } from './catalog/create.ts';
export {
  openCatalogReadOnly,
  openCatalogWritable,
  readCatalogInfo,
  type CatalogConnection,
  type CatalogDb,
} from './catalog/open.ts';
export { normalizeSearchText } from './catalog/search-text.ts';
export { toFtsQuery } from './catalog/search-query.ts';
export {
  levelLabel,
  listCategories,
  listSpells,
  readEntity,
  spellFacets,
  type EntityRecord,
} from './catalog/spell-queries.ts';
