// Коды справочников каталога (раздел 5.1, п. 4). Из этих списков сборка
// заполняет таблицы-справочники catalog.db, а схемы Zod проверяют по ним данные.

export interface ReferenceEntry {
  readonly id: string;
  readonly nameRu: string;
  readonly nameEn: string;
}

export const MAGIC_SCHOOLS = [
  { id: 'abjuration', nameRu: 'Ограждение', nameEn: 'Abjuration' },
  { id: 'conjuration', nameRu: 'Вызов', nameEn: 'Conjuration' },
  { id: 'divination', nameRu: 'Прорицание', nameEn: 'Divination' },
  { id: 'enchantment', nameRu: 'Очарование', nameEn: 'Enchantment' },
  { id: 'evocation', nameRu: 'Воплощение', nameEn: 'Evocation' },
  { id: 'illusion', nameRu: 'Иллюзия', nameEn: 'Illusion' },
  { id: 'necromancy', nameRu: 'Некромантия', nameEn: 'Necromancy' },
  { id: 'transmutation', nameRu: 'Преобразование', nameEn: 'Transmutation' },
] as const satisfies readonly ReferenceEntry[];

export const DAMAGE_TYPES = [
  { id: 'acid', nameRu: 'Кислота', nameEn: 'Acid' },
  { id: 'bludgeoning', nameRu: 'Дробящий', nameEn: 'Bludgeoning' },
  { id: 'cold', nameRu: 'Холод', nameEn: 'Cold' },
  { id: 'fire', nameRu: 'Огонь', nameEn: 'Fire' },
  { id: 'force', nameRu: 'Силовое поле', nameEn: 'Force' },
  { id: 'lightning', nameRu: 'Электричество', nameEn: 'Lightning' },
  { id: 'necrotic', nameRu: 'Некротическая энергия', nameEn: 'Necrotic' },
  { id: 'piercing', nameRu: 'Колющий', nameEn: 'Piercing' },
  { id: 'poison', nameRu: 'Яд', nameEn: 'Poison' },
  { id: 'psychic', nameRu: 'Психическая энергия', nameEn: 'Psychic' },
  { id: 'radiant', nameRu: 'Излучение', nameEn: 'Radiant' },
  { id: 'slashing', nameRu: 'Рубящий', nameEn: 'Slashing' },
  { id: 'thunder', nameRu: 'Звук', nameEn: 'Thunder' },
] as const satisfies readonly ReferenceEntry[];

export const ABILITIES = [
  { id: 'str', nameRu: 'Сила', nameEn: 'Strength' },
  { id: 'dex', nameRu: 'Ловкость', nameEn: 'Dexterity' },
  { id: 'con', nameRu: 'Телосложение', nameEn: 'Constitution' },
  { id: 'int', nameRu: 'Интеллект', nameEn: 'Intelligence' },
  { id: 'wis', nameRu: 'Мудрость', nameEn: 'Wisdom' },
  { id: 'cha', nameRu: 'Харизма', nameEn: 'Charisma' },
] as const satisfies readonly ReferenceEntry[];

export const CONDITIONS = [
  { id: 'blinded', nameRu: 'Ослеплённый', nameEn: 'Blinded' },
  { id: 'charmed', nameRu: 'Очарованный', nameEn: 'Charmed' },
  { id: 'deafened', nameRu: 'Оглохший', nameEn: 'Deafened' },
  { id: 'exhaustion', nameRu: 'Истощение', nameEn: 'Exhaustion' },
  { id: 'frightened', nameRu: 'Испуганный', nameEn: 'Frightened' },
  { id: 'grappled', nameRu: 'Схваченный', nameEn: 'Grappled' },
  { id: 'incapacitated', nameRu: 'Недееспособный', nameEn: 'Incapacitated' },
  { id: 'invisible', nameRu: 'Невидимый', nameEn: 'Invisible' },
  { id: 'paralyzed', nameRu: 'Парализованный', nameEn: 'Paralyzed' },
  { id: 'petrified', nameRu: 'Окаменевший', nameEn: 'Petrified' },
  { id: 'poisoned', nameRu: 'Отравленный', nameEn: 'Poisoned' },
  { id: 'prone', nameRu: 'Сбитый с ног', nameEn: 'Prone' },
  { id: 'restrained', nameRu: 'Опутанный', nameEn: 'Restrained' },
  { id: 'stunned', nameRu: 'Ошеломлённый', nameEn: 'Stunned' },
  { id: 'unconscious', nameRu: 'Бессознательный', nameEn: 'Unconscious' },
] as const satisfies readonly ReferenceEntry[];

/**
 * Классы пока без таблицы: она появится на этапе 3. До тех пор заклинания
 * ссылаются на классы кодом, и сборка эти ссылки не проверяет.
 */
export const CLASS_IDS = [
  'class:artificer',
  'class:barbarian',
  'class:bard',
  'class:cleric',
  'class:druid',
  'class:fighter',
  'class:monk',
  'class:paladin',
  'class:ranger',
  'class:rogue',
  'class:sorcerer',
  'class:warlock',
  'class:wizard',
] as const;

type Ids<T extends readonly ReferenceEntry[]> = T[number]['id'];

export type MagicSchoolId = Ids<typeof MAGIC_SCHOOLS>;
export type DamageTypeId = Ids<typeof DAMAGE_TYPES>;
export type AbilityId = Ids<typeof ABILITIES>;
export type ConditionId = Ids<typeof CONDITIONS>;
export type ClassId = (typeof CLASS_IDS)[number];

export function idsOf<T extends readonly ReferenceEntry[]>(entries: T): [Ids<T>, ...Ids<T>[]] {
  return entries.map((entry) => entry.id) as [Ids<T>, ...Ids<T>[]];
}
