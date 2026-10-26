import { z } from 'zod';

/** Ответ `GET /api/health`: сервер жив, какая версия программы и SQLite. */
export const healthResponseSchema = z.object({
  status: z.literal('ok'),
  appVersion: z.string().min(1),
  sqliteVersion: z.string().min(1),
});

export type HealthResponse = z.infer<typeof healthResponseSchema>;
