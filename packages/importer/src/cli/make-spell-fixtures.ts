// Пересобрать тестовые страницы data/fixtures/dndsu/spells/ из кэша storage/spell-fill/.
//
//   node packages/importer/src/cli/make-spell-fixtures.ts
//
// От каждой страницы остаётся только карточка заклинания: без комментариев,
// скриптов и оформления сайта. Список — по одному заклинанию на трудный случай.

import fs from 'node:fs';
import path from 'node:path';
import * as cheerio from 'cheerio';
import { openSpellCache } from '../dndsu/spell-cache.ts';
import { DEFAULT_PATHS } from '../paths.ts';

const FIXTURE_SPELLS: Record<number, string> = {
  1: 'реакция с условием',
  2: 'дополнительный класс TCE, накладывание в часах, материалы «один из»',
  12: 'список в описании',
  22: 'дистанция в милях, заголовки и таблицы',
  114: 'длительность «пока не рассеяно или не сработает»',
  137: 'врезка additionalInfo с заголовком',
  143: 'полусфера, ритуал',
  176: 'таблица с шапкой',
  195: 'ритуал и концентрация',
  203: 'конус «на себя»',
  205: 'базовый случай, ссылка на PH24, подклассы, проверенные правила',
  223: '«ё» в названии, реакция',
  304: 'накладывание «1 действие или 8 часов»',
  374: 'длительность «Мгновенная или 1 час», два источника',
  401: 'два источника, реакция, проверенные правила',
  474: 'абзац после «На больших уровнях»',
  741: 'нет классов, особый доступ',
  1922: 'компонент «М (А 2 зм)» — вероятная опечатка сайта',
  2340: 'компоненты М и А с пояснениями',
  2341: 'компонент А, цитата, заголовок',
  2441: 'дюнамантия, только подклассы',
  4664: 'конус без «на себя», «На больших уровнях .» с пробелом',
};

const cache = openSpellCache(DEFAULT_PATHS.spellCache);
const outDir = DEFAULT_PATHS.spellFixtures;
fs.rmSync(outDir, { recursive: true, force: true });
fs.mkdirSync(path.join(outDir, 'pages'), { recursive: true });

const ids = Object.keys(FIXTURE_SPELLS).map(Number);
const cards = cache.list.cards.filter((card) => ids.includes(card.siteId));
if (cards.length !== ids.length) {
  throw new Error('Не все заклинания из списка есть в кэше');
}

for (const card of cards) {
  const $ = cheerio.load(cache.readPage(card.siteId) ?? '');
  const html = $.html($('div.card.card__category-spells').first());
  const page = [
    '<!doctype html>',
    `<!-- ${card.url}, кэш от ${cache.list.checkedOn}. Случай: ${FIXTURE_SPELLS[card.siteId]} -->`,
    '<html><body>',
    html,
    '</body></html>',
    '',
  ].join('\n');
  fs.writeFileSync(cache.pagePath(card.siteId).replace(cache.folder, outDir), page);
}

const list = {
  checkedOn: cache.list.checkedOn,
  edition: cache.list.edition,
  cards,
  maps: cache.list.maps,
};
fs.writeFileSync(path.join(outDir, 'index.json'), `${JSON.stringify(list, null, 2)}\n`);
console.log(`Тестовых страниц: ${cards.length} → ${outDir}`);
