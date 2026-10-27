import { z } from 'zod';

// Единый формат ошибки API: любой ответ с кодом 4xx/5xx — `{ error: { … } }`.

export const API_ERROR_CODES = [
  /** Запрос не прошёл схему: неизвестный фильтр, номер страницы не число и т.п. */
  'bad_request',
  /** Нет такого объекта, ревизии или категории. */
  'not_found',
  /** Программа запущена без catalog.db (бывает только в разработке). */
  'catalog_unavailable',
  'internal',
] as const;

export const apiErrorSchema = z.object({
  error: z.object({
    code: z.enum(API_ERROR_CODES),
    /** Сообщение для человека, по-русски. */
    message: z.string().min(1),
    /** Подробности для разработчика: например, какие поля запроса не прошли схему. */
    details: z.unknown().optional(),
  }),
});

export type ApiErrorCode = (typeof API_ERROR_CODES)[number];
export type ApiErrorBody = z.infer<typeof apiErrorSchema>;
