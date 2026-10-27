import type { TextBlock } from '@koster/shared';
import { canonicalJson } from '../build/canonical-json.ts';
import { nameKey } from '../reviewed/reviewed-items.ts';
import type { RawArticle } from './parse-article.ts';

// Описания предметов из абзацев «Термин. Текст» и разделов h3 статьи.
// Описание ищется по названию без уточнения в скобках, по «<название> доспех»
// («Чешуйчатый» — «Чешуйчатый доспех»), по названию группы («Магическая
// фокусировка») и по заголовкам, заданным вручную (descriptionTerms).

/** Разделы, абзацы которых описывают отдельные предметы. */
const ITEM_TERM_SECTIONS = new Set(
  [
    'Лёгкий доспех',
    'Средний доспех',
    'Тяжёлый доспех',
    'Особое оружие',
    'СНАРЯЖЕНИЕ',
    'Инструменты',
  ].map(nameKey),
);

/** «Алхимический огонь (фляга)» → «Алхимический огонь». */
export function baseName(name: string): string {
  return name.replace(/\s*\([^)]*\)\s*$/, '').trim();
}

export class ArticleDescriptions {
  private readonly terms = new Map<string, TextBlock[][]>();
  private readonly sections = new Map<string, TextBlock[]>();
  private readonly used = new Set<string>();
  private readonly itemTerms: { key: string; term: string; source: string | null }[] = [];

  constructor(article: RawArticle) {
    for (const term of article.terms) {
      const key = nameKey(term.term);
      this.terms.set(key, [...(this.terms.get(key) ?? []), term.blocks]);
      if (term.section && ITEM_TERM_SECTIONS.has(nameKey(term.section))) {
        this.itemTerms.push({ key, term: term.term, source: term.source?.code ?? null });
      }
    }
    for (const section of article.sections) {
      const key = nameKey(section.heading);
      this.sections.set(key, section.blocks);
      // Разделы с меткой книги — отдельные предметы: «Покров выживания (VGM)».
      if (section.source) {
        this.itemTerms.push({ key, term: section.heading, source: section.source.code });
      }
    }
  }

  /** Блоки описания по названиям-кандидатам; повторы убираются. */
  find(candidates: readonly string[]): TextBlock[] {
    const blocks: TextBlock[] = [];
    const seen = new Set<string>();
    const add = (list: readonly TextBlock[]) => {
      for (const block of list) {
        const json = canonicalJson(block);
        if (!seen.has(json)) {
          seen.add(json);
          blocks.push(block);
        }
      }
    };
    for (const candidate of new Set(candidates.map(nameKey))) {
      const sectionBlocks = this.sections.get(candidate);
      if (sectionBlocks) {
        this.used.add(candidate);
        add(sectionBlocks);
      }
      for (const termBlocks of this.terms.get(candidate) ?? []) {
        this.used.add(candidate);
        add(termBlocks);
      }
    }
    return blocks;
  }

  /** Описания предметов, для которых не нашлось строки таблицы: в отчёт импорта. */
  unused(): { term: string; source: string | null }[] {
    return this.itemTerms
      .filter((entry) => !this.used.has(entry.key))
      .map(({ term, source }) => ({ term, source }));
  }
}
