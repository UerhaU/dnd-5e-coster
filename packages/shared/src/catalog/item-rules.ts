import { z } from 'zod';
import { DAMAGE_TYPES, idsOf } from './codes.ts';
import { entityIdSchema } from './entity.ts';
import { WEAPON_PROPERTIES } from './item-codes.ts';
import { diceSchema } from './spell-rules.ts';

// Механика обычного предмета (`content_revisions.rules_json`, схема item-rules/v1):
// то, что понадобится конструктору персонажа (этап 4) — атака оружием и КД доспеха.
// Разбирается из таблиц DnD.su; если строку честно разобрать нельзя, rules_json — null
// и строка в отчёте импорта.

export const ITEM_RULES_SCHEMA_VERSION = 'item-rules/v1';

const feet = z.number().int().positive();

/** Дистанция «дис. 80/320»: обычная и максимальная (с помехой). */
export const weaponRangeSchema = z.strictObject({ normalFt: feet, longFt: feet });

export const weaponPropertySchema = z.strictObject({
  id: z.enum(idsOf(WEAPON_PROPERTIES)),
  /** Для `ammunition` и `thrown`. */
  range: weaponRangeSchema.nullable(),
  /** Для `versatile`: урон двумя руками. */
  dice: diceSchema.nullable(),
  /** Для `reload`: выстрелов до перезарядки. */
  shots: z.number().int().positive().nullable(),
});

export const weaponRulesSchema = z.strictObject({
  category: z.enum(['simple', 'martial']),
  range: z.enum(['melee', 'ranged']),
  /** `null` — оружие без урона (сеть). Фиксированный урон — числом: `1` у духовой трубки. */
  damage: z.strictObject({ dice: diceSchema, type: z.enum(idsOf(DAMAGE_TYPES)) }).nullable(),
  properties: z.array(weaponPropertySchema),
  /** Какой боеприпас расходует оружие; `null` — не расходует или неизвестно. */
  ammunitionItemId: entityIdSchema.nullable(),
});

export const equipTimeSchema = z.strictObject({
  amount: z.number().int().positive(),
  unit: z.enum(['action', 'minute']),
});

export const armorRulesSchema = z.strictObject({
  category: z.enum(['light', 'medium', 'heavy']),
  /** КД = база + модификатор Ловкости (если `addDex`), не больше `dexMax`. */
  armorClass: z.strictObject({
    base: z.number().int().positive(),
    addDex: z.boolean(),
    dexMax: z.number().int().positive().nullable(),
  }),
  /** «Сил 13»: без такой Силы скорость −10 футов. */
  strengthRequired: z.number().int().positive().nullable(),
  stealthDisadvantage: z.boolean(),
  don: equipTimeSchema,
  doff: equipTimeSchema,
});

export const shieldRulesSchema = z.strictObject({
  armorClassBonus: z.number().int().positive(),
  don: equipTimeSchema,
  doff: equipTimeSchema,
});

export const itemRulesSchema = z
  .strictObject({
    schemaVersion: z.literal(ITEM_RULES_SCHEMA_VERSION),
    weapon: weaponRulesSchema.nullable(),
    armor: armorRulesSchema.nullable(),
    shield: shieldRulesSchema.nullable(),
  })
  .refine((rules) => [rules.weapon, rules.armor, rules.shield].filter(Boolean).length === 1, {
    message: 'Ровно один раздел механики: оружие, доспех или щит',
  });

export type WeaponProperty = z.infer<typeof weaponPropertySchema>;
export type WeaponRules = z.infer<typeof weaponRulesSchema>;
export type ArmorRules = z.infer<typeof armorRulesSchema>;
export type ShieldRules = z.infer<typeof shieldRulesSchema>;
export type EquipTime = z.infer<typeof equipTimeSchema>;
export type ItemRules = z.infer<typeof itemRulesSchema>;
