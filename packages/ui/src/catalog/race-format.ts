import {
  ABILITIES,
  CREATURE_TYPES,
  LANGUAGES,
  SIZES,
  SKILLS,
  type AbilityOption,
  type RaceListItem,
  type RaceRules,
} from '@koster/shared';
import { plural } from './item-format';
import { damageTypeName } from './spell-format';

// Подписи для экранов рас. Только функции без React: их проще проверить тестами.

const nameOf = (list: readonly { id: string; nameRu: string }[], id: string) =>
  list.find((entry) => entry.id === id)?.nameRu ?? id;

const ABILITY_SHORT: Record<string, string> = {
  str: 'Сил',
  dex: 'Лов',
  con: 'Тел',
  int: 'Инт',
  wis: 'Мдр',
  cha: 'Хар',
};

export function sizeName(size: string): string {
  return nameOf(SIZES, size);
}

/** «Тел +2, Мдр +1»; «+2 к одной, +1 к другой на выбор». */
export function abilityOptionText(option: AbilityOption): string {
  const fixed = option.fixed.map((entry) => `${ABILITY_SHORT[entry.ability]} +${entry.amount}`);
  const choices = option.choices.map((choice) => {
    const count =
      choice.count === 1
        ? 'одной'
        : `${choice.count} ${plural(choice.count, 'характеристике', 'характеристикам', 'характеристикам')}`;
    const from = choice.from ? ` из: ${choice.from.map((id) => ABILITY_SHORT[id]).join(', ')}` : '';
    const except = choice.except.length
      ? ` (кроме ${choice.except.map((id) => ABILITY_SHORT[id]).join(', ')})`
      : '';
    return `+${choice.amount} к ${count} на выбор${from}${except}`;
  });
  return [...fixed, ...choices].join(', ');
}

/** Варианты увеличения: «Тел +2» или «… / или …». `null` — не разобрано; пусто — нет своего. */
export function abilityScoresText(options: RaceRules['abilityScores']): string | null {
  if (options === null) return 'не разобрано, см. текст';
  if (options.length === 0) return null;
  return options.map(abilityOptionText).join('; или ');
}

/** «30 фт., полёт 50 фт., плавание — как ходьба». */
export function speedText(speed: RaceRules['speed']): string | null {
  const feet = (value: number | 'walk') => (value === 'walk' ? 'как ходьба' : `${value} фт.`);
  const parts = [
    speed.walk !== null ? `${speed.walk} фт.` : null,
    speed.fly !== null ? `полёт ${feet(speed.fly)}` : null,
    speed.swim !== null ? `плавание ${feet(speed.swim)}` : null,
    speed.climb !== null ? `лазание ${feet(speed.climb)}` : null,
    speed.burrow !== null ? `копание ${feet(speed.burrow)}` : null,
  ].filter((part) => part !== null);
  return parts.length > 0 ? parts.join(', ') : null;
}

/** «Восприятие; ещё 2 на выбор». */
export function skillsText(skills: RaceRules['skills']): string | null {
  const parts = [
    ...skills.fixed.map((id) => nameOf(SKILLS, id)),
    ...skills.choices.map((choice) =>
      choice.from
        ? `${choice.count} на выбор из: ${choice.from.map((id) => nameOf(SKILLS, id)).join(', ')}`
        : `${choice.count} на выбор`,
    ),
  ];
  return parts.length > 0 ? parts.join('; ') : null;
}

/** «Общий, Эльфийский; ещё 1 на выбор». */
export function languagesText(languages: RaceRules['languages']): string | null {
  const parts = languages.fixed.map((id) => nameOf(LANGUAGES, id));
  if (languages.choose > 0) parts.push(`ещё ${languages.choose} на выбор`);
  return parts.length > 0 ? parts.join(', ') : null;
}

export function resistancesText(resistances: RaceRules['resistances']): string | null {
  return resistances.length > 0
    ? resistances.map((id) => damageTypeName(id).toLowerCase()).join(', ')
    : null;
}

export function creatureTypeName(type: string): string {
  return nameOf(CREATURE_TYPES, type);
}

export function abilityName(id: string): string {
  return nameOf(ABILITIES, id);
}

/** Строка списка: «разновидность: Эльф · Средний · 30 фт. · тёмное зрение 60 фт.». */
export function raceSummary(race: RaceListItem): string {
  return [
    race.variantOfName ? `разновидность: ${race.variantOfName}` : null,
    race.size ? sizeName(race.size) : null,
    race.speedWalkFt !== null ? `${race.speedWalkFt} фт.` : null,
    race.flying ? 'полёт' : null,
    race.darkvisionFt !== null ? `тёмное зрение ${race.darkvisionFt} фт.` : null,
  ]
    .filter((part) => part !== null)
    .join(' · ');
}
