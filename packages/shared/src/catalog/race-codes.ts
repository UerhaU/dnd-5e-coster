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
  { id: 'investigation', nameRu: 'Анализ', nameEn: 'Investigation' },
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

export const LANGUAGES = [
  { id: 'common', nameRu: 'Общий', nameEn: 'Common' },
  { id: 'dwarvish', nameRu: 'Дварфийский', nameEn: 'Dwarvish' },
  { id: 'elvish', nameRu: 'Эльфийский', nameEn: 'Elvish' },
  { id: 'giant', nameRu: 'Великаний', nameEn: 'Giant' },
  { id: 'gnomish', nameRu: 'Гномий', nameEn: 'Gnomish' },
  { id: 'goblin', nameRu: 'Гоблинский', nameEn: 'Goblin' },
  { id: 'halfling', nameRu: 'Язык полуросликов', nameEn: 'Halfling' },
  { id: 'orc', nameRu: 'Орочий', nameEn: 'Orc' },
  { id: 'abyssal', nameRu: 'Язык Бездны', nameEn: 'Abyssal' },
  { id: 'celestial', nameRu: 'Небесный', nameEn: 'Celestial' },
  { id: 'draconic', nameRu: 'Драконий', nameEn: 'Draconic' },
  { id: 'deep_speech', nameRu: 'Глубинная Речь', nameEn: 'Deep Speech' },
  { id: 'infernal', nameRu: 'Инфернальный', nameEn: 'Infernal' },
  { id: 'primordial', nameRu: 'Первичный', nameEn: 'Primordial' },
  { id: 'sylvan', nameRu: 'Сильван', nameEn: 'Sylvan' },
  { id: 'undercommon', nameRu: 'Подземный', nameEn: 'Undercommon' },
  { id: 'aquan', nameRu: 'Акван', nameEn: 'Aquan' },
  { id: 'auran', nameRu: 'Ауран', nameEn: 'Auran' },
  { id: 'ignan', nameRu: 'Игнан', nameEn: 'Ignan' },
  { id: 'terran', nameRu: 'Терран', nameEn: 'Terran' },
  { id: 'gith', nameRu: 'Гитский', nameEn: 'Gith' },
  { id: 'quori', nameRu: 'Квори', nameEn: 'Quori' },
  { id: 'leonin', nameRu: 'Леонинский', nameEn: 'Leonin' },
  { id: 'loxodon', nameRu: 'Локсодонский', nameEn: 'Loxodon' },
  { id: 'minotaur', nameRu: 'Минотавров', nameEn: 'Minotaur' },
  { id: 'vedalken', nameRu: 'Ведалкенский', nameEn: 'Vedalken' },
  { id: 'grung', nameRu: 'Грунгов', nameEn: 'Grung' },
  { id: 'aarakocra', nameRu: 'Ааракокра', nameEn: 'Aarakocra' },
  { id: 'gnoll', nameRu: 'Гноллий', nameEn: 'Gnoll' },
  { id: 'thri_kreen', nameRu: 'Три-кринов', nameEn: 'Thri-kreen' },
] as const satisfies readonly ReferenceEntry[];

export type SizeId = (typeof SIZES)[number]['id'];
export type CreatureTypeId = (typeof CREATURE_TYPES)[number]['id'];
export type SkillId = (typeof SKILLS)[number]['id'];
export type LanguageId = (typeof LANGUAGES)[number]['id'];
