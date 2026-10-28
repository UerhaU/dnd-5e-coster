import type { ReferenceEntry } from './codes.ts';

// Справочники рас (этап 2, часть Б). Навыки и языки — пока только коды: их объекты
// каталога появятся на этапе 3, ссылки на них не проверяются (как классы у заклинаний).

export const SIZES = [
  { id: 'tiny', nameRu: 'Крошечный', nameEn: 'Tiny' },
  { id: 'small', nameRu: 'Маленький', nameEn: 'Small' },
  { id: 'medium', nameRu: 'Средний', nameEn: 'Medium' },
  { id: 'large', nameRu: 'Большой', nameEn: 'Large' },
] as const satisfies readonly ReferenceEntry[];

export const CREATURE_TYPES = [
  { id: 'humanoid', nameRu: 'Гуманоид', nameEn: 'Humanoid' },
  { id: 'fey', nameRu: 'Фея', nameEn: 'Fey' },
  { id: 'construct', nameRu: 'Конструкт', nameEn: 'Construct' },
  { id: 'ooze', nameRu: 'Слизь', nameEn: 'Ooze' },
  { id: 'monstrosity', nameRu: 'Монстр', nameEn: 'Monstrosity' },
  { id: 'undead', nameRu: 'Нежить', nameEn: 'Undead' },
] as const satisfies readonly ReferenceEntry[];

export const SKILLS = [
  { id: 'acrobatics', nameRu: 'Акробатика', nameEn: 'Acrobatics' },
  { id: 'animal_handling', nameRu: 'Уход за животными', nameEn: 'Animal Handling' },
  { id: 'arcana', nameRu: 'Магия', nameEn: 'Arcana' },
  { id: 'athletics', nameRu: 'Атлетика', nameEn: 'Athletics' },
  { id: 'deception', nameRu: 'Обман', nameEn: 'Deception' },
  { id: 'history', nameRu: 'История', nameEn: 'History' },
  { id: 'insight', nameRu: 'Проницательность', nameEn: 'Insight' },
  { id: 'intimidation', nameRu: 'Запугивание', nameEn: 'Intimidation' },
  { id: 'investigation', nameRu: 'Расследование', nameEn: 'Investigation' },
  { id: 'medicine', nameRu: 'Медицина', nameEn: 'Medicine' },
  { id: 'nature', nameRu: 'Природа', nameEn: 'Nature' },
  { id: 'perception', nameRu: 'Восприятие', nameEn: 'Perception' },
  { id: 'performance', nameRu: 'Выступление', nameEn: 'Performance' },
  { id: 'persuasion', nameRu: 'Убеждение', nameEn: 'Persuasion' },
  { id: 'religion', nameRu: 'Религия', nameEn: 'Religion' },
  { id: 'sleight_of_hand', nameRu: 'Ловкость рук', nameEn: 'Sleight of Hand' },
  { id: 'stealth', nameRu: 'Скрытность', nameEn: 'Stealth' },
  { id: 'survival', nameRu: 'Выживание', nameEn: 'Survival' },
] as const satisfies readonly ReferenceEntry[];

/**
 * Коды языков в механике рас (race-rules/v1). Подписей здесь нет: название языка — у
 * объекта-языка каталога (`language:elvish`, как на DnD.su), сборка делает из кода связь.
 */
export const LANGUAGE_CODES = [
  'common',
  'dwarvish',
  'elvish',
  'giant',
  'gnomish',
  'goblin',
  'halfling',
  'orc',
  'abyssal',
  'celestial',
  'draconic',
  'deep_speech',
  'infernal',
  'primordial',
  'sylvan',
  'undercommon',
  'aquan',
  'auran',
  'ignan',
  'terran',
  'gith',
  'quori',
  'leonin',
  'loxodon',
  'minotaur',
  'vedalken',
  'grung',
  'aarakocra',
  'gnoll',
  'thri_kreen',
] as const;

export type SizeId = (typeof SIZES)[number]['id'];
export type CreatureTypeId = (typeof CREATURE_TYPES)[number]['id'];
export type SkillId = (typeof SKILLS)[number]['id'];
export type LanguageId = (typeof LANGUAGE_CODES)[number];
