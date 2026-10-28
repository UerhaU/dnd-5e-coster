// Пересобрать тестовые страницы этапа 3 data/fixtures/dndsu/character/ из кэша
// storage/dndsu-character/.
//
//   node packages/importer/src/cli/make-character-fixtures.ts
//
// Тексты DnD.su не кладутся в git целиком (Р47): от страницы остаются карточка,
// заголовки, таблицы-перечни (названия, характеристики, письменность) и начало каждого
// абзаца и пункта списка — до первой точки, не длиннее 100 знаков. Подсказки
// `tooltip-for` в таблицах сохраняются: по ним разбираются навыки.

import fs from 'node:fs';
import path from 'node:path';
import * as cheerio from 'cheerio';
import type { CheerioAPI } from 'cheerio';
import { CHARACTER_CACHE_PARTS, type CharacterCachePart } from '../character/character-cache.ts';
import { openArticleCache } from '../dndsu/article-cache.ts';
import { cleanText } from '../dndsu/text.ts';
import { DEFAULT_PATHS } from '../paths.ts';

/** Страницы по папкам кэша: номер → зачем она в тестах. */
const FIXTURE_PAGES: Record<CharacterCachePart, Record<number, string>> = {
  reference: {
    468: 'навыки: таблицы с несколькими строками-заголовками, термины <em><strong>, раздел «СКРЫТНОСТЬ»',
    209: 'языки: таблицы по книгам, повтор языка с другой письменностью, диалекты Первичного',
    27: 'состояния: разделы h3, «Сбитый с ног / Лежащий ничком», таблица истощения',
  },
  backgrounds: {
    757: 'артист: навыки и инструменты подсказками, группа «музыкальный инструмент», разновидность «Гладиатор»',
    763: 'народный герой: транспорт (наземное), группа ремесленных инструментов',
    782: 'утгардтский соплеменник: строки владений внутри раздела',
    790: 'следователь: двоеточие после <strong>, «Выберите два навыка из следующих»',
    845: 'адаптация предысторий VRGR: без владений, название — из names.json',
  },
  feats: {
    104: 'боевой заклинатель: требование «способность накладывать заклинание»',
  },
};

const LIMIT = 100;

function shorten(text: string): string {
  const sentence = /^.*?[.!?](?=\s|$)/.exec(text)?.[0] ?? text;
  return sentence.length > LIMIT ? `${sentence.slice(0, LIMIT).trimEnd()}…` : sentence;
}

/** Абзац или пункт: термин в начале («<strong>Атлетика.</strong>») + начало текста. */
function trimParagraphs($: CheerioAPI): void {
  $('.card__body p, .card__body li').each((_, node) => {
    const element = $(node);
    if (element.find('p, li, table').length > 0) return;
    const first = element.contents().first();
    const term = first.is('strong, b, em, i') ? $.html(first) : '';
    const termText = term ? cleanText(first.text()) : '';
    const rest = cleanText(element.text()).slice(termText.length).trim();
    // Предложение о диалектах нужно разбору языков целиком: из него берутся Акван и др.
    const kept = /включает диалекты/.test(rest) ? rest : shorten(rest);
    element.html(`${term}${term && rest ? ' ' : ''}${rest ? kept : ''}`);
  });
}

function fixturePage(html: string): string {
  const $ = cheerio.load(html);
  $('script, style, noscript, iframe, img, svg').remove();
  trimParagraphs($);
  const url = $('meta[property="og:url"]').attr('content') ?? '';
  const title = $.html($('h2.card-title').first());
  const bodies = $('.card__body.new-article, .card__body:has(ul.params)')
    .toArray()
    .map((node) => $.html(node))
    .join('\n');
  return `<!doctype html>\n<html><head><meta property="og:url" content="${url}"></head>\n<body>\n${title}\n${bodies}\n</body></html>\n`;
}

for (const part of CHARACTER_CACHE_PARTS) {
  const cache = openArticleCache(path.join(DEFAULT_PATHS.characterCache, part));
  const folder = path.join(DEFAULT_PATHS.characterFixtures, part);
  fs.rmSync(path.join(folder, 'pages'), { recursive: true, force: true });
  fs.mkdirSync(path.join(folder, 'pages'), { recursive: true });
  const wanted = FIXTURE_PAGES[part];
  const pages = cache.list.pages.filter((page) => String(page.id) in wanted);
  for (const page of pages) {
    const html = cache.readPage(page.id);
    if (html === null) throw new Error(`Нет в кэше: ${page.url}`);
    fs.writeFileSync(path.join(folder, 'pages', `article-${page.id}.html`), fixturePage(html));
  }
  fs.writeFileSync(
    path.join(folder, 'index.json'),
    `${JSON.stringify({ checkedOn: cache.list.checkedOn, pages }, null, 2)}\n`,
  );
  fs.writeFileSync(path.join(folder, 'cases.json'), `${JSON.stringify(wanted, null, 2)}\n`);
  console.log(`${part}: ${pages.length} стр.`);
}
