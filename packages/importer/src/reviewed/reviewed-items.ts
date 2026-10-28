import fs from 'node:fs';
import path from 'node:path';
import { entityIdSchema, idsOf, ITEM_CATEGORIES, ITEM_KINDS } from '@koster/shared';
import { z } from 'zod';

// Ручные данные снаряжения (раздел 6, шаг review): data/reviewed/items/.
// На DnD.su у строк таблиц нет английских названий, а ID строится по ним (Р11),
// поэтому английское название и связи (боеприпас, состав набора) заданы здесь.

const text = z.string().min(1);

export const reviewedItemNameSchema = z.strictObject({
  /** Название из таблицы DnD.su без количества «(20)» и метки книги. */
  match: text,
  nameEn: text,
  /** Вид предмета, если таблица смешанная: в «Сёдла, упряжь и транспорт» есть и повозки. */
  kind: z.enum(idsOf(ITEM_KINDS)).optional(),
  category: z.enum(idsOf(ITEM_CATEGORIES)).optional(),
  ammunition: entityIdSchema.optional(),
  /** Заголовки описаний на странице, если не совпадают с названием. */
  descriptionTerms: z.array(text).optional(),
});

export const reviewedTradeGoodSchema = z.strictObject({
  /** Часть ячейки «Товар»: «1 фунт перца». */
  match: text,
  nameRu: text,
  nameEn: text,
});

export const reviewedPackSchema = z.strictObject({
  match: text,
  nameEn: text,
  contents: z
    .array(
      z.strictObject({
        item: entityIdSchema.nullable(),
        name: text,
        quantity: z.number().int().positive(),
        note: text.optional(),
      }),
    )
    .min(1),
});

/** Строка таблицы, которая не предмет: «Доспех ×4 ×2» — множитель цены доспеха скакуна. */
export const reviewedSkipRowSchema = z.strictObject({ match: text, reason: text });

const namesFileSchema = z.strictObject({
  $comment: z.string().optional(),
  items: z.array(reviewedItemNameSchema),
  tradeGoods: z.array(reviewedTradeGoodSchema),
  skipRows: z.array(reviewedSkipRowSchema).default([]),
});
/** Материальный компонент заклинания → предмет каталога (Р60): новый, существующий или не предмет. */
export const reviewedComponentSchema = z.union([
  z.strictObject({ match: text, nameEn: text }),
  z.strictObject({ match: text, itemId: entityIdSchema }),
  z.strictObject({ match: text, skip: text }),
]);

const componentsFileSchema = z.strictObject({
  $comment: z.string().optional(),
  components: z.array(reviewedComponentSchema),
});

const packsFileSchema = z.strictObject({
  $comment: z.string().optional(),
  packs: z.array(reviewedPackSchema),
});

export type ReviewedItemName = z.infer<typeof reviewedItemNameSchema>;
export type ReviewedTradeGood = z.infer<typeof reviewedTradeGoodSchema>;
export type ReviewedPack = z.infer<typeof reviewedPackSchema>;
export type ReviewedComponent = z.infer<typeof reviewedComponentSchema>;

export interface ReviewedItems {
  names: Map<string, ReviewedItemName>;
  tradeGoods: Map<string, ReviewedTradeGood>;
  packs: Map<string, ReviewedPack>;
  skipRows: Map<string, z.infer<typeof reviewedSkipRowSchema>>;
  /** spell-components.json: ключ — название листа состава заклинания. */
  components: Map<string, ReviewedComponent>;
  /** Ошибки файлов: файл не прочитан или повтор ключа. */
  invalid: { file: string; message: string }[];
}

/** Ключ сравнения названий: без регистра, «ё» как «е», без лишних пробелов. */
export function nameKey(value: string): string {
  return value.toLowerCase().replaceAll('ё', 'е').replace(/\s+/g, ' ').trim();
}

function readJson<T extends z.ZodType>(
  folder: string,
  file: string,
  schema: T,
  invalid: ReviewedItems['invalid'],
): z.infer<T> | null {
  const full = path.join(folder, file);
  if (!fs.existsSync(full)) {
    invalid.push({ file, message: 'файла нет' });
    return null;
  }
  const parsed = schema.safeParse(JSON.parse(fs.readFileSync(full, 'utf8')));
  if (!parsed.success) {
    invalid.push({ file, message: z.prettifyError(parsed.error) });
    return null;
  }
  return parsed.data;
}

function byKey<T extends { match: string }>(
  file: string,
  entries: readonly T[],
  invalid: ReviewedItems['invalid'],
): Map<string, T> {
  const map = new Map<string, T>();
  for (const entry of entries) {
    const key = nameKey(entry.match);
    if (map.has(key)) {
      invalid.push({ file, message: `повтор «${entry.match}»` });
    }
    map.set(key, entry);
  }
  return map;
}

export function loadReviewedItems(folder: string): ReviewedItems {
  const invalid: ReviewedItems['invalid'] = [];
  const names = readJson(folder, 'names.json', namesFileSchema, invalid);
  const packs = readJson(folder, 'packs.json', packsFileSchema, invalid);
  const components = readJson(folder, 'spell-components.json', componentsFileSchema, invalid);
  return {
    names: byKey('names.json', names?.items ?? [], invalid),
    tradeGoods: byKey('names.json', names?.tradeGoods ?? [], invalid),
    packs: byKey('packs.json', packs?.packs ?? [], invalid),
    skipRows: byKey('names.json', names?.skipRows ?? [], invalid),
    components: byKey('spell-components.json', components?.components ?? [], invalid),
    invalid,
  };
}
