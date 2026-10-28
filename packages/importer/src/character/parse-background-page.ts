import type { TextBlock } from '@koster/shared';
import * as cheerio from 'cheerio';
import type { Cheerio, CheerioAPI } from 'cheerio';
import type { Element } from 'domhandler';
import { blocksFrom, cleanText, inlineText } from '../dndsu/text.ts';

// Шаг parse (раздел 6) для страниц предысторий и черт 5e14.dnd.su: карточка
// «Название [English]», плашки книг, описание `div[itemprop=description]`.
// Только чтение HTML: что из этого механика — решает normalize.

export class CardParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CardParseError';
  }
}

export interface RawPlaque {
  code: string;
  title: string | null;
  /** Плашка ведёт на next.dnd.su — это редакция 2024 (Р12), не источник объекта. */
  edition2024: boolean;
}

export interface RawLabeled {
  /** «Владение навыками» без двоеточия. */
  label: string;
  text: string;
  /** Подсказки сайта в строке: `skill.acrobatics`, `tools.music`. */
  tooltips: string[];
  /** Ссылки в строке: `/spells/123-…/`. */
  links: string[];
}

export interface RawTable {
  header: string[];
  rows: string[][];
}

export interface RawSection {
  name: string;
  /** Класс заголовка: `underlined` у разновидностей. */
  underlined: boolean;
  blocks: TextBlock[];
  labeled: RawLabeled[];
  tables: RawTable[];
  /** Ссылки раздела: `/feats/179-strixhaven_initiate/`. */
  links: string[];
}

export interface RawCardPage {
  url: string | null;
  nameRu: string;
  nameEn: string | null;
  plaques: RawPlaque[];
  /** Строки над описанием карточки: «Требование: Сила 13 или выше». */
  params: RawLabeled[];
  intro: TextBlock[];
  /** Все блоки до первого раздела, вместе с абзацами «Метка: текст» и таблицами. */
  preface: TextBlock[];
  /** Абзацы «Метка: текст» до первого раздела. */
  labeled: RawLabeled[];
  tables: RawTable[];
  sections: RawSection[];
}

/** Абзац «<strong>Владение навыками:</strong> …»: метка в начале и текст после. */
function labeledOf($: CheerioAPI, element: Cheerio<Element>): RawLabeled | null {
  const first = element.contents().first();
  if (!first.is('strong, b')) return null;
  const raw = cleanText(first.text());
  const whole = inlineText($, element);
  // Двоеточие бывает и после <strong>: «<strong>Владение навыками</strong>: …».
  const rest = whole.slice(raw.length);
  if (!/:$/.test(raw) && !/^\s*:/.test(rest)) return null;
  return {
    label: raw.replace(/:$/, '').trim(),
    text: rest.replace(/^\s*:/, '').trim(),
    tooltips: element
      .find('[tooltip-for]')
      .toArray()
      .map((node) => $(node).attr('tooltip-for') ?? ''),
    links: element
      .find('a[href]')
      .toArray()
      .map((node) => $(node).attr('href') ?? ''),
  };
}

/** Строка без <strong>: «Требование: Ловкость 13 или выше» (у черт). */
function plainLabeled(text: string): RawLabeled | null {
  const colon = text.indexOf(':');
  if (colon <= 0) return null;
  return {
    label: text.slice(0, colon).trim(),
    text: text.slice(colon + 1).trim(),
    tooltips: [],
    links: [],
  };
}

function tableOf($: CheerioAPI, table: Cheerio<Element>): RawTable | null {
  const rows = table
    .find('tr')
    .toArray()
    .map((row) =>
      $(row)
        .children('td, th')
        .toArray()
        .map((cell) => inlineText($, $(cell)).replace(/\n/g, ' ')),
    );
  const [header, ...body] = rows;
  return header && body.length > 0 ? { header, rows: body } : null;
}

export function parseCardPage(html: string): RawCardPage {
  const $ = cheerio.load(html);
  const title = $('h2.card-title').first();
  const copy = cleanText(title.find('span[data-copy]').first().text());
  if (!copy) {
    throw new CardParseError('На странице нет названия карточки (h2.card-title span[data-copy])');
  }
  const named = /^(.*?)\s*\[([^\]]+)\]\s*$/.exec(copy);
  const plaques = title
    .find('.source-plaque')
    .toArray()
    .map((node) => ({
      code: cleanText($(node).text()),
      title: $(node).attr('title') ?? null,
      edition2024: /next\.dnd\.su/.test($(node).attr('href') ?? ''),
    }));
  const params = $('ul.params > li')
    .not('.desc')
    .toArray()
    .map((li) => labeledOf($, $(li)) ?? plainLabeled(cleanText($(li).text())))
    .filter((entry): entry is RawLabeled => entry !== null);

  const description = $('div[itemprop=description]').first();
  if (description.length === 0) {
    throw new CardParseError('На странице нет описания (div[itemprop=description])');
  }
  const page: RawCardPage = {
    url: $('meta[property="og:url"]').attr('content') ?? null,
    nameRu: named?.[1] ?? copy,
    nameEn: named?.[2]?.trim() ?? null,
    plaques,
    params,
    intro: [],
    preface: [],
    labeled: [],
    tables: [],
    sections: [],
  };

  let section: RawSection | null = null;
  for (const node of description.children().toArray()) {
    const element = $(node);
    const tag = node.tagName.toLowerCase();
    if (tag === 'h3' || tag === 'h4') {
      // Пустой заголовок («<h3> </h3>») — продолжение прошлого раздела.
      if (!cleanText(element.text())) continue;
      section = {
        name: cleanText(element.text()),
        underlined: element.hasClass('underlined'),
        blocks: [],
        labeled: [],
        tables: [],
        links: [],
      };
      page.sections.push(section);
      continue;
    }
    if (tag === 'table') {
      const table = tableOf($, element);
      if (table) (section?.tables ?? page.tables).push(table);
    }
    const labeled = tag === 'p' ? labeledOf($, element) : null;
    if (labeled) (section?.labeled ?? page.labeled).push(labeled);
    const wrapper = $('<div></div>') as Cheerio<Element>;
    const blocks = blocksFrom($, wrapper.append(element.clone()));
    if (section) {
      section.blocks.push(...blocks);
      section.links.push(
        ...element
          .find('a[href]')
          .addBack('a[href]')
          .toArray()
          .map((link) => $(link).attr('href') ?? ''),
      );
      continue;
    }
    page.preface.push(...blocks);
    if (!labeled && tag !== 'table') page.intro.push(...blocks);
  }
  return page;
}
