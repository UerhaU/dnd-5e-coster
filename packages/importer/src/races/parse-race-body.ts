import type { RaceBody } from '@koster/shared';
import type { RawBodyRow } from './parse-race-page.ts';

// Рост, вес и возраст расы числами (Р61, Р69) — из особенностей «Возраст» и «Размер»
// и из таблицы «Случайные рост и вес», если она есть на странице. Только устойчивые
// формулировки; «как у людей» и другие отсылки — `null` (список — в отчёте сборки).
// В выражениях вместо `\w` и `\b` — `[а-яё]`: в JavaScript они не знают кириллицы.

type Range = NonNullable<RaceBody['heightIn']>;
type Random = NonNullable<RaceBody['random']>;

/** «5», «6,5», «2½», «3½». */
const NUMBER = String.raw`(\d+(?:[,.]\d+)?½?|½)`;

function toNumber(text: string): number {
  const half = text.endsWith('½') ? 0.5 : 0;
  const whole = text.replace('½', '').replace(',', '.');
  return (whole ? Number(whole) : 0) + half;
}

export function emptyRaceBody(): RaceBody {
  return { adultAge: null, lifespan: null, heightIn: null, weightLb: null, random: null };
}

/**
 * Диапазон из текста перед единицей `unit`: «от 4 до 5 футов», «6 или 6,5 футов» —
 * min и max; «около 150 фунтов» — min = max; «до 6 футов» — max; «более 6 футов» — min.
 */
function rangeOf(text: string, unit: string, scale: number): Range | null {
  const value = (raw: string) => Math.round(toNumber(raw) * scale);
  const pair = new RegExp(
    String.raw`(?:от|между)\s+(?:чуть менее\s+)?${NUMBER}(?:\s*${unit}[а-яё]*)?\s+(?:до|и)\s+(?:почти\s+|сильно выше\s+)?${NUMBER}\s*${unit}|${NUMBER}\s+или\s+${NUMBER}\s*${unit}`,
  ).exec(text);
  if (pair) {
    const [min, max] = [pair[1] ?? pair[3], pair[2] ?? pair[4]].map((raw) => value(raw ?? ''));
    return { min: min ?? null, max: max ?? null };
  }
  const single = (words: string) =>
    new RegExp(String.raw`(?<![а-яё])(?:${words})\s+${NUMBER}\s*${unit}`).exec(text)?.[1];
  const exact = single('около|примерно|в среднем');
  if (exact) return { min: value(exact), max: value(exact) };
  const upper = single('до|достигать|достигают|меньше|менее');
  const lower = single('более|больше|выше|превосходящий');
  if (!upper && !lower) {
    // «Рост ааракокр около 5 футов» без слов меры уже разобран выше; «весят 30 фунтов».
    return null;
  }
  const range = { min: lower ? value(lower) : null, max: upper ? value(upper) : null };
  // «Некоторые с трудом достигают 5 футов, тогда как другие … превосходящий 6 футов».
  if (range.min !== null && range.max !== null && range.min > range.max) {
    return { min: range.max, max: range.min };
  }
  return range;
}

const YEARS = String.raw`(\d+)\s*(?:год|лет)`;
const ADULT =
  /зрелост|совершеннолет|становятся взрослыми|считаются взрослыми|статус взрослого|считаются юными, пока не/i;
const LIFE = /жив[уеё]т|жить|дожива|доживут|дожить|прожи|продолжительност|жизненн/i;
/** Слова вместо чисел: «за один год», «пятидесятилетнего возраста», «около века». */
const ADULT_WORDS: [RegExp, number][] = [
  [/(?<![а-яё])один год/, 1],
  [/двадцатилетн/, 20],
  [/тридцатилетн/, 30],
  [/сорокалетн/, 40],
  [/пятидесятилетн/, 50],
  [/столетн/, 100],
];
const CENTURY = /(?<![а-яё])(?:век[ауе]?|столети[яе])(?![а-яё])/;

/** Первое число лет после слова зрелости: «к 12 годам», «в 15», «за один год». */
function adultAgeIn(text: string): number | null {
  const years = /(\d+)\s*(?:год|лет)|(?<![а-яё\d-])в (\d+)(?![\d-])/.exec(text);
  const word = ADULT_WORDS.map(([pattern, value]) => ({ index: text.search(pattern), value }))
    .filter((entry) => entry.index >= 0)
    .sort((left, right) => left.index - right.index)[0];
  if (years && (!word || years.index < word.index)) return Number(years[1] ?? years[2]);
  return word?.value ?? null;
}

function parseAge(text: string, body: RaceBody) {
  for (const sentence of text.split(/(?<=[.!?])\s+/)) {
    const adult = ADULT.exec(sentence);
    if (adult && body.adultAge === null) body.adultAge = adultAgeIn(sentence.slice(adult.index));
    const life = LIFE.exec(sentence);
    if (life && !/второго столетия|бесконечно/.test(sentence)) {
      // Числа — после слова о жизни: «зрелости к 6 годам, и могут дожить до 120 лет».
      const rest = sentence.slice(life.index);
      const numbers = [...rest.matchAll(new RegExp(YEARS, 'g'))].map((match) => Number(match[1]));
      const lifespan =
        numbers.length > 0
          ? Math.max(...numbers)
          : CENTURY.test(rest.replace(/столетиями/, ''))
            ? 100
            : null;
      if (lifespan !== null) body.lifespan = Math.max(body.lifespan ?? 0, lifespan);
    }
  }
}

/** «Модификатор размера = 2к10 Высота = 5 футов + 6 дюймов + … Вес в фунтах = 180 + (2к6 × …)». */
function randomFromText(text: string): Random | null {
  const height = /Модификатор размера\s*=\s*(\d+)к(\d+)/.exec(text);
  const base = /Высота\s*=\s*(\d+)\s*фут[а-яё]*(?:\s*\+\s*(\d+)\s*дюйм[а-яё]*)?/.exec(text);
  const weight = /Вес в фунтах\s*=\s*(\d+)(?:\s*\+\s*\((\d+)к(\d+)\s*×)?/.exec(text);
  if (!height || !base || !weight) return null;
  return {
    baseHeightIn: Number(base[1]) * 12 + Number(base[2] ?? 0),
    heightDice: { count: Number(height[1]), sides: Number(height[2]) },
    baseWeightLb: Number(weight[1]),
    weightDice: weight[2] ? { count: Number(weight[2]), sides: Number(weight[3]) } : null,
  };
}

/** Строка таблицы: «5’0’’ | 100 фнт. | +2к12 | × (2к4) фнт.». */
export function randomFromRow(row: RawBodyRow): Random | null {
  const height = /(\d+)\s*[’'′]\s*(\d+)?/.exec(row.baseHeight);
  const weight = /(\d+)/.exec(row.baseWeight);
  const heightDice = /(\d+)к(\d+)/.exec(row.heightModifier);
  const weightDice = /(\d+)к(\d+)/.exec(row.weightModifier);
  if (!height || !weight || !heightDice) return null;
  return {
    baseHeightIn: Number(height[1]) * 12 + Number(height[2] ?? 0),
    heightDice: { count: Number(heightDice[1]), sides: Number(heightDice[2]) },
    baseWeightLb: Number(weight[1]),
    weightDice: weightDice ? { count: Number(weightDice[1]), sides: Number(weightDice[2]) } : null,
  };
}

/** Тексты особенностей «Возраст» и «Размер» (`null` — особенности нет) → числа. */
export function parseRaceBody(ageText: string | null, sizeText: string | null): RaceBody {
  const body = emptyRaceBody();
  if (ageText) parseAge(ageText, body);
  if (sizeText) {
    body.random = randomFromText(sizeText);
    // Описание — до формулы; метрические значения в скобках не нужны.
    const description = sizeText
      .split(/Вот как определить|Вы можете определить|Модификатор размера/)[0]
      ?.replace(/\([^)]*\)/g, ' ')
      .replace(/\s+/g, ' ');
    if (description) {
      body.heightIn = rangeOf(description, 'фут', 12);
      body.weightLb = rangeOf(description, 'фунт', 1);
    }
  }
  return body;
}
