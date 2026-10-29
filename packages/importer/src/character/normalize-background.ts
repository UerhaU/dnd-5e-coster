import type { BackgroundData, BackgroundRules, BackgroundSection, TextBlock } from '@koster/shared';
import { nameKey } from '../reviewed/reviewed-items.ts';
import {
  countIn,
  found,
  SKILL_STEMS,
  TOOL_GROUP_WORDS,
  TOOL_STEMS,
} from '../races/parse-race-rules.ts';
import type { RawCardPage, RawLabeled, RawSection, RawTable } from './parse-background-page.ts';

// Шаг normalize (раздел 6) для предысторий: строки «Владение …», «Языки»,
// «Снаряжение» → механика background-rules/v1; разделы → background/v1.
// Чего нельзя честно описать данными — в `textOnly` (строка как на сайте).

/** Каталог, по которому сопоставляются названия: языки и предметы этой же сборки. */
export interface BackgroundLookup {
  /** Основа названия языка (5 букв, без «язык») → ID; неоднозначные основы не попадают. */
  languageStems: Map<string, string>;
  /**
   * Полное название языка или синоним (`nameKey`) → ID, длинные — первыми: ищутся до основ
   * («Глубинная речь» — основа «глуби» общая с «Языком глубинных воронов»).
   */
  languageNames: [name: string, id: string][];
  /** Название предмета (`nameKey`) → ID. */
  items: Map<string, string>;
  /** Начало части строки → ID (data/reviewed/character/equipment.json), длинные — первыми. */
  phrases: [phrase: string, id: string][];
}

const SKILL_LABEL = /^(Владение навыками|Навыки)$/;
const TOOL_LABEL = /^Владение инструментами$/;
const LANGUAGE_LABEL = /^(Владение языками|Языки)$/;
const EQUIPMENT_LABEL = /^Снаряжение$/;
const CHOICE = /выбор|Выберите|один из|одного из|любой|любых/i;

const PERSONALITY: [RegExp, keyof BackgroundData['personality']][] = [
  [/^Черт[аы] характера/, 'traits'],
  [/^Идеал/, 'ideals'],
  [/^Привязанност/, 'bonds'],
  [/^Слабост/, 'flaws'],
];

const COINS: Record<string, number> = { мм: 1, см: 10, эм: 50, зм: 100, пм: 1000 };

const skillId = (code: string) => `skill:${code.replace(/_/g, '-')}`;

/** Найденное по основам слов — с позицией в тексте: что до слова выбора, то постоянное. */
function positioned<T>(text: string, table: [RegExp, T][]): { value: T; at: number }[] {
  return table
    .map(([pattern, value]) => ({ value, at: text.search(pattern) }))
    .filter((entry) => entry.at >= 0)
    .sort((a, b) => a.at - b.at);
}

function parseSkills(line: RawLabeled, rules: BackgroundRules): void {
  const all = positioned(line.text, SKILL_STEMS);
  const pick = /Выберите (\S+) навык[а-яё]* из/.exec(line.text);
  if (pick) {
    rules.skills.choices.push({
      count: countIn(pick[1] ?? '') ?? 1,
      from: all.map((entry) => skillId(entry.value)),
    });
    return;
  }
  const choiceAt = line.text.search(/(плюс )?(и )?(один|одного) (навык|из)/);
  if (choiceAt < 0) {
    rules.skills.fixed.push(...all.map((entry) => skillId(entry.value)));
    return;
  }
  rules.skills.fixed.push(...all.filter((e) => e.at < choiceAt).map((e) => skillId(e.value)));
  const options = all.filter((entry) => entry.at > choiceAt).map((e) => skillId(e.value));
  rules.skills.choices.push({ count: 1, from: options.length > 1 ? options : null });
  // «один из навыков Интеллекта…», «навык, ассоциируемый с фракцией»: условие — только текстом.
  if (options.length < 2) rules.textOnly.push(`${line.label}: ${line.text}`);
}

/** Строка «Владение инструментами»; экспорт — для теста. */
export function parseTools(line: RawLabeled, rules: BackgroundRules): void {
  const text = line.text.replace(/\.$/, '');
  // «транспорт (водный, наземный)»: запятая в скобках не делит строку.
  const parts = splitOutsideParens(text);
  const unknown: string[] = [];
  for (const part of parts) {
    const lower = part.toLowerCase();
    if (/транспорт/.test(lower)) {
      if (/водн/.test(lower)) rules.vehicles.push('water');
      if (/наземн|сухопутн/.test(lower)) rules.vehicles.push('land');
      continue;
    }
    const tools = found(lower, TOOL_STEMS);
    const groups = TOOL_GROUP_WORDS.filter(([pattern]) => pattern.test(lower));
    // Число — вне скобок: «один игровой набор (например, … ставка трёх драконов)» — один.
    const count = countIn(lower.replace(/\([^)]*\)/g, '')) ?? 1;
    if (groups.length > 1 || (groups.length > 0 && tools.length > 0)) {
      // «музыкальный инструмент или ремесленные инструменты» — смешанный выбор.
      rules.mixed.push({
        count,
        from: [
          ...tools.map((id) => ({ kind: 'tool' as const, id })),
          ...groups.flatMap(([, group]) => (group ? [{ kind: 'tool_group' as const, group }] : [])),
        ],
      });
      continue;
    }
    if (groups[0]) {
      rules.tools.choices.push({ count, from: null, group: groups[0][1] });
    } else if (tools.length > 1 && /или|выбор/.test(lower)) {
      rules.tools.choices.push({ count: 1, from: tools, group: null });
    } else if (tools.length > 0) {
      rules.tools.fixed.push(...tools);
    } else if (part.trim()) {
      unknown.push(part);
    }
  }
  // Неразобранная часть рядом с разобранной — пояснение («…на ваш выбор, скорее всего,
  // что-то свойственное на вашей родине»), а не отдельное условие: строка видна в сводке.
  if (unknown.length === parts.length) {
    rules.textOnly.push(...unknown.map((part) => `${line.label}: ${part}`));
  }
}

function languagesIn(text: string, lookup: BackgroundLookup): { id: string; at: number }[] {
  const result: { id: string; at: number }[] = [];
  const add = (id: string | undefined, at: number) => {
    if (id && !result.some((entry) => entry.id === id)) result.push({ id, at });
  };
  // Найденное полное название закрывается пробелами: его слова не ищутся по основам.
  // Та же длина, что у `text`: позиции сравниваются со словом выбора.
  let rest = text.toLowerCase().replaceAll('ё', 'е');
  for (const [name, id] of lookup.languageNames) {
    const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/ /g, '\\s+');
    const match = new RegExp(`(?<![а-я])${escaped}(?![а-я])`).exec(rest);
    if (!match) continue;
    add(id, match.index);
    rest =
      rest.slice(0, match.index) +
      ' '.repeat(match[0].length) +
      rest.slice(match.index + match[0].length);
  }
  for (const word of rest.matchAll(/[а-я][а-я-]+/g)) {
    add(lookup.languageStems.get(word[0].slice(0, 5)), word.index);
  }
  return result.sort((a, b) => a.at - b.at);
}

function parseLanguages(line: RawLabeled, rules: BackgroundRules, lookup: BackgroundLookup) {
  // Рекомендации («рекомендуется Небесный») — подсказка, а не ограничение выбора.
  const text = line.text.replace(/\((рекоменд[^)]*)\)/g, '').trim();
  const languages = languagesIn(text, lookup);
  const choiceAt = text.search(CHOICE);
  if (choiceAt < 0) {
    rules.languages.fixed.push(...languages.map((entry) => entry.id));
    return;
  }
  const count = countIn(text) ?? 1;
  // «два языка, один из которых должен быть Бездны, …» — 1 из списка + остальные любые.
  if (/один из которых/i.test(text) && languages.length > 1) {
    rules.languages.choices.push({ count: 1, from: languages.map((entry) => entry.id) });
    if (count > 1) rules.languages.choices.push({ count: count - 1, from: null });
    return;
  }
  const listed = /Выберите|один из|на выбор \(/.test(text);
  if (listed && languages.length > 1) {
    rules.languages.choices.push({ count, from: languages.map((entry) => entry.id) });
    if (/должен/.test(text)) rules.textOnly.push(`${line.label}: ${line.text}`);
    return;
  }
  const fixed = languages.filter((entry) => entry.at < choiceAt).map((entry) => entry.id);
  rules.languages.fixed.push(...fixed);
  const after = text.slice(choiceAt);
  rules.languages.choices.push({
    count: countIn(after) ?? (fixed.length > 0 ? 1 : count),
    from: null,
  });
  if (/если|должен/.test(text)) rules.textOnly.push(`${line.label}: ${line.text}`);
}

/** Части строки снаряжения: запятые вне скобок. */
function splitOutsideParens(text: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let current = '';
  for (const char of text) {
    if (char === '(') depth += 1;
    if (char === ')') depth = Math.max(0, depth - 1);
    if (char === ',' && depth === 0) {
      parts.push(current);
      current = '';
    } else current += char;
  }
  parts.push(current);
  return parts.map((part) => part.trim().replace(/\.$/, '')).filter(Boolean);
}

/**
 * Продолжение части после запятой: придаточное («…, которым вы владеете», «…, на которой
 * отмечено…», «…, чтобы…») или причастный оборот («…, напоминающие вам о доме»,
 * «…, украшенное в стиле…»).
 */
const CLAUSE_START =
  /^((\S+\s+)?котор|(чтобы|такой как|такая как|такие как|битком)(?![а-яё])|[а-яё]+(ющ|ящ|ащ|ущ)(ий|ая|ее|ие|их|ую)(?![а-яё])|[а-яё]+[её]нн(ый|ая|ое|ые)\s+(в|во|на|с|из|для)\s)/i;

/** Части строки снаряжения: «;» и запятые вне скобок; придаточное остаётся в своей части. */
export function equipmentParts(text: string): string[] {
  const parts: string[] = [];
  for (const segment of text.split(/\s*;\s*/)) {
    const start = parts.length;
    for (const part of splitOutsideParens(segment)) {
      if (parts.length > start && CLAUSE_START.test(part)) parts[parts.length - 1] += `, ${part}`;
      else parts.push(part);
    }
  }
  return parts;
}

function itemFor(text: string, lookup: BackgroundLookup): string | null {
  // Придаточное после запятой («рожок, которым можно позвать на помощь») — не название.
  const head = text.replace(/\([^)]*\)/g, ' ').split(',')[0] ?? '';
  const plain = nameKey(head.replace(/^(и|а также)\s+/, ''));
  return (
    lookup.items.get(plain) ??
    lookup.phrases.find(([phrase]) => plain === phrase || plain.startsWith(`${phrase} `))?.[1] ??
    null
  );
}

const COIN_WORDS: [RegExp, number][] = [
  [/^медн/, 1],
  [/^серебр/, 10],
  [/^электрум/, 50],
  [/^золот/, 100],
  [/^платин/, 1000],
];

/**
 * Деньги части в медных: «кошель с 5 зм», «мешочек с 5 золотыми монетами». Цена предмета
 * («украшение стоимостью 10 зм», «самоцвет стоимостью 10 золотых монет») — не деньги.
 */
export function coinsIn(part: string): number | null {
  let total: number | null = null;
  const amounts = part.matchAll(/(\d+)\s*(?:(мм|см|эм|зм|пм)(?![а-яё])|([а-яё]+)\s+монет)/gi);
  for (const match of amounts) {
    if (/стоимост[а-яё]*\s*$/i.test(part.slice(0, match.index))) continue;
    const word = match[3]?.toLowerCase();
    const rate = match[2]
      ? COINS[match[2]]
      : COIN_WORDS.find(([pattern]) => word && pattern.test(word))?.[1];
    if (rate) total = (total ?? 0) + Number(match[1]) * rate;
  }
  return total;
}

function parseEquipment(line: RawLabeled, rules: BackgroundRules, lookup: BackgroundLookup) {
  let coins: number | null = null;
  for (const raw of equipmentParts(line.text)) {
    for (const part of raw.split(/\s+и\s+(?=[а-яё]+\s+с\s+\d|кошел|поясн)/i)) {
      const money = coinsIn(part);
      if (money !== null) coins = (coins ?? 0) + money;
      const text = part.replace(/^(и|а также)\s+/i, '').trim();
      if (!text) continue;
      const count = /^(\d+)\s+(?!фут)/.exec(text);
      rules.equipment.items.push({
        text,
        itemId: itemFor(count ? text.slice(count[0].length) : text, lookup),
        quantity: count ? Number(count[1]) : 1,
      });
    }
  }
  rules.equipment.coinsCp = coins;
}

function personalityTable(table: RawTable): { key: keyof BackgroundData['personality'] } | null {
  const column = table.header[1] ?? '';
  const match = PERSONALITY.find(([pattern]) => pattern.test(column));
  return match ? { key: match[1] } : null;
}

function sectionOf(section: RawSection, name = section.name): BackgroundSection {
  // «НОМЕРА АРТИСТА» → «Номера артиста»; смешанный регистр («Поступивший в ЛОРХОЛД») не трогается.
  const shouted = name === name.toUpperCase();
  const nice = shouted ? name.charAt(0) + name.slice(1).toLowerCase() : name;
  return { name: nice, blocks: section.blocks };
}

export interface NormalizedBackground {
  data: BackgroundData;
  rules: BackgroundRules;
}

export function normalizeBackground(
  page: RawCardPage,
  lookup: BackgroundLookup,
): NormalizedBackground {
  const rules: BackgroundRules = {
    schemaVersion: 'background-rules/v1',
    skills: { fixed: [], choices: [] },
    tools: { fixed: [], choices: [] },
    mixed: [],
    vehicles: [],
    languages: { fixed: [], choices: [] },
    equipment: { items: [], coinsCp: null },
    textOnly: [],
  };
  const personality: BackgroundData['personality'] = {
    traits: null,
    ideals: null,
    bonds: null,
    flaws: null,
  };
  const tables = [...page.tables, ...page.sections.flatMap((section) => section.tables)];
  for (const table of tables) {
    const kind = personalityTable(table);
    if (!kind || personality[kind.key]) continue;
    personality[kind.key] = {
      die: table.header[0] || null,
      rows: table.rows.map((row) => row.slice(1).join(' ').trim()).filter(Boolean),
    };
  }

  // Обычно строки владений — до первого раздела; у части страниц (Утгардт) — внутри него.
  const labeled = page.labeled.length > 0 ? page.labeled : page.sections.flatMap((s) => s.labeled);
  for (const line of labeled) {
    if (SKILL_LABEL.test(line.label)) parseSkills(line, rules);
    else if (TOOL_LABEL.test(line.label)) parseTools(line, rules);
    else if (LANGUAGE_LABEL.test(line.label)) parseLanguages(line, rules, lookup);
    else if (EQUIPMENT_LABEL.test(line.label)) parseEquipment(line, rules, lookup);
  }
  rules.vehicles = [...new Set(rules.vehicles)];

  let feature: BackgroundSection | null = null;
  const variants: BackgroundSection[] = [];
  const sections: BackgroundSection[] = [];
  for (const section of page.sections) {
    const featureName = /^Умение:\s*(.+)$/i.exec(section.name)?.[1];
    const variantName = /^Разновидность[^:]*:\s*(.+)$/i.exec(section.name)?.[1];
    if (featureName && !feature) feature = sectionOf(section, featureName.trim());
    else if (variantName) variants.push(sectionOf(section, variantName.trim()));
    else sections.push(sectionOf(section));
  }

  const proficient = labeled.some(
    (line) => SKILL_LABEL.test(line.label) || LANGUAGE_LABEL.test(line.label),
  );
  const intro: TextBlock[] = page.intro;
  return {
    data: {
      schemaVersion: 'background/v1',
      kind: proficient ? 'background' : 'adaptation',
      intro,
      summary: labeled.map((line) => ({ label: line.label, text: line.text })),
      feature,
      personality,
      variants,
      sections,
    },
    rules,
  };
}
