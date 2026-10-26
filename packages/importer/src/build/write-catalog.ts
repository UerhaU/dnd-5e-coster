import fs from 'node:fs';
import {
  catalogSchema,
  createCatalog,
  normalizeSearchText,
  openCatalogReadOnly,
  readCatalogInfo,
} from '@koster/db';
import type { ImportIssue } from '../report/issues.ts';
import { canonicalJson, sha256 } from './canonical-json.ts';
import type { CatalogEntity } from './collect-spells.ts';

// Шаг build (раздел 6): новый catalog.db из собранных объектов.
// Ревизии прошлой сборки переносятся без изменений (Р21); новая ревизия
// появляется, только если данные или правила объекта изменились.

const {
  catalogInfo,
  contentEntities,
  contentRevisions,
  entitySources,
  sources,
  spellIndex,
  spellIndexClasses,
} = catalogSchema;

type EntityRow = typeof contentEntities.$inferSelect;
type RevisionRow = typeof contentRevisions.$inferSelect;
type SourceRow = typeof sources.$inferSelect;
type EntitySourceRow = typeof entitySources.$inferSelect;

interface PreviousCatalog {
  entities: Map<string, EntityRow>;
  revisions: RevisionRow[];
  sources: SourceRow[];
  entitySources: EntitySourceRow[];
  info: Record<string, string>;
}

function readPrevious(file: string | null): PreviousCatalog | null {
  if (!file || !fs.existsSync(file)) {
    return null;
  }
  const catalog = openCatalogReadOnly(file);
  try {
    return {
      entities: new Map(
        catalog.db
          .select()
          .from(contentEntities)
          .all()
          .map((row) => [row.id, row]),
      ),
      revisions: catalog.db.select().from(contentRevisions).orderBy(contentRevisions.id).all(),
      sources: catalog.db.select().from(sources).all(),
      entitySources: catalog.db.select().from(entitySources).all(),
      info: readCatalogInfo(catalog),
    };
  } finally {
    catalog.close();
  }
}

export interface WriteOptions {
  entities: CatalogEntity[];
  outFile: string;
  /** Прошлая сборка, из которой переносятся ревизии; `null` — собрать с нуля. */
  previousFile: string | null;
  importerVersion: string;
  /** Дата сборки (ISO). */
  builtAt: string;
  /** Дополнительные строки catalog_info: откуда данные. */
  sourceInfo: Record<string, string>;
}

export interface WriteStats {
  entities: number;
  added: number;
  changed: number;
  unchanged: number;
  withdrawn: number;
  newRevisions: number;
  revisionsTotal: number;
  catalogVersion: number;
  previousFound: boolean;
}

export function writeCatalog(options: WriteOptions, issues: ImportIssue[]): WriteStats {
  const previous = readPrevious(options.previousFile);
  const latest = new Map<string, RevisionRow>();
  for (const revision of previous?.revisions ?? []) {
    const known = latest.get(revision.entityId);
    if (!known || known.revision < revision.revision) {
      latest.set(revision.entityId, revision);
    }
  }

  const stats: WriteStats = {
    entities: options.entities.length,
    added: 0,
    changed: 0,
    unchanged: 0,
    withdrawn: 0,
    newRevisions: 0,
    revisionsTotal: 0,
    catalogVersion: 1,
    previousFound: previous !== null,
  };

  // Ревизии: сначала все прошлые как есть, потом новые с продолжением нумерации.
  const revisions: RevisionRow[] = [...(previous?.revisions ?? [])];
  let nextRevisionId = Math.max(0, ...revisions.map((row) => row.id)) + 1;
  const currentRevision = new Map<string, number>();

  const entities = [...options.entities].sort((a, b) => (a.id < b.id ? -1 : 1));
  for (const entity of entities) {
    const dataJson = canonicalJson(entity.data);
    const rulesJson = entity.rules ? canonicalJson(entity.rules) : null;
    const contentHash = sha256(`${dataJson}\n${rulesJson ?? ''}`);
    const last = latest.get(entity.id);

    if (last?.contentHash === contentHash) {
      stats.unchanged += 1;
      currentRevision.set(entity.id, last.id);
      continue;
    }
    if (last) {
      stats.changed += 1;
    } else {
      stats.added += 1;
    }
    const row: RevisionRow = {
      id: nextRevisionId,
      entityId: entity.id,
      revision: (last?.revision ?? 0) + 1,
      schemaVersion: entity.schemaVersion,
      dataJson,
      rulesJson,
      contentHash,
      importerVersion: options.importerVersion,
      createdAt: options.builtAt,
    };
    nextRevisionId += 1;
    revisions.push(row);
    currentRevision.set(entity.id, row.id);
    stats.newRevisions += 1;
  }

  const currentIds = new Set(entities.map((entity) => entity.id));
  const withdrawn = [...(previous?.entities.values() ?? [])].filter(
    (row) => !currentIds.has(row.id),
  );
  for (const row of withdrawn) {
    if (!row.withdrawn) {
      stats.withdrawn += 1;
      issues.push({
        severity: 'warning',
        entityId: row.id,
        dndsuId: null,
        field: 'entity',
        message: 'Объект пропал из источника: помечен withdrawn, ревизии сохранены',
      });
    }
  }
  stats.revisionsTotal = revisions.length;

  const changedSomething = stats.newRevisions > 0 || stats.withdrawn > 0 || previous === null;
  const previousVersion = Number(previous?.info['catalog_version'] ?? 0);
  stats.catalogVersion = changedSomething ? previousVersion + 1 : previousVersion;
  const builtAt = changedSomething
    ? options.builtAt
    : (previous?.info['built_at'] ?? options.builtAt);

  const temp = `${options.outFile}.building`;
  fs.rmSync(temp, { force: true });
  const catalog = createCatalog(temp);
  try {
    catalog.db.transaction((tx) => {
      // Источники: текущие и те, на которые ссылаются снятые объекты.
      const sourceRows = new Map<string, SourceRow>();
      for (const row of previous?.sources ?? []) {
        sourceRows.set(row.id, row);
      }
      const seenNow = new Set<string>();
      for (const entity of entities) {
        for (const { source } of entity.sources) {
          const row: SourceRow = {
            id: source.id,
            code: source.code,
            nameRu: null,
            nameEn: source.nameEn,
            dndsuSourceId: source.dndsuSourceId,
            edition: source.edition,
          };
          const known = sourceRows.get(row.id);
          if (known && seenNow.has(row.id) && canonicalJson(known) !== canonicalJson(row)) {
            issues.push({
              severity: 'warning',
              entityId: entity.id,
              dndsuId: null,
              field: 'sources',
              message: `Источник ${row.code} описан по-разному: «${known.nameEn}» и «${row.nameEn}»`,
            });
          }
          sourceRows.set(row.id, row);
          seenNow.add(row.id);
        }
      }
      if (sourceRows.size > 0) {
        tx.insert(sources)
          .values([...sourceRows.values()])
          .run();
      }

      for (const entity of entities) {
        tx.insert(contentEntities)
          .values({
            id: entity.id,
            category: entity.category,
            nameRu: entity.nameRu,
            nameEn: entity.nameEn,
            aliases: JSON.stringify(entity.aliases),
            edition: entity.edition,
            currentRevisionId: currentRevision.get(entity.id) ?? 0,
            reviewStatus: entity.reviewStatus,
            automation: entity.automation,
            withdrawn: false,
          })
          .run();
      }
      for (const row of withdrawn) {
        tx.insert(contentEntities)
          .values({ ...row, withdrawn: true })
          .run();
      }
      for (const row of revisions) {
        tx.insert(contentRevisions).values(row).run();
      }

      for (const entity of entities) {
        for (const { source, dndsuId, url } of entity.sources) {
          tx.insert(entitySources)
            .values({ entityId: entity.id, sourceId: source.id, dndsuId, url })
            .run();
        }
        tx.insert(spellIndex)
          .values({
            entityId: entity.id,
            level: entity.data.level,
            schoolId: entity.data.school,
            ritual: entity.data.ritual,
            concentration: entity.data.concentration,
          })
          .run();
        const classes = [
          ...entity.data.classes.map((classId) => ({ classId, access: 'standard' })),
          ...entity.data.optionalClasses
            .filter((classId) => !entity.data.classes.includes(classId))
            .map((classId) => ({ classId, access: 'optional' })),
        ];
        for (const entry of classes) {
          tx.insert(spellIndexClasses)
            .values({ entityId: entity.id, ...entry })
            .run();
        }
      }
      for (const row of previous?.entitySources ?? []) {
        if (!currentIds.has(row.entityId)) {
          tx.insert(entitySources).values(row).run();
        }
      }

      const search = catalog.sqlite.prepare(
        'INSERT INTO content_search (entity_id, category, name_ru, name_en, aliases, body) VALUES (?, ?, ?, ?, ?, ?)',
      );
      for (const entity of entities) {
        search.run(
          entity.id,
          entity.category,
          normalizeSearchText(entity.nameRu),
          normalizeSearchText(entity.nameEn),
          normalizeSearchText(entity.aliases.join('\n')),
          normalizeSearchText(entity.searchBody),
        );
      }

      const contentHash = sha256(
        [...currentRevision.entries()]
          .sort(([a], [b]) => (a < b ? -1 : 1))
          .map(([id, revisionId]) => `${id}@${revisionId}`)
          .concat(withdrawn.map((row) => `${row.id}:withdrawn`).sort())
          .join('\n'),
      );
      const info: Record<string, string> = {
        ...options.sourceInfo,
        catalog_version: String(stats.catalogVersion),
        content_hash: contentHash,
        built_at: builtAt,
        importer_version: options.importerVersion,
      };
      tx.insert(catalogInfo)
        .values(Object.entries(info).map(([key, value]) => ({ key, value })))
        .run();
    });

    const broken = catalog.sqlite.pragma('foreign_key_check') as unknown[];
    if (broken.length > 0) {
      throw new Error(`В собранном каталоге нарушены связи: ${broken.length}`);
    }
  } finally {
    catalog.close();
  }

  fs.rmSync(options.outFile, { force: true });
  fs.renameSync(temp, options.outFile);
  return stats;
}
