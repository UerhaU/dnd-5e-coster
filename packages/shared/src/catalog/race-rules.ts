import { z } from 'zod';
import { ABILITIES, DAMAGE_TYPES, idsOf } from './codes.ts';
import { entityIdSchema } from './entity.ts';
import { CREATURE_TYPES, LANGUAGES, SIZES, SKILLS } from './race-codes.ts';

/** Группы инструментов для выбора «один музыкальный инструмент» (коды категорий предметов). */
export const TOOL_GROUPS = ['artisans_tools', 'gaming_set', 'musical_instrument'] as const;

// Механика расы или разновидности (`content_revisions.rules_json`, схема race-rules/v1):
// то, что нужно конструктору персонажа (этап 4). Разбирается из текста особенностей
// DnD.su. Выбор игрока хранится как выбор («две характеристики на выбор»), а не как
// готовое значение. Особые умения (дыхательное оружие и т. п.) — только текстом: их
// названия в `textOnly`.
//
// У разновидности — только своё. Конструктор складывает расу и разновидность:
// увеличения, владения, языки и сопротивления — сумма; размер, вид существа,
// скорости и тёмное зрение разновидности, если указаны, заменяют расовые; так же —
// каждое поле роста, веса и возраста (`body`), если оно не `null`.

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

/** Диапазон из текста: «от 4 до 5 футов»; «около 150 фунтов» — min = max; «до 6 футов» — только max. */
const range = z
  .strictObject({ min: amount.nullable(), max: amount.nullable() })
  .refine((value) => value.min !== null || value.max !== null, 'пустой диапазон')
  .refine(
    (value) => value.min === null || value.max === null || value.min <= value.max,
    'min больше max',
  )
  .nullable();

const dice = z.strictObject({ count: amount, sides: amount });

/**
 * Рост, вес, возраст (Р61, Р69) — числами, как написано на DnD.su: особенности
 * «Возраст» и «Размер». Это ориентиры описания, а не пределы для персонажа.
 * `null` — на странице чисел нет («как у людей»).
 */
export const raceBodySchema = z.strictObject({
  /** Возраст зрелости, лет: «достигают зрелости к 12 годам». */
  adultAge: amount.nullable(),
  /** Продолжительность жизни, лет: «живут до 60 лет», «свыше 350 лет». */
  lifespan: amount.nullable(),
  heightIn: range,
  weightLb: range,
  /**
   * Случайные рост и вес: рост = база + бросок `heightDice` (дюймы);
   * вес = база + тот же бросок × `weightDice` (без неё — × 1).
   */
  random: z
    .strictObject({
      baseHeightIn: amount,
      heightDice: dice,
      baseWeightLb: amount,
      weightDice: dice.nullable(),
    })
    .nullable(),
});

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
  /** Инструменты — ID предметов каталога; выбор — из списка, из группы (`group`) или из любых. */
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
  languages: z.strictObject({
    fixed: z.array(z.enum(idsOf(LANGUAGES))),
    /** Сколько языков игрок выбирает сам. */
    choose: z.number().int().min(0),
  }),
  resistances: z.array(z.enum(idsOf(DAMAGE_TYPES))),
  body: raceBodySchema,
  /** Особенности, механика которых не записана данными — только текст (`display_only`). */
  textOnly: z.array(z.string().min(1)),
});

export type RaceRules = z.infer<typeof raceRulesSchema>;
export type RaceBody = z.infer<typeof raceBodySchema>;
export type AbilityOption = z.infer<typeof abilityOptionSchema>;
