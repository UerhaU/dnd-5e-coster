import fs from 'node:fs';
import path from 'node:path';
import { z } from 'zod';
import { nameKey } from './reviewed-items.ts';

// Ручные данные рас (раздел 6, шаг review): data/reviewed/races/names.json.
// На DnD.su у разделов разновидностей нет английских названий, а ID строится по ним
// (Р11, как у снаряжения — Р62). Там же — блоки, которые не берутся (UA, не WotC).

const text = z.string().min(1);

export const reviewedRaceBlockSchema = z
  .strictObject({
    page: z.number().int().positive(),
    /** Заголовок раздела или подпись вкладки без метки книги. */
    match: text,
    /** Код книги блока, если на странице два раздела с одним заголовком. */
    book: text.optional(),
    nameEn: text.optional(),
    /** Русское название, если заголовок им не подходит: вкладка «Метка опеки» → «Дварф с меткой опеки». */
    nameRu: text.optional(),
    /** `race` — полный набор особенностей той же расы из другой книги (Р67). */
    kind: z.enum(['race', 'variant']).default('variant'),
    skip: text.optional(),
  })
  .refine((entry) => Boolean(entry.nameEn) !== Boolean(entry.skip), {
    message: 'нужно либо nameEn, либо skip',
  });

const namesFileSchema = z.strictObject({
  $comment: z.string().optional(),
  blocks: z.array(reviewedRaceBlockSchema),
});

export type ReviewedRaceBlock = z.infer<typeof reviewedRaceBlockSchema>;

export interface ReviewedRaces {
  /** Ключ — `raceBlockKey`. */
  blocks: Map<string, ReviewedRaceBlock>;
  invalid: { file: string; message: string }[];
}

export function raceBlockKey(page: number, heading: string, book?: string | null): string {
  return [page, nameKey(heading), book?.toUpperCase() ?? ''].join('|');
}

export function loadReviewedRaces(folder: string): ReviewedRaces {
  const invalid: ReviewedRaces['invalid'] = [];
  const blocks = new Map<string, ReviewedRaceBlock>();
  const file = path.join(folder, 'names.json');
  if (!fs.existsSync(file)) {
    invalid.push({ file: 'names.json', message: 'файла нет' });
    return { blocks, invalid };
  }
  const parsed = namesFileSchema.safeParse(JSON.parse(fs.readFileSync(file, 'utf8')));
  if (!parsed.success) {
    invalid.push({ file: 'names.json', message: z.prettifyError(parsed.error) });
    return { blocks, invalid };
  }
  for (const entry of parsed.data.blocks) {
    const key = raceBlockKey(entry.page, entry.match, entry.book);
    if (blocks.has(key)) invalid.push({ file: 'names.json', message: `повтор «${entry.match}»` });
    blocks.set(key, entry);
  }
  return { blocks, invalid };
}
