import { z } from 'zod';
import { ABILITIES, CLASS_IDS, idsOf } from './codes.ts';
import { entityIdSchema } from './entity.ts';
import { proficiencyChoiceSchema, TOOL_GROUPS } from './choices.ts';
import { textBlockSchema } from './text-blocks.ts';

// Класс (`data_json`, схема class/v1; `rules_json`, class-rules/v1) и подкласс
// (subclass/v1, subclass-rules/v1). Тексты — как на DnD.su; механика — то, что
// нужно конструктору уровней 1–20 и мультиклассу (этап 4): таблица класса числами,
// владения ID и категориями, стартовое снаряжение выборами. Особенности — блоками
// с уровнем получения; их механика сверх таблицы — текстом (движок правил, этап 4).
// Опциональные особенности TCE — `optionalRule: true` (Р74).

export const CLASS_SCHEMA_VERSION = 'class/v1';
export const CLASS_RULES_SCHEMA_VERSION = 'class-rules/v1';
export const SUBCLASS_SCHEMA_VERSION = 'subclass/v1';
export const SUBCLASS_RULES_SCHEMA_VERSION = 'subclass-rules/v1';

const text = z.string().min(1);
const amount = z.number().int().positive();
const level = z.number().int().min(1).max(20);
const ability = z.enum(idsOf(ABILITIES));

export const classSectionSchema = z.strictObject({
  name: text,
  blocks: z.array(textBlockSchema),
});

/** Особенность класса или подкласса: «Ярость», 1-й уровень. */
export const classFeatureSchema = z.strictObject({
  /** Якорь на странице без `feature.`: `rage`; у особенностей подкласса — `null`. */
  key: z.string().min(1).nullable(),
  nameRu: text,
  /** Уровни получения: из таблицы класса или из строки «3-й уровень, умение …». */
  levels: z.array(level).min(1),
  /** Опциональная особенность TCE: вариант правил, нужно разрешение мастера (Р74). */
  optionalRule: z.boolean(),
  blocks: z.array(textBlockSchema),
  /** Подразделы без уровня: воззвания колдуна, «Шипованный доспех», догматы клятвы. */
  subsections: z.array(classSectionSchema),
});

/** Таблица класса как на сайте: заголовки и строки текстом. */
export const classTableTextSchema = z.strictObject({
  header: z.array(text).min(3),
  rows: z.array(z.array(z.string())).length(20),
});

export const classDataSchema = z.strictObject({
  schemaVersion: z.literal(CLASS_SCHEMA_VERSION),
  intro: z.array(textBlockSchema),
  /** Разделы до умений: «Создание …», «Быстрое создание», углублённая предыстория (XGE). */
  sections: z.array(classSectionSchema),
  /** Строки «Кость хитов: …», «Доспехи: …», «Навыки: …» — как на сайте. */
  summary: z.array(z.strictObject({ label: text, text })),
  /** Пункты стартового снаряжения как на сайте. */
  equipment: z.array(text),
  /** Абзацы блока владений без метки: «Вы начинаете…», «Если вы откажетесь…», заметки. */
  notes: z.array(text),
  /** Раздел «Мультиклассирование и …». */
  multiclass: z.array(textBlockSchema),
  table: classTableTextSchema,
  features: z.array(classFeatureSchema).min(1),
  /** Списки вариантов: таинственные воззвания, боевые приёмы, инфузии, звери дикого облика. */
  options: z.array(
    z.strictObject({
      name: text,
      blocks: z.array(textBlockSchema),
      items: z.array(classSectionSchema),
    }),
  ),
  /** Общее вступление подклассов: «Пути дикости». */
  subclassIntro: classSectionSchema,
});

/** Значение столбца таблицы: число, кость (`1d6`), `unlimited` или `null` («—»). */
export const tableValueSchema = z.union([z.number().int(), z.string().min(1), z.null()]);

/** Столбцы таблиц классов, кроме уровня, бонуса мастерства, умений и ячеек 1–9. */
export const CLASS_TABLE_COLUMNS = [
  'rages',
  'rageDamage',
  'martialArts',
  'kiPoints',
  'unarmoredMovement',
  'sneakAttack',
  'sorceryPoints',
  'cantripsKnown',
  'spellsKnown',
  'pactSlots',
  'pactSlotLevel',
  'invocationsKnown',
  'infusionsKnown',
  'infusedItems',
] as const;

export const classTableRowSchema = z.strictObject({
  level,
  proficiencyBonus: z.number().int().min(2).max(6),
  /** Ключи особенностей этой строки (`rage`); подписи — в `data.table`. */
  features: z.array(z.string().min(1)),
  values: z.partialRecord(z.enum(CLASS_TABLE_COLUMNS), tableValueSchema),
  /** Ячейки заклинаний 1–9 уровней; `null` — у класса нет столбцов ячеек. */
  spellSlots: z.array(z.number().int().min(0)).length(9).nullable(),
});

/** Таблица заклинателя подкласса (мистический рыцарь): уровни 3–20. */
export const spellTableRowSchema = classTableRowSchema.omit({
  proficiencyBonus: true,
  features: true,
});

/**
 * Прогрессия ячеек для мультикласса: полный заклинатель, половина (паладин, следопыт),
 * изобретатель (половина с округлением вверх), треть (подкласс), магия договора.
 */
export const casterProgressionSchema = z.enum(['full', 'half', 'artificer', 'third', 'pact']);

export const spellcastingSchema = z.strictObject({
  ability,
  progression: casterProgressionSchema,
  /** Особенность, дающая заклинания: `spellcasting`, `pact-magic`. */
  featureKey: z.string().min(1).nullable(),
});

/** Группы снаряжения «любое простое оружие», «магическая фокусировка». */
export const EQUIPMENT_GROUPS = [
  'simple_weapon',
  'simple_melee',
  'martial_weapon',
  'martial_melee',
  'arcane_focus',
  'druidic_focus',
  'holy_symbol',
  ...TOOL_GROUPS,
] as const;

export const equipmentPartSchema = z.strictObject({
  /** Часть строки как на сайте: «два ручных топора». */
  text,
  /** Предмет каталога; `null` — группа или не сопоставлен. */
  itemId: entityIdSchema.nullable(),
  /** Выбор из группы: «любое воинское рукопашное оружие». */
  group: z.enum(EQUIPMENT_GROUPS).nullable(),
  quantity: amount,
});

/** Строка стартового снаряжения: варианты «а) … или б) …»; один вариант — без выбора. */
export const equipmentChoiceSchema = z.strictObject({
  options: z.array(z.strictObject({ parts: z.array(equipmentPartSchema).min(1) })).min(1),
});

const armorKinds = z.array(z.enum(['light', 'medium', 'heavy', 'shield']));

export const classProficienciesSchema = z.strictObject({
  armor: armorKinds,
  weapons: z.strictObject({
    categories: z.array(z.enum(['simple', 'martial'])),
    items: z.array(entityIdSchema),
  }),
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
  /** «Один вид инструментов ремесленников либо музыкальный инструмент». */
  mixed: z.array(proficiencyChoiceSchema),
  /** Выбор навыков: `from: null` — из любых. */
  skills: z.array(z.strictObject({ count: amount, from: z.array(entityIdSchema).nullable() })),
});

/** Условие мультикласса: группы «И» из условий «ИЛИ» («Сила или Ловкость 13»). */
export const multiclassRequirementSchema = z.array(
  z.array(z.strictObject({ ability, min: z.number().int().min(1).max(30) })).min(1),
);

export const classRulesSchema = z.strictObject({
  schemaVersion: z.literal(CLASS_RULES_SCHEMA_VERSION),
  hitDie: z.number().int().min(4).max(12),
  /** Хиты на 1-м уровне без модификатора Телосложения: 12. */
  hitPointsFirstLevel: amount,
  /** Среднее за уровень после первого: 7. */
  hitPointsPerLevel: amount,
  savingThrows: z.array(ability).length(2),
  proficiencies: classProficienciesSchema,
  equipment: z.array(equipmentChoiceSchema),
  /** «2к4 × 10 зм» вместо снаряжения: кость и множитель (зм). */
  startingGold: z.strictObject({ dice: text, multiplier: amount }).nullable(),
  table: z.array(classTableRowSchema).length(20),
  /** `null` — класс не накладывает заклинаний сам (воин, плут — через подкласс). */
  spellcasting: spellcastingSchema.nullable(),
  subclass: z.strictObject({
    /** Подпись выбора: «Путь дикости». */
    nameRu: text,
    featureKey: z.string().min(1),
    level,
    /** Уровни, на которых подкласс даёт особенности. */
    featureLevels: z.array(level).min(1),
  }),
  multiclass: z.strictObject({
    requirements: multiclassRequirementSchema,
    proficiencies: classProficienciesSchema,
  }),
  textOnly: z.array(text),
});

export const subclassDataSchema = z.strictObject({
  schemaVersion: z.literal(SUBCLASS_SCHEMA_VERSION),
  intro: z.array(textBlockSchema),
  features: z.array(classFeatureSchema).min(1),
  /** Разделы без уровня: догматы клятвы, «Ограничение: только для дварфов». */
  sections: z.array(classSectionSchema),
});

/** Дополнительные заклинания подкласса: домены, клятвы, расширенный список покровителя. */
export const subclassSpellListSchema = z.strictObject({
  /** Подпись столбца или таблицы: «Арктика», «Заклинание гения»; `null` — одна таблица. */
  name: text.nullable(),
  /** `class` — уровень класса («Уровень жреца»), `spell` — уровень заклинания (колдун). */
  levelKind: z.enum(['class', 'spell']),
  rows: z.array(z.strictObject({ level, spellIds: z.array(entityIdSchema).min(1) })).min(1),
});

export const subclassRulesSchema = z.strictObject({
  schemaVersion: z.literal(SUBCLASS_RULES_SCHEMA_VERSION),
  subclassOf: z.enum(CLASS_IDS),
  spellLists: z.array(subclassSpellListSchema),
  /** Заклинатель-подкласс (мистический рыцарь, мистический ловкач). */
  spellcasting: spellcastingSchema.nullable(),
  spellTable: z.array(spellTableRowSchema).nullable(),
  textOnly: z.array(text),
});

export type ClassData = z.infer<typeof classDataSchema>;
export type ClassRules = z.infer<typeof classRulesSchema>;
export type ClassFeature = z.infer<typeof classFeatureSchema>;
export type ClassTableRow = z.infer<typeof classTableRowSchema>;
export type ClassTableColumn = (typeof CLASS_TABLE_COLUMNS)[number];
export type ClassProficiencies = z.infer<typeof classProficienciesSchema>;
export type EquipmentChoice = z.infer<typeof equipmentChoiceSchema>;
export type EquipmentPart = z.infer<typeof equipmentPartSchema>;
export type EquipmentGroup = (typeof EQUIPMENT_GROUPS)[number];
export type SubclassData = z.infer<typeof subclassDataSchema>;
export type SubclassRules = z.infer<typeof subclassRulesSchema>;
export type SubclassSpellList = z.infer<typeof subclassSpellListSchema>;
