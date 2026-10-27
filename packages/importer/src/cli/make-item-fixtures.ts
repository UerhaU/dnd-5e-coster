// Пересобрать тестовые статьи data/fixtures/dndsu/articles/ из кэша storage/dndsu-articles/.
//
//   node packages/importer/src/cli/make-item-fixtures.ts
//
// Тексты DnD.su не кладутся в git целиком (Р47): от статьи остаются карточка,
// строки-группы таблиц и строки только перечисленных предметов, абзацы описаний —
// только для них. Список — по предмету на трудный случай.

import fs from 'node:fs';
import path from 'node:path';
import * as cheerio from 'cheerio';
import { openArticleCache } from '../dndsu/article-cache.ts';
import { cleanText } from '../dndsu/text.ts';
import { baseName } from '../items/describe.ts';
import { splitSourceMark } from '../items/parse-article.ts';
import { DEFAULT_PATHS } from '../paths.ts';
import { nameKey } from '../reviewed/reviewed-items.ts';

const FIXTURE_ITEMS: Record<string, string> = {
  Стёганый: 'лёгкий доспех, помеха Скрытности',
  Чешуйчатый: 'средний доспех: предел Ловкости, описание «Чешуйчатый доспех»',
  Кольчуга: 'тяжёлый доспех, требование Силы',
  Щит: 'щит: +2 КД, время «1 действие»',
  Кинжал: 'метательное с дистанцией, фехтовальное, лёгкое',
  'Длинный меч': 'универсальное (1к10)',
  Трезубец: 'опечатка сайта «дис.. 20/60»',
  'Арбалет, лёгкий': 'боеприпас, перезарядка, запятая в названии',
  'Духовая трубка': 'фиксированный урон «1 колющий»',
  Сеть: 'нет урона, особое, описание в «Особом оружии»',
  Дротик: 'вес «¼ фнт.», цена в медных',
  Иклва: 'дополнительное оружие (ToA), раздел h3',
  Хупак: '«1к6 колющего урона», «Боеприпас (40/160 фт.)»',
  Стрелы: 'боеприпас «(20)» в группе таблицы',
  Абак: 'обычный предмет без описания',
  'Зелье лечения': 'английское название в скобках',
  'Верёвка пеньковая': 'описание общим термином «Верёвка»',
  Рюкзак: 'входит в наборы',
  Трутница: 'входит в наборы',
  Бурдюк: 'вес «(полн.)»',
  'Волшебная палочка': 'группа «Магическая фокусировка»',
  'Подзорная труба': 'цена «1 000 зм»',
  'Воровские инструменты': 'левая половина таблицы инструментов',
  Лютня: 'музыкальный инструмент',
  'Инструменты алхимика': 'правая половина таблицы, инструменты ремесленников',
  'Набор путешественника': 'набор: состав ссылками',
  'Набор охотника на монстров': 'набор с меткой «(СOS)» кириллицей',
  Безаварий: 'описание без строки таблицы (в отчёт)',
  Пистоль: 'огнестрельное, эпоха Возрождения',
  Пули: 'боеприпас огнестрельного оружия',
  Револьвер: 'боекомплект, цена «-»',
  Батарея: 'вес в унциях',
  Бомба: 'взрывчатка, раздел h3',
  Гранатомёт: 'описание в разделе «Гранаты»',
  'Боевой конь': 'скакун: скорость и грузоподъёмность столбцами',
  Военное: 'подпункт группы «Сёдла» с отступом пробелом → «Седло, военное»',
  Телега: 'строка после группы «Сёдла» без отступа — не седло, а транспорт',
  Доспех: 'строка «×4 ×2» — не предмет (skipRows)',
  Каноэ: 'водный транспорт с меткой книги (TOA)',
  'Боевой воздушный шар': 'воздушный транспорт, цена «—»',
  'Астральный бриг': 'метка книги у группы «Межпланарный транспорт (MTF)»',
  'Дьявольский гонщик': 'объединённая ячейка «Экипаж / Пассажиры» (BGDIA)',
};

/** Общие описания, к которым относятся предметы из списка. */
const FIXTURE_TERMS = [
  'Щиты',
  'Верёвка',
  'Магическая фокусировка',
  'Музыкальные инструменты',
  'Инструменты ремесленников',
  'Гранаты',
];

const keep = new Set([...Object.keys(FIXTURE_ITEMS), ...FIXTURE_TERMS].map(nameKey));
const kept = (text: string) => {
  const name = splitSourceMark(text.replace(/\s*\[[^\]]+\]\s*$/, '')).name;
  return [name, baseName(name), name.replace(/\s*\(\d+\)$/, ''), name.replace(/ доспех$/, '')]
    .map(nameKey)
    .some((key) => keep.has(key));
};

const cache = openArticleCache(DEFAULT_PATHS.itemCache);
const outDir = DEFAULT_PATHS.itemFixtures;
fs.rmSync(outDir, { recursive: true, force: true });
fs.mkdirSync(path.join(outDir, 'pages'), { recursive: true });

for (const page of cache.list.pages) {
  const $ = cheerio.load(cache.readPage(page.id) ?? '');
  const card = $('.card__body.new-article').first().closest('div.card');
  const body = card.find('.card__body.new-article');

  // Строки таблиц: группы остаются, предметы — только из списка.
  body.find('table tr').each((index, row) => {
    const cells = $(row).children('td, th');
    const isHeader = $(row).hasClass('table_header') || index === 0;
    const isGroup = cells.length === 1 || cells.first().attr('colspan') !== undefined;
    const equipTime = $(row).closest('table').text().includes('Надевание');
    const name = cleanText(cells.first().text());
    const second = cells.length === 6 ? cleanText(cells.eq(3).text()) : '';
    if (!isHeader && !isGroup && !equipTime && !kept(name) && !(second && kept(second))) {
      $(row).remove();
    }
  });
  // Абзацы: «Термин. Текст» и его продолжения — только для предметов из списка;
  // разделы h3 с меткой книги (дополнительное оружие, взрывчатка) — тоже.
  let context = false;
  body.find('h2, h3, p, ul, ol').each((_, node) => {
    const element = $(node);
    const text = cleanText(element.text());
    // Списки — как абзацы: остаются только в разделе предмета из списка.
    if (node.tagName === 'ul' || node.tagName === 'ol') {
      if (!context && element.parents('table').length === 0 && !element.hasClass('params')) {
        element.remove();
      }
      return;
    }
    if (node.tagName !== 'p') {
      context = kept(text);
      if (!context && node.tagName === 'h3' && splitSourceMark(text).source) {
        element.nextUntil('h2, h3').remove();
        element.remove();
      }
      return;
    }
    const strong = element.children('strong, b').first();
    if (strong.length) {
      const term = cleanText(strong.text())
        .replace(/\.$/, '')
        .replace(/\s*\([^)]*\d[^)]*\)$/, '');
      context = kept(term);
    }
    if (!context) {
      element.remove();
    }
  });
  body.find('script, .gallery, .comments, img').remove();
  // Блоки статистики кораблей (свёрнутые `.hide-wrapper`) — только у предметов из списка;
  // обёртки, от которых ничего не осталось, — тоже прочь.
  body.find('.hide-wrapper').each((_, node) => {
    const headings = $(node).find('h2, h3').toArray();
    if (!headings.some((heading) => kept(cleanText($(heading).text())))) $(node).remove();
  });
  body.find('div').each((_, node) => {
    if (!cleanText($(node).text())) $(node).remove();
  });

  const html = [
    '<!doctype html>',
    `<!-- ${page.url}, кэш от ${cache.list.checkedOn}. Урезано до тестовых строк (Р47). -->`,
    `<html><head><meta property="og:url" content="${page.url}"></head><body>`,
    $.html(card),
    '</body></html>',
    '',
  ].join('\n');
  fs.writeFileSync(cache.pagePath(page.id).replace(cache.folder, outDir), html);
}

fs.writeFileSync(path.join(outDir, 'index.json'), `${JSON.stringify(cache.list, null, 2)}\n`);
fs.writeFileSync(path.join(outDir, 'cases.json'), `${JSON.stringify(FIXTURE_ITEMS, null, 2)}\n`);
console.log(`Тестовых статей: ${cache.list.pages.length} → ${outDir}`);
