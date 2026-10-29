import fs from 'node:fs';
import path from 'node:path';
import {
  backgroundDataSchema,
  backgroundRulesSchema,
  slugFromName,
  textBlocksToPlain,
} from '@koster/shared';
import { z } from 'zod';
import type { CatalogEntity } from '../build/catalog-entity.ts';
import type { ArticleCache } from '../dndsu/article-cache.ts';
import { ItemSources } from '../items/sources.ts';
import type { ImportIssue } from '../report/issues.ts';
import { nameKey } from '../reviewed/reviewed-items.ts';
import type { NormalizedSource } from '../spells/normalize-spell.ts';
import { mixedLinks } from './proficiency-choices.ts';
import { normalizeBackground, type BackgroundLookup } from './normalize-background.ts';
import { CardParseError, parseCardPage, type RawPlaque } from './parse-background-page.ts';

// Шаги normalize → validate (раздел 6) для предысторий: страницы backgrounds/ кэша
// этапа 3. Книга — первая плашка не 2024 (Р12); только 2024 — пропуск.

type BackgroundEntity = Extract<CatalogEntity, { category: 'background' }>;

export interface BackgroundCollectStats {
  pages: number;
  missingPages: number;
  failedPages: number;
  backgrounds: number;
  adaptations: number;
  withTextOnly: number;
  equipmentParts: number;
  equipmentLinked: number;
}

/** Основы названий языков и названия предметов этой же сборки — для сопоставления. */
export function backgroundLookup(
  entities: readonly CatalogEntity[],
  phrases: Record<string, string>,
): BackgroundLookup {
  const stems = new Map<string, string | null>();
  const items = new Map<string, string>();
  for (const entity of entities) {
    if (entity.category === 'language') {
      const stem = nameKey(entity.nameRu.replace(/^язык\s+/i, '')).slice(0, 5);
      stems.set(stem, stems.has(stem) && stems.get(stem) !== entity.id ? null : entity.id);
    } else if (entity.category === 'item') {
      for (const name of [entity.nameRu, ...entity.aliases]) items.set(nameKey(name), entity.id);
    }
  }
  const languageStems = new Map<string, string>();
  for (const [stem, id] of stems) if (id) languageStems.set(stem, id);
  const names = new Map<string, string>();
  for (const entity of entities) {
    if (entity.category === 'language') names.set(nameKey(entity.nameRu), entity.id);
  }
  for (const [synonym, name] of Object.entries(LANGUAGE_SYNONYMS)) {
    const id = names.get(nameKey(name));
    if (id) names.set(nameKey(synonym), id);
  }
  const sorted = Object.entries(phrases)
    .map(([phrase, id]): [string, string] => [nameKey(phrase), id])
    .sort(([a], [b]) => b.length - a.length);
  return {
    languageStems,
    languageNames: [...names].sort(([a], [b]) => b.length - a.length),
    items,
    phrases: sorted,
  };
}

/** Названия языков на страницах предысторий, которые расходятся с объектом языка. */
const LANGUAGE_SYNONYMS: Record<string, string> = {
  Небожителей: 'Небесный',
};

const equipmentFileSchema = z.strictObject({
  $comment: z.string().optional(),
  phrases: z.record(z.string().min(1), z.string().regex(/^item:[a-z0-9-]+$/)),
});

/** Ручные соответствия снаряжения предысторий (как Р62): data/reviewed/character/equipment.json. */
export function loadEquipmentPhrases(folder: string): Record<string, string> {
  const file = path.join(folder, 'equipment.json');
  return equipmentFileSchema.parse(JSON.parse(fs.readFileSync(file, 'utf8'))).phrases;
}

export function collectBackgrounds(
  cache: ArticleCache,
  lookup: BackgroundLookup,
  names: Map<number, string>,
  issues: ImportIssue[],
  options: { knownSources: NormalizedSource[] },
): {
  entities: BackgroundEntity[];
  stats: BackgroundCollectStats;
  /** Номера страниц черт из раздела «Умение …» — связи `grants_feat` после сборки черт. */
  featPages: Map<string, number[]>;
} {
  const sources = new ItemSources(options.knownSources);
  const entities = new Map<string, BackgroundEntity>();
  const featPages = new Map<string, number[]>();
  const stats: BackgroundCollectStats = {
    pages: cache.list.pages.length,
    missingPages: 0,
    failedPages: 0,
    backgrounds: 0,
    adaptations: 0,
    withTextOnly: 0,
    equipmentParts: 0,
    equipmentLinked: 0,
  };

  for (const page of cache.list.pages) {
    const issue = (
      severity: ImportIssue['severity'],
      message: string,
      entityId = null as string | null,
    ) => issues.push({ severity, entityId, dndsuId: page.id, field: 'page', message });
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
    const plaque: RawPlaque | undefined = raw.plaques.find((entry) => !entry.edition2024);
    if (!plaque) {
      issue('skip', `«${raw.nameRu}»: только редакция 2024 (Р12)`);
      continue;
    }
    const source = sources.fromMark({ code: plaque.code, title: plaque.title });
    // Ручное название — первым: на сайте бывает не как в книге («Folk hero»).
    const nameEn = names.get(page.id) ?? raw.nameEn ?? null;
    if (!nameEn) {
      stats.failedPages += 1;
      issue(
        'error',
        `«${raw.nameRu}»: нет английского названия (data/reviewed/character/names.json, backgrounds)`,
      );
      continue;
    }
    let id = `background:${slugFromName(nameEn)}`;
    if (entities.has(id)) id = `${id}-${source.id}`;

    const normalized = normalizeBackground(raw, lookup);
    const data = backgroundDataSchema.safeParse(normalized.data);
    const rules = backgroundRulesSchema.safeParse(normalized.rules);
    if (!data.success || !rules.success) {
      stats.failedPages += 1;
      const error = !data.success ? data.error : rules.success ? null : rules.error;
      issue(
        'error',
        `«${raw.nameRu}»: не прошла схему: ${error ? z.prettifyError(error) : ''}`,
        id,
      );
      continue;
    }
    const r = rules.data;
    const links: CatalogEntity['links'] = [
      ...[...r.skills.fixed, ...r.skills.choices.flatMap((choice) => choice.from ?? [])].map(
        (toId) => ({ toId, kind: 'skill_proficiency' as const }),
      ),
      ...[...r.languages.fixed, ...r.languages.choices.flatMap((choice) => choice.from ?? [])].map(
        (toId) => ({ toId, kind: 'language' as const }),
      ),
      ...[...r.tools.fixed, ...r.tools.choices.flatMap((choice) => choice.from ?? [])].map(
        (toId) => ({ toId, kind: 'tool_proficiency' as const }),
      ),
      ...mixedLinks(r.mixed),
      ...r.equipment.items.flatMap((item) =>
        item.itemId ? [{ toId: item.itemId, kind: 'starting_equipment' as const }] : [],
      ),
    ];
    stats.equipmentParts += r.equipment.items.length;
    stats.equipmentLinked += r.equipment.items.filter((item) => item.itemId).length;
    if (data.data.kind === 'background') stats.backgrounds += 1;
    else stats.adaptations += 1;
    if (r.textOnly.length > 0) stats.withTextOnly += 1;

    const granted = raw.sections
      .filter((section) => /^Умение/i.test(section.name))
      .flatMap((section) => section.links)
      .flatMap((href) => {
        const page = /\/feats\/(\d+)-/.exec(href)?.[1];
        return page ? [Number(page)] : [];
      });
    if (granted.length > 0) featPages.set(id, [...new Set(granted)]);

    entities.set(id, {
      id,
      category: 'background',
      nameRu: raw.nameRu,
      nameEn,
      aliases: [],
      edition: '5e_2014',
      reviewStatus: 'parsed',
      automation: 'assisted',
      schemaVersion: data.data.schemaVersion,
      data: data.data,
      rules: r,
      sources: [{ source, dndsuId: page.id, url: page.url }],
      links: [...new Map(links.map((link) => [`${link.kind}|${link.toId}`, link])).values()],
      searchBody: [
        textBlocksToPlain(data.data.intro),
        ...data.data.summary.map((line) => `${line.label}: ${line.text}`),
        data.data.feature
          ? `${data.data.feature.name}. ${textBlocksToPlain(data.data.feature.blocks)}`
          : '',
        ...data.data.variants.map((variant) => variant.name),
      ]
        .filter(Boolean)
        .join('\n'),
    });
  }
  return { entities: [...entities.values()], stats, featPages };
}
