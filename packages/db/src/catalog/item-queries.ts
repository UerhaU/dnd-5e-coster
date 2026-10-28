import {
  type ItemFacetsResponse,
  type ItemListItem,
  type ItemListQuery,
  type ItemListResponse,
} from '@koster/shared';
import type { CatalogConnection } from './open.ts';
import { toFtsQuery } from './search-query.ts';
import { normalizeSearchText } from './search-text.ts';

// Список и фильтры снаряжения (раздел 7, «Каталог»). Как у заклинаний: фильтры и
// сортировка — в SQL, снятые объекты (`withdrawn`) в списке не показываются.

interface ItemRow {
  id: string;
  nameRu: string;
  nameEn: string;
  kind: ItemListItem['kind'];
  category: ItemListItem['category'];
  costText: string | null;
  costCp: number | null;
  weightText: string | null;
  weightLb: number | null;
  quantity: number;
  optionalRule: number;
  damage: string | null;
  armorClass: string | null;
  armorClassBonus: number | null;
  sources: string | null;
  reviewStatus: ItemListItem['reviewStatus'];
}

export function listItems(catalog: CatalogConnection, query: ItemListQuery): ItemListResponse {
  const where = ['e.withdrawn = 0', "e.category = 'item'"];
  const params: Record<string, string | number> = {};

  const fts = query.q ? toFtsQuery(query.q) : null;
  if (fts) {
    where.push('content_search MATCH @fts');
    params['fts'] = fts;
  }
  if (query.kind) {
    where.push('ii.kind_id = @kind');
    params['kind'] = query.kind;
  } else {
    // Р70: компоненты заклинаний видны в снаряжении только по фильтру «Вид».
    where.push("ii.kind_id != 'spell_component'");
  }
  if (query.category) {
    where.push('ii.category_id = @category');
    params['category'] = query.category;
  }
  if (query.property) {
    where.push(
      `EXISTS (SELECT 1 FROM item_index_properties p
        WHERE p.entity_id = e.id AND p.property_id = @property)`,
    );
    params['property'] = query.property;
  }
  if (query.damageType) {
    where.push('ii.damage_type_id = @damageType');
    params['damageType'] = query.damageType;
  }
  if (query.source) {
    where.push(
      'EXISTS (SELECT 1 FROM entity_sources es WHERE es.entity_id = e.id AND es.source_id = @source)',
    );
    params['source'] = query.source;
  }
  if (query.optionalRule !== undefined) {
    where.push('ii.optional_rule = @optionalRule');
    params['optionalRule'] = query.optionalRule ? 1 : 0;
  }

  // Неизвестная цена и вес — в конце списка, а не как ноль.
  const byName = 'content_search.name_ru, e.id';
  const order =
    query.sort === 'cost'
      ? `ii.cost_cp IS NULL, ii.cost_cp, ${byName}`
      : query.sort === 'weight'
        ? `ii.weight_lb IS NULL, ii.weight_lb, ${byName}`
        : query.sort === 'relevance' && fts
          ? `CASE WHEN content_search.name_ru = @exact OR content_search.name_en = @exact
               THEN 0 ELSE 1 END, bm25(content_search, 0, 0, 10, 10, 5, 1), ${byName}`
          : byName;
  const exact = normalizeSearchText(query.q ?? '')
    .trim()
    .replace(/\s+/g, ' ');

  const from = `FROM content_entities e
    JOIN item_index ii ON ii.entity_id = e.id
    JOIN content_revisions r ON r.id = e.current_revision_id
    JOIN content_search ON content_search.entity_id = e.id
    WHERE ${where.join(' AND ')}`;

  const total = (
    catalog.sqlite.prepare(`SELECT COUNT(*) AS total ${from}`).get(params) as { total: number }
  ).total;

  const rows = catalog.sqlite
    .prepare(
      `SELECT e.id, e.name_ru AS nameRu, e.name_en AS nameEn, ii.kind_id AS kind,
        ii.category_id AS category, ii.cost_cp AS costCp, ii.weight_lb AS weightLb,
        ii.optional_rule AS optionalRule, e.review_status AS reviewStatus,
        json_extract(r.data_json, '$.cost.text') AS costText,
        json_extract(r.data_json, '$.weight.text') AS weightText,
        json_extract(r.data_json, '$.quantity') AS quantity,
        json_extract(r.rules_json, '$.weapon.damage') AS damage,
        json_extract(r.rules_json, '$.armor.armorClass') AS armorClass,
        json_extract(r.rules_json, '$.shield.armorClassBonus') AS armorClassBonus,
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
    }) as ItemRow[];

  return {
    items: rows.map((row) => ({
      id: row.id,
      nameRu: row.nameRu,
      nameEn: row.nameEn,
      kind: row.kind,
      category: row.category,
      costText: row.costText,
      costCp: row.costCp,
      weightText: row.weightText,
      weightLb: row.weightLb,
      quantity: row.quantity,
      optionalRule: row.optionalRule === 1,
      damage: row.damage ? (JSON.parse(row.damage) as ItemListItem['damage']) : null,
      armorClass: row.armorClass
        ? (JSON.parse(row.armorClass) as ItemListItem['armorClass'])
        : null,
      armorClassBonus: row.armorClassBonus,
      sources: row.sources ? row.sources.split(',').sort() : [],
      reviewStatus: row.reviewStatus,
    })),
    total,
    page: query.page,
    pageSize: query.pageSize,
  };
}

export function itemFacets(catalog: CatalogConnection): ItemFacetsResponse {
  const active = 'JOIN content_entities e ON e.id = ii.entity_id AND e.withdrawn = 0';
  const all = <T>(sql: string) => catalog.sqlite.prepare(sql).all() as T[];
  const reference = (table: string, column: string) =>
    all<{ value: string; label: string; count: number }>(
      `SELECT t.id AS value, t.name_ru AS label, COUNT(*) AS count
       FROM ${table} t JOIN item_index ii ON ii.${column} = t.id ${active}
       GROUP BY t.id ORDER BY t.rowid`,
    );

  const properties = all<{ value: string; label: string; count: number }>(
    `SELECT wp.id AS value, wp.name_ru AS label, COUNT(*) AS count
     FROM weapon_properties wp JOIN item_index_properties p ON p.property_id = wp.id
     JOIN item_index ii ON ii.entity_id = p.entity_id ${active}
     GROUP BY wp.id ORDER BY wp.name_ru`,
  );
  const sources = all<{ value: string; code: string; nameEn: string; count: number }>(
    `SELECT s.id AS value, s.code, s.name_en AS nameEn, COUNT(*) AS count
     FROM sources s JOIN entity_sources es ON es.source_id = s.id
     JOIN item_index ii ON ii.entity_id = es.entity_id ${active}
     GROUP BY s.id ORDER BY count DESC, s.code`,
  );
  const optional = catalog.sqlite
    .prepare(`SELECT SUM(ii.optional_rule) AS count FROM item_index ii ${active}`)
    .get() as { count: number | null };

  return {
    kind: reference('item_kinds', 'kind_id'),
    category: reference('item_categories', 'category_id'),
    property: properties,
    damageType: reference('damage_types', 'damage_type_id').sort((a, b) =>
      a.label.localeCompare(b.label, 'ru'),
    ),
    source: sources.map((row) => ({
      value: row.value,
      label: `${row.code} — ${row.nameEn}`,
      count: row.count,
    })),
    optionalRule: optional.count ?? 0,
  };
}
