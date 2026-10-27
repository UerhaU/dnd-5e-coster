import {
  itemDataSchema,
  itemRulesSchema,
  textBlocksToPlain,
  type ItemKindId,
} from '@koster/shared';
import { z } from 'zod';
import type { ArticleCache } from '../dndsu/article-cache.ts';
import { ItemNormalizer } from '../items/normalize-items.ts';
import { ArticleParseError, parseArticlePage } from '../items/parse-article.ts';
import { ItemSources } from '../items/sources.ts';
import type { ImportIssue } from '../report/issues.ts';
import { nameKey, type ReviewedItems } from '../reviewed/reviewed-items.ts';
import type { NormalizedSource } from '../spells/normalize-spell.ts';
import type { CatalogEntity } from './catalog-entity.ts';

// Шаги parse → normalize → review → validate для обычного снаряжения (этап 2).

export interface ItemCollectStats {
  /** Статей в списке кэша. */
  pages: number;
  missingPages: number;
  /** Статей, которые не удалось разобрать. */
  failedPages: number;
  /** Строк, не попавших в каталог (нет названия, не прошли схему). */
  failed: number;
  collected: number;
  byKind: Partial<Record<ItemKindId, number>>;
  withRules: number;
}

export interface CollectItemsOptions {
  /** Источники, уже известные по заклинаниям: чтобы книга была одной строкой. */
  knownSources: NormalizedSource[];
  /** Сообщать о ручных записях без строки на сайте (только для полного кэша). */
  reportUnusedReviewed: boolean;
}

export function collectItems(
  cache: ArticleCache,
  reviewed: ReviewedItems,
  issues: ImportIssue[],
  options: CollectItemsOptions,
): { entities: CatalogEntity[]; stats: ItemCollectStats } {
  const stats: ItemCollectStats = {
    pages: cache.list.pages.length,
    missingPages: 0,
    failedPages: 0,
    failed: 0,
    collected: 0,
    byKind: {},
    withRules: 0,
  };
  const sources = new ItemSources(options.knownSources);
  const entities = new Map<string, CatalogEntity>();
  const usedNames = new Set<string>();

  for (const invalid of reviewed.invalid) {
    issues.push({
      severity: 'error',
      entityId: null,
      dndsuId: null,
      field: 'reviewed',
      message: `data/reviewed/items/${invalid.file}: ${invalid.message}`,
    });
  }

  for (const page of cache.list.pages) {
    const pageIssue = (message: string) =>
      issues.push({ severity: 'error', entityId: null, dndsuId: page.id, field: 'page', message });
    const html = cache.readPage(page.id);
    if (html === null) {
      stats.missingPages += 1;
      pageIssue(`Статьи нет в кэше (${page.url}); скачать: npm run catalog:fetch -- --items`);
      continue;
    }

    let items;
    try {
      const article = parseArticlePage(html);
      const failedBefore = issues.filter((issue) => issue.severity === 'error').length;
      items = new ItemNormalizer(article, page.id, reviewed, sources, issues).normalize();
      stats.failed += issues.filter((issue) => issue.severity === 'error').length - failedBefore;
    } catch (error) {
      stats.failedPages += 1;
      pageIssue(error instanceof ArticleParseError ? error.message : String(error));
      continue;
    }

    for (const item of items) {
      const fail = (message: string) => {
        stats.failed += 1;
        issues.push({
          severity: 'error',
          entityId: item.id,
          dndsuId: page.id,
          field: 'schema',
          message,
        });
      };
      usedNames.add(nameKey(item.nameRu));
      if (entities.has(item.id)) {
        // Р11: при совпадении английских названий добавляется суффикс источника.
        const suffixed = `${item.id}-${item.source.id}`;
        issues.push({
          severity: 'warning',
          entityId: suffixed,
          dndsuId: page.id,
          field: 'id',
          message: `ID ${item.id} уже занят, использован ${suffixed}`,
        });
        item.id = suffixed;
      }
      const data = itemDataSchema.safeParse(item.data);
      if (!data.success) {
        fail(`данные не прошли схему item/v1: ${z.prettifyError(data.error)}`);
        continue;
      }
      const rules = item.rules ? itemRulesSchema.safeParse(item.rules) : null;
      if (rules && !rules.success) {
        fail(`механика не прошла схему item-rules/v1: ${z.prettifyError(rules.error)}`);
        continue;
      }

      entities.set(item.id, {
        id: item.id,
        category: 'item',
        nameRu: item.nameRu,
        nameEn: item.nameEn,
        aliases: [],
        edition: '5e_2014',
        reviewStatus: 'parsed',
        automation: rules ? 'assisted' : 'display_only',
        schemaVersion: data.data.schemaVersion,
        data: data.data,
        rules: rules?.data ?? null,
        sources: [{ source: item.source, dndsuId: page.id, url: page.url }],
        links: item.links,
        searchBody: [
          ...data.data.stats.map((stat) => `${stat.label}: ${stat.value}`),
          ...data.data.contents.map((entry) => entry.name),
          textBlocksToPlain(data.data.description),
        ]
          .filter((part) => part)
          .join('\n'),
      });
      stats.collected += 1;
      stats.byKind[data.data.kind] = (stats.byKind[data.data.kind] ?? 0) + 1;
      if (rules) stats.withRules += 1;
    }
  }

  if (options.reportUnusedReviewed) {
    const unused = [
      ...[...reviewed.names.values()].filter((entry) => !usedNames.has(nameKey(entry.match))),
      ...[...reviewed.packs.values()].filter((entry) => !usedNames.has(nameKey(entry.match))),
    ];
    for (const entry of unused) {
      issues.push({
        severity: 'warning',
        entityId: null,
        dndsuId: null,
        field: 'reviewed',
        message: `data/reviewed/items: «${entry.match}» не нашлось в таблицах DnD.su`,
      });
    }
  }

  return { entities: [...entities.values()], stats };
}
