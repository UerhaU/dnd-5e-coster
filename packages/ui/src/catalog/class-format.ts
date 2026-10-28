import {
  ABILITIES,
  EQUIPMENT_GROUPS,
  type ClassProficiencies,
  type ClassRules,
  type EquipmentChoice,
} from '@koster/shared';

// Подписи механики классов и подклассов для карточек «Справочника».

type Names = Map<string, string>;

const ARMOR = {
  light: 'лёгкие доспехи',
  medium: 'средние доспехи',
  heavy: 'тяжёлые доспехи',
  shield: 'щиты',
};
const WEAPON_CATEGORIES = { simple: 'простое оружие', martial: 'воинское оружие' };

const GROUP_NAMES: Record<(typeof EQUIPMENT_GROUPS)[number], string> = {
  simple_weapon: 'простое оружие на выбор',
  simple_melee: 'простое рукопашное оружие на выбор',
  martial_weapon: 'воинское оружие на выбор',
  martial_melee: 'воинское рукопашное оружие на выбор',
  arcane_focus: 'магическая фокусировка на выбор',
  druidic_focus: 'фокусировка друидов на выбор',
  holy_symbol: 'священный символ на выбор',
  artisans_tools: 'инструменты ремесленника на выбор',
  gaming_set: 'игровой набор на выбор',
  musical_instrument: 'музыкальный инструмент на выбор',
};

const abilityName = (id: string) => ABILITIES.find((ability) => ability.id === id)?.nameRu ?? id;
const named = (names: Names) => (id: string) => names.get(id) ?? id;

export function abilitiesText(ids: readonly string[]): string {
  return ids.map(abilityName).join(', ');
}

export function armorText(armor: ClassProficiencies['armor']): string | null {
  return armor.length > 0 ? armor.map((kind) => ARMOR[kind]).join(', ') : null;
}

export function weaponsText(weapons: ClassProficiencies['weapons'], names: Names): string | null {
  const parts = [
    ...weapons.categories.map((category) => WEAPON_CATEGORIES[category]),
    ...weapons.items.map(named(names)),
  ];
  return parts.length > 0 ? parts.join(', ') : null;
}

const GROUPS_OF_TOOLS = {
  artisans_tools: 'инструменты ремесленника',
  gaming_set: 'игровой набор',
  musical_instrument: 'музыкальный инструмент',
};

export function toolsText(p: ClassProficiencies, names: Names): string | null {
  const parts = [
    ...p.tools.fixed.map(named(names)),
    ...p.tools.choices.map((choice) =>
      choice.group
        ? `${GROUPS_OF_TOOLS[choice.group]}: ${choice.count} на выбор`
        : `${choice.count} на выбор: ${(choice.from ?? []).map(named(names)).join(', ') || 'любые'}`,
    ),
    ...p.mixed.map(
      (choice) =>
        `${choice.count} на выбор: ${choice.from
          .map((option) =>
            option.kind === 'tool_group'
              ? GROUPS_OF_TOOLS[option.group]
              : option.id
                ? named(names)(option.id)
                : option.kind === 'skill'
                  ? 'любой навык'
                  : 'любой инструмент',
          )
          .join(' или ')}`,
    ),
  ];
  return parts.length > 0 ? parts.join('; ') : null;
}

export function skillsText(skills: ClassProficiencies['skills'], names: Names): string | null {
  if (skills.length === 0) return null;
  return skills
    .map((choice) =>
      choice.from
        ? `${choice.count} на выбор: ${choice.from.map(named(names)).join(', ')}`
        : `${choice.count} любых`,
    )
    .join('; ');
}

/** «Сила 13 или Ловкость 13»; «Ловкость 13 и Мудрость 13». */
export function requirementsText(requirements: ClassRules['multiclass']['requirements']): string {
  return requirements
    .map((group) =>
      group.map((entry) => `${abilityName(entry.ability)} ${entry.min}`).join(' или '),
    )
    .join(' и ');
}

/** Все владения при мультиклассе одной строкой; `нет` — класс владений не даёт. */
export function multiclassProficienciesText(p: ClassProficiencies, names: Names): string {
  const parts = [
    armorText(p.armor),
    weaponsText(p.weapons, names),
    toolsText(p, names),
    skillsText(p.skills, names),
  ];
  return parts.filter(Boolean).join('; ') || 'нет';
}

const PROGRESSION = {
  full: 'полный заклинатель',
  half: 'половина уровней (вниз)',
  artificer: 'половина уровней (вверх)',
  third: 'треть уровней (вниз)',
  pact: 'магия договора',
};

export function spellcastingText(spellcasting: ClassRules['spellcasting']): string | null {
  if (!spellcasting) return null;
  return `${abilityName(spellcasting.ability)}; ячейки при мультиклассе — ${PROGRESSION[spellcasting.progression]}`;
}

/** «(а) секира или (б) воинское рукопашное оружие на выбор». */
export function equipmentText(choice: EquipmentChoice, names: Names): string {
  const options = choice.options.map((option) =>
    option.parts
      .map((part) => {
        const name = part.itemId
          ? named(names)(part.itemId)
          : part.group
            ? GROUP_NAMES[part.group]
            : part.text;
        return part.quantity > 1 ? `${name} ×${part.quantity}` : name;
      })
      .join(', '),
  );
  if (options.length === 1) return options[0] ?? '';
  const letters = ['а', 'б', 'в', 'г'];
  return options.map((option, index) => `(${letters[index] ?? index + 1}) ${option}`).join(' или ');
}

export function startingGoldText(gold: ClassRules['startingGold']): string | null {
  if (!gold) return null;
  const dice = gold.dice.replace('d', 'к');
  return gold.multiplier > 1 ? `${dice} × ${gold.multiplier} зм` : `${dice} зм`;
}

export function levelsText(levels: readonly number[]): string {
  return levels.length === 1 ? `${levels[0]}-й уровень` : `уровни ${levels.join(', ')}`;
}
