/**
 * Текст для индекса FTS5 и для поискового запроса: нижний регистр, «ё» = «е».
 * Одна функция для сборки и для поиска, чтобы они не разошлись.
 */
export function normalizeSearchText(value: string): string {
  return value.toLowerCase().replaceAll('ё', 'е');
}
