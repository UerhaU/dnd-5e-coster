import type { CatalogConnection } from '@koster/db';
import { apiErrorSchema, catalogSearchResponseSchema } from '@koster/shared';
import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createServer } from '../app';
import { openTestCatalog } from '../test/test-catalog';

// Поиск по всему каталогу (Р54) во временном каталоге из data/fixtures.

let catalog: CatalogConnection;
let dispose: () => void;
let server: FastifyInstance;

beforeAll(() => {
  ({ catalog, dispose } = openTestCatalog());
  server = createServer({
    appVersion: '2.0.0-alpha.0',
    sqliteVersion: '3.50.0',
    allowedOrigins: ['app://koster'],
    catalog,
  });
});

afterAll(async () => {
  await server.close();
  dispose();
});

async function search(query: string) {
  const response = await server.inject({ method: 'GET', url: `/api/catalog/search?${query}` });
  expect(response.statusCode).toBe(200);
  return catalogSearchResponseSchema.parse(response.json());
}

describe('GET /api/catalog/search', () => {
  it('находит объекты разных категорий; категория и счётчики по категориям', async () => {
    const result = await search(`q=${encodeURIComponent('щит')}`);
    expect(result.items[0]).toMatchObject({
      id: 'item:shield',
      category: 'item',
      item: { kind: 'shield' },
      spell: null,
      race: null,
    });
    expect(result.items.map((item) => item.category)).toContain('race');
    expect(result.byCategory.reduce((sum, entry) => sum + entry.count, 0)).toBe(result.total);
  });

  it('точное совпадение названия — первым, затем начало названия', async () => {
    const result = await search(`q=${encodeURIComponent('эльф')}`);
    expect(result.items[0]?.id).toBe('race:elf');
    expect(result.items[0]?.race).toEqual({ kind: 'race', variantOfName: null });
    const high = result.items.find((item) => item.id === 'race:high-elf');
    expect(high?.race).toEqual({ kind: 'variant', variantOfName: 'Эльф' });
    const spells = result.items.filter((item) => item.category === 'spell');
    expect(spells.length).toBeGreaterThan(0);
    expect(spells[0]?.spell).toMatchObject({ level: expect.any(Number) });
    // Английское название тоже ищется.
    expect((await search('q=Longsword')).items[0]?.id).toBe('item:longsword');
  });

  it('страницы; запрос из одних знаков — пусто; без q и с лишним параметром — 400', async () => {
    const first = await search(`q=${encodeURIComponent('эльф')}&pageSize=2`);
    const second = await search(`q=${encodeURIComponent('эльф')}&pageSize=2&page=2`);
    expect(first.items).toHaveLength(2);
    expect(second.items[0]?.id).not.toBe(first.items[0]?.id);
    expect((await search('q=%22%2A')).total).toBe(0);
    for (const url of ['/api/catalog/search', '/api/catalog/search?q=a&category=spell']) {
      const response = await server.inject({ method: 'GET', url });
      expect(response.statusCode).toBe(400);
      expect(apiErrorSchema.parse(response.json()).error.code).toBe('bad_request');
    }
  });
});
