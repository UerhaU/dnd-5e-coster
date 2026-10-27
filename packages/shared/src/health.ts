import { z } from 'zod';

/** Ответ `GET /api/health`: сервер жив, какие версии программы, SQLite и каталога. */
export const healthResponseSchema = z.object({
  status: z.literal('ok'),
  appVersion: z.string().min(1),
  sqliteVersion: z.string().min(1),
  /** Версия catalog.db; `null` — программа запущена без каталога (только в разработке). */
  catalog: z
    .object({
      version: z.number().int().positive(),
      contentHash: z.string(),
      builtAt: z.string(),
      /** `full` — полный каталог; `fixtures` — тестовый из data/fixtures (CI). */
      sourceKind: z.string(),
    })
    .nullable(),
});

export type HealthResponse = z.infer<typeof healthResponseSchema>;
