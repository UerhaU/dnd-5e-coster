import {
  CLASS_RULES_SCHEMA_VERSION,
  CLASS_SCHEMA_VERSION,
  SUBCLASS_RULES_SCHEMA_VERSION,
  SUBCLASS_SCHEMA_VERSION,
  textBlocksToPlain,
  type ClassData,
  type ClassFeature,
  type ClassProficiencies,
  type ClassRules,
  type ClassTableColumn,
  type ClassTableRow,
  type EquipmentChoice,
  type EquipmentGroup,
  type EquipmentPart,
  type SubclassData,
  type SubclassRules,
  type SubclassSpellList,
} from '@koster/shared';
import { nameKey } from '../reviewed/reviewed-items.ts';
import {
  ABILITY_STEMS,
  countIn,
  found,
  SKILL_STEMS,
  TOOL_GROUP_WORDS,
  TOOL_STEMS,
} from '../races/parse-race-rules.ts';
import type {
  RawCell,
  RawClassPage,
  RawFeature,
  RawSubclass,
  RawTable,
} from './parse-class-page.ts';

// Шаг normalize (раздел 6) для классов и подклассов: таблица класса — числами,
// владения — категориями и ID, стартовое снаряжение — выборами, мультикласс —
// условиями. Чего нельзя записать данными — `textOnly` со строкой сайта.

export interface ClassLookup {
  /** Предметы каталога: название без регистра (`nameKey`) → ID. */
  items: Map<string, string>;
  /** Страница заклинания на DnD.su → ID объекта. */
  spellsByPage: Map<number, string>;
}

export class ClassNormalizeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ClassNormalizeError';
  }
}

type Ability = ClassRules['savingThrows'][number];

const COLUMN_KEYS: [RegExp, ClassTableColumn][] = [
  [/^Ярость$/, 'rages'],
  [/^Урон ярости$/, 'rageDamage'],
  [/^Боевые искусства$/, 'martialArts'],
  [/^Очки ци$/, 'kiPoints'],
  [/^Скорость без ?доспехов$/, 'unarmoredMovement'],
  [/^Скрытая атака$/, 'sneakAttack'],
  [/^Единицы чародейства$/, 'sorceryPoints'],
  [/^Известные заговоры$/, 'cantripsKnown'],
  [/^Известные заклинания$/, 'spellsKnown'],
  [/^Ячейки заклинаний$/, 'pactSlots'],
  [/^Уровень ячеек$/, 'pactSlotLevel'],
  [/^Известные воззвания$/, 'invocationsKnown'],
  [/^Известные инфузии$/, 'infusionsKnown'],
  [/^Инфузии предметов$/, 'infusedItems'],
];

const NUMBER_WORDS: [RegExp, number][] = [
  [/^(один|одно|одна|одним|одного)$/, 1],
  [/^(два|две|двух)$/, 2],
  [/^(три|трёх|трех)$/, 3],
  [/^(четыре|четырёх)$/, 4],
  [/^(пять|пяти)$/, 5],
  [/^(десять)$/, 10],
];

const countWord = (word: string) => NUMBER_WORDS.find(([pattern]) => pattern.test(word))?.[1];

/** «четыре навыка» — `countIn` знает только до трёх. */
function countOf(text: string): number | null {
  const word = /(?<![а-яё])(один|одно|одна|два|две|три|четыре|пять|десять)(?![а-яё])/i.exec(text);
  return word?.[1] ? (countWord(word[1].toLowerCase()) ?? null) : countIn(text);
}

/** Значение ячейки: «+2» → 2, «1к6» → `1d6`, «+10 фт.» → 10, «3-й» → 3, «—» → `null`. */
export function tableValue(text: string): number | string | null {
  const value = text.replace(/\s+/g, ' ').trim();
  if (/^[-—–]?$/.test(value)) return null;
  const dice = /^(\d+)к(\d+)$/.exec(value);
  if (dice) return `${dice[1]}d${dice[2]}`;
  const number = /^\+?(\d+)(?:-[а-яё]+)?(?: ?(?:фут[а-яё]*|фт)\.?)?$/.exec(value);
  if (number) return Number(number[1]);
  if (/^Неогранич/i.test(value)) return 'unlimited';
  throw new ClassNormalizeError(`Не разобрано значение таблицы: «${text}»`);
}

interface ParsedTable {
  rows: (Omit<ClassTableRow, 'proficiencyBonus' | 'features'> & {
    proficiencyBonus: number | null;
    features: string[];
    featureLinks: RawCell['features'];
  })[];
}

/** Таблица класса или заклинателя-подкласса: столбцы по заголовкам, ячейки — числами. */
function parseTable(table: RawTable): ParsedTable {
  const slotColumns: number[] = [];
  const columns: { index: number; key: ClassTableColumn }[] = [];
  let levelColumn = -1;
  let bonusColumn = -1;
  let featureColumn = -1;
  table.header.forEach((name, index) => {
    const slot = /^Ячейки (\d)$/.exec(name);
    if (slot) slotColumns[Number(slot[1]) - 1] = index;
    else if (/^Бонус мастерства$/.test(name)) bonusColumn = index;
    else if (/^Умения$/.test(name)) featureColumn = index;
    else {
      const key = COLUMN_KEYS.find(([pattern]) => pattern.test(name))?.[1];
      // «Уровень», «Уровень плута» — номер строки; «Уровень ячеек» — столбец колдуна.
      if (!key && levelColumn < 0 && /^Уровень( [а-яё]+)?$/.test(name)) {
        levelColumn = index;
        return;
      }
      if (!key) throw new ClassNormalizeError(`Неизвестный столбец таблицы: «${name}»`);
      columns.push({ index, key });
    }
  });
  if (levelColumn < 0) throw new ClassNormalizeError('В таблице нет столбца «Уровень»');
  const rows = table.rows.map((cells) => {
    const cell = (index: number) => cells[index]?.text ?? '';
    const level = tableValue(cell(levelColumn));
    if (typeof level !== 'number') throw new ClassNormalizeError(`Строка без уровня: «${cell(0)}»`);
    const bonus = bonusColumn >= 0 ? tableValue(cell(bonusColumn)) : null;
    const values: ParsedTable['rows'][number]['values'] = {};
    for (const column of columns) values[column.key] = tableValue(cell(column.index));
    const links = featureColumn >= 0 ? (cells[featureColumn]?.features ?? []) : [];
    return {
      level,
      proficiencyBonus: typeof bonus === 'number' ? bonus : null,
      features: [...new Set(links.map((link) => link.key))],
      featureLinks: links,
      values,
      spellSlots:
        slotColumns.length > 0
          ? Array.from({ length: 9 }, (_, slot) => {
              const index = slotColumns[slot];
              const value = index === undefined ? null : tableValue(cell(index));
              return typeof value === 'number' ? value : 0;
            })
          : null,
    };
  });
  return { rows };
}

// --- Владения ---

const ARMOR_WORDS: [RegExp, ClassProficiencies['armor'][number][]][] = [
  [/(?<![а-яё])вс[еи][а-яё]* (виды )?доспех/i, ['light', 'medium', 'heavy']],
  [/л[её]гк[а-яё]* доспех/i, ['light']],
  [/средн[а-яё]* доспех/i, ['medium']],
  [/т[яе]ж[её]л[а-яё]* доспех/i, ['heavy']],
  [/щит/i, ['shield']],
];

/** Оружие владения во множественном числе: «боевые посохи, дротики, кинжалы». */
const WEAPON_WORDS: [RegExp, string][] = [
  [/боев[а-яё]* посох/i, 'item:quarterstaff'],
  [/дротик/i, 'item:dart'],
  [/кинжал/i, 'item:dagger'],
  [/пращ/i, 'item:sling'],
  [/л[её]гк[а-яё]* арбалет/i, 'item:light-crossbow'],
  [/ручн[а-яё]* арбалет/i, 'item:hand-crossbow'],
  [/булав/i, 'item:mace'],
  [/дубин/i, 'item:club'],
  [/метательн[а-яё]* копь/i, 'item:javelin'],
  [/(?<!метательн[а-яё]* )копь/i, 'item:spear'],
  [/серп/i, 'item:sickle'],
  [/скимитар/i, 'item:scimitar'],
  [/длинн[а-яё]* меч/i, 'item:longsword'],
  [/коротк[а-яё]* меч/i, 'item:shortsword'],
  [/рапир/i, 'item:rapier'],
];

const CHOICE = /выбор|Выберите|любы[хе]|любой/i;

export function emptyProficiencies(): ClassProficiencies {
  return {
    armor: [],
    weapons: { categories: [], items: [] },
    tools: { fixed: [], choices: [] },
    mixed: [],
    skills: [],
  };
}

/** Части строки владений: «лёгкие доспехи, средние доспехи, а также один тип…». */
const partsOf = (text: string) =>
  text
    .replace(/\([^)]*\)/g, ' ')
    .split(/,|;|\s+а также\s+|\s+и\s+(?=один|одн)/)
    .map((part) => part.trim().replace(/\.$/, ''))
    .filter((part) => part && !/^нет$/i.test(part));

function addArmor(part: string, into: ClassProficiencies): boolean {
  const kinds = found(part, ARMOR_WORDS).flat();
  if (kinds.length === 0) return false;
  for (const kind of kinds) if (!into.armor.includes(kind)) into.armor.push(kind);
  return true;
}

function addWeapon(part: string, into: ClassProficiencies): boolean {
  if (/просто[а-яё]* оружи/i.test(part)) into.weapons.categories.push('simple');
  else if (/воинск[а-яё]* оружи/i.test(part)) into.weapons.categories.push('martial');
  else {
    const item = WEAPON_WORDS.find(([pattern]) => pattern.test(part))?.[1];
    if (!item) return false;
    into.weapons.items.push(item);
  }
  return true;
}

function addTool(part: string, into: ClassProficiencies): boolean {
  const groups = found(part, TOOL_GROUP_WORDS).filter((group) => group !== null);
  if (CHOICE.test(part) || groups.length > 0) {
    const count = countOf(part) ?? 1;
    if (groups.length > 1) {
      into.mixed.push({ count, from: groups.map((group) => ({ kind: 'tool_group', group })) });
      return true;
    }
    const group = groups[0];
    if (!group) return false;
    into.tools.choices.push({ count, from: null, group });
    return true;
  }
  const tools = found(part.toLowerCase(), TOOL_STEMS);
  if (tools.length === 0) return false;
  into.tools.fixed.push(...tools);
  return true;
}

const skillId = (code: string) => `skill:${code.replace(/_/g, '-')}`;

function addSkills(part: string, into: ClassProficiencies, classSkills: string[] | null): boolean {
  if (!/навык/i.test(part) && !/любых/i.test(part)) return false;
  const count = countOf(part) ?? 1;
  const listed = found(part, SKILL_STEMS).map(skillId);
  const from = /из списка/i.test(part) ? classSkills : listed.length > 0 ? listed : null;
  into.skills.push({ count, from });
  return true;
}

/** Строка «Оружие: Простое оружие, длинные мечи…»; неразобранные части — в `unparsed`. */
function parseProficiencyLine(
  label: string,
  text: string,
  into: ClassProficiencies,
  unparsed: string[],
) {
  if (/^Навыки/i.test(label)) {
    if (!addSkills(text, into, null)) unparsed.push(`${label}: ${text}`);
    return;
  }
  const add = /^Доспехи/i.test(label)
    ? addArmor
    : /^Оружие/i.test(label)
      ? addWeapon
      : /^Инструменты/i.test(label)
        ? addTool
        : null;
  if (!add) return;
  // «Выберите один вид инструмента ремесленников, либо музыкального инструмента» — один выбор.
  const parts =
    /^Инструменты/i.test(label) &&
    CHOICE.test(text) &&
    !/,\s*а также|,/.test(text.replace(/,\s*либо/, ''))
      ? [text.replace(/\.$/, '')]
      : partsOf(text);
  for (const part of parts) if (!add(part, into)) unparsed.push(`${label}: ${part}`);
}

/** «… вот владения, которые вы приобретаете …: лёгкие доспехи, один навык …». */
function parseMulticlassProficiencies(
  text: string,
  classSkills: string[],
  unparsed: string[],
): ClassProficiencies {
  const into = emptyProficiencies();
  if (/не получаете никаких владений/i.test(text)) return into;
  const list = text.slice(text.indexOf(':') + 1);
  for (const part of partsOf(list)) {
    if (addArmor(part, into) && !/оружи/i.test(part)) continue;
    if (/оружи|меч|арбалет|рапир/i.test(part)) {
      if (!addWeapon(part, into)) unparsed.push(`Мультикласс: ${part}`);
      continue;
    }
    if (addSkills(part, into, classSkills)) continue;
    if (/инструмент|набор/i.test(part) && addTool(part, into)) continue;
    if (found(part, ARMOR_WORDS).length > 0) continue;
    unparsed.push(`Мультикласс: ${part}`);
  }
  return into;
}

/** «значение Силы или Ловкости не ниже 13»; «Ловкости и Мудрости» — оба. */
function parseRequirements(text: string): ClassRules['multiclass']['requirements'] | null {
  const match = /значени[а-яё]* (.+?) не ниже (\d+)/.exec(text);
  if (!match?.[1]) return null;
  const min = Number(match[2]);
  const groups = match[1].split(/\s+и\s+/).map((group) =>
    group
      .split(/\s+или\s+/)
      .flatMap((word) => found(word, ABILITY_STEMS))
      .map((ability) => ({ ability, min })),
  );
  return groups.every((group) => group.length > 0) ? groups : null;
}

// --- Снаряжение ---

const EQUIPMENT_GROUP_WORDS: [RegExp, EquipmentGroup][] = [
  [/просты[а-яё]* рукопашн|простое рукопашн/i, 'simple_melee'],
  [/воинск[а-яё]* рукопашн|воинское рукопашн/i, 'martial_melee'],
  [/просты[а-яё]* оружи|простое оружи/i, 'simple_weapon'],
  [/воинск[а-яё]* оружи|воинское оружи/i, 'martial_weapon'],
  [/магическ[а-яё]* фокусировк/i, 'arcane_focus'],
  [/фокусировк[а-яё]* друид/i, 'druidic_focus'],
  [/священн[а-яё]* символ/i, 'holy_symbol'],
  [/музыкальн[а-яё]* инструмент/i, 'musical_instrument'],
];

/** Предметы снаряжения в косвенных падежах: «два ручных топора», «20 болтов». */
const EQUIPMENT_STEMS: [RegExp, string][] = [
  [/ручн[а-яё]* топор/i, 'item:handaxe'],
  [/метательн[а-яё]* копи?[йья]/i, 'item:javelin'],
  [/кинжал/i, 'item:dagger'],
  [/дротик/i, 'item:dart'],
  [/болт/i, 'item:crossbow-bolts'],
  [/стрел/i, 'item:arrows'],
  [/коротк[а-яё]* меч/i, 'item:shortsword'],
  [/л[её]гк[а-яё]* арбалет/i, 'item:light-crossbow'],
  [/кожан[а-яё]* (доспех|брон)/i, 'item:leather-armor'],
  [/прокл[её]панн[а-яё]* кож/i, 'item:studded-leather-armor'],
  [/чешуйчат[а-яё]* доспех/i, 'item:scale-mail'],
  [/деревянн[а-яё]* щит|^щит/i, 'item:shield'],
  [/мешоч[а-яё]* с компонентами/i, 'item:component-pouch'],
  [/книг[а-яё]* заклинаний/i, 'item:spellbook'],
  [/воровск[а-яё]* инструмент/i, 'item:thieves-tools'],
  [/набор[а-яё]* исследователя подземелий/i, 'item:dungeoneers-pack'],
  [/набор[а-яё]* путешественника/i, 'item:explorers-pack'],
  [/набор[а-яё]* уч[её]ного/i, 'item:scholars-pack'],
  [/набор[а-яё]* священника/i, 'item:priests-pack'],
  [/набор[а-яё]* дипломата/i, 'item:diplomats-pack'],
  [/набор[а-яё]* артиста/i, 'item:entertainers-pack'],
  [/набор[а-яё]* взломщика/i, 'item:burglars-pack'],
  [/лютн/i, 'item:lute'],
  [/колчан/i, 'item:quiver'],
];

function equipmentPart(text: string, lookup: ClassLookup): EquipmentPart {
  const clean = text
    .replace(/\([^)]*\)/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  const first = /^(\S+)\s+(.+)$/.exec(clean);
  let quantity = 1;
  let rest = clean;
  if (first?.[1] && first[2]) {
    const word = first[1].toLowerCase();
    const number = /^\d+$/.test(word) ? Number(word) : countWord(word);
    if (number) {
      quantity = number;
      rest = first[2];
    }
  }
  rest = rest.replace(/^(любое|любой|любая|любых|другой)\s+/i, '').replace(/\s+на ваш выбор$/i, '');
  const group = EQUIPMENT_GROUP_WORDS.find(([pattern]) => pattern.test(rest))?.[1] ?? null;
  const itemId = group
    ? null
    : (lookup.items.get(nameKey(rest)) ??
      EQUIPMENT_STEMS.find(([pattern]) => pattern.test(rest))?.[1] ??
      null);
  return { text, itemId, group, quantity };
}

/** «колчан с 20 стрелами» — колчан и 20 стрел. */
function splitContainer(part: string): string[] {
  const inner = /^(.+?)\s+с\s+(\d+\s+.+)$/.exec(part);
  return inner?.[1] && inner[2] && /колчан/i.test(inner[1]) ? [inner[1], inner[2]] : [part];
}

export function parseEquipmentLine(line: string, lookup: ClassLookup): EquipmentChoice {
  const options = line
    .split(/(?:^|,?\s+(?:или\s+)?)[абв]\)\s*/)
    .map((option) =>
      option
        .trim()
        .replace(/[,.]$/, '')
        .replace(/\s+или$/, ''),
    )
    .filter(Boolean);
  return {
    options: options.map((option) => ({
      parts: option
        .split(/,\s*|\s+и\s+/)
        .map((part) => part.trim())
        .filter(Boolean)
        .flatMap(splitContainer)
        .map((part) => equipmentPart(part, lookup)),
    })),
  };
}

// --- Особенности ---

function featureOf(raw: RawFeature, levels: number[]): ClassFeature {
  return {
    key: raw.key,
    nameRu: raw.nameRu,
    levels,
    optionalRule: raw.optional,
    blocks: raw.blocks,
    subsections: raw.subsections,
  };
}

/** Заклинательная характеристика из текста особенности «Использование заклинаний». */
function spellcastingAbility(feature: {
  blocks: ClassFeature['blocks'];
  subsections: ClassFeature['subsections'];
}): Ability | null {
  const text = [
    textBlocksToPlain(feature.blocks),
    ...feature.subsections.map((part) => `${part.name}. ${textBlocksToPlain(part.blocks)}`),
  ].join('\n');
  // «Базовая характеристика заклинаний» — подраздел или абзац; первая характеристика после него.
  const at = text.search(/Базовая характеристика заклинаний/i);
  if (at < 0) return null;
  // Первая по тексту, а не по списку: «…использует Мудрость. Сила ваших заклинаний…».
  const nearby = text.slice(at, at + 300);
  const first = ABILITY_STEMS.map(([pattern, ability]) => ({
    ability,
    index: nearby.search(pattern),
  }))
    .filter((entry) => entry.index >= 0)
    .sort((a, b) => a.index - b.index)[0];
  return first?.ability ?? null;
}

export interface NormalizedClass {
  data: ClassData;
  rules: ClassRules;
}

const summaryText = (page: RawClassPage, label: RegExp) =>
  page.summary.find((line) => label.test(line.label))?.text ?? '';

export function normalizeClass(
  page: RawClassPage,
  classId: string,
  lookup: ClassLookup,
): NormalizedClass {
  const textOnly: string[] = [];
  const table = parseTable(page.table);
  if (table.rows.length !== 20) {
    throw new ClassNormalizeError(`В таблице ${table.rows.length} строк вместо 20`);
  }
  const rows: ClassTableRow[] = table.rows.map(
    ({ proficiencyBonus, level, features, values, spellSlots }) => {
      if (proficiencyBonus === null) {
        throw new ClassNormalizeError(`Уровень ${level}: нет бонуса мастерства`);
      }
      return { level, proficiencyBonus, features, values, spellSlots };
    },
  );

  // Подкласс: ссылка «Умение пути» в строках таблицы ведёт на особенность выбора.
  const subclassKeys = new Map<string, number>();
  for (const row of table.rows) {
    for (const link of row.featureLinks) {
      if (/^Умени[ея]\s/i.test(link.text)) {
        subclassKeys.set(link.key, (subclassKeys.get(link.key) ?? 0) + 1);
      }
    }
  }
  const subclassKey = [...subclassKeys].sort((a, b) => b[1] - a[1])[0]?.[0];
  if (!subclassKey) throw new ClassNormalizeError('Нет строки «Умение …» подкласса в таблице');
  const subclassLevels = table.rows
    .filter((row) => row.features.includes(subclassKey))
    .map((row) => row.level);
  const subclassLabel =
    table.rows.flatMap((row) => row.featureLinks).find((link) => link.key === subclassKey)?.text ??
    page.subclassIntro.name;

  const features = page.features.map((raw) => {
    const levels = raw.key
      ? table.rows.filter((row) => row.features.includes(raw.key as string)).map((row) => row.level)
      : [];
    return featureOf(raw, levels.length > 0 ? levels : [raw.level]);
  });
  // Ссылки таблицы на списки вариантов и подразделы («metamagic-options») — не особенности.
  const known = new Set(features.map((feature) => feature.key));
  for (const row of rows) row.features = row.features.filter((key) => known.has(key));

  const hitDie = Number(/к(\d+)/.exec(summaryText(page, /^Кость хитов/i))?.[1] ?? NaN);
  const first = Number(/^(\d+)/.exec(summaryText(page, /^Хиты на 1/i))?.[1] ?? NaN);
  const perLevel = Number(
    /\(или (\d+)\)/.exec(summaryText(page, /^Хиты на следующих/i))?.[1] ?? NaN,
  );
  if (![hitDie, first, perLevel].every(Number.isFinite)) {
    throw new ClassNormalizeError('Не разобраны хиты класса');
  }

  const proficiencies = emptyProficiencies();
  for (const line of page.summary) {
    parseProficiencyLine(line.label, line.text, proficiencies, textOnly);
  }
  const savingThrows = found(summaryText(page, /^Спасброски/i), ABILITY_STEMS);
  const classSkills = proficiencies.skills.flatMap((choice) => choice.from ?? []);

  const goldLine = page.notes.find((note) => /Если вы откажетесь/i.test(note)) ?? '';
  const gold = /(\d+)к(\d+)\s*(?:[×x]\s*(\d+))?\s*зм/.exec(goldLine);
  const equipment = page.equipment.map((line) => parseEquipmentLine(line, lookup));
  for (const [index, choice] of equipment.entries()) {
    for (const part of choice.options.flatMap((option) => option.parts)) {
      if (!part.itemId && !part.group)
        textOnly.push(`Снаряжение: ${page.equipment[index]} — «${part.text}»`);
    }
  }

  const multiclassText = page.multiclass.map((block) =>
    block.type === 'paragraph' ? block.text : '',
  );
  const requirementLine = multiclassText.find((line) => /Минимальн/i.test(line)) ?? '';
  const requirements = parseRequirements(requirementLine);
  if (!requirements)
    throw new ClassNormalizeError(`Не разобраны требования мультикласса: «${requirementLine}»`);
  const gainedLine = multiclassText.find((line) => /Получаемые владения/i.test(line)) ?? '';
  const multiclassProficiencies = parseMulticlassProficiencies(gainedLine, classSkills, textOnly);

  const castingFeature = features.find(
    (feature) => feature.key === 'spellcasting' || feature.key === 'pact-magic',
  );
  const slotCount = rows.at(-1)?.spellSlots?.filter((slots) => slots > 0).length ?? 0;
  let spellcasting: ClassRules['spellcasting'] = null;
  if (castingFeature) {
    const ability = spellcastingAbility(castingFeature);
    if (!ability) throw new ClassNormalizeError('Нет заклинательной характеристики');
    spellcasting = {
      ability,
      progression:
        castingFeature.key === 'pact-magic'
          ? 'pact'
          : classId === 'class:artificer'
            ? 'artificer'
            : slotCount === 9
              ? 'full'
              : 'half',
      featureKey: castingFeature.key,
    };
  }

  const subclassFeature = features.find((feature) => feature.key === subclassKey);
  return {
    data: {
      schemaVersion: CLASS_SCHEMA_VERSION,
      intro: page.intro,
      sections: page.sections,
      summary: page.summary,
      equipment: page.equipment,
      notes: page.notes,
      multiclass: page.multiclass,
      table: {
        header: page.table.header,
        rows: page.table.rows.map((cells) => cells.map((cell) => cell.text)),
      },
      features,
      options: page.options,
      subclassIntro: page.subclassIntro,
    },
    rules: {
      schemaVersion: CLASS_RULES_SCHEMA_VERSION,
      hitDie,
      hitPointsFirstLevel: first,
      hitPointsPerLevel: perLevel,
      savingThrows,
      proficiencies,
      equipment,
      startingGold: gold
        ? { dice: `${gold[1]}d${gold[2]}`, multiplier: Number(gold[3] ?? 1) }
        : null,
      table: rows,
      spellcasting,
      subclass: {
        nameRu: subclassLabel,
        featureKey: subclassKey,
        level: subclassFeature?.levels[0] ?? subclassLevels[0] ?? 1,
        featureLevels: subclassLevels,
      },
      multiclass: { requirements, proficiencies: multiclassProficiencies },
      textOnly,
    },
  };
}

// --- Подкласс ---

/** Таблицы «Уровень жреца | Заклинания»: по столбцу на список (лунное чародейство, гений). */
function spellLists(sub: RawSubclass, lookup: ClassLookup, missing: string[]): SubclassSpellList[] {
  const lists: SubclassSpellList[] = [];
  for (const table of sub.tables) {
    if (!/^Уровень/i.test(table.header[0] ?? '')) continue;
    const spellColumns = table.header
      .map((_, index) => index)
      .filter(
        (index) => index > 0 && table.rows.some((row) => (row[index]?.spellPages.length ?? 0) > 0),
      );
    if (spellColumns.length === 0) continue;
    const levelKind = /заклинани/i.test(table.header[0] ?? '') ? 'spell' : 'class';
    for (const column of spellColumns) {
      const rows = table.rows.flatMap((row) => {
        const level = Number(/(\d+)/.exec(row[0]?.text ?? '')?.[1] ?? NaN);
        const spellIds = (row[column]?.spellPages ?? []).flatMap((page) => {
          const id = lookup.spellsByPage.get(page);
          if (!id) missing.push(`/spells/${page}-…/`);
          return id ? [id] : [];
        });
        return Number.isFinite(level) && level >= 1 && level <= 20 && spellIds.length > 0
          ? [{ level, spellIds: [...new Set(spellIds)] }]
          : [];
      });
      if (rows.length === 0) continue;
      lists.push({
        name: spellColumns.length > 1 ? (table.header[column] ?? null) : table.caption,
        levelKind,
        rows,
      });
    }
  }
  return lists;
}

export interface NormalizedSubclass {
  data: SubclassData;
  rules: SubclassRules;
  /** Ссылки на заклинания, которых нет в каталоге этой сборки. */
  missingSpells: string[];
}

export function normalizeSubclass(
  sub: RawSubclass,
  classId: SubclassRules['subclassOf'],
  lookup: ClassLookup,
): NormalizedSubclass {
  const missingSpells: string[] = [];
  const features = sub.features.map((raw) => featureOf(raw, [raw.level]));
  const casting = features.find((feature) => /^Использование заклинаний$/i.test(feature.nameRu));
  const slotTable = sub.tables.find((table) =>
    table.header.some((name) => /^Ячейки \d$/.test(name)),
  );
  let spellcasting: SubclassRules['spellcasting'] = null;
  let spellTable: SubclassRules['spellTable'] = null;
  if (casting && slotTable) {
    const ability = spellcastingAbility(casting);
    if (!ability)
      throw new ClassNormalizeError(`«${sub.nameRu}»: нет заклинательной характеристики`);
    spellcasting = { ability, progression: 'third', featureKey: null };
    spellTable = parseTable(slotTable).rows.map(({ level, values, spellSlots }) => ({
      level,
      values,
      spellSlots,
    }));
  }
  return {
    data: {
      schemaVersion: SUBCLASS_SCHEMA_VERSION,
      intro: sub.intro,
      features,
      sections: sub.sections,
    },
    rules: {
      schemaVersion: SUBCLASS_RULES_SCHEMA_VERSION,
      subclassOf: classId,
      spellLists: spellLists(sub, lookup, missingSpells),
      spellcasting,
      spellTable,
      textOnly: [],
    },
    missingSpells,
  };
}
