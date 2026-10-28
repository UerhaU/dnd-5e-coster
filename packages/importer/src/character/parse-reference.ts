import type { TextBlock } from '@koster/shared';
import * as cheerio from 'cheerio';
import type { Cheerio, CheerioAPI } from 'cheerio';
import type { Element } from 'domhandler';
import { blocksFrom, cleanText, inlineText } from '../dndsu/text.ts';
import { ArticleParseError, parseArticlePage } from '../items/parse-article.ts';

// Шаг parse (раздел 6) для статей-справочников 5e14.dnd.su: «Использование
// характеристик» (навыки), «Языки», «Состояния». Только чтение HTML.

export interface RawSkill {
  /** Код из подсказки сайта: `skill.animal_handling` → `animal_handling`. */
  code: string;
  nameRu: string;
  /** Название характеристики из таблицы «Навыки»: «Сила». */
  abilityRu: string;
  description: TextBlock[];
}

export interface RawLanguage {
  nameRu: string;
  /** Заголовок таблицы: «ОБЫЧНЫЕ ЯЗЫКИ», «ЯЗЫКИ Monster Manual». */
  table: string;
  typicalSpeakers: string | null;
  /** `null` — «—» или пусто. */
  script: string | null;
  description: TextBlock[];
}

export interface RawDialect {
  nameRu: string;
  /** Язык, к которому относится диалект: «Первичный». */
  parentRu: string;
  /** Предложение статьи, где диалект назван. */
  sentence: string;
}

export interface RawCondition {
  /** Заголовок как на сайте: «Сбитый с ног / Лежащий ничком». */
  nameRu: string;
  description: TextBlock[];
}

function articleBody($: CheerioAPI): Cheerio<Element> {
  const body = $('.card__body.new-article').last();
  if (body.length === 0) {
    throw new ArticleParseError('На странице нет текста статьи (.card__body.new-article)');
  }
  return body;
}

/** Абзац-термин: «<strong><em>Медицина.</em></strong> Текст» (вложение бывает любым). */
function termName($: CheerioAPI, paragraph: Cheerio<Element>): string | null {
  const first = paragraph.contents().first();
  if (!first.is('strong, b, em, i')) {
    return null;
  }
  return cleanText(first.text()).replace(/\.$/, '').trim() || null;
}

const dash = (value: string | undefined) => {
  const text = cleanText(value ?? '');
  return text && !/^[—–-]$/.test(text) ? text : null;
};

/**
 * Навыки: таблицы «Навыки» (заголовок — характеристика, строки — навыки с подсказкой
 * `skill.*`) и описания — абзацы-термины «Атлетика.» или раздел «СКРЫТНОСТЬ».
 */
export function parseSkillsArticle(html: string): RawSkill[] {
  const $ = cheerio.load(html);
  const body = articleBody($);
  const skills = new Map<string, RawSkill>();
  let abilityRu: string | null = null;
  // В одной таблице бывает несколько строк-заголовков: «Сила», затем «Ловкость» и т. д.
  body.find('tr').each((_, row) => {
    if ($(row).hasClass('table_header')) {
      abilityRu = cleanText($(row).text());
      return;
    }
    $(row)
      .find('[tooltip-for^="skill."]')
      .each((__, span) => {
        // `skill.sleightOfHand` → `sleight_of_hand`, как в справочнике SKILLS.
        const code = ($(span).attr('tooltip-for') ?? '')
          .replace(/^skill\./, '')
          .replace(/[A-Z]/g, (char) => `_${char.toLowerCase()}`);
        if (abilityRu === null || skills.has(code)) return;
        skills.set(code, { code, nameRu: cleanText($(span).text()), abilityRu, description: [] });
      });
  });
  const byName = new Map([...skills.values()].map((skill) => [skill.nameRu.toLowerCase(), skill]));

  let current: RawSkill | null = null;
  for (const node of body.find('h2, h3, h4, p, ul, ol').toArray()) {
    const element = $(node);
    if (element.parents('table, ul, ol').length > 0) continue;
    const tag = node.tagName.toLowerCase();
    if (/^h\d$/.test(tag)) {
      current = byName.get(cleanText(element.text()).toLowerCase()) ?? null;
      continue;
    }
    const term = tag === 'p' ? termName($, element) : null;
    if (term) {
      current = byName.get(term.toLowerCase()) ?? null;
    }
    if (!current) continue;
    if (term) {
      const rest = inlineText($, element)
        .slice(cleanText(element.contents().first().text()).length)
        .replace(/^\s*\.?\s*/, '')
        .trim();
      if (rest) current.description.push({ type: 'paragraph', text: rest });
      continue;
    }
    const wrapper = $('<div></div>') as Cheerio<Element>;
    current.description.push(...blocksFrom($, wrapper.append(element.clone())));
  }
  return [...skills.values()];
}

/**
 * Языки: таблицы «Язык / Типичный представитель / Письменность» по книгам; описания
 * отдельных языков — абзацы-термины; диалекты — «Первичный язык включает диалекты …».
 */
export function parseLanguagesArticle(html: string): {
  languages: RawLanguage[];
  dialects: RawDialect[];
} {
  const article = parseArticlePage(html);
  const languages: RawLanguage[] = [];
  for (const table of article.tables) {
    if (table.header[0] !== 'Язык') continue;
    for (const row of table.rows) {
      languages.push({
        nameRu: row.name,
        table: table.heading ?? '',
        typicalSpeakers: dash(row.cells[0]),
        script: dash(row.cells[1]),
        description: [],
      });
    }
  }
  for (const term of article.terms) {
    // «Язык Даэлькиров —» и «Даэлькиров» в таблице — один язык.
    const name = term.term
      .replace(/\s*[—–-]$/, '')
      .replace(/^Язык\s+/, '')
      .toLowerCase();
    const language = languages.find(
      (candidate) =>
        candidate.nameRu.toLowerCase() === name &&
        (term.section ?? '')
          .toLowerCase()
          .includes(candidate.table.replace(/^ЯЗЫКИ /, '').toLowerCase()),
    );
    if (!language) continue;
    const blocks: TextBlock[] = [...term.blocks];
    if (/[—–-]$/.test(term.term) && blocks[0]?.type === 'paragraph') {
      // «Язык Даэлькиров — это язык…»: определение начинается в самом термине.
      blocks[0] = { type: 'paragraph', text: `${term.term} ${blocks[0].text}` };
    }
    language.description.push(...blocks);
  }

  const dialects: RawDialect[] = [];
  const $ = cheerio.load(html);
  const plain = cleanText(articleBody($).text()).replace(/\s+/g, ' ');
  const match = /([А-ЯЁ][а-яё]+) язык включает диалекты ([^.]+?), по одному[^.]*\./.exec(plain);
  if (match) {
    const sentenceStart = plain.lastIndexOf('.', match.index) + 1;
    const sentence = plain.slice(sentenceStart, match.index + match[0].length).trim();
    for (const name of (match[2] ?? '').split(/,\s*(?:и\s+)?|\s+и\s+/)) {
      const nameRu = name.trim();
      if (nameRu) dialects.push({ nameRu, parentRu: match[1] ?? '', sentence });
    }
  }
  return { languages, dialects };
}

/** Состояния: разделы h3 («Ослеплённый») с пунктами; у истощения — ещё таблица степеней. */
export function parseConditionsArticle(html: string): RawCondition[] {
  const $ = cheerio.load(html);
  const body = articleBody($);
  const conditions: RawCondition[] = [];
  let current: RawCondition | null = null;
  for (const node of body.find('h2, h3, p, ul, ol, table').toArray()) {
    const element = $(node);
    if (element.parents('table, ul, ol').length > 0) continue;
    const tag = node.tagName.toLowerCase();
    if (tag === 'h3') {
      const nameRu = cleanText(element.text());
      current = nameRu ? { nameRu, description: [] } : null;
      if (current) conditions.push(current);
      continue;
    }
    if (tag === 'h2') {
      current = null;
      continue;
    }
    if (!current) continue;
    const wrapper = $('<div></div>') as Cheerio<Element>;
    current.description.push(...blocksFrom($, wrapper.append(element.clone())));
  }
  return conditions.filter((condition) => condition.description.length > 0);
}
