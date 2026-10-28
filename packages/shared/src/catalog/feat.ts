import { z } from 'zod';
import { ABILITIES, CLASS_IDS, idsOf } from './codes.ts';
import { proficiencyChoiceSchema, TOOL_GROUPS } from './choices.ts';
import { entityIdSchema } from './entity.ts';
import { SIZES } from './race-codes.ts';
import { abilityOptionSchema } from './race-rules.ts';
import { textBlockSchema } from './text-blocks.ts';

// Черта (`data_json`, схема feat/v1) и её механика (`rules_json`, feat-rules/v1).
// Тексты — как на DnD.su; механика — то, что нужно конструктору (этап 4): требования,
// увеличение характеристик, владения, известные заклинания. Выборы игрока — выборами
// (`count`, `from`). Остальное (преимущества, реакции, бонусы) — текстом, его применяет
// движок правил.

export const FEAT_SCHEMA_VERSION = 'feat/v1';
export const FEAT_RULES_SCHEMA_VERSION = 'feat-rules/v1';

const amount = z.number().int().positive();
const ability = z.enum(idsOf(ABILITIES));

export const featSectionSchema = z.strictObject({
  /** Заголовок раздела как на сайте: «Заклинания Стриксхейвена». */
  name: z.string().min(1),
  blocks: z.array(textBlockSchema),
});

export const featDataSchema = z.strictObject({
  schemaVersion: z.literal(FEAT_SCHEMA_VERSION),
  /** Строка требования как на сайте: «Ловкость 13 или выше»; `null` — требований нет. */
  prerequisite: z.string().min(1).nullable(),
  /** Описание до первого раздела: вступление и список преимуществ. */
  description: z.array(textBlockSchema),
  sections: z.array(featSectionSchema),
});

/** Одно условие требования. Неразобранное — `text` со строкой сайта. */
export const featRequirementSchema = z.discriminatedUnion('kind', [
  /** «Сила 13 или выше». */
  z.strictObject({ kind: z.literal('ability'), ability, min: amount }),
  /** Раса или разновидность каталога: «Эльф (дроу)» → `race:drow`. */
  z.strictObject({ kind: z.literal('race'), id: entityIdSchema }),
  /** «Маленькая раса». */
  z.strictObject({ kind: z.literal('size'), size: z.enum(idsOf(SIZES)) }),
  /** «Владение средними доспехами». */
  z.strictObject({ kind: z.literal('armor'), armor: z.enum(['light', 'medium', 'heavy']) }),
  /** «владение хотя бы одним воинским оружием». */
  z.strictObject({ kind: z.literal('weapon'), category: z.enum(['martial']) }),
  /** «Способность накладывать хотя бы одно заклинание». */
  z.strictObject({ kind: z.literal('spellcasting') }),
  /** Умение класса: «Использование заклинаний», «Магия договора». */
  z.strictObject({
    kind: z.literal('class_feature'),
    feature: z.enum(['spellcasting', 'pact_magic']),
  }),
  /** «4 уровень». */
  z.strictObject({ kind: z.literal('level'), min: amount }),
  /** Другая черта; `option` — вариант в скобках: «Удар великанов (Штормовой удар)». */
  z.strictObject({ kind: z.literal('feat'), id: entityIdSchema, option: z.string().nullable() }),
  z.strictObject({ kind: z.literal('background'), id: entityIdSchema }),
  /** Класс (`class:wizard`): связь `prerequisite` на объект класса, без объекта — ошибка сборки. */
  z.strictObject({ kind: z.literal('class'), id: z.enum(CLASS_IDS) }),
  /** Кампания в сеттинге: «Planescape», «Сага о Копье». */
  z.strictObject({ kind: z.literal('campaign'), setting: z.enum(['planescape', 'dragonlance']) }),
  z.strictObject({ kind: z.literal('text'), text: z.string().min(1) }),
]);

export const featRulesSchema = z.strictObject({
  schemaVersion: z.literal(FEAT_RULES_SCHEMA_VERSION),
  /**
   * Требования: все группы (`И`), в группе — любое условие (`ИЛИ`).
   * «4 уровень, черта «X»» → [[level], [feat]]; «Дварф или Маленькая раса» → [[race, size]].
   */
  prerequisites: z.array(z.array(featRequirementSchema).min(1)),
  /** «Увеличьте значение Силы или Ловкости на 1 при максимуме 20»: пустые списки — нет. */
  abilityIncrease: abilityOptionSchema,
  /** Доспехи и щиты: «Вы получаете владение средними доспехами и щитами». */
  armor: z.array(z.enum(['light', 'medium', 'heavy', 'shield'])),
  /** Оружие: группы владения и выбор видов («четырьмя выбранными видами оружия»). */
  weapons: z.strictObject({
    groups: z.array(z.enum(['improvised', 'firearms'])),
    choices: z.array(
      z.strictObject({
        count: amount,
        /** Из каких категорий: простое и воинское. */
        categories: z.array(z.enum(['simple', 'martial'])).min(1),
      }),
    ),
  }),
  skills: z.strictObject({
    fixed: z.array(entityIdSchema),
    choices: z.array(z.strictObject({ count: amount, from: z.array(entityIdSchema).nullable() })),
  }),
  /** Инструменты — ID предметов; выбор — из списка, из группы (`group`) или из любых. */
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
  /** «любой комбинацией из трёх навыков или инструментов». */
  mixed: z.array(proficiencyChoiceSchema),
  languages: z.strictObject({
    fixed: z.array(entityIdSchema),
    /** Сколько языков игрок выбирает сам. */
    choose: z.number().int().min(0),
  }),
  /** Спасброски: «владение спасбросками этой характеристики» — от выбранной характеристики. */
  savingThrows: z.enum(['chosen_ability']).nullable(),
  /** Заклинания, которые черта даёт по названию: «Вы узнаёте заклинание невидимость». */
  spells: z.array(entityIdSchema),
  /** Что не записано данными — только текстом (`display_only`): строка сайта. */
  textOnly: z.array(z.string().min(1)),
});

export type FeatData = z.infer<typeof featDataSchema>;
export type FeatRules = z.infer<typeof featRulesSchema>;
export type FeatRequirement = z.infer<typeof featRequirementSchema>;
