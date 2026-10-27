import { z } from 'zod';
import { CLASS_IDS, DAMAGE_TYPES, idsOf, MAGIC_SCHOOLS } from './codes.ts';
import { materialNodeSchema } from './material.ts';
import { textBlockSchema } from './text-blocks.ts';

// Данные заклинания (`content_revisions.data_json`, схема spell/v1), раздел 5.5.
// Правило раздела 9: что не удалось разобрать, остаётся `null` (и строкой в отчёте
// импорта), а не подменяется нулём или догадкой. Исходный текст поля хранится всегда.

export const SPELL_SCHEMA_VERSION = 'spell/v1';

const text = z.string().min(1);
const feet = z.number().positive();

export const castingTimeUnitSchema = z.enum([
  'action',
  'bonus_action',
  'reaction',
  'minute',
  'hour',
]);

export const spellCastingTimeSchema = z.strictObject({
  text,
  /** Варианты: «1 действие или 8 часов» — два варианта. */
  options: z
    .array(z.strictObject({ amount: z.number().int().positive(), unit: castingTimeUnitSchema }))
    .min(1)
    .nullable(),
  /** Условие реакции, как на DnD.su. */
  reactionTrigger: text.nullable(),
});

export const spellAreaSchema = z.strictObject({
  shape: z.enum(['radius', 'sphere', 'hemisphere', 'cone', 'line', 'cube']),
  /** Радиус, длина конуса или линии, ребро куба. Мили переведены в футы. */
  feet,
});

export const spellRangeSchema = z.strictObject({
  text,
  kind: z.enum(['self', 'touch', 'distance', 'sight', 'unlimited', 'special']).nullable(),
  /** Для `distance`. Мили переведены в футы (1 миля = 5280 футов). */
  feet: feet.nullable(),
  /** Область «на себя (15-футовый конус)». */
  area: spellAreaSchema.nullable(),
});

export const durationUnitSchema = z.enum(['round', 'minute', 'hour', 'day']);

export const spellDurationSchema = z.strictObject({
  text,
  /** Варианты: «Мгновенная или 1 час» — два варианта. */
  options: z
    .array(
      z.strictObject({
        kind: z.enum([
          'instantaneous',
          'timed',
          'until_dispelled',
          'until_dispelled_or_triggered',
          'special',
        ]),
        amount: z.number().int().positive().nullable(),
        unit: durationUnitSchema.nullable(),
      }),
    )
    .min(1)
    .nullable(),
  /** «Вплоть до»: заклинание можно закончить раньше. */
  upTo: z.boolean(),
});

export const spellComponentsSchema = z.strictObject({
  verbal: z.boolean(),
  somatic: z.boolean(),
  material: z
    .strictObject({
      text,
      /** Состав из data/reviewed/; `null` — состав ещё не разобран. */
      recipe: materialNodeSchema.nullable(),
    })
    .nullable(),
  /** Компонент авторских отчислений (А), Acquisitions Incorporated. */
  royalty: z.strictObject({ text, costCp: z.number().positive().nullable() }).nullable(),
});

const classId = z.enum(CLASS_IDS);

export const spellDataSchema = z.strictObject({
  schemaVersion: z.literal(SPELL_SCHEMA_VERSION),
  level: z.number().int().min(0).max(9),
  school: z.enum(idsOf(MAGIC_SCHOOLS)),
  /** Дюнамантия и её виды (Explorer's Guide to Wildemount). */
  tags: z.array(z.enum(['dunamancy', 'chronurgy', 'graviturgy'])),
  ritual: z.boolean(),
  concentration: z.boolean(),
  castingTime: spellCastingTimeSchema,
  range: spellRangeSchema,
  components: spellComponentsSchema,
  duration: spellDurationSchema,
  /** Обычные списки заклинаний классов. Классы появятся в каталоге на этапе 3. */
  classes: z.array(classId),
  /** Дополнительный доступ из Tasha's Cauldron of Everything (метка TCE на DnD.su). */
  optionalClasses: z.array(classId),
  /** Доступ через подкласс. Подклассов в каталоге пока нет, поэтому — название и класс. */
  subclasses: z.array(
    z.strictObject({
      name: text,
      classId,
      /** Номер подкласса в фильтре DnD.su; `null`, если не нашёлся. */
      dndsuId: z.number().int().positive().nullable(),
    }),
  ),
  /** Типы урона из фильтра списка DnD.su. */
  damageTypes: z.array(z.enum(idsOf(DAMAGE_TYPES))),
  /** Число целей (проверено вручную в v0.1); `null` — не задано. */
  targets: z
    .strictObject({
      maxCount: z.number().int().positive(),
      extraPerSlot: z.number().int().min(0),
    })
    .nullable(),
  description: z.array(textBlockSchema).min(1),
  higherLevels: z.array(textBlockSchema),
});

export type SpellData = z.infer<typeof spellDataSchema>;
export type SpellCastingTime = z.infer<typeof spellCastingTimeSchema>;
export type SpellRange = z.infer<typeof spellRangeSchema>;
export type SpellDuration = z.infer<typeof spellDurationSchema>;
export type SpellComponents = z.infer<typeof spellComponentsSchema>;
