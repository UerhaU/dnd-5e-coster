import {
  featDataSchema,
  featRulesSchema,
  slugFromName,
  textBlocksToPlain,
  type FeatRules,
} from '@koster/shared';
import { z } from 'zod';
import type { CatalogEntity } from '../build/catalog-entity.ts';
import type { ArticleCache } from '../dndsu/article-cache.ts';
import { ItemSources } from '../items/sources.ts';
import type { ImportIssue } from '../report/issues.ts';
import { nameKey } from '../reviewed/reviewed-items.ts';
import type { NormalizedSource } from '../spells/normalize-spell.ts';
import { mentionedSpells, normalizeFeat, type FeatLookup } from './normalize-feat.ts';
import { CardParseError, parseCardPage, type RawCardPage } from './parse-background-page.ts';
import { mixedLinks } from './proficiency-choices.ts';

// Шаги normalize → validate (раздел 6) для черт: страницы feats/ кэша этапа 3.
// Книга — первая плашка не 2024 (Р12); только 2024 — пропуск.

type FeatEntity = Extract<CatalogEntity, { category: 'feat' }>;

export interface FeatCollectStats {
  pages: number;
  missingPages: number;
  failedPages: number;
  feats: number;
  withPrerequisites: number;
  /** Условия требований, оставшиеся текстом (`kind: text`). */
  textRequirements: number;
  withAbilityIncrease: number;
  withTextOnly: number;
  /** Без механики, кроме требований: `automation: display_only`. */
  displayOnly: number;
}

/** Расы, предыстории и заклинания этой же сборки — для требований и заклинаний черт. */
export function featLookup(entities: readonly CatalogEntity[]): Omit<FeatLookup, 'feats'> {
  const races = entities.filter((entity) => entity.category === 'race');
  const backgrounds = new Map<string, string>();
  const spells = new Map<string, string>();
  for (const entity of entities) {
    if (entity.category === 'background') backgrounds.set(nameKey(entity.nameRu), entity.id);
    if (entity.category === 'spell') spells.set(nameKey(entity.nameEn), entity.id);
  }
  const shortest = (ids: string[]) => ids.sort((a, b) => a.length - b.length)[0] ?? null;
  return {
    backgrounds,
    spells,
    // «Эльф» — раса с этим названием; «Эльф (дроу)» — разновидность, где есть обе основы.
    race(name) {
      const match = /^(.*?)\s*\((.+)\)$/.exec(name.trim());
      if (!match) {
        const key = nameKey(name);
        return shortest(
          races
            .filter((race) => race.data.kind === 'race' && nameKey(race.nameRu) === key)
            .map((race) => race.id),
        );
      }
      const stems = [match[1] ?? '', match[2] ?? ''].map((part) => nameKey(part).slice(0, 5));
      const variants = races.filter(
        (race) =>
          race.data.kind === 'variant' &&
          stems.every((stem) => nameKey(race.nameRu).includes(stem)),
      );
      return shortest(variants.map((race) => race.id));
    },
  };
}

function featLinks(rules: FeatRules, mentioned: string[]): CatalogEntity['links'] {
  const prerequisites = rules.prerequisites
    .flat()
    .flatMap((requirement) =>
      requirement.kind === 'feat' ||
      requirement.kind === 'race' ||
      requirement.kind === 'background' ||
      requirement.kind === 'class'
        ? [{ toId: requirement.id, kind: 'prerequisite' as const }]
        : [],
    );
  return [
    ...prerequisites,
    ...[...rules.skills.fixed, ...rules.skills.choices.flatMap((choice) => choice.from ?? [])].map(
      (toId) => ({ toId, kind: 'skill_proficiency' as const }),
    ),
    ...[...rules.tools.fixed, ...rules.tools.choices.flatMap((choice) => choice.from ?? [])].map(
      (toId) => ({ toId, kind: 'tool_proficiency' as const }),
    ),
    ...mixedLinks(rules.mixed),
    ...rules.languages.fixed.map((toId) => ({ toId, kind: 'language' as const })),
    ...[...rules.spells, ...mentioned].map((toId) => ({ toId, kind: 'feat_spell' as const })),
  ];
}

const hasMechanics = (rules: FeatRules) =>
  JSON.stringify({ ...rules, prerequisites: [], textOnly: [], schemaVersion: '' }) !==
  JSON.stringify({
    schemaVersion: '',
    prerequisites: [],
    abilityIncrease: { fixed: [], choices: [] },
    armor: [],
    weapons: { groups: [], choices: [] },
    skills: { fixed: [], choices: [] },
    tools: { fixed: [], choices: [] },
    mixed: [],
    languages: { fixed: [], choose: 0 },
    savingThrows: null,
    spells: [],
    textOnly: [],
  });

export function collectFeats(
  cache: ArticleCache,
  lookup: Omit<FeatLookup, 'feats'>,
  /** Английские названия как в книге (data/reviewed/character/names.json, `feats`). */
  names: Map<number, string>,
  issues: ImportIssue[],
  options: { knownSources: NormalizedSource[] },
): { entities: FeatEntity[]; stats: FeatCollectStats } {
  const sources = new ItemSources(options.knownSources);
  const stats: FeatCollectStats = {
    pages: cache.list.pages.length,
    missingPages: 0,
    failedPages: 0,
    feats: 0,
    withPrerequisites: 0,
    textRequirements: 0,
    withAbilityIncrease: 0,
    withTextOnly: 0,
    displayOnly: 0,
  };

  // Первый проход: названия и ID — требования ссылаются на другие черты.
  const pages: { id: string; page: (typeof cache.list.pages)[number]; raw: RawCardPage }[] = [];
  const feats = new Map<string, string>();
  for (const page of cache.list.pages) {
    const issue = (severity: ImportIssue['severity'], message: string) =>
      issues.push({ severity, entityId: null, dndsuId: page.id, field: 'page', message });
    const html = cache.readPage(page.id);
    if (html === null) {
      stats.missingPages += 1;
      issue(
        'error',
        `Страницы нет в кэше (${page.url}); скачать: npm run catalog:fetch -- --character`,
      );
      continue;
    }
    let raw;
    try {
      raw = parseCardPage(html);
    } catch (error) {
      stats.failedPages += 1;
      issue('error', error instanceof CardParseError ? error.message : String(error));
      continue;
    }
    if (!raw.plaques.some((plaque) => !plaque.edition2024)) {
      issue('skip', `«${raw.nameRu}»: только редакция 2024 (Р12)`);
      continue;
    }
    // Ручное название — первым: от него строится ID («Ember of the Fire Giant», Р80).
    raw.nameEn = names.get(page.id) ?? raw.nameEn;
    if (!raw.nameEn) {
      stats.failedPages += 1;
      issue('error', `«${raw.nameRu}»: нет английского названия на странице`);
      continue;
    }
    let id = `feat:${slugFromName(raw.nameEn)}`;
    if (pages.some((entry) => entry.id === id)) id = `${id}-${page.id}`;
    feats.set(nameKey(raw.nameRu), id);
    pages.push({ id, page, raw });
  }

  const full: FeatLookup = { ...lookup, feats };
  const entities: FeatEntity[] = [];
  for (const { id, page, raw } of pages) {
    const plaque = raw.plaques.find((entry) => !entry.edition2024);
    if (!plaque) continue;
    const source = sources.fromMark({ code: plaque.code, title: plaque.title });
    const normalized = normalizeFeat(raw, full);
    const data = featDataSchema.safeParse(normalized.data);
    const rules = featRulesSchema.safeParse(normalized.rules);
    if (!data.success || !rules.success) {
      stats.failedPages += 1;
      const error = !data.success ? data.error : rules.success ? null : rules.error;
      issues.push({
        severity: 'error',
        entityId: id,
        dndsuId: page.id,
        field: 'page',
        message: `«${raw.nameRu}»: не прошла схему: ${error ? z.prettifyError(error) : ''}`,
      });
      continue;
    }
    const r = rules.data;
    const texts = r.prerequisites.flat().filter((requirement) => requirement.kind === 'text');
    for (const requirement of texts) {
      issues.push({
        severity: 'warning',
        entityId: id,
        dndsuId: page.id,
        field: 'prerequisite',
        message: `«${raw.nameRu}»: условие требования только текстом: «${requirement.text}»`,
      });
    }
    stats.feats += 1;
    if (r.prerequisites.length > 0) stats.withPrerequisites += 1;
    stats.textRequirements += texts.length;
    const increase = r.abilityIncrease.fixed.length + r.abilityIncrease.choices.length;
    if (increase > 0) stats.withAbilityIncrease += 1;
    if (r.textOnly.length > 0) stats.withTextOnly += 1;
    const automation = hasMechanics(r) ? 'assisted' : 'display_only';
    if (automation === 'display_only') stats.displayOnly += 1;

    const links = featLinks(r, mentionedSpells(raw, full));
    entities.push({
      id,
      category: 'feat',
      nameRu: raw.nameRu,
      nameEn: raw.nameEn ?? '',
      aliases: [],
      edition: '5e_2014',
      reviewStatus: 'parsed',
      automation,
      schemaVersion: data.data.schemaVersion,
      data: data.data,
      rules: r,
      sources: [{ source, dndsuId: page.id, url: page.url }],
      links: [...new Map(links.map((link) => [`${link.kind}|${link.toId}`, link])).values()],
      searchBody: [
        data.data.prerequisite ? `Требование: ${data.data.prerequisite}` : '',
        textBlocksToPlain(data.data.description),
        ...data.data.sections.map((section) => section.name),
      ]
        .filter(Boolean)
        .join('\n'),
    });
  }
  return { entities, stats };
}

/** Связи `grants_feat` предысторий: номера страниц черт → объекты черт этой сборки. */
export function linkBackgroundFeats(
  backgrounds: CatalogEntity[],
  featPages: Map<string, number[]>,
  feats: readonly FeatEntity[],
): void {
  const byPage = new Map(feats.flatMap((feat) => feat.sources.map((s) => [s.dndsuId, feat.id])));
  for (const background of backgrounds) {
    for (const page of featPages.get(background.id) ?? []) {
      const toId = byPage.get(page);
      if (toId) background.links.push({ toId, kind: 'grants_feat' });
    }
  }
}
