import { normalizeSearchText } from './search-text.ts';

/**
 * Запрос пользователя → выражение FTS5: каждое слово ищется по началу,
 * все слова обязательны. «Огнен шар» → `"огнен"* "шар"*`.
 * Кавычки и операторы FTS5 из запроса не проходят: остаются только буквы и цифры.
 * Пустой запрос (одни знаки препинания) — `null`, поиск не применяется.
 */
export function toFtsQuery(text: string): string | null {
  const words = normalizeSearchText(text)
    .split(/[^\p{L}\p{N}]+/u)
    .filter((word) => word.length > 0);
  if (words.length === 0) {
    return null;
  }
  return words.map((word) => `"${word}"*`).join(' ');
}
