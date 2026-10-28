import { sql } from 'drizzle-orm';
import {
  check,
  index,
  integer,
  primaryKey,
  real,
  sqliteTable,
  text,
  unique,
} from 'drizzle-orm/sqlite-core';

// Схема catalog.db (раздел 5.2): заклинания (этап 1) и снаряжение (этап 2);
// таблицы других категорий добавят их этапы.
// Индекс FTS5 `content_search` Drizzle описать не умеет — он создаётся
// отдельной миграцией (drizzle/catalog/*_content_search.sql).

/** Справочник: код, русское и английское название. */
function referenceTable<const N extends string>(name: N) {
  return sqliteTable(name, {
    id: text('id').primaryKey(),
    nameRu: text('name_ru').notNull(),
    nameEn: text('name_en').notNull(),
  });
}

export const magicSchools = referenceTable('magic_schools');
export const damageTypes = referenceTable('damage_types');
export const abilities = referenceTable('abilities');
export const conditions = referenceTable('conditions');
export const itemKinds = referenceTable('item_kinds');
export const itemCategories = referenceTable('item_categories');
export const weaponProperties = referenceTable('weapon_properties');
export const sizes = referenceTable('sizes');

/** Источник в том виде, как его указывает DnD.su (Р12). Одна книга — одна строка. */
export const sources = sqliteTable('sources', {
  /** Код в нижнем регистре: `ph14`, `xge`. */
  id: text('id').primaryKey(),
  /** Метка на DnD.su: `PH14`, `XGE`. */
  code: text('code').notNull().unique(),
  nameRu: text('name_ru'),
  nameEn: text('name_en').notNull(),
  dndsuSourceId: integer('dndsu_source_id').unique(),
  edition: text('edition').notNull(),
});

export const contentEntities = sqliteTable(
  'content_entities',
  {
    /** `spell:fireball` (Р11). */
    id: text('id').primaryKey(),
    category: text('category').notNull(),
    nameRu: text('name_ru').notNull(),
    nameEn: text('name_en').notNull(),
    /** JSON-массив других названий. */
    aliases: text('aliases').notNull().default('[]'),
    edition: text('edition').notNull(),
    currentRevisionId: integer('current_revision_id').notNull(),
    reviewStatus: text('review_status').notNull(),
    automation: text('automation').notNull(),
    /**
     * Объект пропал из источника. Его ревизии остаются (Р21): на них могут
     * ссылаться персонажи.
     */
    withdrawn: integer('withdrawn', { mode: 'boolean' }).notNull().default(false),
  },
  (table) => [
    index('content_entities_category').on(table.category),
    check(
      'content_entities_review_status',
      sql`${table.reviewStatus} IN ('raw', 'parsed', 'reviewed', 'rules_verified')`,
    ),
    check(
      'content_entities_automation',
      sql`${table.automation} IN ('full', 'assisted', 'display_only')`,
    ),
  ],
);

/** Ревизии только добавляются; ни одна не меняется и не удаляется (Р21). */
export const contentRevisions = sqliteTable(
  'content_revisions',
  {
    id: integer('id').primaryKey(),
    entityId: text('entity_id')
      .notNull()
      .references(() => contentEntities.id),
    /** Номер версии объекта: 1, 2, 3… */
    revision: integer('revision').notNull(),
    schemaVersion: text('schema_version').notNull(),
    dataJson: text('data_json').notNull(),
    rulesJson: text('rules_json'),
    /** SHA-256 от data_json и rules_json: по нему сборка понимает, менялся ли объект. */
    contentHash: text('content_hash').notNull(),
    importerVersion: text('importer_version').notNull(),
    createdAt: text('created_at').notNull(),
  },
  (table) => [unique('content_revisions_entity_revision').on(table.entityId, table.revision)],
);

export const entitySources = sqliteTable(
  'entity_sources',
  {
    entityId: text('entity_id')
      .notNull()
      .references(() => contentEntities.id),
    sourceId: text('source_id')
      .notNull()
      .references(() => sources.id),
    /** Номер страницы на DnD.su: 205 в `/spells/205-fireball/`. */
    dndsuId: integer('dndsu_id'),
    url: text('url'),
  },
  (table) => [primaryKey({ columns: [table.entityId, table.sourceId] })],
);

/** Поля для фильтров списка заклинаний. */
export const spellIndex = sqliteTable(
  'spell_index',
  {
    entityId: text('entity_id')
      .primaryKey()
      .references(() => contentEntities.id),
    level: integer('level').notNull(),
    schoolId: text('school_id')
      .notNull()
      .references(() => magicSchools.id),
    ritual: integer('ritual', { mode: 'boolean' }).notNull(),
    concentration: integer('concentration', { mode: 'boolean' }).notNull(),
  },
  (table) => [
    index('spell_index_level').on(table.level),
    index('spell_index_school').on(table.schoolId),
  ],
);

/**
 * Классы, которым доступно заклинание: списком класса, по TCE или через подкласс.
 * `class_id` — код (`class:wizard`) без внешнего ключа: таблица классов появится на этапе 3.
 */
export const spellIndexClasses = sqliteTable(
  'spell_index_classes',
  {
    entityId: text('entity_id')
      .notNull()
      .references(() => spellIndex.entityId),
    classId: text('class_id').notNull(),
    /**
     * `standard` — обычный список; `optional` — дополнительный список TCE;
     * `subclass` — только через подкласс этого класса (решение автора: фильтр
     * по классу показывает и такие заклинания).
     */
    access: text('access').notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.entityId, table.classId] }),
    index('spell_index_classes_class').on(table.classId),
    check(
      'spell_index_classes_access',
      sql`${table.access} IN ('standard', 'optional', 'subclass')`,
    ),
  ],
);

/** Поля для фильтров списка снаряжения. */
export const itemIndex = sqliteTable(
  'item_index',
  {
    entityId: text('entity_id')
      .primaryKey()
      .references(() => contentEntities.id),
    kindId: text('kind_id')
      .notNull()
      .references(() => itemKinds.id),
    categoryId: text('category_id').references(() => itemCategories.id),
    /** Цена в медных монетах; `null` — не указана. */
    costCp: integer('cost_cp'),
    /** Вес в фунтах; `null` — не указан. */
    weightLb: real('weight_lb'),
    /** Вариант правил: нужно разрешение мастера. */
    optionalRule: integer('optional_rule', { mode: 'boolean' }).notNull(),
    /** Тип урона оружия; у остального — `null`. */
    damageTypeId: text('damage_type_id').references(() => damageTypes.id),
  },
  (table) => [
    index('item_index_kind').on(table.kindId),
    index('item_index_category').on(table.categoryId),
  ],
);

/** Поля для фильтров списка рас. */
export const raceIndex = sqliteTable(
  'race_index',
  {
    entityId: text('entity_id')
      .primaryKey()
      .references(() => contentEntities.id),
    /** `race` или `variant` (разновидность). */
    kind: text('kind', { enum: ['race', 'variant'] }).notNull(),
    /** Раса разновидности; у расы `null`. */
    variantOf: text('variant_of').references(() => contentEntities.id),
    /** Размер; если на выбор («Средний или Маленький») — первый, `null` — не указан. */
    sizeId: text('size_id').references(() => sizes.id),
    speedWalkFt: integer('speed_walk_ft'),
    /** Есть скорость полёта (любая, в том числе «равна скорости ходьбы»). */
    flying: integer('flying', { mode: 'boolean' }).notNull(),
    darkvisionFt: integer('darkvision_ft'),
  },
  (table) => [index('race_index_variant_of').on(table.variantOf)],
);

/** Свойства оружия: для фильтра «фехтовальное», «метательное»… */
export const itemIndexProperties = sqliteTable(
  'item_index_properties',
  {
    entityId: text('entity_id')
      .notNull()
      .references(() => itemIndex.entityId),
    propertyId: text('property_id')
      .notNull()
      .references(() => weaponProperties.id),
  },
  (table) => [
    primaryKey({ columns: [table.entityId, table.propertyId] }),
    index('item_index_properties_property').on(table.propertyId),
  ],
);

/**
 * Связи между объектами. `contains` — предмет входит в набор, `uses_ammunition` —
 * оружие расходует боеприпас. `to_id` без внешнего ключа: классы появятся на этапе 3.
 */
export const contentLinks = sqliteTable(
  'content_links',
  {
    fromId: text('from_id')
      .notNull()
      .references(() => contentEntities.id),
    toId: text('to_id').notNull(),
    kind: text('kind').notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.fromId, table.toId, table.kind] }),
    index('content_links_to').on(table.toId),
  ],
);

/** Версия каталога и дата сборки: ключ — значение. */
export const catalogInfo = sqliteTable('catalog_info', {
  key: text('key').primaryKey(),
  value: text('value').notNull(),
});
