import { z } from 'zod';
import { entityIdSchema } from './entity.ts';
import { proficiencyChoiceSchema, TOOL_GROUPS } from './choices.ts';
import { textBlockSchema } from './text-blocks.ts';

// Предыстория (`data_json`, схема background/v1) и её механика (`rules_json`,
// background-rules/v1). Тексты — как на DnD.su; механика — то, что нужно
// конструктору (этап 4). Выборы игрока — выборами (`count`, `from`), навыки,
// языки и инструменты — ID объектов каталога. Таблицы черт характера, идеалов,
// привязанностей и слабостей — подсказки, а не ограничение (правила, раздел 9).

export const BACKGROUND_SCHEMA_VERSION = 'background/v1';
export const BACKGROUND_RULES_SCHEMA_VERSION = 'background-rules/v1';

const amount = z.number().int().positive();

export const backgroundSectionSchema = z.strictObject({
  /** Заголовок раздела как на сайте: «Специализация гильдии». */
  name: z.string().min(1),
  blocks: z.array(textBlockSchema),
});

/** Таблица-подсказка: «к8 | Черта характера». */
export const personalityTableSchema = z.strictObject({
  /** Кость таблицы: «к8»; `null` — не указана. */
  die: z.string().min(1).nullable(),
  rows: z.array(z.string().min(1)).min(1),
});

export const backgroundDataSchema = z.strictObject({
  schemaVersion: z.literal(BACKGROUND_SCHEMA_VERSION),
  /**
   * `background` — предыстория; `adaptation` — статья «Адаптация предысторий …»
   * (VRGR, OTA…): альтернативные умения и таблицы для чужих предысторий, без владений.
   */
  kind: z.enum(['background', 'adaptation']),
  intro: z.array(textBlockSchema),
  /** Строки «Владение навыками: …», «Снаряжение: …» — как на сайте. */
  summary: z.array(z.strictObject({ label: z.string().min(1), text: z.string().min(1) })),
  /** «Умение: По многочисленным просьбам»; у адаптаций и части книг — `null`. */
  feature: backgroundSectionSchema.nullable(),
  personality: z.strictObject({
    traits: personalityTableSchema.nullable(),
    ideals: personalityTableSchema.nullable(),
    bonds: personalityTableSchema.nullable(),
    flaws: personalityTableSchema.nullable(),
  }),
  /** Разновидности: «Разновидность артиста: Гладиатор» — название после двоеточия. */
  variants: z.array(backgroundSectionSchema),
  /** Остальные разделы: специализации, альтернативные умения, «Создание персонажа». */
  sections: z.array(backgroundSectionSchema),
});

const choiceOf = <T extends z.ZodTypeAny>(item: T) =>
  z.strictObject({ count: amount, from: z.array(item).nullable() });

export const backgroundRulesSchema = z.strictObject({
  schemaVersion: z.literal(BACKGROUND_RULES_SCHEMA_VERSION),
  /** ID навыков (`skill:history`); выбор — из списка или из любых (`from: null`). */
  skills: z.strictObject({
    fixed: z.array(entityIdSchema),
    choices: z.array(choiceOf(entityIdSchema)),
  }),
  /** Инструменты — ID предметов; выбор — из списка, из группы или из любых. */
  tools: z.strictObject({
    fixed: z.array(entityIdSchema),
    choices: z.array(
      z.strictObject({
        count: amount,
        from: z.array(entityIdSchema).nullable(),
        group: z.enum(TOOL_GROUPS).nullable(),
      }),
    ),
  }),
  /** Смешанный выбор: «музыкальный инструмент или игровой набор», «навык или инструмент». */
  mixed: z.array(proficiencyChoiceSchema),
  /** Владение транспортом: «транспорт (водный)» — вид, а не предмет. */
  vehicles: z.array(z.enum(['land', 'water'])),
  /** ID языков; выбор — из списка или из любых. */
  languages: z.strictObject({
    fixed: z.array(entityIdSchema),
    choices: z.array(choiceOf(entityIdSchema)),
  }),
  /** Стартовое снаряжение: каждая часть строки «Снаряжение»; деньги — отдельно, в мм. */
  equipment: z.strictObject({
    items: z.array(
      z.strictObject({
        /** Часть строки как на сайте: «комплект обычной одежды». */
        text: z.string().min(1),
        /** Предмет каталога; `null` — не сопоставлен (подарок, письмо, безделушка). */
        itemId: entityIdSchema.nullable(),
        quantity: amount,
      }),
    ),
    /** «поясной кошель с 15 зм» → 1500; `null` — денег нет или не разобраны. */
    coinsCp: z.number().int().min(0).nullable(),
  }),
  /** Что не записано данными — только текстом (`display_only`): строка и причина. */
  textOnly: z.array(z.string().min(1)),
});

export type BackgroundData = z.infer<typeof backgroundDataSchema>;
export type BackgroundRules = z.infer<typeof backgroundRulesSchema>;
export type BackgroundSection = z.infer<typeof backgroundSectionSchema>;
