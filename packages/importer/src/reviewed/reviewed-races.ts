import fs from 'node:fs';
import path from 'node:path';
import { raceRulesSchema } from '@koster/shared';
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

/**
 * Пробел сайта в механике расы (Р73): значение выводится из той же страницы DnD.su
 * (кентавр MOT — скорость из вкладки GGR, аасимар — размер «как у людей»).
 * Заполняет только пустые поля: если сайт значение даёт, сборка предупреждает.
 */
export const reviewedRaceFillSchema = z.strictObject({
  id: z.string().regex(/^race:[a-z0-9-]+$/),
  size: raceRulesSchema.shape.size.unwrap().optional(),
  walkFt: raceRulesSchema.shape.speed.shape.walk.unwrap().optional(),
  reason: text,
});

const rulesFileSchema = z.strictObject({
  $comment: z.string().optional(),
  fills: z.array(reviewedRaceFillSchema),
});

const namesFileSchema = z.strictObject({
  $comment: z.string().optional(),
  blocks: z.array(reviewedRaceBlockSchema),
});

export type ReviewedRaceBlock = z.infer<typeof reviewedRaceBlockSchema>;
export type ReviewedRaceFill = z.infer<typeof reviewedRaceFillSchema>;

export interface ReviewedRaces {
  /** Ключ — `raceBlockKey`. */
  blocks: Map<string, ReviewedRaceBlock>;
  /** Ключ — ID расы: data/reviewed/races/rules.json. */
  fills: Map<string, ReviewedRaceFill>;
  invalid: { file: string; message: string }[];
}

export function raceBlockKey(page: number, heading: string, book?: string | null): string {
  return [page, nameKey(heading), book?.toUpperCase() ?? ''].join('|');
}

export function loadReviewedRaces(folder: string): ReviewedRaces {
  const invalid: ReviewedRaces['invalid'] = [];
  const blocks = new Map<string, ReviewedRaceBlock>();
  const fills = new Map<string, ReviewedRaceFill>();
  const rulesFile = path.join(folder, 'rules.json');
  if (fs.existsSync(rulesFile)) {
    const rules = rulesFileSchema.safeParse(JSON.parse(fs.readFileSync(rulesFile, 'utf8')));
    if (!rules.success) invalid.push({ file: 'rules.json', message: z.prettifyError(rules.error) });
    for (const entry of rules.data?.fills ?? []) {
      if (fills.has(entry.id)) invalid.push({ file: 'rules.json', message: `повтор ${entry.id}` });
      fills.set(entry.id, entry);
    }
  }
  const file = path.join(folder, 'names.json');
  if (!fs.existsSync(file)) {
    invalid.push({ file: 'names.json', message: 'файла нет' });
    return { blocks, fills, invalid };
  }
  const parsed = namesFileSchema.safeParse(JSON.parse(fs.readFileSync(file, 'utf8')));
  if (!parsed.success) {
    invalid.push({ file: 'names.json', message: z.prettifyError(parsed.error) });
    return { blocks, fills, invalid };
  }
  for (const entry of parsed.data.blocks) {
    const key = raceBlockKey(entry.page, entry.match, entry.book);
    if (blocks.has(key)) invalid.push({ file: 'names.json', message: `повтор «${entry.match}»` });
    blocks.set(key, entry);
  }
  return { blocks, fills, invalid };
}
