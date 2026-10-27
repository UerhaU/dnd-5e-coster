import {
  CLASS_NAMES_RU,
  type SpellFacetsResponse,
  type SpellListItem,
  type SpellListQuery,
  type SpellListResponse,
} from '@koster/shared';
import type { CatalogConnection } from './open.ts';
import { toFtsQuery } from './search-query.ts';
import { normalizeSearchText } from './search-text.ts';

// Список и фильтры заклинаний (раздел 7, «Каталог»). Запросы — на SQL: фильтры
// собираются из частей, а поиск FTS5 Drizzle не описывает.
// Снятые объекты (`withdrawn`) в списке и фильтрах не показываются.

export function levelLabel(level: number): string {
  return level === 0 ? 'Заговор' : `${level} уровень`;
}

interface SpellRow {
  id: string;
  nameRu: string;
  nameEn: string;
  level: number;
  school: SpellListItem['school'];
  ritual: number;
  concentration: number;
  reviewStatus: SpellListItem['reviewStatus'];
  sources: string | null;
  classAccess: SpellListItem['classAccess'];
}

export function listSpells(catalog: CatalogConnection, query: SpellListQuery): SpellListResponse {
  const where = ['e.withdrawn = 0', "e.category = 'spell'"];
  const params: Record<string, string | number> = {};

  const fts = query.q ? toFtsQuery(query.q) : null;
  if (fts) {
    where.push('content_search MATCH @fts');
    params['fts'] = fts;
  }
  if (query.level !== undefined) {
    where.push('si.level = @level');
    params['level'] = query.level;
  }
  if (query.school) {
    where.push('si.school_id = @school');
    params['school'] = query.school;
  }
  if (query.class) {
    where.push(
      'EXISTS (SELECT 1 FROM spell_index_classes c WHERE c.entity_id = e.id AND c.class_id = @class)',
    );
    params['class'] = query.class;
  }
  if (query.source) {
    where.push(
      'EXISTS (SELECT 1 FROM entity_sources es WHERE es.entity_id = e.id AND es.source_id = @source)',
    );
    params['source'] = query.source;
  }
  if (query.ritual !== undefined) {
    where.push('si.ritual = @ritual');
    params['ritual'] = query.ritual ? 1 : 0;
  }
  if (query.concentration !== undefined) {
    where.push('si.concentration = @concentration');
    params['concentration'] = query.concentration ? 1 : 0;
  }

  // Название в индексе уже без «ё» и в нижнем регистре: по нему алфавитный порядок верный.
  // Для MATCH и bm25 таблица FTS5 указывается своим именем, без псевдонима.
  const byName = 'content_search.name_ru, e.id';
  const order =
    query.sort === 'level'
      ? `si.level, ${byName}`
      : query.sort === 'relevance' && fts
        ? // Сначала точное совпадение названия («щит» → «Щит»), потом bm25.
          // Веса столбцов: entity_id, category, name_ru, name_en, aliases, body.
          `CASE WHEN content_search.name_ru = @exact OR content_search.name_en = @exact
             THEN 0 ELSE 1 END, bm25(content_search, 0, 0, 10, 10, 5, 1), ${byName}`
        : byName;
  const exact = normalizeSearchText(query.q ?? '')
    .trim()
    .replace(/\s+/g, ' ');

  const from = `FROM content_entities e
    JOIN spell_index si ON si.entity_id = e.id
    JOIN content_search ON content_search.entity_id = e.id
    WHERE ${where.join(' AND ')}`;

  const total = (
    catalog.sqlite.prepare(`SELECT COUNT(*) AS total ${from}`).get(params) as {
      total: number;
    }
  ).total;

  const rows = catalog.sqlite
    .prepare(
      `SELECT e.id, e.name_ru AS nameRu, e.name_en AS nameEn, si.level, si.school_id AS school,
        si.ritual, si.concentration, e.review_status AS reviewStatus,
        (SELECT group_concat(s.code, ',') FROM entity_sources es JOIN sources s ON s.id = es.source_id
          WHERE es.entity_id = e.id) AS sources,
        ${
          query.class
            ? `(SELECT c.access FROM spell_index_classes c
                WHERE c.entity_id = e.id AND c.class_id = @class)`
            : 'NULL'
        } AS classAccess
       ${from}
       ORDER BY ${order}
       LIMIT @limit OFFSET @offset`,
    )
    .all({
      ...params,
      ...(order.includes('@exact') ? { exact } : {}),
      limit: query.pageSize,
      offset: (query.page - 1) * query.pageSize,
    }) as SpellRow[];

  return {
    items: rows.map((row) => ({
      id: row.id,
      nameRu: row.nameRu,
      nameEn: row.nameEn,
      level: row.level,
      school: row.school,
      ritual: row.ritual === 1,
      concentration: row.concentration === 1,
      sources: row.sources ? row.sources.split(',').sort() : [],
      reviewStatus: row.reviewStatus,
      classAccess: row.classAccess,
    })),
    total,
    page: query.page,
    pageSize: query.pageSize,
  };
}

export function spellFacets(catalog: CatalogConnection): SpellFacetsResponse {
  const active = `JOIN content_entities e ON e.id = si.entity_id AND e.withdrawn = 0`;
  const all = <T>(sql: string) => catalog.sqlite.prepare(sql).all() as T[];

  const levels = all<{ value: number; count: number }>(
    `SELECT si.level AS value, COUNT(*) AS count FROM spell_index si ${active}
     GROUP BY si.level ORDER BY si.level`,
  );
  const schools = all<{ value: string; label: string; count: number }>(
    `SELECT ms.id AS value, ms.name_ru AS label, COUNT(si.entity_id) AS count
     FROM magic_schools ms JOIN spell_index si ON si.school_id = ms.id ${active}
     GROUP BY ms.id ORDER BY ms.name_ru`,
  );
  const classes = all<{ value: string; count: number }>(
    `SELECT c.class_id AS value, COUNT(*) AS count FROM spell_index_classes c
     JOIN spell_index si ON si.entity_id = c.entity_id ${active}
     GROUP BY c.class_id`,
  );
  const sources = all<{ value: string; code: string; nameEn: string; count: number }>(
    `SELECT s.id AS value, s.code, s.name_en AS nameEn, COUNT(*) AS count
     FROM sources s JOIN entity_sources es ON es.source_id = s.id
     JOIN spell_index si ON si.entity_id = es.entity_id ${active}
     GROUP BY s.id ORDER BY count DESC, s.code`,
  );
  const flags = catalog.sqlite
    .prepare(
      `SELECT SUM(si.ritual) AS ritual, SUM(si.concentration) AS concentration
       FROM spell_index si ${active}`,
    )
    .get() as { ritual: number | null; concentration: number | null };

  const className = (id: string) => CLASS_NAMES_RU[id as keyof typeof CLASS_NAMES_RU] ?? id;
  return {
    level: levels.map((row) => ({ ...row, label: levelLabel(row.value) })),
    school: schools,
    class: classes
      .map((row) => ({ ...row, label: className(row.value) }))
      .sort((a, b) => a.label.localeCompare(b.label, 'ru')),
    source: sources.map((row) => ({
      value: row.value,
      label: `${row.code} — ${row.nameEn}`,
      count: row.count,
    })),
    ritual: flags.ritual ?? 0,
    concentration: flags.concentration ?? 0,
  };
}
