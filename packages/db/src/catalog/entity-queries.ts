import {
  CATEGORIES,
  CATEGORY_NAMES_RU,
  type CategoriesResponse,
  type EntityLink,
  type EntitySource,
} from '@koster/shared';
import type { CatalogConnection } from './open.ts';

// Общее чтение каталога для API (раздел 7): категории и карточка объекта.
// Карточка и ревизии снятых объектов (`withdrawn`) открываются: на них могут
// ссылаться персонажи (Р21).

export function listCategories(catalog: CatalogConnection): CategoriesResponse {
  const rows = catalog.sqlite
    .prepare(
      `SELECT category, COUNT(*) AS count FROM content_entities
       WHERE withdrawn = 0 GROUP BY category ORDER BY category`,
    )
    .all() as { category: string; count: number }[];
  return {
    // Порядок — как в CATEGORIES: так же, как в меню «Справочника».
    categories: CATEGORIES.flatMap((id) => {
      const row = rows.find((entry) => entry.category === id);
      return row ? [{ id, nameRu: CATEGORY_NAMES_RU[id], count: row.count }] : [];
    }),
  };
}

export interface EntityRecord {
  id: string;
  category: string;
  nameRu: string;
  nameEn: string;
  aliases: string[];
  edition: string;
  reviewStatus: string;
  automation: string;
  withdrawn: boolean;
  revision: {
    id: number;
    revision: number;
    schemaVersion: string;
    createdAt: string;
    current: boolean;
  };
  revisions: number[];
  sources: EntitySource[];
  links: EntityLink[];
  /** `data_json` и `rules_json` как есть; схему проверяет сервер. */
  data: unknown;
  rules: unknown;
}

/**
 * Карточка объекта: текущая ревизия или ревизия с номером `revision`.
 * `null` — нет такого объекта или ревизии.
 */
export function readEntity(
  catalog: CatalogConnection,
  id: string,
  revision?: number,
): EntityRecord | null {
  const entity = catalog.sqlite
    .prepare(
      `SELECT id, category, name_ru AS nameRu, name_en AS nameEn, aliases, edition,
        review_status AS reviewStatus, automation, withdrawn, current_revision_id AS currentRevisionId
       FROM content_entities WHERE id = ?`,
    )
    .get(id) as
    | (Omit<
        EntityRecord,
        'aliases' | 'withdrawn' | 'revision' | 'revisions' | 'sources' | 'data' | 'rules'
      > & {
        aliases: string;
        withdrawn: number;
        currentRevisionId: number;
      })
    | undefined;
  if (!entity) {
    return null;
  }

  const row = catalog.sqlite
    .prepare(
      `SELECT id, revision, schema_version AS schemaVersion, created_at AS createdAt,
        data_json AS dataJson, rules_json AS rulesJson
       FROM content_revisions
       WHERE entity_id = @id AND ${revision === undefined ? 'id = @current' : 'revision = @revision'}`,
    )
    .get({ id, current: entity.currentRevisionId, revision: revision ?? 0 }) as
    | {
        id: number;
        revision: number;
        schemaVersion: string;
        createdAt: string;
        dataJson: string;
        rulesJson: string | null;
      }
    | undefined;
  if (!row) {
    return null;
  }

  const revisions = (
    catalog.sqlite
      .prepare('SELECT revision FROM content_revisions WHERE entity_id = ? ORDER BY revision')
      .all(id) as { revision: number }[]
  ).map((item) => item.revision);
  const sources = catalog.sqlite
    .prepare(
      `SELECT s.id, s.code, s.name_ru AS nameRu, s.name_en AS nameEn, es.dndsu_id AS dndsuId, es.url
       FROM entity_sources es JOIN sources s ON s.id = es.source_id
       WHERE es.entity_id = ? ORDER BY s.code`,
    )
    .all(id) as EntitySource[];
  // Связи в обе стороны: «входит в набор» видно и у набора, и у предмета.
  const links = catalog.sqlite
    .prepare(
      `SELECT l.kind, 'to' AS direction, e.id, e.category, e.name_ru AS nameRu
       FROM content_links l JOIN content_entities e ON e.id = l.to_id
       WHERE l.from_id = @id
       UNION ALL
       SELECT l.kind, 'from' AS direction, e.id, e.category, e.name_ru AS nameRu
       FROM content_links l JOIN content_entities e ON e.id = l.from_id
       WHERE l.to_id = @id
       ORDER BY 1, 2, 5`,
    )
    .all({ id }) as EntityLink[];

  return {
    id: entity.id,
    category: entity.category,
    nameRu: entity.nameRu,
    nameEn: entity.nameEn,
    aliases: JSON.parse(entity.aliases) as string[],
    edition: entity.edition,
    reviewStatus: entity.reviewStatus,
    automation: entity.automation,
    withdrawn: entity.withdrawn === 1,
    revision: {
      id: row.id,
      revision: row.revision,
      schemaVersion: row.schemaVersion,
      createdAt: row.createdAt,
      current: row.id === entity.currentRevisionId,
    },
    revisions,
    sources,
    links,
    data: JSON.parse(row.dataJson),
    rules: row.rulesJson ? JSON.parse(row.rulesJson) : null,
  };
}
