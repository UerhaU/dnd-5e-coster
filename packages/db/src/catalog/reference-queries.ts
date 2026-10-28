import {
  type ReferenceFacetsResponse,
  type ReferenceListCategory,
  type ReferenceListItem,
  type ReferenceListQuery,
  type ReferenceListResponse,
} from '@koster/shared';
import type { CatalogConnection } from './open.ts';
import { toFtsQuery } from './search-query.ts';
import { normalizeSearchText } from './search-text.ts';

// Списки справочных категорий этапа 3 (раздел 7, «Каталог»): навыки, языки, состояния,
// предыстории, черты. Один запрос на все пять: фильтры своей категории берутся из её
// таблицы индекса, у чужой категории условие пустое. Снятые объекты не показываются.

interface ReferenceRow {
  id: string;
  nameRu: string;
  nameEn: string;
  detail: string | null;
  sources: string | null;
  reviewStatus: ReferenceListItem['reviewStatus'];
}

/** Короткая строка списка — своя у каждой категории. */
const DETAIL: Record<ReferenceListCategory, string> = {
  skill: 'ab.name_ru',
  language: `CASE
      WHEN li.dialect_of IS NOT NULL THEN 'Диалект: ' || dialect.name_ru
      WHEN li.kind = 'standard' THEN 'Обычный'
      WHEN li.kind = 'exotic' THEN 'Экзотический'
    END`,
  condition: 'NULL',
  background: `CASE WHEN bi.kind = 'adaptation' THEN 'Адаптация предысторий' ELSE (
      SELECT json_extract(value, '$.text') FROM json_each(r.data_json, '$.summary')
      WHERE json_extract(value, '$.label') IN ('Владение навыками', 'Навыки') LIMIT 1
    ) END`,
  feat: `'Требование: ' || json_extract(r.data_json, '$.prerequisite')`,
};

const JOINS = `LEFT JOIN skill_index si ON si.entity_id = e.id
    LEFT JOIN abilities ab ON ab.id = si.ability_id
    LEFT JOIN language_index li ON li.entity_id = e.id
    LEFT JOIN content_entities dialect ON dialect.id = li.dialect_of
    LEFT JOIN background_index bi ON bi.entity_id = e.id
    LEFT JOIN feat_index fi ON fi.entity_id = e.id`;

export function listReference(
  catalog: CatalogConnection,
  category: ReferenceListCategory,
  query: ReferenceListQuery,
): ReferenceListResponse {
  const where = ['e.withdrawn = 0', 'e.category = @category'];
  const params: Record<string, string | number> = { category };

  const fts = query.q ? toFtsQuery(query.q) : null;
  if (fts) {
    where.push('content_search MATCH @fts');
    params['fts'] = fts;
  }
  if (query.source) {
    where.push(
      'EXISTS (SELECT 1 FROM entity_sources es WHERE es.entity_id = e.id AND es.source_id = @source)',
    );
    params['source'] = query.source;
  }
  if (query.ability && category === 'skill') {
    where.push('si.ability_id = @ability');
    params['ability'] = query.ability;
  }
  if (query.kind && category === 'language') {
    where.push('li.kind = @kind');
    params['kind'] = query.kind;
  }
  if (query.kind && category === 'background') {
    where.push('bi.kind = @kind');
    params['kind'] = query.kind;
  }
  const flags: [boolean | undefined, string, ReferenceListCategory][] = [
    [query.grantsFeat, 'bi.grants_feat', 'background'],
    [query.prerequisite, 'fi.has_prerequisite', 'feat'],
    [query.abilityIncrease, 'fi.ability_increase', 'feat'],
    [query.raceRequired, 'fi.race_required', 'feat'],
  ];
  for (const [value, column, owner] of flags) {
    if (value !== undefined && category === owner) where.push(`${column} = ${value ? 1 : 0}`);
  }

  const order =
    query.sort === 'relevance' && fts
      ? `CASE WHEN content_search.name_ru = @exact OR content_search.name_en = @exact
           THEN 0 ELSE 1 END, bm25(content_search, 0, 0, 10, 10, 5, 1), e.name_ru, e.id`
      : 'e.name_ru, e.id';
  const exact = normalizeSearchText(query.q ?? '')
    .trim()
    .replace(/\s+/g, ' ');

  const from = `FROM content_entities e
    JOIN content_revisions r ON r.id = e.current_revision_id
    ${JOINS}
    JOIN content_search ON content_search.entity_id = e.id
    WHERE ${where.join(' AND ')}`;

  const total = (
    catalog.sqlite.prepare(`SELECT COUNT(*) AS total ${from}`).get(params) as { total: number }
  ).total;

  const rows = catalog.sqlite
    .prepare(
      `SELECT e.id, e.name_ru AS nameRu, e.name_en AS nameEn, ${DETAIL[category]} AS detail,
        e.review_status AS reviewStatus,
        (SELECT group_concat(s.code, ',') FROM entity_sources es JOIN sources s ON s.id = es.source_id
          WHERE es.entity_id = e.id) AS sources
       ${from}
       ORDER BY ${order}
       LIMIT @limit OFFSET @offset`,
    )
    .all({
      ...params,
      ...(order.includes('@exact') ? { exact } : {}),
      limit: query.pageSize,
      offset: (query.page - 1) * query.pageSize,
    }) as ReferenceRow[];

  return {
    items: rows.map((row) => ({
      id: row.id,
      category,
      nameRu: row.nameRu,
      nameEn: row.nameEn,
      detail: row.detail,
      sources: row.sources ? row.sources.split(',').sort() : [],
      reviewStatus: row.reviewStatus,
    })),
    total,
    page: query.page,
    pageSize: query.pageSize,
  };
}

export function referenceFacets(
  catalog: CatalogConnection,
  category: ReferenceListCategory,
): ReferenceFacetsResponse {
  const active = `JOIN content_entities e ON e.id = t.entity_id AND e.withdrawn = 0`;
  const all = <T>(sql: string) => catalog.sqlite.prepare(sql).all({ category }) as T[];
  const ability =
    category === 'skill'
      ? all<{ value: string; label: string; count: number }>(
          `SELECT ab.id AS value, ab.name_ru AS label, COUNT(*) AS count
           FROM abilities ab JOIN skill_index t ON t.ability_id = ab.id ${active}
           GROUP BY ab.id ORDER BY ab.rowid`,
        )
      : [];
  const kindTable =
    category === 'language'
      ? 'language_index'
      : category === 'background'
        ? 'background_index'
        : null;
  const kindLabels: Record<string, string> = {
    standard: 'Обычные',
    exotic: 'Экзотические',
    background: 'Предыстории',
    adaptation: 'Адаптации',
  };
  const kind = kindTable
    ? all<{ value: string; count: number }>(
        `SELECT t.kind AS value, COUNT(*) AS count FROM ${kindTable} t ${active}
         WHERE t.kind IS NOT NULL GROUP BY t.kind ORDER BY t.kind DESC`,
      ).map((row) => ({ ...row, label: kindLabels[row.value] ?? row.value }))
    : [];
  const sources = all<{ value: string; code: string; nameEn: string; count: number }>(
    `SELECT s.id AS value, s.code, s.name_en AS nameEn, COUNT(*) AS count
     FROM sources s JOIN entity_sources t ON t.source_id = s.id ${active}
     WHERE e.category = @category
     GROUP BY s.id ORDER BY count DESC, s.code`,
  );
  const sum = (sql: string) =>
    (catalog.sqlite.prepare(sql).get() as { value: number | null }).value ?? 0;
  const feat = category === 'feat';
  return {
    ability,
    kind,
    source: sources.map((row) => ({
      value: row.value,
      label: `${row.code} — ${row.nameEn}`,
      count: row.count,
    })),
    grantsFeat:
      category === 'background'
        ? sum(`SELECT SUM(t.grants_feat) AS value FROM background_index t ${active}`)
        : 0,
    prerequisite: feat
      ? sum(`SELECT SUM(t.has_prerequisite) AS value FROM feat_index t ${active}`)
      : 0,
    abilityIncrease: feat
      ? sum(`SELECT SUM(t.ability_increase) AS value FROM feat_index t ${active}`)
      : 0,
    raceRequired: feat
      ? sum(`SELECT SUM(t.race_required) AS value FROM feat_index t ${active}`)
      : 0,
  };
}
