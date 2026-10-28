import fs from 'node:fs';
import path from 'node:path';
import {
  CLASS_IDS,
  classDataSchema,
  classRulesSchema,
  slugFromName,
  subclassDataSchema,
  subclassRulesSchema,
  textBlocksToPlain,
  type ClassFeature,
  type ClassId,
  type ClassProficiencies,
} from '@koster/shared';
import { z } from 'zod';
import type { CatalogEntity } from '../build/catalog-entity.ts';
import type { ArticleCache } from '../dndsu/article-cache.ts';
import { ItemSources } from '../items/sources.ts';
import type { ImportIssue } from '../report/issues.ts';
import { nameKey } from '../reviewed/reviewed-items.ts';
import type { NormalizedSource } from '../spells/normalize-spell.ts';
import { mixedLinks } from './proficiency-choices.ts';
import {
  ClassNormalizeError,
  normalizeClass,
  normalizeSubclass,
  type ClassLookup,
} from './normalize-class.ts';
import { ClassParseError, parseClassPage } from './parse-class-page.ts';

// Шаги normalize → validate (раздел 6) для классов и подклассов: страницы classes/
// кэша этапа 3. Подкласс без строки «Источник» — из книги класса. Английские
// названия подклассов — data/reviewed/character/subclasses.json (как Р62).

type ClassEntity = Extract<CatalogEntity, { category: 'class' }>;
type SubclassEntity = Extract<CatalogEntity, { category: 'subclass' }>;

export interface ClassCollectStats {
  pages: number;
  missingPages: number;
  failedPages: number;
  classes: number;
  subclasses: number;
  failedSubclasses: number;
  features: number;
  optionalFeatures: number;
  subclassFeatures: number;
  spellLists: number;
  /** Части стартового снаряжения: всего и с предметом или группой. */
  equipmentParts: number;
  equipmentLinked: number;
}

const subclassFileSchema = z.strictObject({
  $comment: z.string().optional(),
  subclasses: z.record(
    z.string().regex(/^[a-z]+\/[a-z-]+\.[a-z-]+$/),
    z.strictObject({
      nameEn: z.string().min(1),
      slug: z
        .string()
        .regex(/^[a-z0-9-]+$/)
        .optional(),
      /** Название в фильтре заклинаний DnD.su, если оно не как заголовок подкласса. */
      spellListName: z.string().min(1).optional(),
    }),
  ),
});

export type SubclassNames = z.infer<typeof subclassFileSchema>['subclasses'];

export function loadSubclassNames(folder: string): SubclassNames {
  const file = path.join(folder, 'subclasses.json');
  return subclassFileSchema.parse(JSON.parse(fs.readFileSync(file, 'utf8'))).subclasses;
}

/** ID подкласса по ключу «класс/якорь»: хвост якоря или `slug`, если якорь с опечаткой. */
function subclassIdOf(key: string, name: SubclassNames[string]): string {
  const [classSlug = '', anchor = ''] = key.split('/');
  return `subclass:${classSlug}-${name.slug ?? anchor.slice(anchor.lastIndexOf('.') + 1)}`;
}

/** ID подкласса → название в фильтре заклинаний DnD.su (`spellListName`). */
export function subclassSpellListNames(names: SubclassNames): Map<string, string> {
  return new Map(
    Object.entries(names).flatMap(([key, name]) =>
      name.spellListName ? [[subclassIdOf(key, name), name.spellListName] as const] : [],
    ),
  );
}

/** Предметы и заклинания этой же сборки — для снаряжения и списков подклассов. */
export function classLookup(entities: readonly CatalogEntity[]): ClassLookup {
  const items = new Map<string, string>();
  const spellsByPage = new Map<number, string>();
  for (const entity of entities) {
    if (entity.category === 'item') {
      for (const name of [entity.nameRu, ...entity.aliases]) items.set(nameKey(name), entity.id);
    } else if (entity.category === 'spell') {
      for (const source of entity.sources) {
        if (source.dndsuId !== null) spellsByPage.set(source.dndsuId, entity.id);
      }
    }
  }
  return { items, spellsByPage };
}

function proficiencyLinks(p: ClassProficiencies): CatalogEntity['links'] {
  return [
    ...p.skills
      .flatMap((choice) => choice.from ?? [])
      .map((toId) => ({ toId, kind: 'skill_proficiency' as const })),
    ...[...p.tools.fixed, ...p.tools.choices.flatMap((choice) => choice.from ?? [])].map(
      (toId) => ({ toId, kind: 'tool_proficiency' as const }),
    ),
    ...mixedLinks(p.mixed),
    ...p.weapons.items.map((toId) => ({ toId, kind: 'class_weapon' as const })),
  ];
}

const unique = (links: CatalogEntity['links']) => [
  ...new Map(links.map((link) => [`${link.kind}|${link.toId}`, link])).values(),
];

const featureText = (features: ClassFeature[]) =>
  features.map((feature) => `${feature.nameRu}. ${textBlocksToPlain(feature.blocks)}`);

export function collectClasses(
  cache: ArticleCache,
  lookup: ClassLookup,
  names: SubclassNames,
  issues: ImportIssue[],
  options: { knownSources: NormalizedSource[]; reportUnusedNames: boolean },
): { entities: (ClassEntity | SubclassEntity)[]; stats: ClassCollectStats } {
  const sources = new ItemSources(options.knownSources);
  const entities: (ClassEntity | SubclassEntity)[] = [];
  const usedNames = new Set<string>();
  const stats: ClassCollectStats = {
    pages: cache.list.pages.length,
    missingPages: 0,
    failedPages: 0,
    classes: 0,
    subclasses: 0,
    failedSubclasses: 0,
    features: 0,
    optionalFeatures: 0,
    subclassFeatures: 0,
    spellLists: 0,
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
      raw = parseClassPage(html);
    } catch (error) {
      stats.failedPages += 1;
      issue('error', error instanceof ClassParseError ? error.message : String(error));
      continue;
    }
    const classSlug = slugFromName(raw.nameEn);
    const classId = `class:${classSlug}`;
    if (!(CLASS_IDS as readonly string[]).includes(classId)) {
      stats.failedPages += 1;
      issue('error', `«${raw.nameRu}»: класса ${classId} нет в CLASS_IDS`);
      continue;
    }
    const classSource = raw.sourceTitle ? sources.fromTitle(raw.sourceTitle) : null;
    if (!classSource) {
      stats.failedPages += 1;
      issue('error', `«${raw.nameRu}»: неизвестный источник «${raw.sourceTitle ?? '—'}»`, classId);
      continue;
    }

    let normalized;
    try {
      normalized = normalizeClass(raw, classId, lookup);
    } catch (error) {
      stats.failedPages += 1;
      issue(
        'error',
        `«${raw.nameRu}»: ${error instanceof ClassNormalizeError ? error.message : String(error)}`,
        classId,
      );
      continue;
    }
    const data = classDataSchema.safeParse(normalized.data);
    const rules = classRulesSchema.safeParse(normalized.rules);
    if (!data.success || !rules.success) {
      stats.failedPages += 1;
      const error = !data.success ? data.error : rules.success ? null : rules.error;
      issue(
        'error',
        `«${raw.nameRu}»: не прошёл схему: ${error ? z.prettifyError(error) : ''}`,
        classId,
      );
      continue;
    }
    const r = rules.data;
    for (const line of r.textOnly)
      issue('warning', `«${raw.nameRu}»: только текстом — ${line}`, classId);
    const parts = r.equipment.flatMap((choice) => choice.options.flatMap((option) => option.parts));
    stats.equipmentParts += parts.length;
    stats.equipmentLinked += parts.filter((part) => part.itemId || part.group).length;
    stats.classes += 1;
    stats.features += data.data.features.length;
    stats.optionalFeatures += data.data.features.filter((feature) => feature.optionalRule).length;

    entities.push({
      id: classId,
      category: 'class',
      nameRu: raw.nameRu,
      nameEn: raw.nameEn,
      aliases: [],
      edition: '5e_2014',
      reviewStatus: 'parsed',
      automation: 'assisted',
      schemaVersion: data.data.schemaVersion,
      data: data.data,
      rules: r,
      sources: [{ source: classSource, dndsuId: page.id, url: page.url }],
      links: unique([
        ...proficiencyLinks(r.proficiencies),
        ...proficiencyLinks(r.multiclass.proficiencies),
        ...parts.flatMap((part) =>
          part.itemId ? [{ toId: part.itemId, kind: 'starting_equipment' as const }] : [],
        ),
      ]),
      searchBody: [textBlocksToPlain(data.data.intro), ...featureText(data.data.features)].join(
        '\n',
      ),
    });

    for (const sub of raw.subclasses) {
      if (/^XGE\./.test(sub.anchor)) continue;
      const key = `${classSlug}/${sub.anchor}`;
      const name = names[key];
      if (!name) {
        stats.failedSubclasses += 1;
        issue(
          'error',
          `«${sub.nameRu}» (${key}): нет английского названия (data/reviewed/character/subclasses.json)`,
        );
        continue;
      }
      usedNames.add(key);
      const id = subclassIdOf(key, name);
      const source = sub.sourceTitle ? sources.fromTitle(sub.sourceTitle) : classSource;
      if (!source) {
        stats.failedSubclasses += 1;
        issue('error', `«${sub.nameRu}»: неизвестный источник «${sub.sourceTitle}»`, id);
        continue;
      }
      let subNormalized;
      try {
        subNormalized = normalizeSubclass(sub, classId as ClassId, lookup);
      } catch (error) {
        stats.failedSubclasses += 1;
        issue(
          'error',
          `«${sub.nameRu}»: ${error instanceof ClassNormalizeError ? error.message : String(error)}`,
          id,
        );
        continue;
      }
      const subData = subclassDataSchema.safeParse(subNormalized.data);
      const subRules = subclassRulesSchema.safeParse(subNormalized.rules);
      if (!subData.success || !subRules.success) {
        stats.failedSubclasses += 1;
        const error = !subData.success ? subData.error : subRules.success ? null : subRules.error;
        issue(
          'error',
          `«${sub.nameRu}»: не прошёл схему: ${error ? z.prettifyError(error) : ''}`,
          id,
        );
        continue;
      }
      for (const missing of subNormalized.missingSpells) {
        issue('warning', `«${sub.nameRu}»: заклинания ${missing} нет в каталоге`, id);
      }
      const sr = subRules.data;
      stats.subclasses += 1;
      stats.subclassFeatures += subData.data.features.length;
      stats.spellLists += sr.spellLists.length;
      entities.push({
        id,
        category: 'subclass',
        nameRu: sub.nameRu,
        nameEn: name.nameEn,
        aliases: [],
        edition: '5e_2014',
        reviewStatus: 'parsed',
        automation: 'assisted',
        schemaVersion: subData.data.schemaVersion,
        data: subData.data,
        rules: sr,
        sources: [{ source, dndsuId: page.id, url: `${page.url}#${sub.anchor}` }],
        links: unique([
          { toId: classId, kind: 'subclass_of' },
          ...sr.spellLists.flatMap((list) =>
            list.rows.flatMap((row) =>
              row.spellIds.map((toId) => ({ toId, kind: 'subclass_spell' as const })),
            ),
          ),
        ]),
        searchBody: [
          textBlocksToPlain(subData.data.intro),
          ...featureText(subData.data.features),
        ].join('\n'),
      });
    }
  }
  if (options.reportUnusedNames) {
    for (const key of Object.keys(names)) {
      if (!usedNames.has(key)) {
        issues.push({
          severity: 'warning',
          entityId: null,
          dndsuId: null,
          field: 'reviewed',
          message: `subclasses.json: «${key}» не встретился на страницах`,
        });
      }
    }
  }
  return { entities, stats };
}
