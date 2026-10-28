import {
  type RaceFacetsResponse,
  type RaceListItem,
  type RaceListQuery,
  type RaceListResponse,
} from '@koster/shared';
import type { CatalogConnection } from './open.ts';
import { toFtsQuery } from './search-query.ts';
import { normalizeSearchText } from './search-text.ts';

// Список и фильтры рас (раздел 7, «Каталог»). Как у снаряжения: фильтры и сортировка —
// в SQL, снятые объекты (`withdrawn`) в списке не показываются. Разновидность идёт
// сразу за своей расой, если не задан поиск.

interface RaceRow {
  id: string;
  nameRu: string;
  nameEn: string;
  kind: RaceListItem['kind'];
  variantOf: string | null;
  variantOfName: string | null;
  size: RaceListItem['size'];
  speedWalkFt: number | null;
  flying: number;
  darkvisionFt: number | null;
  sources: string | null;
  reviewStatus: RaceListItem['reviewStatus'];
}

export function listRaces(catalog: CatalogConnection, query: RaceListQuery): RaceListResponse {
  const where = ['e.withdrawn = 0', "e.category = 'race'"];
  const params: Record<string, string | number> = {};

  const fts = query.q ? toFtsQuery(query.q) : null;
  if (fts) {
    where.push('content_search MATCH @fts');
    params['fts'] = fts;
  }
  if (query.kind) {
    where.push('ri.kind = @kind');
    params['kind'] = query.kind;
  }
  if (query.variantOf) {
    where.push('ri.variant_of = @variantOf');
    params['variantOf'] = query.variantOf;
  }
  if (query.size) {
    where.push('ri.size_id = @size');
    params['size'] = query.size;
  }
  if (query.flying !== undefined) {
    where.push('ri.flying = @flying');
    params['flying'] = query.flying ? 1 : 0;
  }
  if (query.darkvision !== undefined) {
    where.push(query.darkvision ? 'ri.darkvision_ft IS NOT NULL' : 'ri.darkvision_ft IS NULL');
  }
  if (query.source) {
    where.push(
      'EXISTS (SELECT 1 FROM entity_sources es WHERE es.entity_id = e.id AND es.source_id = @source)',
    );
    params['source'] = query.source;
  }

  // Без поиска: раса, за ней её разновидности; расы по названию.
  const byName = `COALESCE(base.name_ru, e.name_ru), COALESCE(ri.variant_of, e.id),
    ri.kind = 'variant', e.name_ru, e.id`;
  const order =
    query.sort === 'relevance' && fts
      ? `CASE WHEN content_search.name_ru = @exact OR content_search.name_en = @exact
           THEN 0 ELSE 1 END, bm25(content_search, 0, 0, 10, 10, 5, 1), e.name_ru, e.id`
      : byName;
  const exact = normalizeSearchText(query.q ?? '')
    .trim()
    .replace(/\s+/g, ' ');

  const from = `FROM content_entities e
    JOIN race_index ri ON ri.entity_id = e.id
    LEFT JOIN content_entities base ON base.id = ri.variant_of
    JOIN content_search ON content_search.entity_id = e.id
    WHERE ${where.join(' AND ')}`;

  const total = (
    catalog.sqlite.prepare(`SELECT COUNT(*) AS total ${from}`).get(params) as { total: number }
  ).total;

  const rows = catalog.sqlite
    .prepare(
      `SELECT e.id, e.name_ru AS nameRu, e.name_en AS nameEn, ri.kind, ri.variant_of AS variantOf,
        base.name_ru AS variantOfName, ri.size_id AS size, ri.speed_walk_ft AS speedWalkFt,
        ri.flying, ri.darkvision_ft AS darkvisionFt, e.review_status AS reviewStatus,
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
    }) as RaceRow[];

  return {
    items: rows.map((row) => ({
      id: row.id,
      nameRu: row.nameRu,
      nameEn: row.nameEn,
      kind: row.kind,
      variantOf: row.variantOf,
      variantOfName: row.variantOfName,
      size: row.size,
      speedWalkFt: row.speedWalkFt,
      flying: row.flying === 1,
      darkvisionFt: row.darkvisionFt,
      sources: row.sources ? row.sources.split(',').sort() : [],
      reviewStatus: row.reviewStatus,
    })),
    total,
    page: query.page,
    pageSize: query.pageSize,
  };
}

export function raceFacets(catalog: CatalogConnection): RaceFacetsResponse {
  const active = 'JOIN content_entities e ON e.id = ri.entity_id AND e.withdrawn = 0';
  const all = <T>(sql: string) => catalog.sqlite.prepare(sql).all() as T[];
  const kinds = all<{ value: string; count: number }>(
    `SELECT ri.kind AS value, COUNT(*) AS count FROM race_index ri ${active} GROUP BY ri.kind`,
  );
  const sizes = all<{ value: string; label: string; count: number }>(
    `SELECT t.id AS value, t.name_ru AS label, COUNT(*) AS count
     FROM sizes t JOIN race_index ri ON ri.size_id = t.id ${active}
     GROUP BY t.id ORDER BY t.rowid`,
  );
  const sources = all<{ value: string; code: string; nameEn: string; count: number }>(
    `SELECT s.id AS value, s.code, s.name_en AS nameEn, COUNT(*) AS count
     FROM sources s JOIN entity_sources es ON es.source_id = s.id
     JOIN race_index ri ON ri.entity_id = es.entity_id ${active}
     GROUP BY s.id ORDER BY count DESC, s.code`,
  );
  const counts = catalog.sqlite
    .prepare(
      `SELECT SUM(ri.flying) AS flying, SUM(ri.darkvision_ft IS NOT NULL) AS darkvision
       FROM race_index ri ${active}`,
    )
    .get() as { flying: number | null; darkvision: number | null };

  const kindLabels: Record<string, string> = { race: 'Расы', variant: 'Разновидности' };
  return {
    kind: kinds.map((row) => ({
      value: row.value,
      label: kindLabels[row.value] ?? row.value,
      count: row.count,
    })),
    size: sizes,
    source: sources.map((row) => ({
      value: row.value,
      label: `${row.code} — ${row.nameEn}`,
      count: row.count,
    })),
    flying: counts.flying ?? 0,
    darkvision: counts.darkvision ?? 0,
  };
}
