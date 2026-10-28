import { z } from 'zod';
import { idsOf } from './codes.ts';
import { entityIdSchema } from './entity.ts';
import { ITEM_CATEGORIES, ITEM_KINDS } from './item-codes.ts';
import { textBlockSchema } from './text-blocks.ts';

// Данные обычного предмета (`content_revisions.data_json`, схема item/v1).
// Механика оружия и доспехов — в rules_json (item-rules/v1).
// Раздел 9: «варьируется», «—» и прочее неизвестное — `null`, исходный текст хранится всегда.

export const ITEM_SCHEMA_VERSION = 'item/v1';

const text = z.string().min(1);

export const itemCostSchema = z.strictObject({
  /** Как в таблице DnD.su: «1 500 зм», «—»; `null` — на сайте нет такой ячейки. */
  text: text.nullable(),
  /** В медных монетах: 1 зм = 100 мм. `null` — цена не указана. */
  cp: z.number().int().min(0).nullable(),
});

export const itemWeightSchema = z.strictObject({
  /** Как в таблице: «¼ фнт.», «5 фнт. (полн.)», «—»; `null` — на сайте нет такой ячейки. */
  text: text.nullable(),
  /** `null` — вес не указан («—»): это не то же самое, что 0. */
  lb: z.number().min(0).nullable(),
});

/** Предмет, входящий в набор. Если такого предмета в каталоге нет — только название. */
export const itemContentSchema = z.strictObject({
  itemId: entityIdSchema.nullable(),
  /** Как в описании набора: «спальник», «коробка для пожертвований». */
  name: text,
  quantity: z.number().int().positive(),
  /** Уточнение: «на 5 дней», «50 футов». */
  note: text.nullable(),
});

/** Столбец исходной таблицы: «Урон» — «1к8 рубящий». Для показа как на сайте. */
export const itemStatSchema = z.strictObject({ label: text, value: text });

export const itemDataSchema = z.strictObject({
  schemaVersion: z.literal(ITEM_SCHEMA_VERSION),
  kind: z.enum(idsOf(ITEM_KINDS)),
  /** Вид оружия или доспеха, группа фокусировки или инструментов; `null` — без группы. */
  category: z.enum(idsOf(ITEM_CATEGORIES)).nullable(),
  cost: itemCostSchema,
  weight: itemWeightSchema,
  /** Сколько штук продаётся за эту цену: «Стрелы (20)» — 20. */
  quantity: z.number().int().positive(),
  /**
   * Вариант правил: дополнительное оружие из приключений и огнестрельное оружие DMG.
   * Использовать можно только с разрешения мастера.
   */
  optionalRule: z.boolean(),
  /** Огнестрельное оружие DMG и его эпоха. */
  firearm: z.enum(['renaissance', 'modern', 'futuristic']).nullable(),
  /** Столбцы строки таблицы, кроме названия. */
  stats: z.array(itemStatSchema),
  /** Состав набора снаряжения; у остальных предметов пустой. */
  contents: z.array(itemContentSchema),
  description: z.array(textBlockSchema),
});

export type ItemData = z.infer<typeof itemDataSchema>;
export type ItemContent = z.infer<typeof itemContentSchema>;
