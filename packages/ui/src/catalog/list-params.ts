import {
  itemListQuerySchema,
  spellListQuerySchema,
  type ItemListParams,
  type SpellListParams,
} from '@koster/shared';

// Фильтры списка хранятся в адресе экрана (`?q=огнен&level=3`): после карточки
// кнопка «Назад» возвращает к тому же списку.

/** Фильтры списка заклинаний, которые сбрасывают номер страницы при изменении. */
export const FILTER_KEYS = [
  'q',
  'level',
  'school',
  'class',
  'source',
  'ritual',
  'concentration',
  'sort',
] as const;

/** Фильтры списка снаряжения. */
export const ITEM_FILTER_KEYS = [
  'q',
  'kind',
  'category',
  'property',
  'damageType',
  'source',
  'optionalRule',
  'sort',
] as const;

export type FilterKey = (typeof FILTER_KEYS)[number];
export type ItemFilterKey = (typeof ITEM_FILTER_KEYS)[number];

/** Поля схемы списка: каждое умеет проверить одно значение из адреса. */
interface ListSchema {
  shape: Record<string, { safeParse(value: unknown): { success: boolean; data?: unknown } }>;
}

/** Адрес → параметры запроса по схеме списка. Неверные значения просто не применяются. */
function parseParams(
  search: URLSearchParams,
  schema: ListSchema,
  keys: readonly string[],
): Record<string, unknown> {
  const params: Record<string, unknown> = {};
  for (const key of [...keys, 'page']) {
    const value = search.get(key);
    const field = schema.shape[key];
    if (value === null || value === '' || !field) {
      continue;
    }
    const parsed = field.safeParse(value);
    if (parsed.success && parsed.data !== undefined) {
      params[key] = parsed.data;
    }
  }
  return params;
}

export function paramsFromSearch(search: URLSearchParams): SpellListParams {
  return parseParams(search, spellListQuerySchema, FILTER_KEYS) as SpellListParams;
}

export function itemParamsFromSearch(search: URLSearchParams): ItemListParams {
  return parseParams(search, itemListQuerySchema, ITEM_FILTER_KEYS) as ItemListParams;
}

/** Новый адрес после изменения одного фильтра: страница — снова первая. */
export function withFilter(search: URLSearchParams, key: string, value: string) {
  const next = new URLSearchParams(search);
  if (value === '') {
    next.delete(key);
  } else {
    next.set(key, value);
  }
  if (key !== 'page') {
    next.delete('page');
  }
  return next;
}
