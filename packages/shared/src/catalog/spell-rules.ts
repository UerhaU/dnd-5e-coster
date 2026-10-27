import { z } from 'zod';
import { ABILITIES, CONDITIONS, DAMAGE_TYPES, idsOf } from './codes.ts';

// Механика заклинания (`content_revisions.rules_json`, схема spell-rules/v1).
// Заполняется только для проверенных вручную правил (review_status: rules_verified).
// Поля перенесены из v0.1 (scripts/spell-reviewed-rules.mjs) без потерь;
// словарь `stat` и `trigger` уточнит движок правил на этапе 4.

export const SPELL_RULES_SCHEMA_VERSION = 'spell-rules/v1';

const ability = z.enum(idsOf(ABILITIES));
const damageType = z.enum(idsOf(DAMAGE_TYPES));
const code = z.string().regex(/^[a-z][a-z0-9_]*$/);

/**
 * Формула броска: `8d6`, `1d4+1`, `5` (фиксированное число).
 * `SC` — модификатор базовой характеристики заклинателя: `1d8+SC`.
 */
export const diceSchema = z.string().regex(/^(\d+d\d+|\d+)(\+(\d+|SC))?$/);

export const spellEffectSchema = z.strictObject({
  type: z.enum(['modifier', 'damage', 'healing', 'control', 'creation', 'information']),
  /** Что меняет эффект: `armor_class`, `speed`, `saving_throws`, … */
  stat: code.optional(),
  op: z
    .enum([
      'add',
      'subtract',
      'set',
      'base',
      'multiply',
      'minimum',
      'cap',
      'advantage',
      'disadvantage',
      'resistance',
      'immunity',
    ])
    .optional(),
  value: z.number().nullable().optional(),
  dice: diceSchema.optional(),
  /** Характеристика, модификатор которой прибавляется (Доспехи мага: 13 + Ловкость). */
  ability: ability.optional(),
  /** Прибавляется модификатор базовой характеристики заклинателя. */
  spellcasting: z.literal(true).optional(),
  damageType: damageType.nullable().optional(),
  /** Тип урона выбирается из списка. */
  choices: z.array(damageType).min(2).optional(),
  condition: z.enum(idsOf(CONDITIONS)).optional(),
  /** Название варианта заклинания, к которому относится эффект. */
  choice: z.string().min(1).optional(),
  save: z.strictObject({ ability, onSuccess: z.enum(['half', 'none']).nullable() }).optional(),
  resolution: z.enum(['auto', 'ranged_spell_attack', 'melee_spell_attack']).optional(),
  trigger: code.optional(),
  scope: z.literal('weapon').optional(),
  conditionText: z.string().min(1).optional(),
  /** Значение или кость при ячейке указанного уровня и выше. */
  slotScaling: z
    .array(
      z.strictObject({
        slotLevel: z.number().int().min(1).max(9),
        value: z.number().optional(),
        dice: diceSchema.optional(),
      }),
    )
    .optional(),
  /** Кость, добавляемая за каждый уровень ячейки выше базового. */
  scalingDice: diceSchema.optional(),
  /** С какого уровня ячейки начинается рост и через сколько уровней шаг. */
  scalingStart: z.number().int().min(1).max(9).optional(),
  scalingStep: z.number().int().min(1).optional(),
  /** Рост от уровня ячейки не действует на этот эффект. */
  noScaling: z.literal(true).optional(),
  /** Число, добавляемое за каждый уровень ячейки выше базового. */
  scalarPerSlot: z.number().optional(),
  /** Сколько раз эффект повторяется (лучи, дротики) и прибавка за уровень ячейки. */
  repeatCount: z.number().int().min(1).optional(),
  repeatPerSlot: z.number().int().min(1).optional(),
  /** Число лучей от уровня персонажа (Мистический заряд). */
  beamsByCharacterLevel: z
    .array(
      z.strictObject({
        characterLevel: z.number().int().min(1).max(20),
        count: z.number().int().min(1),
      }),
    )
    .optional(),
  /** Кость заговора, растущая с уровнем персонажа. */
  cantripDice: diceSchema.optional(),
});

export const spellRulesSchema = z.strictObject({
  schemaVersion: z.literal(SPELL_RULES_SCHEMA_VERSION),
  effects: z.array(spellEffectSchema).min(1),
});

export type SpellEffect = z.infer<typeof spellEffectSchema>;
export type SpellRules = z.infer<typeof spellRulesSchema>;
