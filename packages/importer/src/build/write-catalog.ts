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
import type { CatalogEntity } from './catalog-entity.ts';
import type { Ledger, LedgerRevision } from './ledger.ts';
import { writeItemIndex, writeRaceIndex, writeSpellIndex } from './write-index.ts';

// Шаг build (раздел 6): новый catalog.db из собранных объектов.
// Ревизии прошлой сборки переносятся без изменений (Р21); новая ревизия
// появляется, только если данные или правила объекта изменились.
// Нумерация берётся и из прошлого catalog.db, и из журнала ревизий в git (Р51):
// без прошлого файла неизменившийся объект получает ту же ревизию из журнала.

const { catalogInfo, contentEntities, contentLinks, contentRevisions, entitySources, sources } =
  catalogSchema;

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
  /** Журнал ревизий (Р51); `null` — не использовать (тестовый каталог). */
  ledger: Ledger | null;
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
  /** Ревизий, восстановленных по журналу: прошлого файла не было, данные те же. */
  restoredFromLedger: number;
}

export interface WriteResult {
  stats: WriteStats;
  /** Журнал после сборки: все известные ревизии, включая прошлые. */
  ledger: Ledger;
}

function ledgerEntry(row: RevisionRow): LedgerRevision {
  return {
    revisionId: row.id,
    entityId: row.entityId,
    revision: row.revision,
    contentHash: row.contentHash,
    schemaVersion: row.schemaVersion,
    importerVersion: row.importerVersion,
    createdAt: row.createdAt,
  };
}

/** Все известные ревизии: из прошлого файла (с данными) и из журнала (без данных). */
function knownRevisions(
  previous: PreviousCatalog | null,
  ledger: Ledger | null,
  issues: ImportIssue[],
): Map<number, LedgerRevision> {
  const known = new Map<number, LedgerRevision>();
  for (const row of previous?.revisions ?? []) {
    known.set(row.id, ledgerEntry(row));
  }
  for (const entry of ledger?.revisions ?? []) {
    const fromFile = known.get(entry.revisionId);
    if (!fromFile) {
      known.set(entry.revisionId, entry);
    } else if (canonicalJson(fromFile) !== canonicalJson(entry)) {
      issues.push({
        severity: 'error',
        entityId: entry.entityId,
        dndsuId: null,
        field: 'ledger',
        message: `Ревизия ${entry.revisionId} в журнале не совпадает с прошлым catalog.db: берётся catalog.db`,
      });
    }
  }
  return known;
}

export function writeCatalog(options: WriteOptions, issues: ImportIssue[]): WriteResult {
  const previous = readPrevious(options.previousFile);
  const known = knownRevisions(previous, options.ledger, issues);
  const latest = new Map<string, LedgerRevision>();
  for (const entry of known.values()) {
    const last = latest.get(entry.entityId);
    if (!last || last.revision < entry.revision) {
      latest.set(entry.entityId, entry);
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
    restoredFromLedger: 0,
  };

  // Ревизии: сначала все прошлые как есть, потом новые с продолжением нумерации.
  const revisions: RevisionRow[] = [...(previous?.revisions ?? [])];
  const withData = new Set(revisions.map((row) => row.id));
  let nextRevisionId = Math.max(0, ...known.keys()) + 1;
  const currentRevision = new Map<string, number>();

  const entities = [...options.entities].sort((a, b) => (a.id < b.id ? -1 : 1));
  for (const entity of entities) {
    const dataJson = canonicalJson(entity.data);
    const rulesJson = entity.rules ? canonicalJson(entity.rules) : null;
    const contentHash = sha256(`${dataJson}\n${rulesJson ?? ''}`);
    const last = latest.get(entity.id);

    if (last?.contentHash === contentHash) {
      stats.unchanged += 1;
      currentRevision.set(entity.id, last.revisionId);
      if (!withData.has(last.revisionId)) {
        // Хеш тот же — значит, и данные те же: ревизия восстанавливается целиком.
        revisions.push({
          id: last.revisionId,
          entityId: last.entityId,
          revision: last.revision,
          schemaVersion: last.schemaVersion,
          dataJson,
          rulesJson,
          contentHash,
          importerVersion: last.importerVersion,
          createdAt: last.createdAt,
        });
        withData.add(last.revisionId);
        stats.restoredFromLedger += 1;
      }
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
  const present = new Set([...currentIds, ...withdrawn.map((row) => row.id)]);
  for (const entityId of latest.keys()) {
    if (!present.has(entityId)) {
      issues.push({
        severity: 'warning',
        entityId,
        dndsuId: null,
        field: 'ledger',
        message: 'Объект есть только в журнале ревизий: данных нет, в каталог не попал',
      });
    }
  }
  const withoutData = [...known.keys()].filter((id) => !withData.has(id)).length;
  if (withoutData > 0) {
    issues.push({
      severity: 'warning',
      entityId: null,
      dndsuId: null,
      field: 'ledger',
      message: `Прошлых ревизий без данных (есть только в журнале): ${withoutData}. Номера сохранены`,
    });
  }
  stats.revisionsTotal = revisions.length;

  // Без прошлого файла версия и дата берутся из журнала: если ничего не изменилось,
  // восстановленный каталог совпадает с потерянным.
  const previousInfo = previous
    ? { version: Number(previous.info['catalog_version'] ?? 0), builtAt: previous.info['built_at'] }
    : options.ledger?.info
      ? { version: options.ledger.info.catalogVersion, builtAt: options.ledger.info.builtAt }
      : null;
  const changedSomething = stats.newRevisions > 0 || stats.withdrawn > 0 || previousInfo === null;
  const previousVersion = previousInfo?.version ?? 0;
  stats.catalogVersion = changedSomething ? previousVersion + 1 : previousVersion;
  const builtAt = changedSomething ? options.builtAt : (previousInfo?.builtAt ?? options.builtAt);
  let catalogHash = '';

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
        if (entity.category === 'spell') {
          writeSpellIndex(tx, entity);
        } else if (entity.category === 'item') {
          writeItemIndex(tx, entity);
        } else {
          writeRaceIndex(tx, entity);
        }
        for (const link of entity.links) {
          if (!currentIds.has(link.toId)) {
            issues.push({
              severity: 'warning',
              entityId: entity.id,
              dndsuId: null,
              field: 'links',
              message: `Связь ${link.kind} ведёт к ${link.toId}, которого нет в каталоге: не записана`,
            });
            continue;
          }
          tx.insert(contentLinks)
            .values({ fromId: entity.id, toId: link.toId, kind: link.kind })
            .onConflictDoNothing()
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

      catalogHash = sha256(
        [...currentRevision.entries()]
          .sort(([a], [b]) => (a < b ? -1 : 1))
          .map(([id, revisionId]) => `${id}@${revisionId}`)
          .concat(withdrawn.map((row) => `${row.id}:withdrawn`).sort())
          .join('\n'),
      );
      const info: Record<string, string> = {
        ...options.sourceInfo,
        catalog_version: String(stats.catalogVersion),
        content_hash: catalogHash,
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

  const ledgerRevisions = new Map(known);
  for (const row of revisions) {
    ledgerRevisions.set(row.id, ledgerEntry(row));
  }
  return {
    stats,
    ledger: {
      info: { catalogVersion: stats.catalogVersion, contentHash: catalogHash, builtAt },
      revisions: [...ledgerRevisions.values()],
    },
  };
}
