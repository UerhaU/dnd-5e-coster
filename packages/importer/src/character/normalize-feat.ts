import {
  ABILITIES,
  CLASS_IDS,
  CLASS_NAMES_RU,
  FEAT_RULES_SCHEMA_VERSION,
  FEAT_SCHEMA_VERSION,
  type AbilityId,
  type FeatData,
  type FeatRequirement,
  type FeatRules,
  type TextBlock,
} from '@koster/shared';
import {
  countIn,
  found,
  SKILL_STEMS,
  TOOL_GROUP_WORDS,
  TOOL_STEMS,
} from '../races/parse-race-rules.ts';
import { nameKey } from '../reviewed/reviewed-items.ts';
import type { RawCardPage } from './parse-background-page.ts';
import { skillOrToolChoice } from './proficiency-choices.ts';

// Шаг normalize (раздел 6) для черт: строка «Требование» → `prerequisites`, пункты
// описания → увеличение характеристик, владения, заклинания (feat-rules/v1). Разбираются
// только устойчивые формулировки; выбор, который не записан данными, — в `textOnly`.
// В выражениях вместо `\b` — `(?![а-яё])`: в JavaScript он не знает кириллицы.

/** По чему ищутся цели требований и заклинания: объекты этой же сборки. */
export interface FeatLookup {
  /** Раса или разновидность по названию: «Эльф», «Эльф (дроу)» → ID; `null` — не нашлась. */
  race(name: string): string | null;
  /** Черта по названию (`nameKey`) → ID. */
  feats: Map<string, string>;
  /** Предыстория по названию (`nameKey`) → ID. */
  backgrounds: Map<string, string>;
  /** Заклинание по английскому названию (`nameKey`) → ID. */
  spells: Map<string, string>;
}

/** Характеристика в именительном и родительном падеже: «Сила», «Силы». */
const ABILITY_WORDS: [RegExp, AbilityId][] = [
  [/(?<![а-яё])Сил[аыу](?![а-яё])/i, 'str'],
  [/Ловкост[ьи](?! рук)/i, 'dex'],
  [/Телосложени[ея]/i, 'con'],
  [/Интеллект/i, 'int'],
  [/Мудрост[ьи]/i, 'wis'],
  [/Харизм[аы]/i, 'cha'],
];

const ABILITY_NAMES = ABILITIES.map((entry) => entry.nameRu).join('|');
/** «Интеллект или Мудрость 13 или выше». */
const ABILITY_REQUIREMENT = new RegExp(
  `((?:${ABILITY_NAMES})(?:\\s*(?:,|или)\\s*(?:${ABILITY_NAMES}))*)\\s+(\\d+)\\s+или выше`,
);

const CLASS_BY_NAME = new Map(CLASS_IDS.map((id) => [nameKey(CLASS_NAMES_RU[id]), id]));

const skillId = (code: string) => `skill:${code.replace(/_/g, '-')}`;

const sentences = (text: string) => text.split(/(?<=[.!?])\s+/);

/** Делит строку по запятым и «или» вне «кавычек» и (скобок). */
function splitTokens(text: string): string[] {
  const tokens: string[] = [];
  let depth = 0;
  let current = '';
  for (let i = 0; i < text.length; i += 1) {
    const char = text[i] ?? '';
    if (char === '«' || char === '(') depth += 1;
    if (char === '»' || char === ')') depth = Math.max(0, depth - 1);
    const rest = text.slice(i);
    if (depth === 0 && (char === ',' || /^\s+или\s+/.test(rest))) {
      tokens.push(current);
      current = '';
      if (char !== ',') i += (/^\s+или\s+/.exec(rest)?.[0].length ?? 1) - 1;
      continue;
    }
    current += char;
  }
  tokens.push(current);
  return tokens.map((token) => token.trim()).filter(Boolean);
}

/** «черта «Удар Великанов (Штормовой удар)»» → название и вариант в скобках. */
function quoted(token: string): { name: string; option: string | null } | null {
  const match = /«(.+?)»(?:\s*\((.+?)\))?/.exec(token);
  if (!match?.[1]) return null;
  const inner = /^(.*?)\s*\((.+)\)$/.exec(match[1]);
  return {
    name: (inner?.[1] ?? match[1]).replace(/\s+/g, ' ').trim(),
    option: inner?.[2]?.trim() ?? match[2]?.trim() ?? null,
  };
}

type Prefix = 'feat' | 'background' | 'feature' | null;

function requirementOf(
  token: string,
  prefix: Prefix,
  lookup: FeatLookup,
): { requirement: FeatRequirement; prefix: Prefix } {
  const text = { requirement: { kind: 'text', text: token } as FeatRequirement, prefix };
  if (/способност[а-яё]* накладывать/i.test(token)) {
    return { requirement: { kind: 'spellcasting' }, prefix: null };
  }
  const armor = /владение (л[её]гк|средн|тяж[её]л)[а-яё]* доспех/i.exec(token);
  if (armor?.[1]) {
    const kind = /^л/.test(armor[1]) ? 'light' : /^с/.test(armor[1]) ? 'medium' : 'heavy';
    return { requirement: { kind: 'armor', armor: kind }, prefix: null };
  }
  if (/владение [^«]*воинск[а-яё]* оружи/i.test(token)) {
    return { requirement: { kind: 'weapon', category: 'martial' }, prefix: null };
  }
  if (/^Маленькая раса$/i.test(token)) {
    return { requirement: { kind: 'size', size: 'small' }, prefix: null };
  }
  const own: Prefix = /^черт/i.test(token)
    ? 'feat'
    : /^предыстори/i.test(token)
      ? 'background'
      : /^умени/i.test(token)
        ? 'feature'
        : /^«/.test(token)
          ? prefix
          : null;
  const named = quoted(token);
  if (named) {
    if (
      own === 'feature' ||
      (own === null && /Использование заклинаний|Магия договора/.test(token))
    ) {
      if (/Использование заклинаний/.test(named.name)) {
        return {
          requirement: { kind: 'class_feature', feature: 'spellcasting' },
          prefix: 'feature',
        };
      }
      if (/Магия договора/.test(named.name)) {
        return { requirement: { kind: 'class_feature', feature: 'pact_magic' }, prefix: 'feature' };
      }
      return text;
    }
    const feat = lookup.feats.get(nameKey(named.name));
    const background = lookup.backgrounds.get(nameKey(named.name));
    if (own !== 'background' && feat) {
      return { requirement: { kind: 'feat', id: feat, option: named.option }, prefix: 'feat' };
    }
    if (own !== 'feat' && background) {
      return { requirement: { kind: 'background', id: background }, prefix: 'background' };
    }
    return text;
  }
  const classId = CLASS_BY_NAME.get(nameKey(token));
  if (classId) return { requirement: { kind: 'class', id: classId }, prefix: null };
  const race = lookup.race(token);
  if (race) return { requirement: { kind: 'race', id: race }, prefix: null };
  return text;
}

/** «4 уровень, черта «X»» → [[level], [feat]]: уровень, кампания и характеристики — свои группы. */
export function parsePrerequisites(line: string, lookup: FeatLookup): FeatRules['prerequisites'] {
  const groups: FeatRules['prerequisites'] = [];
  for (const segment of line.split(';')) {
    let rest = segment;
    const ability = ABILITY_REQUIREMENT.exec(rest);
    if (ability?.[1] && ability[2]) {
      const min = Number(ability[2]);
      groups.push(
        found(ability[1], ABILITY_WORDS).map((id) => ({ kind: 'ability', ability: id, min })),
      );
      rest = rest.replace(ability[0], '');
    }
    const anyOf: FeatRequirement[] = [];
    let prefix: Prefix = null;
    for (const token of splitTokens(rest)) {
      const level = /^(\d+)\s*уров/.exec(token);
      if (level) {
        groups.push([{ kind: 'level', min: Number(level[1]) }]);
        continue;
      }
      if (/^кампани/i.test(token)) {
        if (/Planescape/i.test(token)) groups.push([{ kind: 'campaign', setting: 'planescape' }]);
        else if (/Копь|Кринн|Dragonlance/i.test(token)) {
          groups.push([{ kind: 'campaign', setting: 'dragonlance' }]);
        } else groups.push([{ kind: 'text', text: token }]);
        continue;
      }
      const parsed = requirementOf(token, prefix, lookup);
      prefix = parsed.prefix;
      anyOf.push(parsed.requirement);
    }
    if (anyOf.length > 0) groups.push(anyOf);
  }
  return groups;
}

/** Пункты и абзацы описания и разделов — по одному тексту. */
function linesOf(blocks: readonly TextBlock[]): string[] {
  return blocks.flatMap((block) => {
    if (block.type === 'paragraph' || block.type === 'quote') return [block.text];
    if (block.type === 'list') return block.items;
    return [];
  });
}

function parseAbilityIncrease(sentence: string, rules: FeatRules): boolean {
  const match = /Увеличьте значение (.+?) на (\d)/.exec(sentence);
  if (!match?.[1]) return false;
  const amount = Number(match[2]);
  if (/выбранной|по вашему выбору|на ваш выбор/.test(match[1])) {
    rules.abilityIncrease.choices.push({ count: 1, amount, from: null, except: [] });
    return true;
  }
  const abilities = found(match[1], ABILITY_WORDS);
  if (abilities.length === 1 && abilities[0]) {
    rules.abilityIncrease.fixed.push({ ability: abilities[0], amount });
  } else if (abilities.length > 1) {
    rules.abilityIncrease.choices.push({ count: 1, amount, from: abilities, except: [] });
  } else return false;
  return true;
}

function parseProficiencies(sentence: string, rules: FeatRules): void {
  const lower = sentence.toLowerCase();
  if (/владение спасброск/.test(lower)) rules.savingThrows = 'chosen_ability';
  if (!/владени|бегло говорить|узна[её]те [^.]*язык/.test(lower)) return;
  if (/л[её]гк[а-яё]* доспех/.test(lower)) rules.armor.push('light');
  if (/средн[а-яё]* доспех/.test(lower)) rules.armor.push('medium');
  if (/тяж[её]л[а-яё]* доспех/.test(lower)) rules.armor.push('heavy');
  if (/доспех[а-яё]* и щит|владение щит/.test(lower)) rules.armor.push('shield');
  if (/импровизированн[а-яё]* оружи/.test(lower)) rules.weapons.groups.push('improvised');
  if (/огнестрельн[а-яё]* оружи/.test(lower)) rules.weapons.groups.push('firearms');
  const weaponChoice = /владение (\S+) выбранными видами оружия/.exec(lower);
  if (weaponChoice) {
    const categories: ('simple' | 'martial')[] = [];
    if (/прост/.test(lower)) categories.push('simple');
    if (/воинск/.test(lower)) categories.push('martial');
    rules.weapons.choices.push({
      count: /^четыр/.test(weaponChoice[1] ?? '') ? 4 : (countIn(weaponChoice[1] ?? '') ?? 1),
      categories: categories.length > 0 ? categories : ['simple', 'martial'],
    });
  }

  const mixed = skillOrToolChoice(sentence, countIn(sentence));
  if (mixed) {
    rules.mixed.push(mixed);
    return;
  }
  // «владение одним навыком на выбор, владение одним набором инструментов на выбор и …
  // на одном языке на ваш выбор»: части строки — по отдельности.
  for (const clause of sentence.split(/,\s+|\s+и\s+(?=обучаетесь|владение|получаете)/)) {
    const part = clause.toLowerCase();
    if (/навык/.test(part)) {
      const skills = found(clause, SKILL_STEMS).map(skillId);
      if (/выбор/.test(part)) {
        rules.skills.choices.push({
          count: countIn(part) ?? 1,
          from: skills.length > 1 ? skills : null,
        });
      } else rules.skills.fixed.push(...skills);
    } else if (/инструмент|набор/.test(part)) {
      const tools = found(part, TOOL_STEMS);
      const group = TOOL_GROUP_WORDS.find(([pattern]) => pattern.test(part))?.[1] ?? null;
      if (/выбор/.test(part)) {
        rules.tools.choices.push({
          count: countIn(part) ?? 1,
          from: tools.length > 0 ? tools : null,
          group: tools.length > 0 ? null : group,
        });
      } else rules.tools.fixed.push(...tools);
    } else if (/язык/.test(part) && /выбор/.test(part)) {
      rules.languages.choose += countIn(part) ?? 1;
    }
  }
}

/** «Вы узнаёте заклинание невидимость [invisibility] и одно заклинание … на выбор» → невидимость. */
function parseSpells(sentence: string, rules: FeatRules, lookup: FeatLookup): void {
  if (
    !/(узна[её]те|изучаете|наложить|накладывать)( на себя)?( следующие)? (заговор|заклинани)/i.test(
      sentence,
    )
  ) {
    return;
  }
  const fixedPart =
    sentence.split(/\s+и\s+одн[оу]|по (вашему|своему) выбору|на (ваш|свой) выбор/)[0] ?? '';
  for (const match of fixedPart.matchAll(/\[([^\]]+)\]/g)) {
    const id = lookup.spells.get(nameKey(match[1] ?? ''));
    if (id && !rules.spells.includes(id)) rules.spells.push(id);
  }
}

/** Выбор, который механикой не записан: заклинание на выбор, компетентность, класс. */
const UNWRITTEN_CHOICE =
  /(выбор|Выберите)[^.]*(заклинани|заговор|навык|инструмент|язык|владени|компетентн|класс|при[её]м)|(заклинани|заговор|навык|инструмент|язык|владени|компетентн|при[её]м)[^.]*(выбор)/i;

export function normalizeFeat(
  raw: RawCardPage,
  lookup: FeatLookup,
): { data: FeatData; rules: FeatRules } {
  const prerequisite =
    raw.params.find((line) => /^Требовани/.test(line.label))?.text.replace(/;\s*$/, '') ?? null;
  const data: FeatData = {
    schemaVersion: FEAT_SCHEMA_VERSION,
    prerequisite: prerequisite || null,
    description: raw.preface,
    sections: raw.sections.map((section) => ({ name: section.name, blocks: section.blocks })),
  };
  const rules: FeatRules = {
    schemaVersion: FEAT_RULES_SCHEMA_VERSION,
    prerequisites: prerequisite ? parsePrerequisites(prerequisite, lookup) : [],
    abilityIncrease: { fixed: [], choices: [] },
    armor: [],
    weapons: { groups: [], choices: [] },
    skills: { fixed: [], choices: [] },
    tools: { fixed: [], choices: [] },
    mixed: [],
    languages: { fixed: [], choose: 0 },
    savingThrows: null,
    spells: [],
    textOnly: [],
  };

  const lines = [...linesOf(raw.preface), ...raw.sections.flatMap((s) => linesOf(s.blocks))];
  for (const line of lines) {
    for (const sentence of sentences(line)) {
      const before = JSON.stringify(rules);
      parseAbilityIncrease(sentence, rules);
      parseProficiencies(sentence, rules);
      parseSpells(sentence, rules, lookup);
      const yielded = JSON.stringify(rules) !== before;
      // «…заклинание невидимость и одно заклинание 1-го уровня на выбор»: выбор — текстом.
      const spellChoice = /одн[оу] (заклинани|заговор)[^.]*выбор/.test(sentence);
      if (
        (!yielded || spellChoice) &&
        UNWRITTEN_CHOICE.test(sentence) &&
        /^Вы |^Выберите|^Кроме того/.test(sentence)
      ) {
        rules.textOnly.push(sentence);
      }
    }
  }
  rules.armor = [...new Set(rules.armor)];
  rules.weapons.groups = [...new Set(rules.weapons.groups)];
  rules.skills.fixed = [...new Set(rules.skills.fixed)];
  rules.tools.fixed = [...new Set(rules.tools.fixed)];
  return { data, rules };
}

/** Все английские названия в квадратных скобках — упоминания заклинаний (таблицы, текст). */
export function mentionedSpells(raw: RawCardPage, lookup: FeatLookup): string[] {
  const text = JSON.stringify([raw.preface, raw.sections]);
  const ids = [...text.matchAll(/\[([^\]"]+)\]/g)]
    .map((match) => lookup.spells.get(nameKey(match[1] ?? '')))
    .filter((id): id is string => Boolean(id));
  return [...new Set(ids)];
}
