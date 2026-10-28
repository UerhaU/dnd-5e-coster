import type { ReferenceEntry } from './codes.ts';

// Справочники снаряжения (раздел 5.1, п. 4): виды предметов, виды оружия и доспехов,
// свойства оружия. Сборка заполняет из них таблицы catalog.db.

export const ITEM_KINDS = [
  { id: 'weapon', nameRu: 'Оружие', nameEn: 'Weapon' },
  { id: 'armor', nameRu: 'Доспех', nameEn: 'Armor' },
  { id: 'shield', nameRu: 'Щит', nameEn: 'Shield' },
  { id: 'ammunition', nameRu: 'Боеприпасы', nameEn: 'Ammunition' },
  { id: 'adventuring_gear', nameRu: 'Снаряжение', nameEn: 'Adventuring gear' },
  { id: 'pack', nameRu: 'Набор снаряжения', nameEn: 'Equipment pack' },
  { id: 'tool', nameRu: 'Инструменты', nameEn: 'Tools' },
  { id: 'explosive', nameRu: 'Взрывчатка', nameEn: 'Explosive' },
  { id: 'trade_good', nameRu: 'Товар', nameEn: 'Trade good' },
  { id: 'mount', nameRu: 'Скакун или животное', nameEn: 'Mount or other animal' },
  { id: 'tack', nameRu: 'Сёдла и упряжь', nameEn: 'Tack and harness' },
  { id: 'vehicle', nameRu: 'Транспорт', nameEn: 'Vehicle' },
  /** Материальный компонент заклинания, которого нет в таблицах снаряжения DnD.su (Р60). */
  { id: 'spell_component', nameRu: 'Компонент заклинания', nameEn: 'Spell component' },
] as const satisfies readonly ReferenceEntry[];

/** Вид внутри категории: оружие, доспехи и группы из таблиц DnD.su. */
export const ITEM_CATEGORIES = [
  { id: 'simple_melee', nameRu: 'Простое рукопашное оружие', nameEn: 'Simple melee weapon' },
  { id: 'simple_ranged', nameRu: 'Простое дальнобойное оружие', nameEn: 'Simple ranged weapon' },
  { id: 'martial_melee', nameRu: 'Воинское рукопашное оружие', nameEn: 'Martial melee weapon' },
  {
    id: 'martial_ranged',
    nameRu: 'Воинское дальнобойное оружие',
    nameEn: 'Martial ranged weapon',
  },
  { id: 'light_armor', nameRu: 'Лёгкий доспех', nameEn: 'Light armor' },
  { id: 'medium_armor', nameRu: 'Средний доспех', nameEn: 'Medium armor' },
  { id: 'heavy_armor', nameRu: 'Тяжёлый доспех', nameEn: 'Heavy armor' },
  { id: 'arcane_focus', nameRu: 'Магическая фокусировка', nameEn: 'Arcane focus' },
  { id: 'druidic_focus', nameRu: 'Фокусировка друидов', nameEn: 'Druidic focus' },
  { id: 'holy_symbol', nameRu: 'Священный символ', nameEn: 'Holy symbol' },
  { id: 'artisans_tools', nameRu: 'Инструменты ремесленников', nameEn: "Artisan's tools" },
  { id: 'gaming_set', nameRu: 'Игровой набор', nameEn: 'Gaming set' },
  { id: 'musical_instrument', nameRu: 'Музыкальный инструмент', nameEn: 'Musical instrument' },
  { id: 'saddle', nameRu: 'Седло', nameEn: 'Saddle' },
  { id: 'land_vehicle', nameRu: 'Наземный транспорт', nameEn: 'Land vehicle' },
  { id: 'waterborne_vehicle', nameRu: 'Водный транспорт', nameEn: 'Waterborne vehicle' },
  { id: 'airborne_vehicle', nameRu: 'Воздушный транспорт', nameEn: 'Airborne vehicle' },
  { id: 'planar_vehicle', nameRu: 'Межпланарный транспорт', nameEn: 'Planar vehicle' },
  {
    id: 'infernal_war_machine',
    nameRu: 'Инфернальная военная машина',
    nameEn: 'Infernal war machine',
  },
] as const satisfies readonly ReferenceEntry[];

export const WEAPON_PROPERTIES = [
  { id: 'ammunition', nameRu: 'Боеприпас', nameEn: 'Ammunition' },
  { id: 'finesse', nameRu: 'Фехтовальное', nameEn: 'Finesse' },
  { id: 'heavy', nameRu: 'Тяжёлое', nameEn: 'Heavy' },
  { id: 'light', nameRu: 'Лёгкое', nameEn: 'Light' },
  { id: 'loading', nameRu: 'Перезарядка', nameEn: 'Loading' },
  { id: 'reach', nameRu: 'Досягаемость', nameEn: 'Reach' },
  { id: 'special', nameRu: 'Особое', nameEn: 'Special' },
  { id: 'thrown', nameRu: 'Метательное', nameEn: 'Thrown' },
  { id: 'two_handed', nameRu: 'Двуручное', nameEn: 'Two-handed' },
  { id: 'versatile', nameRu: 'Универсальное', nameEn: 'Versatile' },
  /** Огнестрельное оружие DMG: выстрелов до перезарядки. */
  { id: 'reload', nameRu: 'Боекомплект', nameEn: 'Reload' },
  { id: 'burst_fire', nameRu: 'Очередь', nameEn: 'Burst fire' },
] as const satisfies readonly ReferenceEntry[];

type Ids<T extends readonly ReferenceEntry[]> = T[number]['id'];

export type ItemKindId = Ids<typeof ITEM_KINDS>;
export type ItemCategoryId = Ids<typeof ITEM_CATEGORIES>;
export type WeaponPropertyId = Ids<typeof WEAPON_PROPERTIES>;
