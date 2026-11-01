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
    772: 'городской стражник: «рожок, которым можно позвать на помощь» — одна часть, наручники',
    777: 'дальний путешественник: «украшение стоимостью 10 зм» — не деньги, части с придаточными',
    789: 'преследуемый: «два языка, один из которых должен быть …», «Небожителей», «Глубинная речь»',
    820: 'великаний подкидыш: «камень или ветка, напоминающие вам о доме» — одна часть',
    858: 'награждённый: «бутылочка с чёрными чернилами», «пять листов бумаги» — число словом',
  },
  feats: {
    104: 'боевой заклинатель: требование «способность накладывать заклинание»',
    102: 'атлетичный: «Увеличьте значение Силы или Ловкости на 1» — выбор из двух',
    114: 'знаток средних доспехов: требование-владение, доспехи и щиты',
    130: 'одарённый: смешанный выбор «трёх навыков или инструментов»',
    153: 'низкорослое проворство: «Дварф или Маленькая раса», навык на выбор из двух',
    160: 'затронутый тенью: заклинание по названию и заклинание на выбор (текстом)',
    222: 'агент Порядка: «4 уровень, черта «…» (вариант)» — две группы требований',
    233: 'наследник внешних планов: требование-кампания (Planescape)',
  },
  classes: {
    87: 'варвар: «Неограниченно» в таблице, опциональные умения TCE, подкласс без «Источник» (PHB) и с ним',
    89: 'жрец: двухстрочный заголовок ячеек, домены — таблицы заклинаний по уровню жреца, умение без якоря',
    91: 'воин: списки боевых стилей и приёмов (h2 внутри умений), мистический рыцарь — таблица заклинателя',
    93: 'монах: кость в таблице («1к4»), футы, «Ловкости и Мудрости», смешанный выбор инструментов',
    104: 'колдун: «Ячейки заклинаний» и «Уровень ячеек», воззвания, расширенные списки по уровню заклинаний',
    94: 'паладин: «Источник» с точкой после кавычки (XGE) и «Dungeon Master Guide»',
    97: 'следопыт: «Источник» в голом <strong> (FTD); «Источник» TCE вложенного раздела — не книга подкласса',
    101: 'чародей: «Источник: «…».» с точкой у трёх подклассов XGE',
  },
};

const LIMIT = 100;

function shorten(text: string): string {
  const sentence = /^.*?[.!?](?=\s|$)/.exec(text)?.[0] ?? text;
  return sentence.length > LIMIT ? `${sentence.slice(0, LIMIT).trimEnd()}…` : sentence;
}

/** Абзац или пункт: термин в начале («<strong>Атлетика.</strong>») + начало текста. */
function trimParagraphs($: CheerioAPI, part: CharacterCachePart): void {
  $('.card__body p, .card__body li').each((_, node) => {
    const element = $(node);
    if (element.find('p, li, table').length > 0) return;
    const first = element.contents().first();
    const term = first.is('strong, b, em, i') ? $.html(first) : '';
    const termText = term ? cleanText(first.text()) : '';
    const rest = cleanText(element.text()).slice(termText.length).trim();
    // Предложение о диалектах нужно разбору языков целиком: из него берутся Акван и др.;
    // владения мультикласса и деньги вместо снаряжения — разбору классов.
    const whole = /включает диалекты|вот владения|никаких владений|откажетесь от этого снаряжения/;
    // Строки владений и снаряжения предысторий — перечни, нужные разбору целиком.
    const listLine =
      part === 'backgrounds' && /^(Владение [а-яё]+|Навыки|Языки|Снаряжение):?$/i.test(termText);
    const kept = whole.test(rest) || listLine ? rest : shorten(rest);
    element.html(`${term}${term && rest ? ' ' : ''}${rest ? kept : ''}`);
  });
}

/** Ячейки таблиц описаний (дикая магия, тотемы): начало текста; ячейки со ссылками — как есть. */
function trimCells($: CheerioAPI): void {
  $('.card__body td').each((_, node) => {
    const cell = $(node);
    if (cell.find('a, table').length > 0) return;
    const text = cleanText(cell.text());
    if (text.length > 40) cell.text(shorten(text));
  });
}

function fixturePage(html: string, part: CharacterCachePart): string {
  // Страница класса: Unearthed Arcana и хоумбрю после #unofficial не нужны (Р12).
  const cut = part === 'classes' ? html.indexOf("id='unofficial'") : -1;
  const $ = cheerio.load(cut > 0 ? html.slice(0, cut) : html);
  if (part === 'classes') {
    $('.spoiler_neck').remove();
    trimCells($);
  }
  $('script, style, noscript, iframe, img, svg').remove();
  trimParagraphs($, part);
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
    fs.writeFileSync(
      path.join(folder, 'pages', `article-${page.id}.html`),
      fixturePage(html, part),
    );
  }
  fs.writeFileSync(
    path.join(folder, 'index.json'),
    `${JSON.stringify({ checkedOn: cache.list.checkedOn, pages }, null, 2)}\n`,
  );
  fs.writeFileSync(path.join(folder, 'cases.json'), `${JSON.stringify(wanted, null, 2)}\n`);
  console.log(`${part}: ${pages.length} стр.`);
}
