import { z } from 'zod';
import { ABILITIES, idsOf } from './codes.ts';
import { entityIdSchema } from './entity.ts';
import { textBlockSchema } from './text-blocks.ts';

// Справочные категории этапа 3 (`content_revisions.data_json`): навык, язык,
// состояние. Механики сверх полей ниже у них нет: состояния применяет движок
// правил (этап 6) по тексту, поэтому `rules_json` у них пустой.

export const SKILL_SCHEMA_VERSION = 'skill/v1';
export const LANGUAGE_SCHEMA_VERSION = 'language/v1';
export const CONDITION_SCHEMA_VERSION = 'condition/v1';

export const skillDataSchema = z.strictObject({
  schemaVersion: z.literal(SKILL_SCHEMA_VERSION),
  /** Характеристика проверки навыка: Атлетика — Сила. */
  ability: z.enum(idsOf(ABILITIES)),
  description: z.array(textBlockSchema),
});

/** Письменность языка в книге, которая меняет её: Великаний в GGR пишется минотаврской. */
export const languageScriptSchema = z.strictObject({
  /** «Дварфская»; `null` — у языка нет письменности («—»). */
  script: z.string().min(1).nullable(),
  /** Код книги таблицы: `PH14`, `GGR`. */
  source: z.string().min(1),
});

export const languageDataSchema = z.strictObject({
  schemaVersion: z.literal(LANGUAGE_SCHEMA_VERSION),
  /**
   * Таблица PHB «Обычные языки» / «Экзотические языки» (и экзотические MTF);
   * таблицы других книг вид не указывают — `null`.
   */
  kind: z.enum(['standard', 'exotic']).nullable(),
  /** «Огры, великаны»; `null` — «—». */
  typicalSpeakers: z.string().min(1).nullable(),
  /** Письменность по книгам: первая — та, что в книге объекта. */
  scripts: z.array(languageScriptSchema).min(1),
  /** Диалект языка: Акван — диалект Первичного. Та же связь — `dialect_of`. */
  dialectOf: entityIdSchema.nullable(),
  description: z.array(textBlockSchema),
});

export const conditionDataSchema = z.strictObject({
  schemaVersion: z.literal(CONDITION_SCHEMA_VERSION),
  /** Пункты состояния как на DnD.su; механику по ним применяет движок правил (этап 6). */
  description: z.array(textBlockSchema),
});

export type SkillData = z.infer<typeof skillDataSchema>;
export type LanguageData = z.infer<typeof languageDataSchema>;
export type ConditionData = z.infer<typeof conditionDataSchema>;
