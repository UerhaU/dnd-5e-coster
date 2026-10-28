import {
  ABILITIES,
  CREATURE_TYPES,
  ITEM_CATEGORIES,
  LANGUAGES,
  SIZES,
  SKILLS,
  type AbilityOption,
  type RaceBody,
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

const years = (count: number) => `${count} ${plural(count, 'год', 'года', 'лет')}`;

/** «зрелость — 20 лет, жизнь — 100 лет». */
export function ageText(body: RaceBody): string | null {
  const parts = [
    body.adultAge !== null ? `зрелость — ${years(body.adultAge)}` : null,
    body.lifespan !== null ? `жизнь — ${years(body.lifespan)}` : null,
  ].filter((part) => part !== null);
  return parts.length > 0 ? parts.join(', ') : null;
}

/** 66 → «5 фт. 6 дюйм.». */
export function feetText(inches: number): string {
  const feet = Math.floor(inches / 12);
  const rest = inches % 12;
  return [feet > 0 ? `${feet} фт.` : null, rest > 0 ? `${rest} дюйм.` : null]
    .filter((part) => part !== null)
    .join(' ');
}

function rangeText(
  range: RaceBody['heightIn'],
  format: (value: number) => string,
  metric: (value: number) => number,
  metricUnit: string,
): string | null {
  if (!range) return null;
  const { min, max } = range;
  const both = (value: (part: number) => string | number) =>
    min !== null && max !== null
      ? min === max
        ? `около ${value(min)}`
        : `${value(min)} – ${value(max)}`
      : min !== null
        ? `от ${value(min)}`
        : `до ${value(max ?? 0)}`;
  return `${both(format)} (${both((value) => Math.round(metric(value)))} ${metricUnit})`;
}

/** «4 фт. – 5 фт. (122 – 152 см)». */
export function heightText(body: RaceBody): string | null {
  return rangeText(body.heightIn, feetText, (inches) => inches * 2.54, 'см');
}

/** «40 – 80 фнт. (18 – 36 кг)». */
export function weightText(body: RaceBody): string | null {
  return rangeText(
    body.weightLb,
    (pounds) => `${pounds} фнт.`,
    (pounds) => pounds * 0.4536,
    'кг',
  );
}

/** «рост 4 фт. 8 дюйм. + 2к8 дюйм., вес 100 фнт. + (2к8 × 2к4) фнт.». */
export function randomBodyText(body: RaceBody): string | null {
  const random = body.random;
  if (!random) return null;
  const heightDice = `${random.heightDice.count}к${random.heightDice.sides}`;
  const weightDice = random.weightDice
    ? ` × ${random.weightDice.count}к${random.weightDice.sides}`
    : '';
  return (
    `рост ${feetText(random.baseHeightIn)} + ${heightDice} дюйм., ` +
    `вес ${random.baseWeightLb} фнт. + (${heightDice}${weightDice}) фнт.; ` +
    `${heightDice} — один бросок для роста и веса`
  );
}

/** «Инструменты ремонтника; 1 на выбор из: …». `names` — названия предметов из связей. */
export function toolsText(tools: RaceRules['tools'], names: Map<string, string>): string | null {
  const name = (id: string) => names.get(id) ?? id;
  const parts = [
    ...tools.fixed.map(name),
    ...tools.choices.map((choice) => {
      if (choice.from) return `${choice.count} на выбор из: ${choice.from.map(name).join(', ')}`;
      if (choice.group) {
        const group = nameOf(ITEM_CATEGORIES, choice.group).toLowerCase();
        return `${choice.count} на выбор (${group})`;
      }
      return `${choice.count} на выбор (любые)`;
    }),
  ];
  return parts.length > 0 ? parts.join('; ') : null;
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
