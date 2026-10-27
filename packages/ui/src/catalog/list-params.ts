import { spellListQuerySchema, type SpellListParams } from '@koster/shared';

// Фильтры списка хранятся в адресе экрана (`?q=огнен&level=3`): после карточки
// кнопка «Назад» возвращает к тому же списку.

/** Фильтры, которые сбрасывают номер страницы при изменении. */
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

export type FilterKey = (typeof FILTER_KEYS)[number];

/** Адрес → параметры запроса к API. Неверные значения просто не применяются. */
export function paramsFromSearch(search: URLSearchParams): SpellListParams {
  const params: SpellListParams = {};
  for (const key of [...FILTER_KEYS, 'page'] as const) {
    const value = search.get(key);
    if (value === null || value === '') {
      continue;
    }
    const parsed = spellListQuerySchema.shape[key].safeParse(value);
    if (parsed.success && parsed.data !== undefined) {
      Object.assign(params, { [key]: parsed.data });
    }
  }
  return params;
}

/** Новый адрес после изменения одного фильтра: страница — снова первая. */
export function withFilter(search: URLSearchParams, key: FilterKey | 'page', value: string) {
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
