import {
  spellDataSchema,
  textBlocksToPlain,
  type Automation,
  type Edition,
  type ReviewStatus,
  type SpellData,
  type SpellRules,
} from '@koster/shared';
import { z } from 'zod';
import type { SpellCache } from '../dndsu/spell-cache.ts';
import type { ImportIssue } from '../report/issues.ts';
import { applyReviewed, type ReviewedSpellSet } from '../reviewed/reviewed-spells.ts';
import { SpellNormalizer, type NormalizedSource } from '../spells/normalize-spell.ts';
import { PageParseError, parseSpellPage } from '../spells/parse-page.ts';

// Шаги parse → normalize → review → validate для заклинаний.

export interface CatalogEntity {
  id: string;
  category: 'spell';
  nameRu: string;
  nameEn: string;
  aliases: string[];
  edition: Edition;
  reviewStatus: ReviewStatus;
  automation: Automation;
  schemaVersion: string;
  data: SpellData;
  rules: SpellRules | null;
  sources: { source: NormalizedSource; dndsuId: number; url: string }[];
  /** Плоский текст для полнотекстового поиска. */
  searchBody: string;
}

export interface CollectStats {
  listed: number;
  missingPages: number;
  failed: number;
  skipped: number;
  collected: number;
  reviewedApplied: number;
  rulesVerified: number;
}

export function collectSpells(
  cache: SpellCache,
  reviewed: ReviewedSpellSet,
  issues: ImportIssue[],
): { entities: CatalogEntity[]; stats: CollectStats } {
  const normalizer = new SpellNormalizer(cache.list);
  const stats: CollectStats = {
    listed: cache.list.cards.length,
    missingPages: 0,
    failed: 0,
    skipped: 0,
    collected: 0,
    reviewedApplied: 0,
    rulesVerified: 0,
  };
  const entities = new Map<string, CatalogEntity>();
  const usedReviewed = new Set<string>();

  for (const invalid of reviewed.invalid) {
    issues.push({
      severity: 'error',
      entityId: null,
      dndsuId: null,
      field: 'reviewed',
      message: `data/reviewed/spells/${invalid.file}: ${invalid.message}`,
    });
  }

  const cards = [...cache.list.cards].sort((a, b) => a.siteId - b.siteId);
  for (const card of cards) {
    const fail = (message: string) => {
      stats.failed += 1;
      issues.push({
        severity: 'error',
        entityId: null,
        dndsuId: card.siteId,
        field: 'page',
        message,
      });
    };

    const html = cache.readPage(card.siteId);
    if (html === null) {
      stats.missingPages += 1;
      issues.push({
        severity: 'error',
        entityId: null,
        dndsuId: card.siteId,
        field: 'page',
        message: `Страницы нет в кэше (${card.url}); скачать: npm run catalog:fetch`,
      });
      continue;
    }

    // Ошибка одной страницы не останавливает импорт (раздел 6).
    try {
      const issuesBefore = issues.length;
      const spell = normalizer.normalize(parseSpellPage(html), card, issues);
      if (!spell) {
        const skipped = issues.slice(issuesBefore).some((issue) => issue.severity === 'skip');
        if (skipped) {
          stats.skipped += 1;
        } else {
          stats.failed += 1;
        }
        continue;
      }

      if (entities.has(spell.id)) {
        // Р11: при совпадении английских названий добавляется суффикс источника.
        const suffixed = `${spell.id}-${spell.sources[0]?.id ?? card.siteId}`;
        issues.push({
          severity: 'warning',
          entityId: suffixed,
          dndsuId: card.siteId,
          field: 'id',
          message: `ID ${spell.id} уже занят, использован ${suffixed}`,
        });
        spell.id = suffixed;
      }

      const review = reviewed.byId.get(spell.id);
      const { rules } = applyReviewed(spell, review, issues);
      if (review) {
        usedReviewed.add(spell.id);
        stats.reviewedApplied += 1;
      }

      const valid = spellDataSchema.safeParse(spell.data);
      if (!valid.success) {
        fail(`${spell.id}: данные не прошли схему spell/v1: ${z.prettifyError(valid.error)}`);
        continue;
      }
      if (rules) {
        stats.rulesVerified += 1;
      }

      entities.set(spell.id, {
        id: spell.id,
        category: 'spell',
        nameRu: spell.nameRu,
        nameEn: spell.nameEn,
        aliases: [],
        edition: spell.edition,
        reviewStatus: rules ? 'rules_verified' : 'parsed',
        automation: rules ? 'assisted' : 'display_only',
        schemaVersion: valid.data.schemaVersion,
        data: valid.data,
        rules,
        sources: spell.sources.map((source) => ({ source, dndsuId: card.siteId, url: card.url })),
        searchBody: [
          textBlocksToPlain(valid.data.description),
          textBlocksToPlain(valid.data.higherLevels),
        ]
          .filter((part) => part)
          .join('\n\n'),
      });
      stats.collected += 1;
    } catch (error) {
      fail(error instanceof PageParseError ? error.message : String(error));
    }
  }

  // Исправление для заклинания, которого нет в этом кэше (например, в тестовом
  // каталоге из data/fixtures/), — не ошибка. Ошибка — когда страница есть, а ID не совпал.
  const listedIds = new Set(cards.map((card) => card.siteId));
  for (const [id, review] of reviewed.byId) {
    if (!usedReviewed.has(id) && listedIds.has(review.dndsuId)) {
      issues.push({
        severity: 'error',
        entityId: id,
        dndsuId: review.dndsuId,
        field: 'reviewed',
        message: 'Исправление не нашло своё заклинание',
      });
    }
  }

  return { entities: [...entities.values()], stats };
}
