import type { TextBlock } from '@koster/shared';
import type { Cheerio, CheerioAPI } from 'cheerio';
import type { AnyNode, Element } from 'domhandler';

// HTML страницы DnD.su → простой текст и блоки (раздел 4.5: HTML в каталог не попадает).

/** Текст узла: `<br>` — перенос строки, лишние пробелы схлопнуты. */
export function inlineText($: CheerioAPI, node: Cheerio<AnyNode>): string {
  const clone = node.clone();
  clone.find('br').replaceWith('\n');
  return cleanText(clone.text());
}

export function cleanText(value: string): string {
  return value
    .replace(/\u00a0/g, ' ')
    .split('\n')
    .map((line) => line.replace(/[ \t\r\f\v]+/g, ' ').trim())
    .join('\n')
    .replace(/\n{2,}/g, '\n')
    .trim();
}

function tableBlock($: CheerioAPI, table: Cheerio<Element>): TextBlock | null {
  const rows = table
    .find('tr')
    .toArray()
    .map((tr) => ({
      header: $(tr).hasClass('table_header') || $(tr).children('th').length > 0,
      cells: $(tr)
        .children('td, th')
        .toArray()
        .map((cell) => inlineText($, $(cell)).replace(/\n/g, ' ')),
    }));
  const headerRow = rows[0]?.header ? rows[0] : null;
  const body = rows.filter((row) => row !== headerRow).map((row) => row.cells);
  if (body.length === 0) {
    return null;
  }
  return { type: 'table', caption: null, header: headerRow?.cells ?? null, rows: body };
}

function quoteBlock($: CheerioAPI, quote: Cheerio<Element>): TextBlock | null {
  const lines = inlineText($, quote).split('\n');
  const last = lines.at(-1) ?? '';
  const attribution = lines.length > 1 && /^[—–-]\s*\S/.test(last) ? last : null;
  const body = (attribution ? lines.slice(0, -1) : lines).join('\n').trim();
  return body ? { type: 'quote', text: body, attribution } : null;
}

/**
 * Блоки описания: абзацы, заголовки, списки, таблицы, цитаты.
 * Обёртки (`div`) раскрываются, разделители (`hr`) пропускаются.
 */
export function blocksFrom($: CheerioAPI, container: Cheerio<Element>): TextBlock[] {
  const blocks: TextBlock[] = [];
  let loose: string[] = [];

  const flushLoose = () => {
    const paragraph = cleanText(loose.join(''));
    if (paragraph) {
      blocks.push({ type: 'paragraph', text: paragraph });
    }
    loose = [];
  };

  for (const node of container.contents().toArray()) {
    if (node.type === 'text') {
      loose.push($(node).text());
      continue;
    }
    if (node.type !== 'tag') {
      continue;
    }
    const element = $(node);
    const tag = node.tagName.toLowerCase();

    if (['strong', 'em', 'b', 'i', 'span', 'a', 'nobr', 'sup'].includes(tag)) {
      loose.push(element.text());
      continue;
    }
    flushLoose();

    if (tag === 'br' || tag === 'hr') {
      continue;
    }
    if (tag === 'p') {
      const paragraph = inlineText($, element);
      if (paragraph) {
        blocks.push({ type: 'paragraph', text: paragraph });
      }
    } else if (/^h[1-6]$/.test(tag)) {
      const heading = inlineText($, element).replace(/\n/g, ' ');
      if (heading) {
        blocks.push({ type: 'heading', text: heading });
      }
    } else if (tag === 'ul' || tag === 'ol') {
      const items = element
        .children('li')
        .toArray()
        .map((li) => inlineText($, $(li)))
        .filter((item) => item);
      if (items.length > 0) {
        blocks.push({ type: 'list', ordered: tag === 'ol', items });
      }
    } else if (tag === 'table') {
      const table = tableBlock($, element);
      if (table) {
        blocks.push(table);
      }
    } else if (tag === 'blockquote') {
      const quote = quoteBlock($, element);
      if (quote) {
        blocks.push(quote);
      }
    } else {
      blocks.push(...blocksFrom($, element));
    }
  }
  flushLoose();
  return blocks;
}
