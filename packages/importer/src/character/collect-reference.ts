import fs from 'node:fs';
import path from 'node:path';
import {
  ABILITIES,
  conditionDataSchema,
  languageDataSchema,
  SKILLS,
  skillDataSchema,
  slugFromName,
  textBlocksToPlain,
  type LanguageData,
} from '@koster/shared';
import { z } from 'zod';
import type { CatalogEntity } from '../build/catalog-entity.ts';
import type { ArticleCache } from '../dndsu/article-cache.ts';
import { ItemSources } from '../items/sources.ts';
import type { ImportIssue } from '../report/issues.ts';
import { nameKey } from '../reviewed/reviewed-items.ts';
import type { NormalizedSource } from '../spells/normalize-spell.ts';
import {
  parseConditionsArticle,
  parseLanguagesArticle,
  parseSkillsArticle,
  type RawLanguage,
} from './parse-reference.ts';

// Шаги normalize → validate (раздел 6) для навыков, языков и состояний: статьи 468,
// 209 и 27 кэша reference/. Английские названия языков и состояний — вручную
// (data/reviewed/character/names.json, как Р62): на сайте их нет, а ID строится по ним.

const ARTICLES = { skills: 468, languages: 209, conditions: 27 } as const;

const namesFileSchema = z.strictObject({
  $comment: z.string().optional(),
  languages: z.record(z.string().min(1), z.string().min(1)),
  conditions: z.record(z.string().min(1), z.string().min(1)),
  /**
   * Английские названия предысторий и черт по номеру страницы: нет на странице («Адаптация
   * предысторий VRGR») или на сайте не как в книге («Embar of the fire giant», Р80).
   */
  backgrounds: z.record(z.string().regex(/^\d+$/), z.string().min(1)),
  feats: z.record(z.string().regex(/^\d+$/), z.string().min(1)),
});

export interface ReferenceNames {
  languages: Map<string, string>;
  conditions: Map<string, string>;
  backgrounds: Map<number, string>;
  feats: Map<number, string>;
}

const byPage = (record: Record<string, string>) =>
  new Map(Object.entries(record).map(([page, en]) => [Number(page), en]));

export function loadReferenceNames(folder: string): ReferenceNames {
  const file = path.join(folder, 'names.json');
  const parsed = namesFileSchema.parse(JSON.parse(fs.readFileSync(file, 'utf8')));
  const toMap = (record: Record<string, string>) =>
    new Map(Object.entries(record).map(([ru, en]) => [nameKey(ru), en]));
  return {
    languages: toMap(parsed.languages),
    conditions: toMap(parsed.conditions),
    backgrounds: byPage(parsed.backgrounds),
    feats: byPage(parsed.feats),
  };
}

export interface ReferenceCollectStats {
  skills: number;
  languages: number;
  conditions: number;
}

type Entity = Extract<CatalogEntity, { category: 'skill' | 'language' | 'condition' }>;

/** «ОБЫЧНЫЕ ЯЗЫКИ» → обычный язык PHB; «ЭКЗОТИЧЕСКИЕ Mordenkainen’s Tome of Foes» → экзотический MTF. */
function tableKind(heading: string): { kind: LanguageData['kind']; bookTitle: string | null } {
  const match = /^(ОБЫЧНЫЕ|ЭКЗОТИЧЕСКИЕ|ЯЗЫКИ)\s*(.*)$/.exec(heading.trim());
  const word = match?.[1] ?? '';
  const rest = (match?.[2] ?? '').trim();
  const kind = word === 'ОБЫЧНЫЕ' ? 'standard' : word === 'ЭКЗОТИЧЕСКИЕ' ? 'exotic' : null;
  return { kind, bookTitle: rest && rest !== 'ЯЗЫКИ' ? rest : null };
}

export function collectReference(
  cache: ArticleCache,
  names: ReferenceNames,
  issues: ImportIssue[],
  options: { knownSources: NormalizedSource[] },
): { entities: Entity[]; stats: ReferenceCollectStats } {
  const sources = new ItemSources(options.knownSources);
  const entities: Entity[] = [];
  const stats: ReferenceCollectStats = { skills: 0, languages: 0, conditions: 0 };
  const pageOf = (id: number) => cache.list.pages.find((page) => page.id === id);
  const phb = sources.fromTitle("Player's Handbook");
  if (!phb) throw new Error('Книга PH14 не найдена в справочнике книг');

  const read = (id: number): string | null => {
    const html = cache.readPage(id);
    if (html === null) {
      issues.push({
        severity: 'error',
        entityId: null,
        dndsuId: id,
        field: 'page',
        message: `Статьи нет в кэше (${pageOf(id)?.url ?? id}); скачать: npm run catalog:fetch -- --character`,
      });
    }
    return html;
  };
  const sourceRow = (id: number, source: NormalizedSource) => ({
    source,
    dndsuId: id,
    url: pageOf(id)?.url ?? null,
  });
  const fail = (entityId: string | null, dndsuId: number, message: string) =>
    issues.push({ severity: 'error', entityId, dndsuId, field: 'data', message });

  // Навыки.
  const skillsHtml = read(ARTICLES.skills);
  for (const raw of skillsHtml ? parseSkillsArticle(skillsHtml) : []) {
    const known = SKILLS.find((skill) => skill.id === raw.code);
    const ability = ABILITIES.find((entry) => entry.nameRu === raw.abilityRu);
    const id = `skill:${raw.code.replace(/_/g, '-')}`;
    if (!known || !ability) {
      fail(id, ARTICLES.skills, `Навык «${raw.nameRu}» (${raw.code}, ${raw.abilityRu}) не опознан`);
      continue;
    }
    const data = skillDataSchema.safeParse({
      schemaVersion: 'skill/v1',
      ability: ability.id,
      description: raw.description,
    });
    if (!data.success) {
      fail(id, ARTICLES.skills, `навык не прошёл схему skill/v1: ${z.prettifyError(data.error)}`);
      continue;
    }
    if (raw.description.length === 0) {
      issues.push({
        severity: 'warning',
        entityId: id,
        dndsuId: ARTICLES.skills,
        field: 'description',
        message: 'Описание навыка не найдено',
      });
    }
    entities.push({
      id,
      category: 'skill',
      nameRu: raw.nameRu,
      nameEn: known.nameEn,
      aliases: [],
      edition: '5e_2014',
      reviewStatus: 'parsed',
      automation: 'full',
      schemaVersion: data.data.schemaVersion,
      data: data.data,
      rules: null,
      sources: [sourceRow(ARTICLES.skills, phb)],
      links: [],
      searchBody: `${ability.nameRu}. ${textBlocksToPlain(data.data.description)}`,
    });
    stats.skills += 1;
  }

  // Языки: повтор в таблице другой книги (Великаний в GGR) — тот же язык с другой письменностью.
  const languagesHtml = read(ARTICLES.languages);
  const parsed = languagesHtml ? parseLanguagesArticle(languagesHtml) : null;
  const languages = new Map<
    string,
    { raw: RawLanguage; data: LanguageData; sources: NormalizedSource[]; nameEn: string }
  >();
  for (const raw of parsed?.languages ?? []) {
    const { kind, bookTitle } = tableKind(raw.table);
    const source = bookTitle ? sources.fromTitle(bookTitle) : phb;
    const nameEn = names.languages.get(nameKey(raw.nameRu));
    if (!source || !nameEn) {
      fail(
        null,
        ARTICLES.languages,
        !source
          ? `Языки «${raw.table}»: книга «${bookTitle}» не известна (items/sources.ts)`
          : `Язык «${raw.nameRu}»: нет английского названия в data/reviewed/character/names.json`,
      );
      continue;
    }
    const id = `language:${slugFromName(nameEn)}`;
    const script = { script: raw.script, source: source.code };
    const existing = languages.get(id);
    if (existing) {
      existing.data.scripts.push(script);
      if (!existing.sources.includes(source)) existing.sources.push(source);
      existing.data.description.push(...raw.description);
      continue;
    }
    languages.set(id, {
      raw,
      nameEn,
      sources: [source],
      data: {
        schemaVersion: 'language/v1',
        kind,
        typicalSpeakers: raw.typicalSpeakers,
        scripts: [script],
        dialectOf: null,
        description: raw.description,
      },
    });
  }
  for (const dialect of parsed?.dialects ?? []) {
    const parent = [...languages.entries()].find(
      ([, language]) => nameKey(language.raw.nameRu) === nameKey(dialect.parentRu),
    );
    const nameEn = names.languages.get(nameKey(dialect.nameRu));
    if (!parent || !nameEn) {
      fail(
        null,
        ARTICLES.languages,
        `Диалект «${dialect.nameRu}» (${dialect.parentRu}) не опознан`,
      );
      continue;
    }
    const [parentId, parentLanguage] = parent;
    languages.set(`language:${slugFromName(nameEn)}`, {
      raw: { ...parentLanguage.raw, nameRu: dialect.nameRu },
      nameEn,
      sources: [phb],
      data: {
        schemaVersion: 'language/v1',
        kind: parentLanguage.data.kind,
        typicalSpeakers: null,
        scripts: [parentLanguage.data.scripts[0] ?? { script: null, source: phb.code }],
        dialectOf: parentId,
        description: [{ type: 'paragraph', text: dialect.sentence }],
      },
    });
  }
  for (const [id, language] of languages) {
    const data = languageDataSchema.safeParse(language.data);
    if (!data.success) {
      fail(
        id,
        ARTICLES.languages,
        `язык не прошёл схему language/v1: ${z.prettifyError(data.error)}`,
      );
      continue;
    }
    entities.push({
      id,
      category: 'language',
      nameRu: language.raw.nameRu.replace(/^язык /, 'Язык '),
      nameEn: language.nameEn,
      aliases: [],
      edition: '5e_2014',
      reviewStatus: 'parsed',
      automation: 'full',
      schemaVersion: data.data.schemaVersion,
      data: data.data,
      rules: null,
      sources: language.sources.map((source) => sourceRow(ARTICLES.languages, source)),
      links: data.data.dialectOf ? [{ toId: data.data.dialectOf, kind: 'dialect_of' }] : [],
      searchBody: [
        data.data.typicalSpeakers,
        ...data.data.scripts.map((entry) => entry.script),
        textBlocksToPlain(data.data.description),
      ]
        .filter((part) => part)
        .join('\n'),
    });
    stats.languages += 1;
  }

  // Состояния.
  const conditionsHtml = read(ARTICLES.conditions);
  for (const raw of conditionsHtml ? parseConditionsArticle(conditionsHtml) : []) {
    const nameEn = names.conditions.get(nameKey(raw.nameRu));
    if (!nameEn) {
      fail(null, ARTICLES.conditions, `Состояние «${raw.nameRu}»: нет английского названия`);
      continue;
    }
    const id = `condition:${slugFromName(nameEn)}`;
    const data = conditionDataSchema.safeParse({
      schemaVersion: 'condition/v1',
      description: raw.description,
    });
    if (!data.success) {
      fail(id, ARTICLES.conditions, `состояние не прошло схему: ${z.prettifyError(data.error)}`);
      continue;
    }
    // «Сбитый с ног / Лежащий ничком»: первое — название, второе — синоним для поиска.
    const [nameRu = raw.nameRu, ...aliases] = raw.nameRu.split(/\s*\/\s*/);
    entities.push({
      id,
      category: 'condition',
      nameRu,
      nameEn,
      aliases,
      edition: '5e_2014',
      reviewStatus: 'parsed',
      automation: 'display_only',
      schemaVersion: data.data.schemaVersion,
      data: data.data,
      rules: null,
      sources: [sourceRow(ARTICLES.conditions, phb)],
      links: [],
      searchBody: textBlocksToPlain(data.data.description),
    });
    stats.conditions += 1;
  }

  return { entities, stats };
}

const removedFileSchema = z.strictObject({
  $comment: z.string().optional(),
  ids: z.array(z.string().regex(/^[a-z]+:[a-z0-9-]+$/)),
});

/** ID, убранные до релиза (data/reviewed/character/removed-ids.json, Р80). */
export function loadRemovedIds(folder: string): Set<string> {
  const file = path.join(folder, 'removed-ids.json');
  if (!fs.existsSync(file)) return new Set();
  return new Set(removedFileSchema.parse(JSON.parse(fs.readFileSync(file, 'utf8'))).ids);
}
