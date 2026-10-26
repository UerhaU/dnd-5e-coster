import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { catalogSchema, openCatalogReadOnly, readCatalogInfo } from '@koster/db';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { DEFAULT_PATHS } from '../paths.ts';
import { buildCatalog, type BuildOptions } from './build-catalog.ts';

// Сборка на копии тестового кэша во временной папке (раздел 9: только временные базы).

let folder: string;
let cacheDir: string;
let outFile: string;

beforeEach(() => {
  folder = fs.mkdtempSync(path.join(os.tmpdir(), 'koster-build-'));
  cacheDir = path.join(folder, 'cache');
  fs.cpSync(DEFAULT_PATHS.spellFixtures, cacheDir, { recursive: true });
  outFile = path.join(folder, 'catalog.db');
});

afterEach(() => {
  fs.rmSync(folder, { recursive: true, force: true });
});

function build(overrides: Partial<BuildOptions> = {}) {
  return buildCatalog({
    cacheDir,
    reviewedDir: DEFAULT_PATHS.reviewedSpells,
    outFile,
    previousFile: outFile,
    sourceKind: 'fixtures',
    now: new Date('2026-10-27T10:00:00Z'),
    ...overrides,
  });
}

function read<T>(query: (catalog: ReturnType<typeof openCatalogReadOnly>) => T): T {
  const catalog = openCatalogReadOnly(outFile);
  try {
    return query(catalog);
  } finally {
    catalog.close();
  }
}

const { contentEntities, contentRevisions, sources, spellIndexClasses } = catalogSchema;
const pageCount = () => fs.readdirSync(path.join(DEFAULT_PATHS.spellFixtures, 'pages')).length;

describe('npm run catalog:build', () => {
  it('собирает каталог: объекты, ревизии, источники без дублей, поиск', () => {
    const result = build();

    expect(result.issues.filter((issue) => issue.severity === 'error')).toEqual([]);
    expect(result.write).toMatchObject({ added: pageCount(), newRevisions: pageCount() });
    read((catalog) => {
      const entities = catalog.db.select().from(contentEntities).all();
      expect(entities).toHaveLength(pageCount());
      expect(entities.find((entity) => entity.id === 'spell:fireball')).toMatchObject({
        reviewStatus: 'rules_verified',
        automation: 'assisted',
      });
      expect(entities.find((entity) => entity.id === 'spell:feather-fall')).toMatchObject({
        reviewStatus: 'parsed',
        automation: 'display_only',
      });

      const codes = catalog.db
        .select()
        .from(sources)
        .all()
        .map((row) => row.code);
      expect(new Set(codes).size).toBe(codes.length);

      const bard = catalog.db.select().from(spellIndexClasses).all();
      expect(bard).toContainEqual({
        entityId: 'spell:antipathy-sympathy',
        classId: 'class:bard',
        access: 'optional',
      });

      const found = catalog.sqlite
        .prepare(
          "SELECT entity_id FROM content_search WHERE content_search MATCH 'name_ru: огнен*'",
        )
        .all();
      expect(found).toContainEqual({ entity_id: 'spell:fireball' });
      expect(readCatalogInfo(catalog)).toMatchObject({ catalog_version: '1' });
    });
  });

  it('проверенные правила и состав материалов из data/reviewed попадают в ревизию', () => {
    build();

    const revision = read((catalog) =>
      catalog.db
        .select()
        .from(contentRevisions)
        .all()
        .find((row) => row.entityId === 'spell:fireball'),
    );
    const data = JSON.parse(revision?.dataJson ?? '{}');
    expect(data.components.material.recipe.kind).toBe('all');
    expect(JSON.parse(revision?.rulesJson ?? '{}').effects[0]).toMatchObject({
      type: 'damage',
      dice: '8d6',
    });
  });

  it('повторная сборка на тех же данных: 0 новых ревизий, версия и дата прежние', () => {
    build();
    const before = read((catalog) => readCatalogInfo(catalog));

    const again = build({ now: new Date('2026-10-28T10:00:00Z') });

    expect(again.write).toMatchObject({ added: 0, changed: 0, newRevisions: 0 });
    expect(again.write.revisionsTotal).toBe(pageCount());
    expect(read((catalog) => readCatalogInfo(catalog))).toEqual(before);
  });

  it('изменившийся объект получает новую ревизию, старая не меняется (Р21)', () => {
    build();
    const oldRevisions = read((catalog) => catalog.db.select().from(contentRevisions).all());

    const page = path.join(cacheDir, 'pages', 'spell-205.html');
    fs.writeFileSync(page, fs.readFileSync(page, 'utf8').replace('150 футов', '160 футов'));
    const result = build({ now: new Date('2026-10-28T10:00:00Z') });

    expect(result.write).toMatchObject({ changed: 1, unchanged: pageCount() - 1, newRevisions: 1 });
    read((catalog) => {
      const revisions = catalog.db.select().from(contentRevisions).all();
      for (const old of oldRevisions) {
        expect(revisions).toContainEqual(old);
      }
      const fireball = catalog.db
        .select()
        .from(contentEntities)
        .all()
        .find((e) => e.id === 'spell:fireball');
      const current = revisions.find((row) => row.id === fireball?.currentRevisionId);
      expect(current).toMatchObject({ revision: 2, createdAt: '2026-10-28T10:00:00.000Z' });
      expect(JSON.parse(current?.dataJson ?? '{}').range.feet).toBe(160);
      expect(readCatalogInfo(catalog)['catalog_version']).toBe('2');
    });
  });

  it('пропавший из источника объект остаётся с ревизиями и пометкой withdrawn', () => {
    build();
    const listFile = path.join(cacheDir, 'index.json');
    const list = JSON.parse(fs.readFileSync(listFile, 'utf8'));
    list.cards = list.cards.filter((card: { siteId: number }) => card.siteId !== 223);
    fs.writeFileSync(listFile, JSON.stringify(list));

    const result = build();

    expect(result.write.withdrawn).toBe(1);
    read((catalog) => {
      const entity = catalog.db
        .select()
        .from(contentEntities)
        .all()
        .find((e) => e.id === 'spell:feather-fall');
      expect(entity?.withdrawn).toBe(true);
      const revisions = catalog.db.select().from(contentRevisions).all();
      expect(revisions.some((row) => row.id === entity?.currentRevisionId)).toBe(true);
    });
  });

  it('ошибка одной страницы не останавливает сборку и попадает в отчёт', () => {
    fs.writeFileSync(path.join(cacheDir, 'pages', 'spell-205.html'), '<html>сломано</html>');
    fs.rmSync(path.join(cacheDir, 'pages', 'spell-1.html'));

    const result = build({ previousFile: null });

    expect(result.collect).toMatchObject({ failed: 1, missingPages: 1 });
    expect(result.write.entities).toBe(pageCount() - 2);
    const errors = result.issues.filter((issue) => issue.severity === 'error');
    expect(errors.map((issue) => [issue.dndsuId, issue.field])).toEqual([
      [1, 'page'],
      [205, 'page'],
      // Исправление Огненного шара осталось без страницы — тоже ошибка, а не тишина.
      [205, 'reviewed'],
    ]);
  });
});
