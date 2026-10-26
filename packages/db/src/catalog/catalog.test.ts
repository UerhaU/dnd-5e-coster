import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createCatalog } from './create.ts';
import { openCatalogReadOnly, readCatalogInfo } from './open.ts';
import { catalogInfo, contentEntities, contentRevisions, magicSchools } from './schema.ts';

let folder: string;
let file: string;

beforeEach(() => {
  folder = fs.mkdtempSync(path.join(os.tmpdir(), 'koster-catalog-'));
  file = path.join(folder, 'catalog.db');
});

afterEach(() => {
  fs.rmSync(folder, { recursive: true, force: true });
});

describe('catalog.db', () => {
  it('создаётся миграциями, справочники заполнены, FTS5 есть', () => {
    const catalog = createCatalog(file);

    expect(catalog.db.select().from(magicSchools).all()).toHaveLength(8);
    const search = catalog.sqlite
      .prepare("SELECT name FROM sqlite_master WHERE name = 'content_search'")
      .get();
    expect(search).toEqual({ name: 'content_search' });
    catalog.close();
  });

  it('открывается только для чтения', () => {
    const catalog = createCatalog(file);
    catalog.db.insert(catalogInfo).values({ key: 'catalog_version', value: 'test' }).run();
    catalog.close();

    const readOnly = openCatalogReadOnly(file);
    expect(readCatalogInfo(readOnly)).toEqual({ catalog_version: 'test' });
    expect(() => readOnly.db.insert(catalogInfo).values({ key: 'x', value: 'y' }).run()).toThrow(
      /readonly/i,
    );
    readOnly.close();
  });

  it('не открывает несуществующий файл', () => {
    expect(() => openCatalogReadOnly(file)).toThrow();
    expect(fs.existsSync(file)).toBe(false);
  });

  it('не даёт сохранить две ревизии с одним номером', () => {
    const catalog = createCatalog(file);
    catalog.db
      .insert(contentEntities)
      .values({
        id: 'spell:test',
        category: 'spell',
        nameRu: 'Тест',
        nameEn: 'Test',
        edition: '5e_2014',
        currentRevisionId: 1,
        reviewStatus: 'parsed',
        automation: 'display_only',
      })
      .run();
    const revision = {
      entityId: 'spell:test',
      revision: 1,
      schemaVersion: 'spell/v1',
      dataJson: '{}',
      contentHash: 'h',
      importerVersion: '1',
      createdAt: '2026-10-27',
    };
    catalog.db.insert(contentRevisions).values(revision).run();

    expect(() => catalog.db.insert(contentRevisions).values(revision).run()).toThrow(/UNIQUE/);
    catalog.close();
  });
});
