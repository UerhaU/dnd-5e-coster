import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { catalogSchema, openCatalogReadOnly, readCatalogInfo } from '@koster/db';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { ImportIssue } from '../report/issues.ts';
import type { CatalogEntity } from './catalog-entity.ts';
import { writeCatalog, type WriteOptions } from './write-catalog.ts';

// Запись каталога на двух условных объектах (раздел 9: только временные базы).

let folder: string;
let outFile: string;

beforeEach(() => {
  folder = fs.mkdtempSync(path.join(os.tmpdir(), 'koster-write-'));
  outFile = path.join(folder, 'catalog.db');
});

afterEach(() => {
  fs.rmSync(folder, { recursive: true, force: true });
});

const source = {
  id: 'ph14',
  code: 'PH14',
  nameEn: "Player's Handbook",
  dndsuSourceId: null,
  edition: '5e_2014' as const,
};

function condition(id: string, extra: Partial<CatalogEntity> = {}): CatalogEntity {
  return {
    id,
    category: 'condition',
    nameRu: id,
    nameEn: id,
    aliases: [],
    edition: '5e_2014',
    reviewStatus: 'parsed',
    automation: 'display_only',
    schemaVersion: 'condition/v1',
    data: { blocks: [] } as unknown as Extract<CatalogEntity, { category: 'condition' }>['data'],
    rules: null,
    sources: [{ source, dndsuId: null, url: null }],
    links: [],
    searchBody: '',
    ...extra,
  } as CatalogEntity;
}

function write(entities: CatalogEntity[], extra: Partial<WriteOptions> = {}) {
  const issues: ImportIssue[] = [];
  const result = writeCatalog(
    {
      entities,
      outFile,
      previousFile: outFile,
      ledger: null,
      importerVersion: 'test',
      builtAt: '2026-10-29T10:00:00.000Z',
      sourceInfo: {},
      ...extra,
    },
    issues,
  );
  return { ...result, issues };
}

const version = () => {
  const catalog = openCatalogReadOnly(outFile);
  try {
    return readCatalogInfo(catalog)['catalog_version'];
  } finally {
    catalog.close();
  }
};

describe('writeCatalog: версия каталога (Р80)', () => {
  it('те же объекты — версия прежняя; изменились только связи или название — версия растёт', () => {
    write([condition('condition:a'), condition('condition:b')]);
    expect(version()).toBe('1');
    write([condition('condition:a'), condition('condition:b')]);
    expect(version()).toBe('1');

    const linked = write([
      condition('condition:a', { links: [{ toId: 'condition:b', kind: 'prerequisite' }] }),
      condition('condition:b'),
    ]);
    expect(linked.stats.newRevisions).toBe(0);
    expect(version()).toBe('2');

    const renamed = write([
      condition('condition:a', {
        nameEn: 'A',
        links: [{ toId: 'condition:b', kind: 'prerequisite' }],
      }),
      condition('condition:b'),
    ]);
    expect(renamed.stats.newRevisions).toBe(0);
    expect(version()).toBe('3');
  });

  it('убранный до релиза ID — не withdrawn: нет ни объекта, ни ревизий, ни строк журнала', () => {
    write([condition('condition:a'), condition('condition:old')]);
    const result = write([condition('condition:a'), condition('condition:new')], {
      removedIds: new Set(['condition:old']),
    });
    expect(result.stats.withdrawn).toBe(0);
    expect(result.ledger.revisions.map((row) => row.entityId).sort()).toEqual([
      'condition:a',
      'condition:new',
    ]);
    const catalog = openCatalogReadOnly(outFile);
    try {
      const { contentEntities, contentRevisions } = catalogSchema;
      const ids = catalog.db
        .select()
        .from(contentEntities)
        .all()
        .map((row) => row.id);
      expect(ids.sort()).toEqual(['condition:a', 'condition:new']);
      const revisions = catalog.db.select().from(contentRevisions).all();
      expect(revisions.some((row) => row.entityId === 'condition:old')).toBe(false);
    } finally {
      catalog.close();
    }
  });

  it('прошлый источник без объектов (сменился код книги) не переносится', () => {
    write([
      condition('condition:a', {
        sources: [{ source: { ...source, id: 'bgg', code: 'BGG' }, dndsuId: null, url: null }],
      }),
    ]);
    write([
      condition('condition:a', {
        sources: [{ source: { ...source, id: 'bpgg', code: 'BPGG' }, dndsuId: null, url: null }],
      }),
    ]);
    const catalog = openCatalogReadOnly(outFile);
    try {
      const codes = catalog.db
        .select()
        .from(catalogSchema.sources)
        .all()
        .map((row) => row.code);
      expect(codes).toEqual(['BPGG']);
    } finally {
      catalog.close();
    }
  });
});
