import type { TextBlock } from '@koster/shared';
import * as cheerio from 'cheerio';
import type { Cheerio, CheerioAPI } from 'cheerio';
import type { Element } from 'domhandler';
import { blocksFrom, cleanText, inlineText } from '../dndsu/text.ts';

// Шаг parse (раздел 6) для страниц классов 5e14.dnd.su (/class/N-…): класс и все
// подклассы — на одной странице. Только чтение HTML; механику решает normalize.
//
// Устройство страницы: карточка «Варвар [Barbarian]», строка «Источник», вступление,
// таблица `table.class_table`, разделы h3 (создание, мультикласс), h2 «Классовые
// умения» с блоком «Хиты, владение и снаряжение» и особенностями h3 + «<em>3-й
// уровень, умение …</em>», h2 вступления подклассов, h2 каждого подкласса
// (`<span id='primal.berserker'>`) с «Источник: «…»» и особенностями. Всё после
// `#unofficial` (Unearthed Arcana, хоумбрю) отбрасывается (Р12, Р67).

export class ClassParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ClassParseError';
  }
}

export interface RawSection {
  name: string;
  blocks: TextBlock[];
}

export interface RawFeature {
  /** Якорь `feature.rage` без приставки; у особенностей подкласса — `null`. */
  key: string | null;
  nameRu: string;
  /** Строка под заголовком: «3-й уровень, опциональное умение варвара». */
  subtitle: string;
  level: number;
  optional: boolean;
  blocks: TextBlock[];
  subsections: RawSection[];
}

export interface RawCell {
  text: string;
  /** Ссылки на особенности: якорь (`rage`, `primal-path`) и подпись («Умение пути»). */
  features: { key: string; text: string }[];
  /** Номера страниц заклинаний: 123 из `/spells/123-…/`. */
  spellPages: number[];
}

export interface RawTable {
  caption: string | null;
  /** Заголовки: двухстрочный заголовок ячеек склеен в «Ячейки 1» … «Ячейки 9». */
  header: string[];
  rows: RawCell[][];
}

export interface RawSubclass {
  anchor: string;
  nameRu: string;
  /** Книга из «Источник: «…»»; `null` — строки нет (Player's Handbook). */
  sourceTitle: string | null;
  intro: TextBlock[];
  features: RawFeature[];
  sections: RawSection[];
  tables: RawTable[];
}

export interface RawOptionList {
  name: string;
  blocks: TextBlock[];
  items: RawSection[];
}

export interface RawClassPage {
  nameRu: string;
  nameEn: string;
  sourceTitle: string | null;
  intro: TextBlock[];
  sections: RawSection[];
  multiclass: TextBlock[];
  /** Абзацы «Метка: текст» блока «Хиты, владение и снаряжение». */
  summary: { label: string; text: string }[];
  /** Пункты списка снаряжения: «а) секира или б) любое воинское рукопашное оружие». */
  equipment: string[];
  /** Абзацы без метки: «Вы начинаете…», «Если вы откажетесь… 2к4×10 зм», заметки. */
  notes: string[];
  table: RawTable;
  features: RawFeature[];
  /** Списки вариантов (h2 внутри умений): воззвания, боевые приёмы, инфузии. */
  options: RawOptionList[];
  subclassIntro: RawSection;
  subclasses: RawSubclass[];
}

interface Chunk {
  element: Cheerio<Element>;
  tag: string;
  /** Внутри `.TCE-feature-on`: опциональная особенность TCE. */
  tce: boolean;
}

const WRAPPERS = new Set(['div', 'span', 'section', 'article', 'center']);
const LEVEL_SUBTITLE = /^(\d+)-[а-яё]+ уровень,\s*(опциональн[а-яё]+\s+)?умени/i;

/** Элементы описания в порядке страницы: обёртки раскрываются, меню и дубли-спойлеры пропускаются. */
function flatten($: CheerioAPI, root: Cheerio<Element>, tce = false, out: Chunk[] = []): Chunk[] {
  for (const node of root.contents().toArray()) {
    if (node.type !== 'tag') continue;
    const element = $(node);
    const tag = node.tagName.toLowerCase();
    if (element.is('.spoiler_neck, .content-switch, .new-article-menu, script, style')) continue;
    const inTce = tce || element.hasClass('TCE-feature-on');
    if (WRAPPERS.has(tag) && element.children().length > 0 && !element.is('.long, .short')) {
      flatten($, element, inTce, out);
      continue;
    }
    if (tag === 'br' || tag === 'hr') continue;
    out.push({ element, tag, tce: inTce });
  }
  return out;
}

function blocksOf($: CheerioAPI, chunks: Chunk[]): TextBlock[] {
  const box = $('<div></div>') as Cheerio<Element>;
  for (const chunk of chunks) box.append(chunk.element.clone());
  return blocksFrom($, box);
}

const pageNumber = (href: string, part: string) =>
  Number(new RegExp(`/${part}/(\\d+)-`).exec(href)?.[1] ?? NaN);

/**
 * Ключи особенностей попадут в сохранения персонажей: опечатки якорей сайта (Р80) и
 * ключи не как у других классов (Р81: паладин — `TCE-spells`, у остальных `extra-spells`).
 * Ключи — строчными (`ASI` → `asi`), здесь — уже строчные.
 */
const FEATURE_KEY_FIXES: Record<string, string> = {
  'otherwordly-patron': 'otherworldly-patron',
  'unarmored-defence': 'unarmored-defense',
  'tce-spells': 'extra-spells',
  'tce-fighting-styles': 'fighting-style-variants',
};

/** `feature.otherwordly-patron` (якорь или ссылка `#feature.…`) → ключ особенности. */
function featureKeyOf(anchor: string): string {
  const key = anchor.replace(/^#?feature\./, '').toLowerCase();
  return FEATURE_KEY_FIXES[key] ?? key;
}

function cellOf($: CheerioAPI, cell: Cheerio<Element>): RawCell {
  const clone = cell.clone();
  clone.find('.short').remove();
  // `.TCE-feature-off` — то, что сайт прячет при включённом TCE. Прочерк («-» вместо
  // «Формул заговоров») убирается; умение остаётся: у жреца на 8-м «Умение божественного
  // домена» и «Благословлённые удары» (TCE) идут подряд без запятой.
  for (const node of clone.find('.TCE-feature-off').toArray()) {
    const off = $(node);
    const text = cleanText(off.text());
    if (!/[а-яёa-z]/i.test(text)) off.remove();
    else if (off.next().is('.TCE-feature-on') && !/^\s*,/.test(off.next().text())) off.append(', ');
  }
  return {
    text: inlineText($, clone).replace(/\n/g, ' '),
    features: cell
      .find('a[href^="#feature."]')
      .toArray()
      .map((a) => ({
        key: featureKeyOf($(a).attr('href') ?? ''),
        text: cleanText($(a).text()),
      })),
    spellPages: cell
      .find('a[href*="/spells/"]')
      .toArray()
      .map((a) => pageNumber($(a).attr('href') ?? '', 'spells'))
      .filter((page) => Number.isFinite(page)),
  };
}

/** Таблица с заголовком в одну или две строки (второй ряд — уровни ячеек). */
function tableOf($: CheerioAPI, table: Cheerio<Element>, caption: string | null): RawTable {
  const trs = table
    .find('tr')
    .toArray()
    .map((tr) => $(tr));
  const isHeader = (tr: Cheerio<Element>) =>
    tr.hasClass('table_header') || tr.children('th').length > 0;
  const headerRows = trs.filter((tr, index) => index === 0 || isHeader(tr)).slice(0, 2);
  const firstHeader = headerRows[0];
  const header: string[] = [];
  const slotRow = headerRows[1];
  const slotLabels = slotRow
    ? slotRow
        .children()
        .toArray()
        .map((td) => cleanText($(td).text()))
    : [];
  for (const td of firstHeader?.children('td, th').toArray() ?? []) {
    const cell = $(td).clone();
    cell.find('.short').remove();
    cell.find('br').replaceWith(' ');
    const name = cleanText(cell.text());
    const span = Number($(td).attr('colspan') ?? 1);
    if (span > 1 && slotLabels.length >= span) {
      header.push(...slotLabels.splice(0, span).map((label) => `Ячейки ${label}`));
    } else header.push(name);
  }
  const rows = trs
    .filter((tr) => !headerRows.includes(tr))
    .map((tr) =>
      tr
        .children('td, th')
        .toArray()
        .map((td) => cellOf($, $(td as Element))),
    );
  return { caption, header, rows };
}

function headingText($: CheerioAPI, element: Cheerio<Element>): string {
  return cleanText(element.text()).replace(/\n/g, ' ');
}

/**
 * «Источник: «Xanathar’s Guide to Everything»» → название книги. После кавычки бывают
 * точка («…Everything».») и текст того же абзаца — они не часть названия.
 */
function sourceTitleOf(text: string): string | null {
  const match = /^Источник:\s*(?:«([^»]+)»|([^«».\n]+))/.exec(cleanText(text));
  const title = match?.[1] ?? match?.[2];
  // Апостроф и невидимые метки направления: «Tasha’s» с меткой U+200E — как у плашек книг.
  return title?.replace(/[‎‏]/g, '').replace(/’/g, "'").trim() || null;
}

interface FeatureDraft extends RawFeature {
  chunks: Chunk[];
  sub: { name: string; chunks: Chunk[] }[];
}

function finishFeature($: CheerioAPI, draft: FeatureDraft): RawFeature {
  const { chunks, sub, ...feature } = draft;
  return {
    ...feature,
    blocks: blocksOf($, chunks),
    subsections: sub.map((part) => ({ name: part.name, blocks: blocksOf($, part.chunks) })),
  };
}

export function parseClassPage(html: string): RawClassPage {
  const cut = html.indexOf("id='unofficial'");
  const $ = cheerio.load(cut > 0 ? html.slice(0, cut) : html);
  const title = cleanText($('h2.card-title a').first().text());
  const name = /^(.+?)\s*\[(.+)\]$/.exec(title);
  if (!name?.[1] || !name[2]) throw new ClassParseError(`Нет названия класса: «${title}»`);
  const sourceLine = $('ul.params li')
    .toArray()
    .map((li) => cleanText($(li).text()))
    .find((line) => line.startsWith('Источник'));
  const root = $('div.desc.card__article-body').first();
  if (root.length === 0) throw new ClassParseError(`«${name[1]}»: нет описания`);

  const chunks = flatten($, root);
  const page: RawClassPage = {
    nameRu: name[1],
    nameEn: name[2],
    sourceTitle: sourceLine ? sourceTitleOf(sourceLine) : null,
    intro: [],
    sections: [],
    multiclass: [],
    summary: [],
    equipment: [],
    notes: [],
    table: { caption: null, header: [], rows: [] },
    features: [],
    options: [],
    subclassIntro: { name: '', blocks: [] },
    subclasses: [],
  };

  type Mode = 'intro' | 'section' | 'multiclass' | 'proficiency' | 'features' | 'subIntro' | 'sub';
  let mode: Mode = 'intro';
  const introChunks: Chunk[] = [];
  let section: { name: string; chunks: Chunk[] } | null = null;
  const sections: { name: string; chunks: Chunk[] }[] = [];
  const multiclass: Chunk[] = [];
  const subIntro: Chunk[] = [];
  let feature: FeatureDraft | null = null;
  let subclass: (RawSubclass & { introChunks: Chunk[]; secs: typeof sections }) | null = null;
  let options: { name: string; chunks: Chunk[]; sub: { name: string; chunks: Chunk[] }[] } | null =
    null;
  let caption: string | null = null;
  let tableFound = false;

  const closeOptions = () => {
    if (!options) return;
    page.options.push({
      name: options.name,
      blocks: blocksOf($, options.chunks),
      items: options.sub.map((part) => ({ name: part.name, blocks: blocksOf($, part.chunks) })),
    });
    options = null;
  };
  const closeFeature = () => {
    closeOptions();
    if (!feature) return;
    const done = finishFeature($, feature);
    if (subclass) subclass.features.push(done);
    else page.features.push(done);
    feature = null;
  };
  const closeSubclass = () => {
    closeFeature();
    if (!subclass) return;
    const { introChunks: intro, secs, ...rest } = subclass;
    page.subclasses.push({
      ...rest,
      intro: blocksOf($, intro),
      sections: secs.map((part) => ({ name: part.name, blocks: blocksOf($, part.chunks) })),
    });
    subclass = null;
  };
  const target = (): Chunk[] => {
    if (options) return options.sub.at(-1)?.chunks ?? options.chunks;
    if (feature) return feature.sub.at(-1)?.chunks ?? feature.chunks;
    if (subclass) return subclass.secs.at(-1)?.chunks ?? subclass.introChunks;
    switch (mode) {
      case 'intro':
        return introChunks;
      case 'multiclass':
        return multiclass;
      case 'subIntro':
        return subIntro;
      default:
        return section?.chunks ?? introChunks;
    }
  };

  for (let index = 0; index < chunks.length; index += 1) {
    const chunk = chunks[index] as Chunk;
    const { element, tag } = chunk;

    if (tag === 'table' && element.hasClass('class_table') && !tableFound) {
      page.table = tableOf($, element, null);
      tableFound = true;
      caption = null;
      continue;
    }
    if (tag === 'h4' && element.hasClass('tableTitle')) {
      caption = headingText($, element);
      continue;
    }
    if (tag === 'table') {
      const table = tableOf($, element, caption);
      caption = null;
      if (subclass) subclass.tables.push(table);
      // Таблица остаётся и в тексте: блоком особенности или раздела.
      target().push(chunk);
      continue;
    }

    if (tag === 'h2') {
      const anchor = element.find('span[id]').attr('id') ?? '';
      const heading = headingText($, element);
      if (!heading) continue;
      if (anchor === 'klassovye_umeniya' || /^Классовые умения$/i.test(heading)) {
        closeFeature();
        mode = 'proficiency';
        section = null;
        continue;
      }
      if (mode === 'features' || mode === 'subIntro' || mode === 'sub') {
        if (anchor.includes('.')) {
          closeSubclass();
          mode = 'sub';
          subclass = {
            anchor,
            nameRu: heading,
            sourceTitle: null,
            intro: [],
            features: [],
            sections: [],
            tables: [],
            introChunks: [],
            secs: [],
          };
        } else if (subclass) {
          closeFeature();
          subclass.secs.push({ name: heading, chunks: [] });
        } else if (element.hasClass('hide-next')) {
          closeFeature();
          options = { name: heading, chunks: [], sub: [] };
        } else {
          closeFeature();
          mode = 'subIntro';
          page.subclassIntro.name = heading;
        }
        continue;
      }
      // До «Классовых умений»: углублённая предыстория (XGE) — раздел.
      mode = 'section';
      section = { name: heading, chunks: [] };
      sections.push(section);
      continue;
    }

    if (tag === 'h3' || tag === 'h4') {
      const heading = headingText($, element);
      if (!heading) continue;
      if (/^Хиты, владение и снаряжение$/i.test(heading)) {
        mode = 'proficiency';
        continue;
      }
      if (mode === 'proficiency' && /^(ХИТЫ|ВЛАДЕНИЕ|СНАРЯЖЕНИЕ)$/i.test(heading)) continue;
      if (/^МУЛЬТИКЛАССИРОВАНИЕ/i.test(heading)) {
        mode = 'multiclass';
        section = null;
        continue;
      }
      const next = chunks[index + 1];
      const subtitle =
        next?.tag === 'p' && next.element.children('em').length > 0
          ? cleanText(next.element.children('em').first().text())
          : '';
      const levelMatch = LEVEL_SUBTITLE.exec(subtitle);
      if (levelMatch && (mode === 'proficiency' || mode === 'features' || mode === 'sub')) {
        closeFeature();
        if (mode === 'proficiency') mode = 'features';
        const anchor = element.find('span[id^="feature."]').attr('id');
        // «Дополнительные заклинания жреца» (TCE) — без якоря; у других классов — `extra-spells`.
        const key = anchor
          ? featureKeyOf(anchor)
          : /^Дополнительные заклинания /.test(heading)
            ? 'extra-spells'
            : null;
        feature = {
          key: subclass ? null : key,
          nameRu: heading,
          subtitle,
          level: Number(levelMatch[1]),
          optional: Boolean(levelMatch[2]) || chunk.tce,
          blocks: [],
          subsections: [],
          chunks: [],
          sub: [],
        };
        index += 1;
        continue;
      }
      if (options) {
        options.sub.push({ name: heading, chunks: [] });
        continue;
      }
      if (feature) {
        feature.sub.push({ name: heading, chunks: [] });
        continue;
      }
      if (subclass) {
        subclass.secs.push({ name: heading, chunks: [] });
        continue;
      }
      if (mode === 'intro' || mode === 'section' || mode === 'multiclass') {
        mode = 'section';
        section = { name: heading, chunks: [] };
        sections.push(section);
        continue;
      }
      target().push(chunk);
      continue;
    }

    if (mode === 'proficiency' && !feature) {
      if (tag === 'p') {
        const strong = element.children('strong, b').first();
        const whole = inlineText($, element).replace(/\n/g, ' ');
        const label = strong.length > 0 ? cleanText(strong.text()).replace(/:$/, '') : '';
        if (label && whole.startsWith(label)) {
          page.summary.push({
            label,
            text: whole
              .slice(label.length)
              .replace(/^\s*:\s*/, '')
              .trim(),
          });
        } else if (whole) page.notes.push(whole);
      } else if (tag === 'ul' || tag === 'ol') {
        for (const li of element.children('li').toArray()) {
          const line = inlineText($, $(li)).replace(/\n/g, ' ');
          if (line) page.equipment.push(line);
        }
      }
      continue;
    }

    // Книга подкласса — строка «Источник» в самом начале раздела (`<p>` или голый `<strong>`).
    // Ниже, во вложенных разделах, — книга дополнения («Спутники повелителя зверей», TCE).
    if (
      subclass &&
      !feature &&
      !subclass.sourceTitle &&
      subclass.introChunks.length === 0 &&
      subclass.secs.length === 0 &&
      subclass.features.length === 0 &&
      (tag === 'p' || tag === 'strong')
    ) {
      const source = /^Источник:/.test(cleanText(element.text()))
        ? sourceTitleOf(element.text())
        : null;
      if (source) {
        subclass.sourceTitle = source;
        continue;
      }
    }
    target().push(chunk);
  }
  closeSubclass();

  page.intro = blocksOf($, introChunks);
  page.sections = sections.map((part) => ({ name: part.name, blocks: blocksOf($, part.chunks) }));
  page.multiclass = blocksOf($, multiclass);
  page.subclassIntro.blocks = blocksOf($, subIntro);
  if (!tableFound) throw new ClassParseError(`«${page.nameRu}»: нет таблицы класса`);
  return page;
}
