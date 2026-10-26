import {
  MAGIC_SCHOOLS,
  type ClassId,
  type MagicSchoolId,
  type SpellCastingTime,
  type SpellComponents,
  type SpellData,
  type SpellDuration,
  type SpellRange,
} from '@koster/shared';

// Толкование строк страницы DnD.su. Каждая функция либо разбирает строку целиком,
// либо возвращает `null` в разобранной части — тогда normalize пишет строку в отчёт.

const FEET_PER_MILE = 5280;

export interface LevelLine {
  level: number;
  school: MagicSchoolId;
  ritual: boolean;
  tags: SpellData['tags'];
}

const TAGS: Record<string, SpellData['tags'][number]> = {
  дюнамантия: 'dunamancy',
  хронургия: 'chronurgy',
  гравитургия: 'graviturgy',
};

/** «3 уровень, воплощение (ритуал, дюнамантия: хронургия)», «Заговор, вызов». */
export function parseLevelLine(line: string): LevelLine | null {
  const match = /^(?:(\d) уровень|Заговор), ([а-яё]+)(?: \(([^)]*)\))?$/i.exec(line);
  if (!match?.[2]) {
    return null;
  }
  const school = MAGIC_SCHOOLS.find(
    (entry) => entry.nameRu.toLowerCase() === match[2]?.toLowerCase(),
  );
  if (!school) {
    return null;
  }

  let ritual = false;
  const tags: SpellData['tags'] = [];
  const notes = (match[3] ?? '')
    .split(/[,:]/)
    .map((note) => note.trim())
    .filter((note) => note);
  for (const note of notes) {
    const tag = TAGS[note.toLowerCase()];
    if (note === 'ритуал') {
      ritual = true;
    } else if (tag) {
      tags.push(tag);
    } else {
      return null;
    }
  }
  return { level: match[1] ? Number(match[1]) : 0, school: school.id, ritual, tags };
}

type CastingOption = NonNullable<SpellCastingTime['options']>[number];
type DurationOption = NonNullable<SpellDuration['options']>[number];

const CASTING_UNITS: [RegExp, CastingOption['unit']][] = [
  [/^бонусное действие$/, 'bonus_action'],
  [/^действи[ея]$/, 'action'],
  [/^реакци[яи]$/, 'reaction'],
  [/^минут[аы]?$/, 'minute'],
  [/^час(а|ов)?$/, 'hour'],
];

function castingOption(part: string): CastingOption | null {
  const match = /^(\d+) (.+)$/.exec(part);
  const unit = CASTING_UNITS.find(([pattern]) => pattern.test(match?.[2] ?? ''))?.[1];
  return match && unit ? { amount: Number(match[1]), unit } : null;
}

/** «1 действие», «10 минут», «1 действие или 8 часов», «1 реакция, совершаемая вами, когда…». */
export function parseCastingTime(text: string): SpellCastingTime {
  const reaction = /^(1 реакция), (?:совершаемая вами, )?(.+)$/.exec(text);
  if (reaction?.[1] && reaction[2]) {
    return {
      text,
      options: [{ amount: 1, unit: 'reaction' }],
      reactionTrigger: reaction[2].replace(/\s+/g, ' '),
    };
  }
  const options = text.split(' или ').map(castingOption);
  return {
    text,
    options: options.every((option) => option) ? (options as CastingOption[]) : null,
    reactionTrigger: null,
  };
}

function lengthInFeet(amount: string, unit: string): number | null {
  if (/^фут(а|ов)?/.test(unit)) {
    return Number(amount);
  }
  if (/^мил(я|и|ь)/.test(unit)) {
    return Number(amount) * FEET_PER_MILE;
  }
  return null;
}

const AREA_SHAPES: [RegExp, NonNullable<SpellRange['area']>['shape']][] = [
  [/^(\d+)-футов(?:ый|ая) (радиус)$/, 'radius'],
  [/^(\d+)-футов(?:ый|ая) (конус)$/, 'cone'],
  [/^(\d+)-футов(?:ый|ая) (линия)$/, 'line'],
  [/^(\d+)-футов(?:ый|ая) (куб)$/, 'cube'],
];

function parseArea(text: string): SpellRange['area'] {
  for (const [pattern, shape] of AREA_SHAPES) {
    const match = pattern.exec(text);
    if (match) {
      return { shape, feet: Number(match[1]) };
    }
  }
  const radius = /^(полусфера с )?радиус(?:ом)? (\d+) (футов|фута|фут|миль|мили|миля)$/.exec(text);
  const feet = radius?.[2] && radius[3] ? lengthInFeet(radius[2], radius[3]) : null;
  if (radius && feet) {
    return { shape: radius[1] ? 'hemisphere' : 'radius', feet };
  }
  return null;
}

const RANGE_WORDS: Record<string, NonNullable<SpellRange['kind']>> = {
  касание: 'touch',
  'на себя': 'self',
  'в пределах видимости': 'sight',
  особая: 'special',
  неограниченная: 'unlimited',
  'без ограничений': 'unlimited',
};

/** «150 футов», «1 миля», «Касание», «На себя (15-футовый конус)». */
export function parseRange(text: string): SpellRange {
  const unknown: SpellRange = { text, kind: null, feet: null, area: null };
  const word = RANGE_WORDS[text.toLowerCase()];
  if (word) {
    return { ...unknown, kind: word };
  }
  const distance = /^(\d+) (\S+)$/.exec(text);
  if (distance?.[1] && distance[2]) {
    const feet = lengthInFeet(distance[1], distance[2]);
    return feet ? { ...unknown, kind: 'distance', feet } : unknown;
  }
  const self = /^На себя \((.+)\)$/.exec(text);
  if (self?.[1]) {
    const area = parseArea(self[1]);
    return area ? { ...unknown, kind: 'self', area } : unknown;
  }
  // Область без слов «На себя» — вид дистанции на странице не указан.
  return { ...unknown, area: parseArea(text) };
}

const DURATION_UNITS: [RegExp, NonNullable<DurationOption['unit']>][] = [
  [/^раунд(а|ов)?$/, 'round'],
  [/^минут[аы]?$/, 'minute'],
  [/^час(а|ов)?$/, 'hour'],
  [/^(день|дня|дней)$/, 'day'],
];

function durationOption(part: string): DurationOption | null {
  const lower = part.toLowerCase();
  if (lower === 'мгновенная') {
    return { kind: 'instantaneous', amount: null, unit: null };
  }
  if (lower === 'пока не рассеяно') {
    return { kind: 'until_dispelled', amount: null, unit: null };
  }
  if (lower === 'пока не рассеяно или не сработает') {
    return { kind: 'until_dispelled_or_triggered', amount: null, unit: null };
  }
  if (lower === 'особая') {
    return { kind: 'special', amount: null, unit: null };
  }
  const match = /^(\d+) (\S+)$/.exec(lower);
  const unit = DURATION_UNITS.find(([pattern]) => pattern.test(match?.[2] ?? ''))?.[1];
  return match && unit ? { kind: 'timed', amount: Number(match[1]), unit } : null;
}

/** «Концентрация, вплоть до 1 минуты», «Мгновенная или 1 час», «Пока не рассеяно». */
export function parseDuration(text: string): { duration: SpellDuration; concentration: boolean } {
  let rest = text;
  let concentration = false;
  let upTo = false;

  const concentrationMatch = /^Концентрация, (вплоть до|до) (.+)$/.exec(rest);
  if (concentrationMatch?.[2]) {
    concentration = true;
    upTo = true;
    rest = concentrationMatch[2];
  }
  const upToMatch = /^Вплоть до (.+)$/.exec(rest);
  if (upToMatch?.[1]) {
    upTo = true;
    rest = upToMatch[1];
  }

  const whole = durationOption(rest);
  const options = whole ? [whole] : rest.split(' или ').map(durationOption);
  return {
    duration: {
      text,
      options: options.every((option) => option) ? (options as DurationOption[]) : null,
      upTo,
    },
    concentration,
  };
}

/** Делит по запятым верхнего уровня: запятые в скобках остаются внутри. */
function splitTopLevel(text: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let current = '';
  for (const char of text) {
    if (char === '(') depth += 1;
    if (char === ')') depth -= 1;
    if (char === ',' && depth === 0) {
      parts.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  parts.push(current.trim());
  return parts;
}

/** «В, С, М (крошечный шарик…)», «В, С, А (1 зм)», «С, М (монетка), А (2 зм)». */
export function parseComponents(text: string): SpellComponents | null {
  const details = new Map<string, string | null>();
  for (const part of splitTopLevel(text)) {
    const match = /^([ВСМА])(?: \((.*)\))?$/s.exec(part);
    if (!match?.[1] || details.has(match[1])) {
      return null;
    }
    details.set(match[1], match[2]?.trim() || null);
  }

  // У М и А пояснение обязательно, у В и С его не бывает.
  for (const [code, detail] of details) {
    if ((code === 'М' || code === 'А') !== Boolean(detail)) {
      return null;
    }
  }
  const material = details.get('М');
  const royalty = details.get('А');
  const royaltyGold = royalty ? /^(\d+) зм$/.exec(royalty) : null;

  return {
    verbal: details.has('В'),
    somatic: details.has('С'),
    material: material ? { text: material, recipe: null } : null,
    royalty: royalty
      ? { text: royalty, costCp: royaltyGold ? Number(royaltyGold[1]) * 100 : null }
      : null,
  };
}

/** Названия классов на DnD.su → коды. */
export const CLASS_BY_NAME: Record<string, ClassId> = {
  бард: 'class:bard',
  варвар: 'class:barbarian',
  воин: 'class:fighter',
  волшебник: 'class:wizard',
  друид: 'class:druid',
  жрец: 'class:cleric',
  изобретатель: 'class:artificer',
  колдун: 'class:warlock',
  монах: 'class:monk',
  паладин: 'class:paladin',
  плут: 'class:rogue',
  следопыт: 'class:ranger',
  чародей: 'class:sorcerer',
};

export function classIdByName(name: string): ClassId | null {
  return CLASS_BY_NAME[name.trim().toLowerCase()] ?? null;
}

/** «домен света (жрец), артиллерист (изобретатель)» → пары «подкласс — класс». */
export function parseSubclassList(text: string): { name: string; className: string }[] | null {
  const pairs = [...text.matchAll(/([^,()]+?)\s*\(([^()]+)\)/g)].map((match) => ({
    name: (match[1] ?? '').trim(),
    className: (match[2] ?? '').trim(),
  }));
  const rebuilt = pairs.map((pair) => `${pair.name} (${pair.className})`).join(', ');
  return rebuilt === text.trim() ? pairs : null;
}
