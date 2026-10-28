import { raceDataSchema, raceRulesSchema, textBlocksToPlain } from '@koster/shared';
import { z } from 'zod';
import type { ArticleCache } from '../dndsu/article-cache.ts';
import { ItemSources } from '../items/sources.ts';
import { RaceNormalizer } from '../races/normalize-races.ts';
import { parseRacePage, RaceParseError } from '../races/parse-race-page.ts';
import type { ImportIssue } from '../report/issues.ts';
import { raceBlockKey, type ReviewedRaces } from '../reviewed/reviewed-races.ts';
import type { NormalizedSource } from '../spells/normalize-spell.ts';
import type { CatalogEntity } from './catalog-entity.ts';

// Шаги parse → normalize → review → validate для рас (этап 2, часть Б).

export interface RaceCollectStats {
  pages: number;
  missingPages: number;
  failedPages: number;
  /** Объектов, не попавших в каталог (не прошли схему). */
  failed: number;
  races: number;
  variants: number;
  /** Объектов, у которых хоть одна особенность — только текст. */
  withTextOnly: number;
}

export interface CollectRacesOptions {
  knownSources: NormalizedSource[];
  reportUnusedReviewed: boolean;
}

/** Страницы `/race/…` раньше `/multiverse/race/…`: ID без суффикса — у ранней книги (Р67). */
const pageOrder = (url: string) => (url.includes('/multiverse/') ? 1 : 0);

export function collectRaces(
  cache: ArticleCache,
  reviewed: ReviewedRaces,
  issues: ImportIssue[],
  options: CollectRacesOptions,
): { entities: CatalogEntity[]; stats: RaceCollectStats } {
  const stats: RaceCollectStats = {
    pages: cache.list.pages.length,
    missingPages: 0,
    failedPages: 0,
    failed: 0,
    races: 0,
    variants: 0,
    withTextOnly: 0,
  };
  const sources = new ItemSources(options.knownSources);
  const entities = new Map<string, CatalogEntity>();
  const usedKeys = new Set<string>();

  for (const invalid of reviewed.invalid) {
    issues.push({
      severity: 'error',
      entityId: null,
      dndsuId: null,
      field: 'reviewed',
      message: `data/reviewed/races/${invalid.file}: ${invalid.message}`,
    });
  }

  const pages = [...cache.list.pages].sort((a, b) => pageOrder(a.url) - pageOrder(b.url));
  for (const page of pages) {
    const pageIssue = (message: string) =>
      issues.push({ severity: 'error', entityId: null, dndsuId: page.id, field: 'page', message });
    const html = cache.readPage(page.id);
    if (html === null) {
      stats.missingPages += 1;
      pageIssue(`Страницы нет в кэше (${page.url}); скачать: npm run catalog:fetch -- --races`);
      continue;
    }
    // Строки отчёта этой страницы: при суффиксе ID в них меняется ID.
    const pageIssuesFrom = issues.length;
    let races;
    try {
      races = new RaceNormalizer(
        parseRacePage(html),
        page.id,
        reviewed,
        sources,
        issues,
      ).normalize();
    } catch (error) {
      stats.failedPages += 1;
      pageIssue(error instanceof RaceParseError ? error.message : String(error));
      continue;
    }

    // Разновидность ссылается на ID расы, который мог получить суффикс.
    const renamed = new Map<string, string>();
    for (const race of races) {
      if (race.reviewedKey) usedKeys.add(race.reviewedKey);
      if (race.data.variantOf) {
        const target = renamed.get(race.data.variantOf) ?? race.data.variantOf;
        race.data.variantOf = target;
        race.links = race.links.map((link) =>
          link.kind === 'variant_of' ? { ...link, toId: target } : link,
        );
      }
      if (entities.has(race.id)) {
        // Р11, Р67: при совпадении английских названий добавляется суффикс книги.
        const suffixed = `${race.id}-${race.source.id}`;
        if (entities.has(suffixed)) {
          stats.failed += 1;
          issues.push({
            severity: 'error',
            entityId: suffixed,
            dndsuId: page.id,
            field: 'id',
            message: `ID ${race.id} и ${suffixed} уже заняты: задайте другое nameEn`,
          });
          continue;
        }
        renamed.set(race.id, suffixed);
        for (const issue of issues.slice(pageIssuesFrom)) {
          if (issue.entityId === race.id) issue.entityId = suffixed;
        }
        race.id = suffixed;
      }
      const fail = (message: string) => {
        stats.failed += 1;
        issues.push({
          severity: 'error',
          entityId: race.id,
          dndsuId: page.id,
          field: 'schema',
          message,
        });
      };
      const data = raceDataSchema.safeParse(race.data);
      if (!data.success) {
        fail(`данные не прошли схему race/v1: ${z.prettifyError(data.error)}`);
        continue;
      }
      const rules = raceRulesSchema.safeParse(race.rules);
      if (!rules.success) {
        fail(`механика не прошла схему race-rules/v1: ${z.prettifyError(rules.error)}`);
        continue;
      }

      entities.set(race.id, {
        id: race.id,
        category: 'race',
        nameRu: race.nameRu,
        nameEn: race.nameEn,
        aliases: [],
        edition: '5e_2014',
        reviewStatus: 'parsed',
        automation: 'assisted',
        schemaVersion: data.data.schemaVersion,
        data: data.data,
        rules: rules.data,
        sources: [{ source: race.source, dndsuId: page.id, url: page.url }],
        links: race.links,
        searchBody: [
          ...data.data.features.map(
            (feature) => `${feature.name}. ${textBlocksToPlain(feature.blocks)}`,
          ),
          textBlocksToPlain(data.data.intro),
        ]
          .filter((part) => part)
          .join('\n'),
      });
      if (data.data.kind === 'race') stats.races += 1;
      else stats.variants += 1;
      if (rules.data.textOnly.length > 0) stats.withTextOnly += 1;
    }
  }

  if (options.reportUnusedReviewed) {
    for (const entry of reviewed.blocks.values()) {
      if (entry.skip || usedKeys.has(raceBlockKey(entry.page, entry.match, entry.book))) continue;
      issues.push({
        severity: 'warning',
        entityId: null,
        dndsuId: entry.page,
        field: 'reviewed',
        message: `data/reviewed/races: «${entry.match}» не нашлось на странице`,
      });
    }
  }

  return { entities: [...entities.values()], stats };
}
