// Пересобрать тестовые страницы рас data/fixtures/dndsu/races/ из кэша storage/dndsu-races/.
//
//   node packages/importer/src/cli/make-race-fixtures.ts
//
// Тексты DnD.su не кладутся в git целиком (Р47): от страницы остаются карточка,
// заголовки перечисленных блоков и абзацы особенностей в них; описание расы, таблицы
// (кроме «Случайные рост и вес») и прочие разделы убираются. Список — по странице
// на трудный случай.

import fs from 'node:fs';
import path from 'node:path';
import * as cheerio from 'cheerio';
import { openArticleCache } from '../dndsu/article-cache.ts';
import { cleanText } from '../dndsu/text.ts';
import { splitSourceMark } from '../items/parse-article.ts';
import { DEFAULT_PATHS } from '../paths.ts';
import { nameKey } from '../reviewed/reviewed-items.ts';

/** Страница → заголовки блоков, которые остаются (первый блок страницы — всегда). */
const FIXTURE_PAGES: Record<number, { why: string; keep: string[] }> = {
  79: {
    why: 'эльф: разделы-разновидности, метка книги, источник внутри раздела, UA — пропуск',
    keep: ['Высший эльф', 'Тёмный эльф (дроу)', 'Морской эльф', 'Авариэль'],
  },
  78: { why: 'дварф: вкладки со слитыми особенностями, общее вычисляется', keep: [] },
  92: { why: 'ааракокра VGM: полёт «летать со скоростью 50 футов»', keep: [] },
  278: { why: 'ааракокра MPMM: увеличение на выбор, повтор ID → суффикс книги (Р67)', keep: [] },
  166: {
    why: 'гоблин: та же раса из другой книги, книга — из заголовка раздела выше',
    keep: ['ОСОБЕННОСТИ ГОБЛИНОВ', 'Гоблин'],
  },
  223: { why: 'своё происхождение: особенности без заголовка, размер на выбор', keep: [] },
  165: {
    why: 'гит: таблица «Случайные рост и вес» по разновидностям, «навыком или инструментом»',
    keep: ['Гитцераи', 'Гитъянки'],
  },
  173: { why: 'кентавр: формула роста и веса абзацами после «Размера» (MOT)', keep: [] },
};

const cache = openArticleCache(DEFAULT_PATHS.raceCache);
const outDir = DEFAULT_PATHS.raceFixtures;
fs.rmSync(outDir, { recursive: true, force: true });
fs.mkdirSync(path.join(outDir, 'pages'), { recursive: true });

const pages = cache.list.pages.filter((page) => page.id in FIXTURE_PAGES);
for (const page of pages) {
  const $ = cheerio.load(cache.readPage(page.id) ?? '');
  const keep = new Set((FIXTURE_PAGES[page.id]?.keep ?? []).map(nameKey));
  const card = $('.card__body.new-article').last().closest('div.card');
  const body = card.find('.card__body.new-article').last();

  // Абзац особенности: начинается с названия в <strong> или в span-подписи.
  const isFeature = (element: ReturnType<typeof $>) => {
    const head = cleanText(
      element.find('strong, b, .article-body__feature-name, .dnd-feature-name').first().text(),
    );
    return head !== '' && cleanText(element.text()).startsWith(head);
  };

  let context = true;
  let firstBlock = true;
  body.find('h2, h3, p, ul, ol, table').each((_, node) => {
    const element = $(node);
    if (element.closest('.multiforo').length > 0) {
      if (node.tagName === 'p' && !isFeature(element)) element.remove();
      if (node.tagName !== 'p') element.remove();
      return;
    }
    if (element.parents('table, ul, ol').length > 0 || element.closest('.params').length > 0)
      return;
    // Таблица роста и веса нужна разбору (Р69): цифры, а не текст правил.
    if (node.tagName === 'table' && cleanText(element.text()).includes('Базовый рост')) return;
    if (node.tagName === 'h2' || node.tagName === 'h3') {
      const heading = splitSourceMark(cleanText(element.text())).name;
      // Первый блок «Особенности …» страницы — раса: остаётся вместе с заголовком.
      const isFirst = firstBlock && /^особенност/i.test(heading);
      if (isFirst) firstBlock = false;
      context = isFirst || keep.has(nameKey(heading));
      if (!context) element.remove();
      return;
    }
    if (node.tagName !== 'p' || !context || !isFeature(element)) {
      if (!(node.tagName === 'p' && context && /^Источник:/.test(cleanText(element.text())))) {
        element.remove();
      }
    }
  });
  body.find('script, img, .gallery, .comments, .new-article-menu, br').remove();
  body.find('div').each((_, node) => {
    if (!cleanText($(node).text())) $(node).remove();
  });

  const html = [
    '<!doctype html>',
    `<!-- ${page.url}, кэш от ${cache.list.checkedOn}. Урезано до тестовых блоков (Р47). -->`,
    `<html><head><meta property="og:url" content="${page.url}"></head><body>`,
    $.html(card),
    '</body></html>',
    '',
  ].join('\n');
  fs.writeFileSync(cache.pagePath(page.id).replace(cache.folder, outDir), html);
}

fs.writeFileSync(
  path.join(outDir, 'index.json'),
  `${JSON.stringify({ ...cache.list, pages }, null, 2)}\n`,
);
fs.writeFileSync(
  path.join(outDir, 'cases.json'),
  `${JSON.stringify(
    Object.fromEntries(Object.entries(FIXTURE_PAGES).map(([id, entry]) => [id, entry.why])),
    null,
    2,
  )}\n`,
);
console.log(`Тестовых страниц рас: ${pages.length} → ${outDir}`);
