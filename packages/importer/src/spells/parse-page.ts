import type { TextBlock } from '@koster/shared';
import * as cheerio from 'cheerio';
import type { Element } from 'domhandler';
import { blocksFrom, cleanText, inlineText } from '../dndsu/text.ts';

// Шаг parse (раздел 6): страница заклинания DnD.su → сырые поля, без толкования.
// Толкование полей (уровень, время, дистанция…) — в normalize-spell.ts.

export interface PageSource {
  /** Метка на DnD.su: `PH14`. */
  code: string;
  /** Название книги из подсказки метки: `Player's Handbook`. */
  title: string;
}

export interface PageClass {
  name: string;
  /** Метка TCE: дополнительный список Tasha's Cauldron of Everything. */
  optional: boolean;
}

export interface RawSpellPage {
  nameRu: string;
  nameEn: string;
  sources: PageSource[];
  /** Ссылки на другие редакции (PH24 → next.dnd.su): не источники этой записи. */
  otherEditions: { code: string; title: string; url: string }[];
  /** «3 уровень, воплощение (ритуал)». */
  levelLine: string;
  castingTime: string | null;
  range: string | null;
  components: string | null;
  duration: string | null;
  classes: PageClass[];
  /** «домен света (жрец), артиллерист (изобретатель)». */
  subclasses: string | null;
  description: TextBlock[];
  higherLevels: TextBlock[];
  /** Подписи параметров, которых парсер не знает. */
  unknownParams: string[];
}

export class PageParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PageParseError';
  }
}

const KNOWN_PARAMS = {
  'Время накладывания': 'castingTime',
  Дистанция: 'range',
  Компоненты: 'components',
  Длительность: 'duration',
  Классы: 'classes',
  Подклассы: 'subclasses',
} as const;

const HIGHER_LEVELS_PREFIX = /^На больших уровнях\.\s*/;

function splitTitle(title: string): { nameRu: string; nameEn: string } {
  const match = /^(.*?)\s*\[([^\]]+)\]\s*$/.exec(title);
  if (!match?.[1] || !match[2]) {
    throw new PageParseError(`Не удалось разделить название: «${title}»`);
  }
  return { nameRu: match[1], nameEn: match[2].trim() };
}

function parseClasses($: cheerio.CheerioAPI, li: cheerio.Cheerio<Element>): PageClass[] {
  const clone = li.clone();
  clone.children('strong').first().remove();
  clone.find('sup').each((_, sup) => {
    $(sup).replaceWith(`[${$(sup).text().trim()}]`);
  });
  return cleanText(clone.text())
    .split(',')
    .map((part) => part.trim())
    .filter((part) => part)
    .map((part) => {
      const optional = part.endsWith('[TCE]');
      return { name: part.replace(/\[[^\]]*\]$/, '').trim(), optional };
    });
}

/** Разбирает страницу заклинания (полную или сохранённый фрагмент карточки). */
export function parseSpellPage(html: string): RawSpellPage {
  const $ = cheerio.load(html);
  const card = $('div.card.card__category-spells').first();
  if (card.length === 0) {
    throw new PageParseError('На странице нет карточки заклинания');
  }

  const titleNode = card.find('h2.card-title [data-copy]').first();
  const { nameRu, nameEn } = splitTitle(cleanText(titleNode.attr('data-copy') ?? titleNode.text()));

  const sources: PageSource[] = [];
  const otherEditions: RawSpellPage['otherEditions'] = [];
  card.find('h2.card-title .source-plaque').each((_, plaque) => {
    const code = cleanText($(plaque).text());
    const title = cleanText($(plaque).attr('title') ?? '');
    const href = $(plaque).attr('href');
    if (href) {
      otherEditions.push({ code, title, url: href });
    } else {
      sources.push({ code, title });
    }
  });

  const page: RawSpellPage = {
    nameRu,
    nameEn,
    sources,
    otherEditions,
    levelLine: '',
    castingTime: null,
    range: null,
    components: null,
    duration: null,
    classes: [],
    subclasses: null,
    description: [],
    higherLevels: [],
    unknownParams: [],
  };

  const params = card.find('ul.params').first();
  params.children('li').each((_, node) => {
    const li = $(node);
    if (li.hasClass('size-type-alignment')) {
      page.levelLine = cleanText(li.text());
      return;
    }
    if (li.hasClass('desc')) {
      return;
    }
    const label = cleanText(li.children('strong').first().text()).replace(/:$/, '');
    const key = KNOWN_PARAMS[label as keyof typeof KNOWN_PARAMS];
    if (!key) {
      page.unknownParams.push(label || cleanText(li.text()).slice(0, 40));
      return;
    }
    if (key === 'classes') {
      page.classes = parseClasses($, li);
      return;
    }
    const value = li.clone();
    value.children('strong').first().remove();
    page[key] = inlineText($, value) || null;
  });

  const description = params.find('li.desc [itemprop=description]').first();
  for (const block of blocksFrom($, description)) {
    if (block.type === 'paragraph' && HIGHER_LEVELS_PREFIX.test(block.text)) {
      page.higherLevels.push({
        type: 'paragraph',
        text: block.text.replace(HIGHER_LEVELS_PREFIX, ''),
      });
    } else {
      page.description.push(block);
    }
  }

  if (!page.levelLine) {
    throw new PageParseError('Нет строки с уровнем и школой');
  }
  return page;
}
