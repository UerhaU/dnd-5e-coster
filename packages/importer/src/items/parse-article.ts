import type { TextBlock } from '@koster/shared';
import * as cheerio from 'cheerio';
import type { Cheerio, CheerioAPI } from 'cheerio';
import type { Element } from 'domhandler';
import { blocksFrom, cleanText, inlineText } from '../dndsu/text.ts';

// Шаг parse (раздел 6) для статей-таблиц DnD.su «Инвентарь»: снаряжение не имеет
// своих страниц, а лежит строками таблиц. Здесь только чтение HTML: строки таблиц
// с группами и абзацы описаний «Термин. Текст». Смысл им придаёт normalize-items.ts.

export class ArticleParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ArticleParseError';
  }
}

/** Метка книги в тексте статьи: «(RLW)», «(ToA)» с подсказкой-названием. */
export interface RawSourceMark {
  code: string;
  title: string | null;
}

export interface RawRow {
  /** Название как в первой ячейке, без метки книги. */
  name: string;
  /** Метка книги из названия: «Иклва (TOA)». */
  source: RawSourceMark | null;
  /** Остальные ячейки строки по порядку столбцов. */
  cells: string[];
  /** Строка с отступом: относится к последней группе таблицы. */
  inGroup: boolean;
  /** Все строки-группы таблицы выше этой строки, по порядку: «эпоха Возрождения», «Боеприпасы». */
  groups: string[];
}

export interface RawTable {
  /** Заголовки столбцов (для таблицы из двух половин — одной половины). */
  header: string[];
  rows: RawRow[];
  /** Ближайший заголовок раздела над таблицей. */
  heading: string | null;
}

/** Абзац «<strong>Термин</strong>. Текст» и абзацы-продолжения после него. */
export interface RawTerm {
  term: string;
  source: RawSourceMark | null;
  /** Заголовок раздела (h2/h3), в котором стоит абзац. */
  section: string | null;
  blocks: TextBlock[];
}

/** Раздел h3 целиком: «Иклва (ToA)» с описанием и таблицей. */
export interface RawSection {
  heading: string;
  source: RawSourceMark | null;
  /** Ближайший h2 выше. */
  parent: string | null;
  blocks: TextBlock[];
}

export interface RawArticle {
  url: string | null;
  title: string;
  /** «Источник: «Player's Handbook»» в начале статьи. */
  sourceTitle: string | null;
  tables: RawTable[];
  terms: RawTerm[];
  sections: RawSection[];
}

/** Латинские коды книг иногда набраны кириллицей: «СOS». */
function latinCode(value: string): string {
  const map: Record<string, string> = { С: 'C', О: 'O', А: 'A', Е: 'E', Т: 'T', Р: 'P', М: 'M' };
  return value.replace(/[СОАЕТРМ]/g, (char) => map[char] ?? char);
}

/** «Иклва (ToA)» → название и метка книги. Скобки не с кодом книги остаются в названии. */
export function splitSourceMark(
  text: string,
  titles: Map<string, string> = new Map(),
): { name: string; source: RawSourceMark | null } {
  const match = /^(.*?)\s*\(([A-ZА-Я][A-Za-zА-Я0-9:-]{1,9})\)\s*$/.exec(text);
  if (!match || !/^[A-Z0-9:-]+$/i.test(latinCode(match[2] ?? ''))) {
    return { name: text, source: null };
  }
  const code = latinCode(match[2] ?? '');
  return { name: match[1] ?? text, source: { code, title: titles.get(code) ?? null } };
}

/** Подсказки-названия книг на странице: `<span title="Tomb of Annihilation">ToA</span>`. */
function sourceTitles($: CheerioAPI): Map<string, string> {
  const titles = new Map<string, string>();
  $('span.tooltip[title]').each((_, span) => {
    const code = latinCode(cleanText($(span).text()));
    const title = cleanText($(span).attr('title') ?? '');
    if (/^[A-Za-z0-9:-]{2,10}$/.test(code) && title) {
      titles.set(code, title);
    }
  });
  return titles;
}

interface Cell {
  text: string;
  span: number;
  pad: boolean;
}

function readCells($: CheerioAPI, row: Cheerio<Element>): Cell[] {
  return row
    .children('td, th')
    .toArray()
    .map((cell) => ({
      text: inlineText($, $(cell)).replace(/\n/g, ' '),
      span: Number($(cell).attr('colspan') ?? 1),
      pad: $(cell).hasClass('pad'),
    }));
}

/**
 * Строки таблицы по столбцам `width`. Таблица инструментов на DnD.su — две таблицы
 * рядом в одной (6 столбцов): каждая половина читается отдельно.
 */
function readTable(
  $: CheerioAPI,
  table: Cheerio<Element>,
  heading: string | null,
  titles: Map<string, string>,
): RawTable[] {
  const rows = table.find('tr').toArray();
  const headerCells = readCells($, $(rows[0] as Element)).map((cell) => cell.text);
  const halves = headerCells.length === 6 && headerCells[0] === headerCells[3] ? 2 : 1;
  const width = headerCells.length / halves;

  const result: RawTable[] = [];
  for (let half = 0; half < halves; half += 1) {
    const groups: string[] = [];
    const out: RawRow[] = [];
    for (const tr of rows.slice(1)) {
      // Ячейки этой половины: по сумме colspan.
      let column = 0;
      const cells = readCells($, $(tr)).filter((cell) => {
        const start = column;
        column += cell.span;
        return start >= half * width && start < (half + 1) * width;
      });
      const first = cells[0];
      if (!first) {
        continue;
      }
      if (cells.length === 1 && first.span === width) {
        if (first.text) {
          groups.push(first.text);
        }
        continue;
      }
      if (cells.length !== width) {
        throw new ArticleParseError(
          `Строка таблицы «${heading ?? headerCells.join(', ')}»: ${cells.length} ячеек вместо ${width}`,
        );
      }
      const { name, source } = splitSourceMark(first.text, titles);
      out.push({
        name,
        source,
        cells: cells.slice(1).map((cell) => cell.text),
        inGroup: first.pad,
        groups: [...groups],
      });
    }
    result.push({
      header: headerCells.slice(half * width, (half + 1) * width),
      rows: out,
      heading,
    });
  }
  return result;
}

/** «<strong>Верёвка</strong>. Текст» → термин «Верёвка» и абзац без термина. */
function termOf(
  $: CheerioAPI,
  paragraph: Cheerio<Element>,
  titles: Map<string, string>,
): { term: string; source: RawSourceMark | null; rest: string } | null {
  const strong = paragraph.children().first();
  if (!strong.is('strong, b') || paragraph.contents().first()[0] !== strong[0]) {
    return null;
  }
  const raw = inlineText($, strong).replace(/\.$/, '').trim();
  const { name, source } = splitSourceMark(raw, titles);
  const whole = inlineText($, paragraph);
  const rest = whole
    .slice(inlineText($, strong).length)
    .replace(/^\s*\.?\s*/, '')
    .trim();
  return name ? { term: name, source, rest } : null;
}

export function parseArticlePage(html: string): RawArticle {
  const $ = cheerio.load(html);
  const bodies = $('.card__body.new-article');
  const body = bodies.last();
  if (body.length === 0) {
    throw new ArticleParseError('На странице нет текста статьи (.card__body.new-article)');
  }
  const titles = sourceTitles($);
  const title = cleanText($('h2.card-title').first().text() || $('title').text());
  const sourceLine = cleanText(bodies.first().find('li').first().text());
  const sourceTitle = /Источник:\s*«(.+)»/.exec(sourceLine)?.[1] ?? null;
  const url = $('meta[property="og:url"]').attr('content') ?? null;

  const tables: RawTable[] = [];
  const terms: RawTerm[] = [];
  const sections: RawSection[] = [];
  let h2: string | null = null;
  let heading: string | null = null;
  let currentTerm: RawTerm | null = null;
  let currentSection: RawSection | null = null;

  // Обход по порядку: заголовки, абзацы, списки и таблицы тела статьи.
  const nodes = body.find('h2, h3, h4, p, ul, ol, table').toArray();
  for (const node of nodes) {
    const element = $(node);
    if (
      element.parents('table, ul, ol').length > 0 ||
      element.closest('.new-article-menu').length
    ) {
      continue;
    }
    const tag = node.tagName.toLowerCase();
    if (tag === 'h2' || tag === 'h3') {
      heading = cleanText(element.text());
      currentTerm = null;
      if (tag === 'h2') {
        h2 = heading;
        currentSection = null;
      } else {
        const { name, source } = splitSourceMark(heading, titles);
        currentSection = { heading: name, source, parent: h2, blocks: [] };
        sections.push(currentSection);
      }
      continue;
    }
    if (tag === 'h4') {
      heading = cleanText(element.text()) || heading;
      continue;
    }
    if (tag === 'table') {
      tables.push(...readTable($, element, heading, titles));
      currentTerm = null;
      continue;
    }

    const wrapper = $('<div></div>') as Cheerio<Element>;
    const blocks = blocksFrom($, wrapper.append(element.clone()));
    if (blocks.length === 0) {
      continue;
    }
    currentSection?.blocks.push(...blocks);
    const term = tag === 'p' ? termOf($, element, titles) : null;
    if (term) {
      currentTerm = {
        term: term.term,
        source: term.source,
        section: heading,
        blocks: term.rest ? [{ type: 'paragraph', text: term.rest }] : [],
      };
      terms.push(currentTerm);
    } else if (currentTerm) {
      currentTerm.blocks.push(...blocks);
    }
  }

  return { url, title, sourceTitle, tables, terms, sections };
}
