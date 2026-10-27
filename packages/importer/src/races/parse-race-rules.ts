import {
  RACE_RULES_SCHEMA_VERSION,
  textBlocksToPlain,
  type AbilityOption,
  type RaceRules,
} from '@koster/shared';
import type { RawFeature } from './parse-race-page.ts';

// Механика расы из текста особенностей DnD.su (race-rules/v1). Разбираются только
// устойчивые формулировки; что не разобрано — `null` и запись в отчёт, особые умения
// остаются текстом (`textOnly`). Ветвлений по названию расы нет: только по тексту.
// В выражениях вместо `\w` и `\b` — `[а-яё]`: в JavaScript они не знают кириллицы.

type Ability = AbilityOption['fixed'][number]['ability'];
type Skill = RaceRules['skills']['fixed'][number];
type Language = RaceRules['languages']['fixed'][number];
type DamageType = RaceRules['resistances'][number];

const ABILITY_STEMS: [RegExp, Ability][] = [
  [/Сил[аыу]/, 'str'],
  [/Ловкост/, 'dex'],
  [/Телосложени/, 'con'],
  [/Интеллект/, 'int'],
  [/Мудрост/, 'wis'],
  [/Харизм/, 'cha'],
];
const ALL_ABILITIES: Ability[] = ['str', 'dex', 'con', 'int', 'wis', 'cha'];

const COUNT_WORDS: [RegExp, number][] = [
  [/(?<![а-яё])(тр[её]х|тремя|три)(?![а-яё])/i, 3],
  [/(?<![а-яё])(двух|двум|двумя|две|два)(?![а-яё])/i, 2],
  [/(?<![а-яё])(одн(ой|ого|ом|им|у)|другой)(?![а-яё])/i, 1],
];

const SIZE_WORDS: [RegExp, NonNullable<RaceRules['size']>[number]][] = [
  [/Крошечн/i, 'tiny'],
  [/Маленьк/i, 'small'],
  [/Средн/i, 'medium'],
  [/Больш/i, 'large'],
];

const CREATURE_WORDS: [RegExp, NonNullable<RaceRules['creatureType']>][] = [
  [/гуманоид/i, 'humanoid'],
  [/(?<![а-яё])фе(я|ей|и)(?![а-яё])/i, 'fey'],
  [/конструкт/i, 'construct'],
  [/слиз/i, 'ooze'],
  [/монстр/i, 'monstrosity'],
  [/нежит/i, 'undead'],
];

const SKILL_STEMS: [RegExp, Skill][] = [
  [/Акробатик/, 'acrobatics'],
  [/Уход[а-яё]* за животными/, 'animal_handling'],
  [/Маги[яюи](?![а-яё])/, 'arcana'],
  [/Атлетик/, 'athletics'],
  [/Обман/, 'deception'],
  [/Истори[яюи](?![а-яё])/, 'history'],
  [/Проницательност/, 'insight'],
  [/Запугивани/, 'intimidation'],
  [/Анализ/, 'investigation'],
  [/Медицин/, 'medicine'],
  [/Природ[аыу](?![а-яё])/, 'nature'],
  [/Восприяти/, 'perception'],
  [/Выступлени/, 'performance'],
  [/Убеждени/, 'persuasion'],
  [/Религи/, 'religion'],
  [/Ловкост[ьи] рук/, 'sleight_of_hand'],
  [/Скрытност/, 'stealth'],
  [/Выживани/, 'survival'],
];

const LANGUAGE_STEMS: [RegExp, Language][] = [
  [/Общ(ем|ий|его)(?![а-яё])/, 'common'],
  [/Дварфийск/, 'dwarvish'],
  [/Эльфийск/, 'elvish'],
  [/Великань/, 'giant'],
  [/Гном(ье|ьи|ск)/, 'gnomish'],
  [/Гоблинск/, 'goblin'],
  [/[Пп]олурослик/, 'halfling'],
  [/Орочь|Орочий|Оркск/, 'orc'],
  [/Бездн/, 'abyssal'],
  [/Небесн/, 'celestial'],
  [/Драконь/, 'draconic'],
  [/Глубинн[а-яё]* [Рр]еч/, 'deep_speech'],
  [/Инфернальн/, 'infernal'],
  [/Первичн/, 'primordial'],
  [/Сильван/, 'sylvan'],
  [/Подземн/, 'undercommon'],
  [/Акван/, 'aquan'],
  [/Ауран/, 'auran'],
  [/Игнан/, 'ignan'],
  [/Терран/, 'terran'],
  [/Гитск/, 'gith'],
  [/Квори/, 'quori'],
  [/Леонинск/, 'leonin'],
  [/Локсодонск/, 'loxodon'],
  [/Минотавр/, 'minotaur'],
  [/Ведалкенск/, 'vedalken'],
  [/Грунг/, 'grung'],
  [/Ааракокр/, 'aarakocra'],
  [/Гнолл/, 'gnoll'],
  [/Три-крин/, 'thri_kreen'],
];

const DAMAGE_WORDS: [RegExp, DamageType][] = [
  [/ядом|ядовит/, 'poison'],
  [/огн[её]м|огненн/, 'fire'],
  [/холодом/, 'cold'],
  [/электричеств/, 'lightning'],
  [/кислот/, 'acid'],
  [/некротическ/, 'necrotic'],
  [/излучени/, 'radiant'],
  [/психическ/, 'psychic'],
  [/звуком/, 'thunder'],
  [/силов[а-яё]* пол/, 'force'],
];

/** Оружие из текста владений → ID предметов каталога. Сначала пары «коротким и длинным луками». */
const WEAPON_STEMS: [RegExp, string[]][] = [
  [/коротк[а-яё]* и длинн[а-яё]* лук/, ['item:shortbow', 'item:longbow']],
  [/л[её]гк[а-яё]* и боев[а-яё]* молот/, ['item:light-hammer', 'item:warhammer']],
  [/длинн[а-яё]* меч/, ['item:longsword']],
  [/коротк[а-яё]* меч/, ['item:shortsword']],
  [/коротк[а-яё]* лук/, ['item:shortbow']],
  [/длинн[а-яё]* лук/, ['item:longbow']],
  [/боев[а-яё]* топор/, ['item:battleaxe']],
  [/ручн[а-яё]* топор/, ['item:handaxe']],
  [/л[её]гк[а-яё]* молот/, ['item:light-hammer']],
  [/боев[а-яё]* молот/, ['item:warhammer']],
  [/рапир/, ['item:rapier']],
  [/ручн[а-яё]* арбалет/, ['item:hand-crossbow']],
  [/л[её]гк[а-яё]* арбалет/, ['item:light-crossbow']],
  [/копь[её]м|копья(?![а-яё])/, ['item:spear']],
  [/трезуб/, ['item:trident']],
  [/(?<![а-яё])сет(ью|ь)(?![а-яё])/, ['item:net']],
  [/скимитар/, ['item:scimitar']],
];

/** Особенности, которые полностью описываются полями механики (или не нужны ей). */
const STANDARD_FEATURES =
  /^(Увеличение характеристики?|Возраст|Мировоззрение|Размер|Скорость|Языки?|Дополнительный язык|(Превосходное )?[Тт]ёмное зрение|Вид существа|Разновидност[а-яё]*|Подраса)$/;

const sentences = (text: string) => text.split(/(?<=[.!?])\s+/);

function found<T>(text: string, table: [RegExp, T][]): T[] {
  return table.filter(([pattern]) => pattern.test(text)).map(([, value]) => value);
}

function countIn(text: string): number | null {
  return COUNT_WORDS.find(([pattern]) => pattern.test(text))?.[1] ?? null;
}

/** Одна часть текста увеличения: «Значение вашей Силы увеличивается на 2, а Ловкости — на 1». */
function abilityOption(text: string): AbilityOption | null {
  const option: AbilityOption = { fixed: [], choices: [] };
  if (/всех ваших характеристик/.test(text)) {
    const value = /на (\d)/.exec(text);
    if (!value) return null;
    return {
      fixed: ALL_ABILITIES.map((ability) => ({ ability, amount: Number(value[1]) })),
      choices: [],
    };
  }
  // Части: «…на 2», «а другой — на 1», «и значение вашей Мудрости увеличивается на 1».
  const parts = text.split(/,\s*(?:а|и)\s+|;\s*|\s+и\s+(?=значени)|,\s*(?=значени)/i);
  for (const part of parts) {
    const value = /на (\d)/.exec(part);
    if (!value) continue;
    const amount = Number(value[1]);
    if (/выбор|другой|других|различных|разных/.test(part)) {
      const count = countIn(part) ?? 1;
      const except = /других|кроме/.test(part)
        ? [...option.fixed.map((entry) => entry.ability), ...found(part, ABILITY_STEMS)]
        : [];
      const named = /кроме/.test(part)
        ? []
        : found(part.replace(/характеристик[а-яё]*/g, ''), ABILITY_STEMS);
      option.choices.push({
        count,
        amount,
        from: named.length > 1 ? named : null,
        except: [...new Set(except)],
      });
      continue;
    }
    const abilities = found(part, ABILITY_STEMS);
    if (abilities.length === 0) return null;
    for (const ability of abilities) option.fixed.push({ ability, amount });
  }
  return option.fixed.length + option.choices.length > 0 ? option : null;
}

/** Увеличение характеристик: варианты на выбор (MPMM «(а) … (б) …», «Либо …, либо …»). */
export function parseAbilityScores(text: string): AbilityOption[] | null {
  const body = text.replace(/^Выберите одно из:\s*/, '');
  const pieces = /\(б\)|либо/i.test(body)
    ? body
        .split(/\s*\([аб]\)\s*|,?\s*либо\s+/i)
        .map((piece) => piece.trim())
        .filter((piece) => /на \d/.test(piece))
    : [body];
  const options = pieces.map(abilityOption);
  return options.length > 0 && options.every((option) => option !== null)
    ? (options as AbilityOption[])
    : null;
}

function parseSpeed(text: string, word: RegExp): number | 'walk' | null {
  const sentence = sentences(text).find((part) => word.test(part));
  if (!sentence) return null;
  if (/равн[а-яё]* (вашей )?(базовой )?скорости ходьбы/.test(sentence)) return 'walk';
  const feet = /(\d+)\s*(фут|фт)/.exec(sentence.slice(sentence.search(word)));
  return feet ? Number(feet[1]) : null;
}

export interface ParsedRaceRules {
  rules: RaceRules;
  /** Особенности, текст которых узнан, но не разобран: в отчёт. */
  failed: string[];
}

export function emptyRaceRules(): RaceRules {
  return {
    schemaVersion: RACE_RULES_SCHEMA_VERSION,
    abilityScores: [],
    size: null,
    creatureType: null,
    speed: { walk: null, fly: null, swim: null, climb: null, burrow: null },
    darkvisionFt: null,
    skills: { fixed: [], choices: [] },
    weapons: [],
    armor: [],
    languages: { fixed: [], choose: 0 },
    resistances: [],
    textOnly: [],
  };
}

export function parseRaceRules(features: RawFeature[]): ParsedRaceRules {
  const rules = emptyRaceRules();
  const failed: string[] = [];
  const texts = features.map((feature) => ({
    name: feature.name,
    text: textBlocksToPlain(feature.blocks).replace(/\s+/g, ' '),
  }));

  for (const { name, text } of texts) {
    const before = JSON.stringify(rules);

    if (/^Увеличение характеристики?$/.test(name)) {
      const options = parseAbilityScores(text);
      if (options) rules.abilityScores = options;
      else {
        rules.abilityScores = null;
        failed.push(name);
      }
      continue;
    }
    if (name === 'Размер') {
      // «Ваш размер — Средний»; рост и вес в том же абзаце размеров не дают.
      const sizes =
        sentences(text)
          .filter((part) => /размер/i.test(part))
          .map((part) => found(part.slice(part.search(/размер/i)), SIZE_WORDS))
          .find((list) => list.length > 0) ?? [];
      if (sizes.length > 0) rules.size = sizes;
      else failed.push(name);
      continue;
    }
    if (name === 'Вид существа') {
      const type = found(text, CREATURE_WORDS)[0];
      if (type) rules.creatureType = type;
      else failed.push(name);
      continue;
    }
    if (/[Тт]ёмное зрение$/.test(name)) {
      const feet = /(\d+)\s*(фут|фт)/.exec(text);
      if (feet) rules.darkvisionFt = Number(feet[1]);
      else failed.push(name);
      continue;
    }
    if (/^(Языки?|Дополнительный язык)$/.test(name)) {
      const first = sentences(text)[0] ?? '';
      rules.languages.fixed.push(...found(first, LANGUAGE_STEMS));
      const extra = sentences(text).find(
        (part) => /(выбор|дополнительн|ещё|еще|подходит|другом)/.test(part) && /язык/.test(part),
      );
      if (extra) rules.languages.choose += countIn(extra) ?? 1;
      if (rules.languages.fixed.length === 0 && rules.languages.choose === 0) failed.push(name);
      continue;
    }

    // Остальные особенности: скорости, владения, сопротивления — где встретятся.
    const walk = /скорост[а-яё]* ходьбы[^.\d]*(\d+)\s*(фут|фт)/.exec(text);
    if (walk) rules.speed.walk = Number(walk[1]);
    rules.speed.fly ??= parseSpeed(text, /скорост[а-яё]* пол[её]та|летать со скорост/);
    rules.speed.swim ??= parseSpeed(text, /скорост[а-яё]* плавания/);
    rules.speed.climb ??= parseSpeed(text, /скорост[а-яё]* лазани/);
    rules.speed.burrow ??= parseSpeed(text, /скорост[а-яё]* (копания|рытья)/);

    for (const sentence of sentences(text)) {
      if (/навык/.test(sentence) && /владе/.test(sentence)) {
        const skills = found(sentence, SKILL_STEMS);
        if (/выбор|из следующ|одним из|двумя из/.test(sentence)) {
          rules.skills.choices.push({
            count: countIn(sentence) ?? 1,
            from: skills.length > 1 ? skills : null,
          });
        } else {
          rules.skills.fixed.push(...skills);
        }
      }
      if (/владе/.test(sentence) && !/навык/.test(sentence)) {
        // Найденное вырезается: «коротким и длинным луками» не даёт ещё раз «длинный лук».
        let lower = sentence.toLowerCase();
        for (const [pattern, ids] of WEAPON_STEMS) {
          if (!pattern.test(lower)) continue;
          lower = lower.replace(pattern, ' ');
          rules.weapons.push(...ids.filter((id) => !rules.weapons.includes(id)));
        }
        if (/л[её]гк[а-яё]*( и средн[а-яё]*)? доспех/.test(lower)) rules.armor.push('light');
        if (/средн[а-яё]* доспех/.test(lower)) rules.armor.push('medium');
      }
      if (
        /сопротивлени/.test(sentence) &&
        /урон/.test(sentence) &&
        !/выбор|таблиц/.test(sentence)
      ) {
        rules.resistances.push(...found(sentence, DAMAGE_WORDS));
      }
    }
    const yielded = JSON.stringify(rules) !== before;
    if (!yielded && !STANDARD_FEATURES.test(name)) rules.textOnly.push(name);
    if (name === 'Скорость' && !walk) failed.push(name);
  }

  rules.skills.fixed = [...new Set(rules.skills.fixed)];
  rules.armor = [...new Set(rules.armor)];
  rules.languages.fixed = [...new Set(rules.languages.fixed)];
  rules.resistances = [...new Set(rules.resistances)];
  return { rules, failed };
}
