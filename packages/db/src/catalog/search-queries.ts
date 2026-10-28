import {
  CATEGORIES,
  type CatalogSearchQuery,
  type CatalogSearchResponse,
  type SearchResultItem,
} from '@koster/shared';
import type { CatalogConnection } from './open.ts';
import { toFtsQuery } from './search-query.ts';
import { normalizeSearchText } from './search-text.ts';

// Поиск по всему каталогу (Р54, раздел 7): один индекс FTS5 на все категории.
// Порядок: точное совпадение названия (русского или английского), затем название,
// начинающееся с запроса, затем релевантность bm25 (название весит больше текста).
// Снятые объекты (`withdrawn`) не показываются.

interface SearchRow {
  id: string;
  category: SearchResultItem['category'];
  nameRu: string;
  nameEn: string;
  sources: string | null;
  level: number | null;
  school: NonNullable<SearchResultItem['spell']>['school'] | null;
  itemKind: NonNullable<SearchResultItem['item']>['kind'] | null;
  itemCategory: NonNullable<SearchResultItem['item']>['category'];
  raceKind: NonNullable<SearchResultItem['race']>['kind'] | null;
  variantOfName: string | null;
}

export function searchCatalog(
  catalog: CatalogConnection,
  query: CatalogSearchQuery,
): CatalogSearchResponse {
  const fts = toFtsQuery(query.q);
  const empty = { items: [], total: 0, page: query.page, pageSize: query.pageSize, byCategory: [] };
  if (!fts) return empty;

  const exact = normalizeSearchText(query.q).trim().replace(/\s+/g, ' ');
  const params = { fts, exact, prefix: `${exact.replace(/[!%_]/g, '!$&')}%` };
  const from = `FROM content_entities e
    JOIN content_search ON content_search.entity_id = e.id`;
  const where = 'WHERE e.withdrawn = 0 AND content_search MATCH @fts';

  const counts = catalog.sqlite
    .prepare(`SELECT e.category, COUNT(*) AS count ${from} ${where} GROUP BY e.category`)
    .all({ fts }) as { category: SearchResultItem['category']; count: number }[];
  const total = counts.reduce((sum, row) => sum + row.count, 0);

  // Для MATCH и bm25 таблица FTS5 указывается своим именем, без псевдонима.
  const rows = catalog.sqlite
    .prepare(
      `SELECT e.id, e.category, e.name_ru AS nameRu, e.name_en AS nameEn,
        si.level, si.school_id AS school,
        ii.kind_id AS itemKind, ii.category_id AS itemCategory,
        ri.kind AS raceKind, base.name_ru AS variantOfName,
        (SELECT group_concat(s.code, ',') FROM entity_sources es JOIN sources s ON s.id = es.source_id
          WHERE es.entity_id = e.id) AS sources
       ${from}
       LEFT JOIN spell_index si ON si.entity_id = e.id
       LEFT JOIN item_index ii ON ii.entity_id = e.id
       LEFT JOIN race_index ri ON ri.entity_id = e.id
       LEFT JOIN content_entities base ON base.id = ri.variant_of
       ${where}
       ORDER BY
         CASE WHEN content_search.name_ru = @exact OR content_search.name_en = @exact THEN 0
              WHEN content_search.name_ru LIKE @prefix ESCAPE '!'
                OR content_search.name_en LIKE @prefix ESCAPE '!' THEN 1
              ELSE 2 END,
         bm25(content_search, 0, 0, 10, 10, 5, 1), e.name_ru, e.id
       LIMIT @limit OFFSET @offset`,
    )
    .all({
      ...params,
      limit: query.pageSize,
      offset: (query.page - 1) * query.pageSize,
    }) as SearchRow[];

  return {
    items: rows.map((row) => ({
      id: row.id,
      category: row.category,
      nameRu: row.nameRu,
      nameEn: row.nameEn,
      sources: row.sources ? row.sources.split(',').sort() : [],
      spell:
        row.level !== null && row.school !== null ? { level: row.level, school: row.school } : null,
      item: row.itemKind ? { kind: row.itemKind, category: row.itemCategory } : null,
      race: row.raceKind ? { kind: row.raceKind, variantOfName: row.variantOfName } : null,
    })),
    total,
    page: query.page,
    pageSize: query.pageSize,
    byCategory: CATEGORIES.flatMap((id) => {
      const row = counts.find((entry) => entry.category === id);
      return row ? [{ id, count: row.count }] : [];
    }),
  };
}
