import {
  ABILITIES,
  CLASS_NAMES_RU,
  ITEM_CATEGORIES,
  SIZES,
  type BackgroundRules,
  type FeatRequirement,
  type FeatRules,
  type ProficiencyChoice,
} from '@koster/shared';

// Подписи механики предысторий и черт (background-rules/v1, feat-rules/v1) для карточек.
// Названия объектов (навыков, языков, предметов, черт) — из связей карточки: `names`.

type Names = Map<string, string>;

const nameOf = (entries: readonly { id: string; nameRu: string }[], id: string) =>
  entries.find((entry) => entry.id === id)?.nameRu ?? id;

const named = (names: Names) => (id: string) => names.get(id) ?? id;

const ARMOR = { light: 'лёгкие доспехи', medium: 'средние доспехи', heavy: 'тяжёлые доспехи' };

/** «1 на выбор из: А, Б»; без списка — «1 на выбор (любые)». */
function choiceText(count: number, from: string[] | null, any = 'любые'): string {
  return from ? `${count} на выбор из: ${from.join(', ')}` : `${count} на выбор (${any})`;
}

/** Навыки и инструменты: «Атлетика; 1 на выбор из: …». */
export function proficienciesText(
  list: {
    fixed: string[];
    choices: { count: number; from: string[] | null; group?: string | null }[];
  },
  names: Names,
): string | null {
  const name = named(names);
  const parts = [
    ...list.fixed.map(name),
    ...list.choices.map((choice) =>
      choice.group
        ? `${choice.count} на выбор (${nameOf(ITEM_CATEGORIES, choice.group).toLowerCase()})`
        : choiceText(choice.count, choice.from?.map(name) ?? null),
    ),
  ];
  return parts.length > 0 ? parts.join('; ') : null;
}

/** «3 на выбор в любой комбинации: навык, инструмент». */
export function mixedText(choices: readonly ProficiencyChoice[], names: Names): string | null {
  if (choices.length === 0) return null;
  const name = named(names);
  return choices
    .map((choice) => {
      const options = choice.from.map((option) => {
        if (option.kind === 'tool_group') {
          return nameOf(ITEM_CATEGORIES, option.group).toLowerCase();
        }
        if (option.id) return name(option.id);
        return option.kind === 'skill' ? 'любой навык' : 'любой инструмент';
      });
      return `${choice.count} на выбор в любой комбинации: ${options.join(', ')}`;
    })
    .join('; ');
}

/** Языки предыстории: «Эльфийский; 2 на выбор (любые)». */
export function backgroundLanguagesText(
  languages: BackgroundRules['languages'],
  names: Names,
): string | null {
  return proficienciesText(languages, names);
}

/** «поясной кошель с 15 зм» → «15 зм»; мм → самая крупная монета без остатка. */
export function coinsText(cp: number | null): string | null {
  if (cp === null) return null;
  const coins: [number, string][] = [
    [100, 'зм'],
    [10, 'см'],
    [1, 'мм'],
  ];
  const [value, label] = coins.find(([size]) => cp % size === 0) ?? [1, 'мм'];
  return `${cp / value} ${label}`;
}

function requirementText(requirement: FeatRequirement, names: Names): string {
  switch (requirement.kind) {
    case 'ability':
      return `${nameOf(ABILITIES, requirement.ability)} ${requirement.min}+`;
    case 'race':
    case 'background':
      return names.get(requirement.id) ?? requirement.id;
    case 'feat': {
      const feat = names.get(requirement.id) ?? requirement.id;
      return requirement.option ? `${feat} (${requirement.option})` : feat;
    }
    case 'size':
      return `размер ${nameOf(SIZES, requirement.size).toLowerCase()}`;
    case 'armor':
      return `владение: ${ARMOR[requirement.armor]}`;
    case 'weapon':
      return 'владение воинским оружием';
    case 'spellcasting':
      return 'накладывает хотя бы одно заклинание';
    case 'class_feature':
      return requirement.feature === 'spellcasting'
        ? 'умение «Использование заклинаний»'
        : 'умение «Магия договора»';
    case 'level':
      return `${requirement.min} уровень`;
    case 'class':
      return CLASS_NAMES_RU[requirement.id];
    case 'campaign':
      return requirement.setting === 'planescape' ? 'кампания Planescape' : 'кампания Dragonlance';
    case 'text':
      return requirement.text;
  }
}

/** Группы требований: «4 уровень; Удар великанов (Огненный удар)»; в группе — «или». */
export function prerequisitesText(
  prerequisites: FeatRules['prerequisites'],
  names: Names,
): string | null {
  if (prerequisites.length === 0) return null;
  return prerequisites
    .map((group) => group.map((requirement) => requirementText(requirement, names)).join(' или '))
    .join('; ');
}

/** Оружие черты: «импровизированное; 4 вида на выбор (простое, воинское)». */
export function featWeaponsText(weapons: FeatRules['weapons']): string | null {
  const groups = { improvised: 'импровизированное', firearms: 'огнестрельное' };
  const categories = { simple: 'простое', martial: 'воинское' };
  const parts = [
    ...weapons.groups.map((group) => groups[group]),
    ...weapons.choices.map(
      (choice) =>
        `${choice.count} на выбор (${choice.categories.map((id) => categories[id]).join(', ')})`,
    ),
  ];
  return parts.length > 0 ? parts.join('; ') : null;
}
