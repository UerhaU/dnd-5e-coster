import type { TextBlock } from '@koster/shared';
import * as cheerio from 'cheerio';
import type { Cheerio, CheerioAPI } from 'cheerio';
import type { Element } from 'domhandler';
import { blocksFrom, cleanText, inlineText } from '../dndsu/text.ts';
import { splitSourceMark, type RawSourceMark } from '../items/parse-article.ts';

// Шаг parse (раздел 6) для страниц рас 5e14.dnd.su. Только чтение HTML: блоки
// особенностей («Особенности эльфов», разделы разновидностей, вкладки дварфа и гнома)
// и абзацы-термины в них. Что раса, что разновидность — решает normalize-races.ts.

export class RaceParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'RaceParseError';
  }
}

/** Особенность: «<strong>Тёмное зрение</strong>. Текст» и абзацы-продолжения. */
export interface RawFeature {
  name: string;
  blocks: TextBlock[];
}

export interface RawRaceBlock {
  /** Заголовок раздела или подпись вкладки без метки книги: «Морской эльф». */
  heading: string;
  /** Метка книги в заголовке: «(MTF)». */
  mark: RawSourceMark | null;
  /** `page` — особенности без заголовка, в начале страницы («Своё происхождение»). `tab` — вкладка `.multiforo` (дварф, гном): в ней слиты особенности расы и разновидности. */
  layout: 'h2' | 'h3' | 'tab' | 'page';
  /** Ближайший раздел h2 выше (для h3 и вкладок): «Гоблины Эберрона (RLW)». */
  parent: { heading: string; mark: RawSourceMark | null } | null;
  /** `id` подписи вкладки: «hill», «duergar-MTF». */
  tabId: string | null;
  /** Абзац «Источник: Mordenkainen’s Tome of Foes» внутри блока. */
  sourceTitle: string | null;
  /** Абзацы до первой особенности. */
  lead: TextBlock[];
  features: RawFeature[];
}

export interface RawRacePage {
  url: string | null;
  nameRu: string;
  /** Из заголовка «Эльф [Elf]». */
  nameEn: string | null;
  /** «Источник: «Player's Handbook»» в карточке. */
  sourceTitle: string | null;
  /** Абзацы в начале страницы, до первого заголовка. */
  intro: TextBlock[];
  /** Только блоки с особенностями расы (характеристики, размер, скорость, языки). */
  blocks: RawRaceBlock[];
}

/** Особенности, по которым блок узнаётся как набор особенностей расы. */
const CORE_FEATURES = /^(Увеличение характеристик?|Размер|Скорость|Языки|Вид существа)/;

const SOURCE_LINE = /^Источник:\s*«?(.+?)»?\.?$/;

/** Название особенности, если абзац начинается с него: `<strong>`, `<em><strong>`, `.article-body__feature-name`, `.dnd-feature-name`. */
function featureName($: CheerioAPI, paragraph: Cheerio<Element>): string | null {
  const head = paragraph.find('strong, b, .article-body__feature-name, .dnd-feature-name').first();
  const name = cleanText(head.text());
  if (!name || !cleanText(paragraph.text()).startsWith(name)) {
    return null;
  }
  return name.replace(/[.:]\s*$/, '').trim() || null;
}

function restAfter($: CheerioAPI, paragraph: Cheerio<Element>, name: string): string {
  const whole = inlineText($, paragraph);
  return whole
    .slice(whole.indexOf(name) + name.length)
    .replace(/^\s*[.:]?\s*/, '')
    .trim();
}

function toBlocks($: CheerioAPI, element: Cheerio<Element>): TextBlock[] {
  const wrapper = $('<div></div>') as Cheerio<Element>;
  return blocksFrom($, wrapper.append(element.clone()));
}

/** Абзацы, списки и таблицы блока по порядку → вступление и особенности. */
function readBlockContent(
  $: CheerioAPI,
  nodes: Element[],
): { sourceTitle: string | null; lead: TextBlock[]; features: RawFeature[] } {
  let sourceTitle: string | null = null;
  const lead: TextBlock[] = [];
  const features: RawFeature[] = [];
  let current: RawFeature | null = null;
  for (const node of nodes) {
    const element = $(node);
    const text = cleanText(element.text());
    if (!text) continue;
    const source = node.tagName === 'p' ? SOURCE_LINE.exec(text) : null;
    if (source && !sourceTitle && features.length === 0) {
      sourceTitle = source[1] ?? null;
      continue;
    }
    const name = node.tagName === 'p' ? featureName($, element) : null;
    // «Лидер: …», «Штаб-квартира: …» у домов драконьих меток — не особенности.
    if (name && !/:\s*$/.test(cleanText(element.find('strong, b').first().text()))) {
      const rest = restAfter($, element, name);
      current = { name, blocks: rest ? [{ type: 'paragraph', text: rest }] : [] };
      features.push(current);
      continue;
    }
    (current?.blocks ?? lead).push(...toBlocks($, element));
  }
  return { sourceTitle, lead, features };
}

export function parseRacePage(html: string): RawRacePage {
  const $ = cheerio.load(html);
  const body = $('.card__body.new-article').last();
  if (body.length === 0) {
    throw new RaceParseError('На странице нет текста расы (.card__body.new-article)');
  }
  const title = cleanText($('h2.card-title').first().text());
  const titleMatch = /^(.*?)\s*\[([^\]]+)\]\s*$/.exec(title);
  const sourceLine = cleanText($('ul.params').first().text());
  const sourceTitle = /Источник:\s*«([^»]+)»/.exec(sourceLine)?.[1] ?? null;
  const url = $('meta[property="og:url"]').attr('content') ?? null;

  // Обход тела статьи по порядку: заголовок или вкладка открывает новый блок.
  let intro: TextBlock[] = [];
  const blocks: RawRaceBlock[] = [];
  let parent: RawRaceBlock['parent'] = null;
  const nameRu = titleMatch?.[1] ?? title;
  // До первого заголовка — вступление страницы; если в нём особенности, это блок `page`.
  let open: {
    block: Omit<RawRaceBlock, 'sourceTitle' | 'lead' | 'features'>;
    nodes: Element[];
  } | null = {
    block: { heading: nameRu, mark: null, layout: 'page', tabId: null, parent: null },
    nodes: [],
  };
  const close = () => {
    if (!open) return;
    const content = readBlockContent($, open.nodes);
    if (content.features.some((feature) => CORE_FEATURES.test(feature.name))) {
      blocks.push({ ...open.block, ...content });
    } else if (open.block.layout === 'page') {
      intro = content.lead;
    }
    open = null;
  };

  const nodes = body.find('h2, h3, p, ul, ol, table, .multiforo').toArray();
  for (const node of nodes) {
    const element = $(node);
    if (
      element.parents('table, ul, ol').length > 0 ||
      element.closest('.new-article-menu, .params, .card-menu__list').length > 0
    ) {
      continue;
    }
    const tab = element.parents('.multiforo').first();
    if (node.tagName === 'div') {
      close();
      const caption = cheerio.load(element.attr('caption') ?? '');
      const { name, source } = splitSourceMark(cleanText(caption.text()));
      open = {
        block: {
          heading: name,
          mark: source,
          layout: 'tab',
          tabId: caption('span').attr('id') ?? null,
          parent,
        },
        nodes: [],
      };
      continue;
    }
    if (tab.length > 0) {
      // Внутри вкладки — только её содержимое; заголовки вкладок не бывают.
      if (node.tagName !== 'h2' && node.tagName !== 'h3') open?.nodes.push(node);
      continue;
    }
    if (open?.block.layout === 'tab') close();
    if (node.tagName === 'h2' || node.tagName === 'h3') {
      close();
      const { name, source } = splitSourceMark(cleanText(element.text()));
      if (node.tagName === 'h2') parent = { heading: name, mark: source };
      open = {
        block: {
          heading: name,
          mark: source,
          layout: node.tagName,
          tabId: null,
          parent: node.tagName === 'h3' ? parent : null,
        },
        nodes: [],
      };
      continue;
    }
    open?.nodes.push(node);
  }
  close();

  return {
    url,
    nameRu,
    nameEn: titleMatch?.[2] ?? null,
    sourceTitle,
    intro,
    blocks,
  };
}
