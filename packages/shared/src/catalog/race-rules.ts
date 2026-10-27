import { z } from 'zod';
import { ABILITIES, DAMAGE_TYPES, idsOf } from './codes.ts';
import { entityIdSchema } from './entity.ts';
import { CREATURE_TYPES, LANGUAGES, SIZES, SKILLS } from './race-codes.ts';

// Механика расы или разновидности (`content_revisions.rules_json`, схема race-rules/v1):
// то, что нужно конструктору персонажа (этап 4). Разбирается из текста особенностей
// DnD.su. Выбор игрока хранится как выбор («две характеристики на выбор»), а не как
// готовое значение. Особые умения (дыхательное оружие и т. п.) — только текстом: их
// названия в `textOnly`.
//
// У разновидности — только своё. Конструктор складывает расу и разновидность:
// увеличения, владения, языки и сопротивления — сумма; размер, вид существа,
// скорости и тёмное зрение разновидности, если указаны, заменяют расовые.

export const RACE_RULES_SCHEMA_VERSION = 'race-rules/v1';

const ability = z.enum(idsOf(ABILITIES));
const feet = z.number().int().positive();
const amount = z.number().int().positive();

/** «Значение одной характеристики по вашему выбору увеличивается на 2». */
export const abilityChoiceSchema = z.strictObject({
  count: amount,
  amount,
  /** Из каких характеристик; `null` — из любых. */
  from: z.array(ability).nullable(),
  /** Кроме этих: полуэльф — «двух других, кроме Харизмы». */
  except: z.array(ability),
});

/** Один вариант увеличения характеристик. */
export const abilityOptionSchema = z.strictObject({
  fixed: z.array(z.strictObject({ ability, amount })),
  choices: z.array(abilityChoiceSchema),
});

/** «Выберите N … из списка» или «из любых» (`from: null`). */
const choiceOf = <T extends z.ZodTypeAny>(item: T) =>
  z.strictObject({ count: amount, from: z.array(item).nullable() });

/** Скорость в футах; `walk` — равна скорости ходьбы («скорость полёта, равная скорости ходьбы»). */
const speed = z.union([feet, z.literal('walk')]).nullable();

export const raceRulesSchema = z.strictObject({
  schemaVersion: z.literal(RACE_RULES_SCHEMA_VERSION),
  /**
   * Увеличение характеристик: варианты на выбор игрока (MPMM: «+2 и +1 или три по +1»).
   * Пустой список — у разновидности нет своего увеличения; `null` — не разобрано.
   */
  abilityScores: z.array(abilityOptionSchema).nullable(),
  /** Размер на выбор: «Средний или Маленький». `null` — не указан или не разобран. */
  size: z.array(z.enum(idsOf(SIZES))).nullable(),
  creatureType: z.enum(idsOf(CREATURE_TYPES)).nullable(),
  speed: z.strictObject({
    walk: feet.nullable(),
    fly: speed,
    swim: speed,
    climb: speed,
    burrow: speed,
  }),
  /** Радиус тёмного зрения в футах. */
  darkvisionFt: feet.nullable(),
  skills: z.strictObject({
    fixed: z.array(z.enum(idsOf(SKILLS))),
    choices: z.array(choiceOf(z.enum(idsOf(SKILLS)))),
  }),
  /** Оружие — ID предметов каталога; доспехи — виды. */
  weapons: z.array(entityIdSchema),
  armor: z.array(z.enum(['light', 'medium', 'heavy', 'shield'])),
  languages: z.strictObject({
    fixed: z.array(z.enum(idsOf(LANGUAGES))),
    /** Сколько языков игрок выбирает сам. */
    choose: z.number().int().min(0),
  }),
  resistances: z.array(z.enum(idsOf(DAMAGE_TYPES))),
  /** Особенности, механика которых не записана данными — только текст (`display_only`). */
  textOnly: z.array(z.string().min(1)),
});

export type RaceRules = z.infer<typeof raceRulesSchema>;
export type AbilityOption = z.infer<typeof abilityOptionSchema>;
